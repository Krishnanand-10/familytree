import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, GitBranch, User, ArrowRight } from 'lucide-react';

/* ── Relationship graph builder ──────────────────────────────────────────── */
function buildRelationships(nodes, edges) {
  const memberIds = new Set(nodes.filter(n => n.type === 'member').map(n => n.id));
  const rels = {};
  memberIds.forEach(id => { rels[id] = { parents: [], children: [], spouses: [] }; });

  // Spouses
  edges.filter(e => e.type === 'spouse').forEach(e => {
    if (memberIds.has(e.source) && memberIds.has(e.target)) {
      rels[e.source].spouses.push(e.target);
      rels[e.target].spouses.push(e.source);
    }
  });

  // Build junction maps
  const junctionParents = {}; // jId -> [parentMemberIds]
  const junctionChildren = {}; // jId -> [childMemberIds]

  edges.filter(e => e.type === 'marriage').forEach(e => {
    if (!junctionParents[e.target]) junctionParents[e.target] = [];
    if (memberIds.has(e.source)) junctionParents[e.target].push(e.source);
  });

  edges.filter(e => e.type === 'family').forEach(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.type === 'junction' && memberIds.has(e.target)) {
      if (!junctionChildren[e.source]) junctionChildren[e.source] = [];
      junctionChildren[e.source].push(e.target);
    }
  });

  // Connect members via junctions
  Object.entries(junctionChildren).forEach(([jId, children]) => {
    const parents = junctionParents[jId] || [];
    parents.forEach(pId => {
      children.forEach(cId => {
        if (!rels[pId].children.includes(cId)) rels[pId].children.push(cId);
        if (!rels[cId].parents.includes(pId)) rels[cId].parents.push(pId);
      });
    });
  });

  // Direct family edges (member → member)
  edges.filter(e => e.type === 'family' || e.type === 'deletable').forEach(e => {
    if (memberIds.has(e.source) && memberIds.has(e.target)) {
      if (!rels[e.source].children.includes(e.target)) rels[e.source].children.push(e.target);
      if (!rels[e.target].parents.includes(e.source)) rels[e.target].parents.push(e.source);
    }
  });

  // Connect parents sharing a junction as spouses
  Object.values(junctionParents).forEach(parents => {
    if (parents.length === 2) {
      const [pA, pB] = parents;
      if (!rels[pA].spouses.includes(pB)) rels[pA].spouses.push(pB);
      if (!rels[pB].spouses.includes(pA)) rels[pB].spouses.push(pA);
    }
  });

  // Connect parents sharing any children as spouses
  Object.keys(rels).forEach(memberId => {
    rels[memberId].children.forEach(cId => {
      if (rels[cId]) {
        rels[cId].parents.forEach(pId => {
          if (pId !== memberId) {
            if (!rels[memberId].spouses.includes(pId)) rels[memberId].spouses.push(pId);
            if (!rels[pId].spouses.includes(memberId)) rels[pId].spouses.push(memberId);
          }
        });
      }
    });
  });

  return rels;
}

/**
 * interpretPath
 * 
 * path  — array of { id, via } hops from BFS
 * nodes — all React Flow nodes (used to look up gender of the TARGET person)
 * 
 * via values:
 *   'parent' = we went UP to a parent
 *   'child'  = we went DOWN to a child
 *   'spouse' = we went SIDEWAYS to a spouse
 */
function interpretPath(path, nodes) {
  if (!path || path.length === 0) return 'Unknown';

  const vias = path.map(p => p.via);
  
  // Helper to translate pure blood relations (no spouse hops)
  const getBloodRelation = (subVias, targetGender) => {
    const isMale = targetGender === 'male';
    const isFemale = targetGender === 'female';
    const g = (m, f, n = `${m}/${f}`) => isMale ? m : isFemale ? f : n;
    
    const s = subVias.join(',');
    
    if (s === 'parent') return g('Father', 'Mother', 'Parent');
    if (s === 'child')  return g('Son', 'Daughter', 'Child');
    
    if (s === 'parent,parent') return g('Grandfather', 'Grandmother', 'Grandparent');
    if (s === 'child,child')   return g('Grandson', 'Granddaughter', 'Grandchild');
    if (s === 'parent,child')  return g('Brother', 'Sister', 'Sibling');
    if (s === 'child,parent')  return g('Husband', 'Wife', 'Spouse');
    
    // Detours
    if (s === 'child,parent,child')  return g('Son', 'Daughter', 'Child');
    if (s === 'parent,child,parent') return g('Father', 'Mother', 'Parent');
    if (s === 'child,parent,parent') return g('Father-in-Law', 'Mother-in-Law', 'Parent-in-Law');
    if (s === 'parent,child,parent,child') return g('Brother', 'Sister', 'Sibling');
    
    if (s === 'parent,parent,parent') return g('Great-Grandfather', 'Great-Grandmother', 'Great-Grandparent');
    if (s === 'child,child,child')    return g('Great-Grandson', 'Great-Granddaughter', 'Great-Grandchild');
    if (s === 'parent,parent,child') return g('Uncle', 'Aunt', 'Uncle/Aunt');
    if (s === 'parent,child,child') return g('Nephew', 'Niece', 'Nephew/Niece');
    
    if (s === 'parent,parent,child,child') return 'Cousin';
    if (s === 'parent,parent,parent,child') return g('Great-Uncle', 'Great-Aunt', 'Great-Uncle/Aunt');
    if (s === 'parent,child,child,child') return g('Great-Nephew', 'Great-Niece', 'Great-Nephew/Niece');
    
    if (s === 'parent,parent,parent,parent') return g('Great-Great-Grandfather', 'Great-Great-Grandmother', 'Great-Great-Grandparent');
    if (s === 'child,child,child,child')     return g('Great-Great-Grandson', 'Great-Great-Granddaughter', 'Great-Great-Grandchild');
    
    if (s === 'parent,parent,parent,child,child') return 'Cousin';
    if (s === 'parent,parent,child,child,child') return 'Cousin';
    
    if (s === 'parent,parent,parent,child,child,child') return 'Cousin';
    if (s === 'parent,parent,parent,parent,child,child') return 'Cousin';
    if (s === 'parent,parent,child,child,child,child')   return 'Cousin';
    
    if (s === 'parent,parent,parent,parent,child,child,child') return 'Cousin';
    if (s === 'parent,parent,parent,child,child,child,child')  return 'Cousin';
    if (s === 'parent,parent,parent,parent,child,child,child,child') return 'Cousin';
    
    // Fallback counts
    const ups = subVias.filter(v => v === 'parent').length;
    const downs = subVias.filter(v => v === 'child').length;
    if (ups > 0 && downs === 0) {
      const prefix = 'Great-'.repeat(ups - 2);
      return `${prefix}Great-${g('Grandfather', 'Grandmother', 'Grandparent')}`;
    }
    if (downs > 0 && ups === 0) {
      const prefix = 'Great-'.repeat(downs - 2);
      return `${prefix}Great-${g('Grandson', 'Granddaughter', 'Grandchild')}`;
    }
    if (ups > 0 && downs > 0) {
      return 'Cousin';
    }
  };

  const destId = path[path.length - 1].id;
  const destNode = nodes.find(n => n.id === destId);
  const destGender = destNode?.data?.gender || 'other';

  const spouseIdx = vias.indexOf('spouse');

  // Case 1: Pure blood relation (no spouse hops)
  if (spouseIdx === -1) {
    return getBloodRelation(vias, destGender);
  }

  // Case 2: Direct Spouse
  if (vias.length === 1 && vias[0] === 'spouse') {
    return destGender === 'male' ? 'Husband' : destGender === 'female' ? 'Wife' : 'Spouse';
  }

  // Case 3: Spouse at index 0 (Spouse's blood relation, e.g. spouse, parent)
  if (spouseIdx === 0) {
    const restVias = vias.slice(1);
    const restStr = restVias.join(',');
    const spouseNode = nodes.find(n => n.id === path[0].id);
    const spouseGender = spouseNode?.data?.gender || 'other';
    const spouseTerm = spouseGender === 'male' ? 'Husband' : spouseGender === 'female' ? 'Wife' : 'Spouse';
    
    // Direct in-laws
    if (restStr === 'parent') return destGender === 'male' ? 'Father-in-Law' : destGender === 'female' ? 'Mother-in-Law' : 'Parent-in-Law';
    if (restStr === 'parent,child') return destGender === 'male' ? 'Brother-in-Law' : destGender === 'female' ? 'Sister-in-Law' : 'Sibling-in-Law';
    if (restStr === 'parent,parent') return destGender === 'male' ? 'Grandfather-in-Law' : destGender === 'female' ? 'Grandmother-in-Law' : 'Grandparent-in-Law';
    if (restStr === 'parent,parent,child') return destGender === 'male' ? 'Uncle-in-Law' : destGender === 'female' ? 'Aunt-in-Law' : 'Uncle/Aunt-in-Law';
    if (restStr === 'child') return destGender === 'male' ? 'Stepson' : destGender === 'female' ? 'Stepdaughter' : 'Stepchild';

    const rightLabel = getBloodRelation(restVias, destGender);
    return rightLabel ? `${spouseTerm}'s ${rightLabel}` : `Spouse's Relative`;
  }

  // Case 4: Spouse at the very end (Blood relation's spouse, e.g. parent, child, spouse)
  if (spouseIdx === vias.length - 1) {
    const restVias = vias.slice(0, -1);
    const restStr = restVias.join(',');
    
    // Direct in-laws
    if (restStr === 'parent,child') return destGender === 'male' ? 'Brother-in-Law' : destGender === 'female' ? 'Sister-in-Law' : 'Sibling-in-Law';
    if (restStr === 'child') return destGender === 'male' ? 'Son-in-Law' : destGender === 'female' ? 'Daughter-in-Law' : 'Child-in-Law';
    if (restStr === 'child,child') return destGender === 'male' ? 'Grandson-in-Law' : destGender === 'female' ? 'Granddaughter-in-Law' : 'Grandchild-in-Law';
    if (restStr === 'parent') return destGender === 'male' ? 'Stepfather' : destGender === 'female' ? 'Stepmother' : 'Stepparent';

    const leftPersonId = path[path.length - 2].id;
    const leftNode = nodes.find(n => n.id === leftPersonId);
    const leftGender = leftNode?.data?.gender || 'other';
    const leftLabel = getBloodRelation(restVias, leftGender);
    const spouseTerm = destGender === 'male' ? 'Husband' : destGender === 'female' ? 'Wife' : 'Spouse';
    
    return leftLabel ? `${leftLabel}'s ${spouseTerm}` : `Relative's Spouse`;
  }

  // Case 5: Spouse in the middle (e.g. Sibling's Spouse's Parent / Sibling's Spouse's Sibling)
  const leftPath = path.slice(0, spouseIdx);
  const rightPath = path.slice(spouseIdx + 1);

  const leftLabel = interpretPath(leftPath, nodes);

  const spouseId = path[spouseIdx].id;
  const spouseNode = nodes.find(n => n.id === spouseId);
  const spouseGender = spouseNode?.data?.gender || 'other';
  const spouseTerm = spouseGender === 'male' ? 'Husband' : spouseGender === 'female' ? 'Wife' : 'Spouse';

  const rightLabel = interpretPath(rightPath, nodes);

  if (leftLabel && rightLabel) {
    return `${leftLabel}'s ${spouseTerm}'s ${rightLabel}`;
  }

  return `Distant Relative (${path.length} steps)`;
}

function findRelationship(fromId, toId, nodes, edges) {
  if (!fromId || !toId || fromId === toId) return null;
  const rels = buildRelationships(nodes, edges);
  if (!rels[fromId] || !rels[toId]) return null;

  const visited = new Set([fromId]);
  // queue: { id, path: [{ id, via }] }
  const queue = [{ id: fromId, path: [] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift();
    const r = rels[id];
    if (!r) continue;

    const neighbors = [
      ...r.parents.map(p => ({ id: p, via: 'parent' })),
      ...r.children.map(c => ({ id: c, via: 'child' })),
      ...r.spouses.map(s => ({ id: s, via: 'spouse' })),
    ];

    for (const { id: nId, via } of neighbors) {
      if (visited.has(nId)) continue;
      visited.add(nId);
      const newPath = [...path, { id: nId, via }];
      if (nId === toId) {
        return {
          path: newPath,
          label: interpretPath(newPath, nodes),
          steps: newPath.length,
        };
      }
      if (newPath.length < 8) { // Limit BFS depth
        queue.push({ id: nId, path: newPath });
      }
    }
  }
  return { path: [], label: 'Not Related', steps: 0 };
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function RelationFinder({ isOpen, fromMemberId, nodes, edges, onClose }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedId(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, fromMemberId]);

  const fromMember = useMemo(
    () => nodes.find(n => n.id === fromMemberId),
    [nodes, fromMemberId]
  );

  const members = useMemo(
    () => nodes.filter(n => n.type === 'member' && n.id !== fromMemberId),
    [nodes, fromMemberId]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    return members.filter(n =>
      n.data.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [members, search]);

  const result = useMemo(() => {
    if (!selectedId) return null;
    return findRelationship(fromMemberId, selectedId, nodes, edges);
  }, [fromMemberId, selectedId, nodes, edges]);

  const selectedMember = useMemo(
    () => nodes.find(n => n.id === selectedId),
    [nodes, selectedId]
  );

  const fromAccent =
    fromMember?.data?.gender === 'female' ? '#e91e63' :
    fromMember?.data?.gender === 'other' ? '#9c27b0' : '#2196f3';

  const toAccent =
    selectedMember?.data?.gender === 'female' ? '#e91e63' :
    selectedMember?.data?.gender === 'other' ? '#9c27b0' : '#2196f3';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="relation-finder-modal"
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 24 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="rf-header">
              <div className="rf-title">
                <GitBranch size={18} />
                <span>Relationship Finder</span>
              </div>
              <button className="profile-close-btn" onClick={onClose}>
                <X size={17} />
              </button>
            </div>

            {/* From → To display */}
            <div className="rf-pair">
              <div className="rf-person-chip" style={{ borderColor: fromAccent }}>
                {fromMember?.data?.imageUrl ? (
                  <img src={fromMember.data.imageUrl} alt="" className="rf-chip-img" />
                ) : (
                  <User size={16} color={fromAccent} />
                )}
                <span>{fromMember?.data?.name || 'Unknown'}</span>
              </div>

              <div className="rf-arrow">
                <ArrowRight size={18} />
                {result && <span className="rf-label-badge">{result.label}</span>}
              </div>

              <div className={`rf-person-chip ${!selectedMember ? 'empty' : ''}`}
                style={{ borderColor: selectedMember ? toAccent : 'rgba(255,255,255,0.15)' }}>
                {selectedMember ? (
                  <>
                    {selectedMember.data.imageUrl ? (
                      <img src={selectedMember.data.imageUrl} alt="" className="rf-chip-img" />
                    ) : (
                      <User size={16} color={toAccent} />
                    )}
                    <span>{selectedMember.data.name}</span>
                  </>
                ) : (
                  <span className="rf-chip-placeholder">Select a person →</span>
                )}
              </div>
            </div>

            {/* Result */}
            {result && (
              <motion.div
                className={`rf-result ${result.steps === 0 ? 'unrelated' : ''}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {result.steps > 0 ? (
                  <div className="rf-result-label">{result.label}</div>
                ) : (
                  <div className="rf-result-label">No relation found in the tree</div>
                )}
              </motion.div>
            )}

            {/* Search */}
            <div className="rf-search-wrap">
              <Search size={14} className="rf-search-icon" />
              <input
                ref={inputRef}
                className="rf-search-input"
                placeholder="Search for a person…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Member list */}
            <div className="rf-member-list">
              {filtered.length === 0 && (
                <div className="rf-empty">No members found</div>
              )}
              {filtered.map(m => {
                const acc = m.data.gender === 'female' ? '#e91e63' :
                  m.data.gender === 'other' ? '#9c27b0' : '#2196f3';
                return (
                  <button
                    key={m.id}
                    className={`rf-member-row ${m.id === selectedId ? 'selected' : ''}`}
                    onClick={() => setSelectedId(m.id)}
                  >
                    <div className="rf-member-avatar" style={{ borderColor: acc }}>
                      {m.data.imageUrl ? (
                        <img src={m.data.imageUrl} alt="" />
                      ) : (
                        <User size={14} color={acc} />
                      )}
                    </div>
                    <div className="rf-member-info">
                      <span className="rf-member-name">{m.data.name || 'Unknown'}</span>
                      {m.data.birthYear && (
                        <span className="rf-member-year">{m.data.birthYear}</span>
                      )}
                    </div>
                    {m.id === selectedId && <span className="rf-member-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
