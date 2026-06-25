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
  console.log('Supabase client initialized successfully.');
} else {
  console.warn('\n⚠️  WARNING: Supabase credentials are not configured in the server/.env file.');
  console.warn('The server will start but endpoints requesting database sync will fail or run in mockup mode.\n');
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    databaseConfigured: !!supabase,
  });
});

// GET: Load family tree nodes and edges from Supabase
app.get('/api/tree', async (req, res) => {
  const branchId = req.query.branchId || DEFAULT_BRANCH_ID;

  if (!supabase) {
    return res.status(503).json({
      error: 'Database not configured. Configure SUPABASE_URL and SUPABASE_KEY in the server/.env file.',
    });
  }

  try {
    // 1. Fetch people in this branch
    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('*')
      .eq('branch_id', branchId);

    if (peopleError) throw peopleError;

    if (!people || people.length === 0) {
      return res.json({ nodes: [], edges: [] });
    }

    // 2. Fetch relationships for these people
    const personIds = people.map(p => p.id);
    const { data: relationships, error: relError } = await supabase
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

// POST: Save/Sync the client React Flow tree state back to Supabase
app.post('/api/tree', async (req, res) => {
  const { nodes, edges } = req.body;
  const branchId = req.query.branchId || DEFAULT_BRANCH_ID;

  if (!supabase) {
    return res.status(503).json({
      error: 'Database not configured. Configure SUPABASE_URL and SUPABASE_KEY in the server/.env file.',
    });
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
      const { error: upsertErr } = await supabase
        .from('people')
        .upsert(peopleData);
      
      if (upsertErr) throw upsertErr;
    }

    // 3. Delete any members that were deleted in the UI (not present in current nodes)
    const currentIds = peopleData.map(p => p.id);
    if (currentIds.length > 0) {
      const { error: deletePeopleErr } = await supabase
        .from('people')
        .delete()
        .eq('branch_id', branchId)
        .not('id', 'in', `(${currentIds.join(',')})`);
      
      if (deletePeopleErr) throw deletePeopleErr;
    } else {
      // If tree is cleared completely, delete all people
      const { error: clearPeopleErr } = await supabase
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
          // UUID length is 36 chars. j-UUID-UUID is 2 + 36 + 1 + 36 = 75 chars.
          if (edge.source.length === 75) {
            parentA = edge.source.slice(2, 38);
            parentB = edge.source.slice(39);
          } else {
            // Fallback for legacy short/timestamp-based IDs
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

    // Deduplicate relationships (e.g. from overlapping parent junctions or duplicates)
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
    // Fetch all current people IDs in the DB to clear relationships cleanly
    const { data: dbPeople, error: dbPeopleErr } = await supabase
      .from('people')
      .select('id')
      .eq('branch_id', branchId);

    if (dbPeopleErr) throw dbPeopleErr;

    if (dbPeople && dbPeople.length > 0) {
      const dbPeopleIds = dbPeople.map(p => p.id);
      const { error: deleteRelErr } = await supabase
        .from('relationships')
        .delete()
        .in('person_a', dbPeopleIds);

      if (deleteRelErr) throw deleteRelErr;
    }

    // 6. Insert new relationships
    if (relationshipsData.length > 0) {
      const { error: insertRelErr } = await supabase
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
