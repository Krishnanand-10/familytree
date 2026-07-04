import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '15mb' })); // Allow large base64 photos

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const DEFAULT_BRANCH_ID = '00000000-0000-0000-0000-000000000000'; // Seed branch from schema.sql

let supabase = null;
if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-supabase-project.supabase.co') {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Global Supabase client initialized.');
} else {
  console.warn('\n⚠️  WARNING: Supabase credentials are not configured in the server/.env file.');
  console.warn('The server will start but endpoints requesting database sync will fail or run in mockup mode.\n');
}

// Middleware to verify JWT and attach user-scoped supabase client
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or invalid.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({ error: 'Database credentials not configured on the server.' });
    }

    // Instantiate a user-specific Supabase client using their JWT
    const userClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    req.user = user;
    req.supabase = userClient;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({ error: 'Authentication failed.' });
  }
};

// Health Check (Public)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    databaseConfigured: !!supabase,
  });
});

// GET: Fetch all family branches (Protected)
app.get('/api/branches', requireAuth, async (req, res) => {
  try {
    // 1. Get branches owned by the user
    const { data: ownedBranches, error: ownedError } = await req.supabase
      .from('family_branches')
      .select('*')
      .eq('user_id', req.user.id);

    // 2. Get branches shared with the user (only ACCEPTED ones appear in the switcher)
    const { data: shares, error: sharesError } = await req.supabase
      .from('branch_shares')
      .select('branch_id, role, family_branches(*)')
      .eq('shared_with_email', req.user.email)
      .eq('status', 'accepted');

    if (ownedError) throw ownedError;
    if (sharesError) throw sharesError;

    // 3. Merge results
    const owned = (ownedBranches || []).map(b => ({ ...b, role: 'owner' }));
    const shared = (shares || [])
      .filter(s => s.family_branches)
      .map(s => ({ ...s.family_branches, role: s.role }));

    const allBranches = [...owned, ...shared];
    
    // Deduplicate (in case user owns and is shared on same branch)
    const uniqueBranches = Array.from(new Map(allBranches.map(b => [b.id, b])).values());

    // Provision default if user has no branches at all
    if (uniqueBranches.length === 0) {
      const emailName = req.user.email ? req.user.email.split('@')[0] : 'My';
      const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      
      const { data: newBranch, error: createError } = await req.supabase
        .from('family_branches')
        .insert({
          name: `${displayName}'s Family Tree`,
          user_id: req.user.id
        })
        .select();

      if (createError) throw createError;
      return res.json(newBranch ? [{ ...newBranch[0], role: 'owner' }] : []);
    }

    res.json(uniqueBranches);
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Upsert a family branch (Protected)
app.post('/api/branches', requireAuth, async (req, res) => {
  const { id, name } = req.body;

  let dbId = id;
  if (dbId === 'default' || dbId === DEFAULT_BRANCH_ID) {
    dbId = undefined; // Supabase will auto-generate a UUID
  }

  try {
    const { data, error } = await req.supabase
      .from('family_branches')
      .upsert({
        ...(dbId ? { id: dbId } : {}),
        name: name || 'Unnamed Tree',
        user_id: req.user.id,
      })
      .select();

    if (error) throw error;
    res.json({ success: true, data: data?.[0] });
  } catch (error) {
    console.error('Error saving branch:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Delete a family branch (Protected)
app.delete('/api/branches/:id', requireAuth, async (req, res) => {
  let branchId = req.params.id;
  if (branchId === 'default') {
    branchId = DEFAULT_BRANCH_ID;
  }

  try {
    const { error } = await req.supabase
      .from('family_branches')
      .delete()
      .eq('id', branchId);

    if (error) throw error;
    res.json({ success: true, message: 'Branch deleted successfully.' });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Fetch all active shares for a branch (Protected)
app.get('/api/branches/:id/shares', requireAuth, async (req, res) => {
  const branchId = req.params.id === 'default' ? DEFAULT_BRANCH_ID : req.params.id;
  try {
    const { data, error } = await req.supabase
      .from('branch_shares')
      .select('*')
      .eq('branch_id', branchId);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching shares:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Share a branch with another user by email (Protected)
app.post('/api/branches/:id/shares', requireAuth, async (req, res) => {
  const branchId = req.params.id === 'default' ? DEFAULT_BRANCH_ID : req.params.id;
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role are required.' });
  }

  try {
    const { data, error } = await req.supabase
      .from('branch_shares')
      .upsert({
        branch_id: branchId,
        shared_with_email: email.trim().toLowerCase(),
        role: role,
        status: 'pending'
      }, {
        onConflict: 'branch_id,shared_with_email'
      })
      .select();

    if (error) throw error;
    res.json({ success: true, data: data?.[0] });
  } catch (error) {
    console.error('Error creating share:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Fetch pending invitations for the logged-in user
app.get('/api/invitations', requireAuth, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('branch_shares')
      .select('id, role, status, branch_id, family_branches(id, name)')
      .eq('shared_with_email', req.user.email)
      .eq('status', 'pending');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Accept an invitation
app.post('/api/invitations/:shareId/accept', requireAuth, async (req, res) => {
  const { shareId } = req.params;
  try {
    const { error } = await req.supabase
      .from('branch_shares')
      .update({ status: 'accepted' })
      .eq('id', shareId)
      .eq('shared_with_email', req.user.email);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Decline an invitation
app.delete('/api/invitations/:shareId', requireAuth, async (req, res) => {
  const { shareId } = req.params;
  try {
    const { error } = await req.supabase
      .from('branch_shares')
      .delete()
      .eq('id', shareId)
      .eq('shared_with_email', req.user.email);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Revoke a share (Protected)
app.delete('/api/branches/:id/shares/:shareId', requireAuth, async (req, res) => {
  const shareId = req.params.shareId;
  try {
    const { error } = await req.supabase
      .from('branch_shares')
      .delete()
      .eq('id', shareId);

    if (error) throw error;
    res.json({ success: true, message: 'Access revoked successfully.' });
  } catch (error) {
    console.error('Error revoking share:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH: Update collaborator role (Protected)
app.patch('/api/branches/:id/shares/:shareId', requireAuth, async (req, res) => {
  const shareId = req.params.shareId;
  const { role } = req.body;
  
  if (!role || !['viewer', 'editor'].includes(role)) {
    return res.status(400).json({ error: 'Valid role is required.' });
  }

  try {
    const { error } = await req.supabase
      .from('branch_shares')
      .update({ role })
      .eq('id', shareId);

    if (error) throw error;
    res.json({ success: true, message: 'Role updated successfully.' });
  } catch (error) {
    console.error('Error updating share role:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Leave a shared tree (collaborator removes themselves)
app.delete('/api/branches/:id/leave', requireAuth, async (req, res) => {
  const branchId = req.params.id === 'default' ? DEFAULT_BRANCH_ID : req.params.id;
  try {
    const { error } = await req.supabase
      .from('branch_shares')
      .delete()
      .eq('branch_id', branchId)
      .eq('shared_with_email', req.user.email);

    if (error) throw error;
    res.json({ success: true, message: 'You have left this shared tree.' });
  } catch (error) {
    console.error('Error leaving branch:', error);
    res.status(500).json({ error: error.message });
  }
});


// GET: Load family tree nodes and edges from Supabase (Protected)
app.get('/api/tree', requireAuth, async (req, res) => {
  let branchId = req.query.branchId || DEFAULT_BRANCH_ID;
  if (branchId === 'default') {
    branchId = DEFAULT_BRANCH_ID;
  }

  try {
    // 1. Fetch people in this branch
    const { data: people, error: peopleError } = await req.supabase
      .from('people')
      .select('*')
      .eq('branch_id', branchId);

    if (peopleError) throw peopleError;

    if (!people || people.length === 0) {
      return res.json({ nodes: [], edges: [] });
    }

    // 2. Fetch relationships for these people
    const personIds = people.map(p => p.id);
    const { data: relationships, error: relError } = await req.supabase
      .from('relationships')
      .select('*')
      .in('person_a', personIds);

    if (relError) throw relError;

    // 3. Map Database rows -> React Flow nodes
    const nodes = people.map(p => ({
      id: p.id,
      type: 'member',
      position: { x: p.x !== null ? p.x : 0, y: p.y !== null ? p.y : 0 },
      data: {
        name: p.full_name,
        gender: p.gender,
        imageUrl: p.photo_url || '',
        isAlive: p.death_date ? false : true,
        birthYear: p.birth_date ? p.birth_date.split('-')[0] : '',
        deathYear: p.death_date ? p.death_date.split('-')[0] : '',
        notes: p.notes || '',
      },
    }));

    // 4. Map Database relationships -> React Flow edges
    const edges = [];
    if (relationships && relationships.length > 0) {
      relationships.forEach(r => {
        if (r.type === 'spouse') {
          edges.push({
            id: `s-${r.person_a}-${r.person_b}`,
            source: r.person_a,
            target: r.person_b,
            sourceHandle: 'spouse-out',
            targetHandle: 'spouse-in',
            type: 'spouse',
          });
        } else if (r.type === 'parent') {
          edges.push({
            id: `e-${r.person_a}-${r.person_b}`,
            source: r.person_a,
            target: r.person_b,
            sourceHandle: 'child-out',
            targetHandle: 'parent-in',
            type: 'family',
          });
        }
      });
    }

    res.json({ nodes, edges });
  } catch (error) {
    console.error('Error fetching tree data:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Save/Sync the client React Flow tree state back to Supabase (Protected)
app.post('/api/tree', requireAuth, async (req, res) => {
  const { nodes, edges } = req.body;
  let branchId = req.query.branchId || DEFAULT_BRANCH_ID;
  if (branchId === 'default') {
    branchId = DEFAULT_BRANCH_ID;
  }

  try {
    const memberNodes = (nodes || []).filter(n => n.type === 'member');
    
    // 1. Prepare People DB rows
    const peopleData = memberNodes.map(node => {
      const birthYear = node.data.birthYear;
      const deathYear = node.data.deathYear;
      return {
        id: node.id,
        full_name: node.data.name || 'Unknown',
        birth_date: birthYear ? `${birthYear}-01-01` : null,
        death_date: deathYear ? `${deathYear}-01-01` : null,
        gender: node.data.gender || 'male',
        photo_url: node.data.imageUrl || null,
        notes: node.data.notes || null,
        x: node.position ? Math.round(node.position.x) : null,
        y: node.position ? Math.round(node.position.y) : null,
        branch_id: branchId,
      };
    });

    // 2. Perform People Upsert
    if (peopleData.length > 0) {
      const { error: upsertErr } = await req.supabase
        .from('people')
        .upsert(peopleData);
      
      if (upsertErr) throw upsertErr;
    }

    // 3. Delete any members that were deleted in the UI (not present in current nodes)
    const currentIds = peopleData.map(p => p.id);
    if (currentIds.length > 0) {
      const { error: deletePeopleErr } = await req.supabase
        .from('people')
        .delete()
        .eq('branch_id', branchId)
        .not('id', 'in', `(${currentIds.join(',')})`);
      
      if (deletePeopleErr) throw deletePeopleErr;
    } else {
      // If tree is cleared completely, delete all people
      const { error: clearPeopleErr } = await req.supabase
        .from('people')
        .delete()
        .eq('branch_id', branchId);
      
      if (clearPeopleErr) throw clearPeopleErr;
    }

    // 4. Extract relationships from edges
    const relationshipsRaw = [];
    (edges || []).forEach(edge => {
      if (edge.type === 'spouse') {
        relationshipsRaw.push({
          person_a: edge.source,
          person_b: edge.target,
          type: 'spouse',
        });
      } else if (edge.type === 'family' || edge.type === 'deletable') {
        // If source is a junction (format: j-parentAId-parentBId)
        if (edge.source.startsWith('j-')) {
          let parentA, parentB;
          if (edge.source.length === 75) {
            parentA = edge.source.slice(2, 38);
            parentB = edge.source.slice(39);
          } else {
            const parts = edge.source.split('-');
            parentA = parts[1];
            parentB = parts[2];
          }
          if (parentA && parentA !== 'j') {
            relationshipsRaw.push({ person_a: parentA, person_b: edge.target, type: 'parent' });
          }
          if (parentB) {
            relationshipsRaw.push({ person_a: parentB, person_b: edge.target, type: 'parent' });
          }
        } else {
          // Direct parent-child relationship
          relationshipsRaw.push({
            person_a: edge.source,
            person_b: edge.target,
            type: 'parent',
          });
        }
      }
    });

    // Deduplicate relationships
    const relationshipsData = [];
    const seen = new Set();
    relationshipsRaw.forEach(rel => {
      const key = `${rel.person_a}-${rel.person_b}-${rel.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        relationshipsData.push(rel);
      }
    });

    // 5. Delete existing relationships for this branch to prevent duplicates
    const { data: dbPeople, error: dbPeopleErr } = await req.supabase
      .from('people')
      .select('id')
      .eq('branch_id', branchId);

    if (dbPeopleErr) throw dbPeopleErr;

    if (dbPeople && dbPeople.length > 0) {
      const dbPeopleIds = dbPeople.map(p => p.id);
      const { error: deleteRelErr } = await req.supabase
        .from('relationships')
        .delete()
        .or(`person_a.in.(${dbPeopleIds.join(',')}),person_b.in.(${dbPeopleIds.join(',')})`);

      if (deleteRelErr) throw deleteRelErr;
    }

    // 6. Insert new relationships
    if (relationshipsData.length > 0) {
      const { error: insertRelErr } = await req.supabase
        .from('relationships')
        .insert(relationshipsData);

      if (insertRelErr) throw insertRelErr;
    }

    res.json({ success: true, message: 'Tree synchronized successfully.' });
  } catch (error) {
    console.error('Error syncing tree data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Kinship API Server running on http://localhost:${port}`);
});
