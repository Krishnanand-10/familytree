import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import MemberNode from './components/MemberNode';
import MemberModal from './components/MemberModal';
import DeletableEdge from './components/DeletableEdge';
import FamilyEdge from './components/FamilyEdge';
import MarriageEdge from './components/MarriageEdge';
import SpouseEdge from './components/SpouseEdge';
import JunctionNode from './components/JunctionNode';
import { initialNodes, initialEdges } from './data';
import { Search, Save, Plus, Wand2, TreePine, Undo2, Redo2, Trash2, Check, Download, Upload } from 'lucide-react';

const nodeTypes = {
  member: MemberNode,
  junction: JunctionNode,
};

const edgeTypes = {
  default: DeletableEdge,
  deletable: DeletableEdge,
  smoothstep: DeletableEdge,
  family: FamilyEdge,
  marriage: MarriageEdge,
  spouse: SpouseEdge,
};

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (id) => id && (id.startsWith('j-') || uuidRegex.test(id));

function migrateLegacyIds(nodes = [], edges = []) {
  const idMap = {};
  
  // 1. Map legacy member IDs to UUIDs
  const migratedNodes = nodes.map(node => {
    if (node.type === 'member' && !isUUID(node.id)) {
      const newUuid = crypto.randomUUID();
      idMap[node.id] = newUuid;
      return { ...node, id: newUuid };
    }
    return node;
  });

  // 2. Map legacy edges to use new UUIDs
  const migratedEdges = edges.map(edge => {
    let source = edge.source;
    let target = edge.target;
    let id = edge.id;

    if (idMap[source]) source = idMap[source];
    if (idMap[target]) target = idMap[target];

    // Re-construct the edge ID if source or target was migrated
    if (idMap[edge.source] || idMap[edge.target]) {
      if (edge.type === 'spouse') {
        id = `s-${source}-${target}`;
      } else if (edge.type === 'family' || edge.type === 'deletable' || edge.type === 'marriage') {
        id = `e-${source}-${target}`;
      }
    }

    return {
      ...edge,
      id,
      source,
      target
    };
  });

  return { nodes: migratedNodes, edges: migratedEdges };
}

function layoutTree(nodes, edges) {
  const newNodes = nodes.map(n => ({ ...n }));
  const newEdges = edges.map(e => ({ ...e }));

  // --- Constants ---
  const CARD_W = 160;           // visual card width (must match CSS)
  const H_GAP  = 80;            // horizontal gap between siblings
  const V_GAP  = 320;           // vertical gap between generations (needs room for junction dot)
  const UNIT   = CARD_W + H_GAP; // slot width per single node

  // --- Helpers ---
  const getChildren = (parentId) =>
    newEdges
      .filter(e => e.source === parentId && (e.type === 'family' || e.type === 'deletable'))
      .map(e => e.target)
      .filter(id => newNodes.find(n => n.id === id));

  const getSpouseId = (id) => {
    // 1. Direct spouse edge (before junction is created)
    const direct = newEdges.find(e2 => e2.type === 'spouse' && (e2.source === id || e2.target === id));
    if (direct) return direct.source === id ? direct.target : direct.source;

    // 2. Via shared junction: marriage edges go FROM member TO junction
    //    So find a junction this node feeds into, then find the OTHER member feeding that junction
    const marriageEdge = newEdges.find(e2 => e2.type === 'marriage' && e2.source === id);
    if (marriageEdge) {
      const junctionId = marriageEdge.target;
      const otherEdge = newEdges.find(e2 => e2.type === 'marriage' && e2.target === junctionId && e2.source !== id);
      if (otherEdge) return otherEdge.source;
    }

    return null;
  };

  const isAlsoChild = (id) =>
    newEdges.some(e => e.target === id && (e.type === 'family' || e.type === 'deletable'));

  // Sort a list of node IDs by their current x position (preserves user's left-to-right arrangement)
  const sortByX = (ids) =>
    [...ids].sort((a, b) => {
      const na = newNodes.find(n => n.id === a);
      const nb = newNodes.find(n => n.id === b);
      return (na?.position?.x ?? 0) - (nb?.position?.x ?? 0);
    });

  // Get all children that appear BELOW a member node (direct or via junction)
  const getAllChildren = (nodeId) => {
    // direct children (rare — most go through junction)
    const direct = getChildren(nodeId);
    // children via junction: marriage edges go FROM member TO junction
    const junctionEdges = newEdges.filter(
      e => e.type === 'marriage' && e.source === nodeId
    );
    const junctionChildren = [];
    junctionEdges.forEach(je => {
      getChildren(je.target).forEach(cId => {
        if (!direct.includes(cId)) junctionChildren.push(cId);
      });
    });
    const combined = [...direct, ...junctionChildren];
    // Sort by current x so align respects user's left-to-right arrangement
    return sortByX(combined);
  };

  // --- Find root nodes (no parent edges pointing to them) ---
  const memberNodes = newNodes.filter(n => n.type === 'member');
  const roots = memberNodes.filter(n => !isAlsoChild(n.id));

  // If there's a married couple at the root, treat them together
  // Build "family units" at root level: a root + its spouse (if spouse is also a root)
  const rootIds = new Set(roots.map(n => n.id));
  const processedRoots = new Set();
  const rootUnits = []; // each unit is [memberId] or [memberId, spouseId]
  roots.forEach(r => {
    if (processedRoots.has(r.id)) return;
    processedRoots.add(r.id);
    const sp = getSpouseId(r.id);
    if (sp && rootIds.has(sp) && !processedRoots.has(sp)) {
      processedRoots.add(sp);
      rootUnits.push([r.id, sp]);
    } else {
      rootUnits.push([r.id]);
    }
  });

  // --- Bottom-up subtree width calculation ---
  // subtreeWidth[nodeId] = total width needed to render this node's entire subtree
  const subtreeWidth = {};

  const calcWidth = (nodeId) => {
    if (subtreeWidth[nodeId] !== undefined) return subtreeWidth[nodeId];
    const children = getAllChildren(nodeId);
    // Also include spouse width in root calculation if relevant
    const spouseId = getSpouseId(nodeId);
    const spouseAlsoChild = spouseId && isAlsoChild(spouseId);

    if (children.length === 0) {
      // Leaf: width is own card + spouse card if bundled
      const w = (spouseId && !spouseAlsoChild) ? UNIT + CARD_W : CARD_W;
      subtreeWidth[nodeId] = w;
      return w;
    }

    // Children subtree widths
    const childrenW = children.reduce((sum, cId) => {
      return sum + calcWidth(cId) + H_GAP;
    }, -H_GAP); // remove trailing gap

    const myWidth = Math.max(
      childrenW,
      (spouseId && !spouseAlsoChild) ? UNIT + CARD_W : CARD_W
    );
    subtreeWidth[nodeId] = myWidth;
    return myWidth;
  };

  roots.forEach(r => calcWidth(r.id));

  // --- Top-down placement ---
  const positioned = new Set();

  const placeNode = (nodeId, centerX, y) => {
    if (positioned.has(nodeId)) return;
    positioned.add(nodeId);

    const idx = newNodes.findIndex(n => n.id === nodeId);
    if (idx === -1) return;

    const spouseId = getSpouseId(nodeId);
    const spouseAlsoChild = spouseId && isAlsoChild(spouseId);

    // If this node has a bundled spouse (spouse is NOT also a child), place them side-by-side
    if (spouseId && !spouseAlsoChild && !positioned.has(spouseId)) {
      // Total pair width = 2*CARD_W + H_GAP, centered at centerX
      // leftX = centerX - (2*CARD_W + H_GAP)/2 = centerX - CARD_W - H_GAP/2
      const leftX  = centerX - CARD_W - H_GAP / 2;
      const rightX = centerX + H_GAP / 2;

      const node = newNodes[idx];
      const spouseNode = newNodes.find(n => n.id === spouseId);
      const spouseIdx = newNodes.findIndex(n => n.id === spouseId);
      const isNodeFemaleSpouseMale = node?.data?.gender === 'female' && spouseNode?.data?.gender === 'male';

      if (isNodeFemaleSpouseMale) {
        // Spouse (male) on the left, Node (female) on the right
        if (spouseIdx !== -1) {
          newNodes[spouseIdx] = { ...newNodes[spouseIdx], position: { x: leftX, y } };
        }
        newNodes[idx] = { ...newNodes[idx], position: { x: rightX, y } };
      } else {
        // Node on the left, Spouse on the right
        newNodes[idx] = { ...newNodes[idx], position: { x: leftX, y } };
        if (spouseIdx !== -1) {
          newNodes[spouseIdx] = { ...newNodes[spouseIdx], position: { x: rightX, y } };
        }
      }
      positioned.add(spouseId);

      // Normalize the spouse edge so source is on the left and target is on the right
      const leftId = isNodeFemaleSpouseMale ? spouseId : nodeId;
      const rightId = isNodeFemaleSpouseMale ? nodeId : spouseId;
      const sEdgeIdx = newEdges.findIndex(e => e.type === 'spouse' && 
        ((e.source === nodeId && e.target === spouseId) || (e.source === spouseId && e.target === nodeId))
      );
      if (sEdgeIdx !== -1) {
        newEdges[sEdgeIdx] = {
          ...newEdges[sEdgeIdx],
          id: `s-${leftId}-${rightId}`,
          source: leftId,
          target: rightId,
          sourceHandle: 'spouse-out',
          targetHandle: 'spouse-in'
        };
      }
    } else {
      // Place single node centered
      newNodes[idx] = { ...newNodes[idx], position: { x: centerX - CARD_W / 2, y } };
    }

    // Place children centered below
    const children = getAllChildren(nodeId);
    if (children.length === 0) return;

    const childY = y + V_GAP;

    // Calculate total width of all children
    const totalChildW = children.reduce((sum, cId) => sum + subtreeWidth[cId], 0)
      + H_GAP * (children.length - 1);

    let childX = centerX - totalChildW / 2;
    children.forEach(cId => {
      if (positioned.has(cId)) return;
      const cW = subtreeWidth[cId];
      const cCenter = childX + cW / 2;
      placeNode(cId, cCenter, childY);
      childX += cW + H_GAP;
    });
  };

  // Place root units
  // Total width of all root units
  const totalRootW = rootUnits.reduce((sum, unit) => {
    const mainW = subtreeWidth[unit[0]] || CARD_W;
    return sum + mainW;
  }, 0) + H_GAP * (rootUnits.length - 1);

  let rootX = -totalRootW / 2;
  rootUnits.forEach(unit => {
    const mainId = unit[0];
    const mainW = subtreeWidth[mainId] || CARD_W;
    const centerX = rootX + mainW / 2;
    placeNode(mainId, centerX, 0);
    rootX += mainW + H_GAP;
  });

  // --- Place any unpositioned members (disconnected nodes) ---
  let floatX = 0;
  newNodes.forEach((node, i) => {
     if (node.type === 'member' && !positioned.has(node.id)) {
       newNodes[i] = { ...node, position: { x: floatX, y: 0 } };
       floatX += UNIT;
     }
  });

  // --- Reposition junction nodes exactly between their two parent cards ---
  newNodes.forEach((node, i) => {
    if (node.type === 'junction') {
      const mEdges = newEdges.filter(e => e.target === node.id && e.type === 'marriage');
      if (mEdges.length === 2) {
        const pA = newNodes.find(n => n.id === mEdges[0].source);
        const pB = newNodes.find(n => n.id === mEdges[1].source);
        if (pA && pB) {
          // midX = average of the two card centres (each centre = card.x + CARD_W/2)
          // Then subtract 10 so the 20px junction dot is centred there
          const midX = ((pA.position.x + CARD_W / 2) + (pB.position.x + CARD_W / 2)) / 2 - 10;
          // midY: parent card height ≈ 150px, children at parent.y + V_GAP (320)
          // midpoint between 150 and 320 = ~235 → use 240 for clean spacing
          const midY = Math.max(pA.position.y, pB.position.y) + 240;
          newNodes[i] = { ...node, position: { x: midX, y: midY } };
        }
      }
    }
  });

  return { nodes: newNodes, edges: newEdges };
}

// Inner component that can use useReactFlow()
function FlowApp() {
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();
  const [treeName, setTreeName] = useState(() => {
    return localStorage.getItem('family-tree-name') || 'My Family Tree';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [dbStatus, setDbStatus] = useState('loading'); // 'loading', 'connected', 'fallback'
  const [isSaving, setIsSaving] = useState(false);
  const [saveToastMsg, setSaveToastMsg] = useState('Tree saved successfully');

  const [nodes, setNodes, onNodesChange] = useNodesState(() => {
    const savedNodes = localStorage.getItem('family-tree-nodes');
    const savedEdges = localStorage.getItem('family-tree-edges');
    const parsedNodes = savedNodes ? JSON.parse(savedNodes) : initialNodes;
    const parsedEdges = savedEdges ? JSON.parse(savedEdges) : initialEdges;
    const { nodes: migrated } = migrateLegacyIds(parsedNodes, parsedEdges);
    return migrated;
  });
  const [edges, setEdges, onEdgesChange] = useEdgesState(() => {
    const savedNodes = localStorage.getItem('family-tree-nodes');
    const savedEdges = localStorage.getItem('family-tree-edges');
    const parsedNodes = savedNodes ? JSON.parse(savedNodes) : initialNodes;
    const parsedEdges = savedEdges ? JSON.parse(savedEdges) : initialEdges;
    const { edges: migrated } = migrateLegacyIds(parsedNodes, parsedEdges);
    return migrated;
  });



  const handleSaveClick = useCallback(async () => {
    setIsSaving(true);
    
    // Always backup to localStorage
    localStorage.setItem('family-tree-nodes', JSON.stringify(nodes));
    localStorage.setItem('family-tree-edges', JSON.stringify(edges));
    localStorage.setItem('family-tree-name', treeName);

    try {
      const res = await fetch('http://localhost:5000/api/tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      
      setSaveToastMsg('Tree saved to database successfully');
      setShowSaveToast(true);
      setDbStatus('connected');
    } catch (err) {
      console.warn('Kinship: Could not save to database server. Saved locally.', err);
      setSaveToastMsg('Saved locally (database offline)');
      setShowSaveToast(true);
      setDbStatus('fallback');
    } finally {
      setIsSaving(false);
      setTimeout(() => setShowSaveToast(false), 3000);
    }
  }, [nodes, edges, treeName]);

  // Track latest nodes/edges for cleanup logic to avoid stale closures
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const fileInputRef = useRef(null);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Undo/Redo History
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const takeSnapshot = useCallback(() => {
    setHistory((prev) => [...prev.slice(-49), { nodes, edges }]); // Keep last 50 states
    setRedoStack([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prevState = history[history.length - 1];
    setRedoStack((prev) => [...prev, { nodes, edges }]);
    setNodes(prevState.nodes);
    setEdges(prevState.edges);
    setHistory((prev) => prev.slice(0, -1));
  }, [history, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, { nodes, edges }]);
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack, nodes, edges, setNodes, setEdges]);

  // Save tree name
  useEffect(() => {
    localStorage.setItem('family-tree-name', treeName);
  }, [treeName]);

  // Modal State
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'add',
    activeMemberId: null,
    relativeType: null,
  });

  // Save to localStorage when tree changes
  useEffect(() => {
    localStorage.setItem('family-tree-nodes', JSON.stringify(nodes));
    localStorage.setItem('family-tree-edges', JSON.stringify(edges));
  }, [nodes, edges]);

  // Handle unlinking via custom event from DeletableEdge
  useEffect(() => {
    const handleUnlink = (event) => {
      const { id } = event.detail;
      takeSnapshot();
      setEdges((eds) => eds.filter((e) => e.id !== id));
    };

    window.addEventListener('edge-unlink', handleUnlink);
    return () => window.removeEventListener('edge-unlink', handleUnlink);
  }, [setEdges, takeSnapshot]);

  // Handle adding person from edge
  useEffect(() => {
    const handleEdgeAdd = (event) => {
      const { sourceId, edgeId } = event.detail;
      const edge = edges.find(e => e.id === edgeId);
      if (!edge) return;

      // We always add a child when clicking an edge, 
      // whether it's a marriage line or an existing parent-child line.
      let type = 'child';


      setModalState({
        isOpen: true,
        mode: 'add',
        activeMemberId: sourceId,
        relativeType: type,
      });
    };

    window.addEventListener('edge-add-person', handleEdgeAdd);
    return () => window.removeEventListener('edge-add-person', handleEdgeAdd);
  }, [edges]);

  // Handle Search
  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    return nodes.filter(node => 
      node.type === 'member' && 
      node.data.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, nodes]);

  const handleSelectSearchResult = (node) => {
    setSearchQuery('');
    setCenter(node.position.x + 80, node.position.y + 90, { zoom: 1.2, duration: 800 });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const findMarriageJunction = useCallback((memberId) => {
    if (!memberId) return null;
    const edge = edges.find(e =>
      e.source === memberId && e.type === 'marriage'
    );
    return edge ? edge.target : null;
  }, [edges]);

  // Cleanup and migrate old edges to junctions

  const cleanupTree = useCallback((shouldRearrange = false) => {
    console.log('cleanupTree called, shouldRearrange:', shouldRearrange);
    let hasChanged = false;
    let newEdges = [...edgesRef.current];
    let newNodes = [...nodesRef.current];

    // 1. Identify all married pairs (either via junction or direct spouse edge)
    const pairs = [];
    
    // Find pairs from junctions
    newNodes.forEach(node => {
      if (node.type === 'junction') {
        const parentEdges = newEdges.filter(e => e.target === node.id && e.type === 'marriage');
        if (parentEdges.length === 2) {
          pairs.push({
            parentAId: parentEdges[0].source,
            parentBId: parentEdges[1].source,
            junctionId: node.id
          });
        }
      }
    });

    // Find pairs from direct spouse edges
    newEdges.forEach(edge => {
      if (edge.type === 'spouse') {
        if (!pairs.some(p => (p.parentAId === edge.source && p.parentBId === edge.target) || (p.parentAId === edge.target && p.parentBId === edge.source))) {
          pairs.push({
            parentAId: edge.source,
            parentBId: edge.target,
            junctionId: null
          });
        }
      }
    });

    // NEW: Find pairs from shared children
    newNodes.forEach(node => {
      if (node.type === 'member') {
        const parentEdges = newEdges.filter(e => e.target === node.id && (e.type === 'family' || e.type === 'deletable'));
        if (parentEdges.length === 2) {
          const pAId = parentEdges[0].source;
          const pBId = parentEdges[1].source;
          const pA = newNodes.find(n => n.id === pAId);
          const pB = newNodes.find(n => n.id === pBId);
          
          if (pA?.type === 'member' && pB?.type === 'member') {
            if (!pairs.some(p => (p.parentAId === pAId && p.parentBId === pBId) || (p.parentAId === pBId && p.parentBId === pAId))) {
              pairs.push({
                parentAId: pAId,
                parentBId: pBId,
                junctionId: null
              });
            }
          }
        }
      }
    });

    // 2. For each pair, decide if we need a junction or a direct link
    pairs.forEach(pair => {
      const childEdges = newEdges.filter(e => 
        (e.source === pair.junctionId || e.source === pair.parentAId || e.source === pair.parentBId) && 
        (e.type === 'family' || e.targetHandle === 'parent-in')
      );
      const hasChildren = childEdges.length > 0;

      if (hasChildren && !pair.junctionId) {
        const pA = newNodes.find(n => n.id === pair.parentAId);
        const pB = newNodes.find(n => n.id === pair.parentBId);
        if (pA && pB) {
          const junctionId = `j-${pA.id}-${pB.id}`;
          const jX = Math.round((pA.position.x + pB.position.x) / 2 + 80 - 6);
          const jY = Math.round(Math.max(pA.position.y, pB.position.y) + 200);
          
          if (!newNodes.find(n => n.id === junctionId)) {
            newNodes.push({ id: junctionId, type: 'junction', position: { x: jX, y: jY }, data: {} });
            hasChanged = true;
          }

          newEdges = newEdges.filter(e => !((e.source === pA.id && e.target === pB.id) || (e.source === pB.id && e.target === pA.id)));
          
          if (!newEdges.find(e => e.id === `e-${pA.id}-${junctionId}`)) {
            newEdges.push({ id: `e-${pA.id}-${junctionId}`, source: pA.id, target: junctionId, sourceHandle: 'child-out', targetHandle: 'parent-left', type: 'marriage' });
            hasChanged = true;
          }
          if (!newEdges.find(e => e.id === `e-${pB.id}-${junctionId}`)) {
            newEdges.push({ id: `e-${pB.id}-${junctionId}`, source: pB.id, target: junctionId, sourceHandle: 'child-out', targetHandle: 'parent-right', type: 'marriage' });
            hasChanged = true;
          }

          const seenChildren = new Set();
          newEdges = newEdges.filter(e => {
            if (childEdges.some(ce => ce.id === e.id)) {
              if (seenChildren.has(e.target)) return false;
              seenChildren.add(e.target);
              e.source = junctionId;
              e.type = 'family';
              e.sourceHandle = 'child-out';
              hasChanged = true;
            }
            return true;
          });
        }
      } else if (!hasChildren && pair.junctionId) {
        newNodes = newNodes.filter(n => n.id !== pair.junctionId);
        newEdges = newEdges.filter(e => e.target !== pair.junctionId && e.source !== pair.junctionId);
        
        const pA = newNodes.find(n => n.id === pair.parentAId);
        const pB = newNodes.find(n => n.id === pair.parentBId);
        let leftId = pair.parentAId;
        let rightId = pair.parentBId;
        if (pA && pB && pA.position.x > pB.position.x) {
          leftId = pair.parentBId;
          rightId = pair.parentAId;
        }

        const edgeId = `s-${leftId}-${rightId}`;
        if (!newEdges.find(e => e.id === edgeId)) {
          newEdges.push({ id: edgeId, source: leftId, target: rightId, sourceHandle: 'spouse-out', targetHandle: 'spouse-in', type: 'spouse' });
        }
        hasChanged = true;
      } else if (hasChildren && pair.junctionId) {
        const pA = newNodes.find(n => n.id === pair.parentAId);
        const pB = newNodes.find(n => n.id === pair.parentBId);
        const node = newNodes.find(n => n.id === pair.junctionId);
        if (pA && pB && node) {
          const targetX = Math.round((pA.position.x + pB.position.x) / 2 + 80 - 10);
          const targetY = Math.round(Math.max(pA.position.y, pB.position.y) + 200);
          if (Math.abs(node.position.x - targetX) > 1 || Math.abs(node.position.y - targetY) > 1) {
            const idx = newNodes.findIndex(n => n.id === node.id);
            newNodes[idx] = { ...node, position: { x: targetX, y: targetY } };
            hasChanged = true;
          }

          // REDIRECT any direct children to the junction
          const directEdges = newEdges.filter(e => 
            (e.source === pair.parentAId || e.source === pair.parentBId) && 
            (e.type === 'family' || e.type === 'deletable' || e.targetHandle === 'parent-in') &&
            e.target !== pair.junctionId
          );
          
          if (directEdges.length > 0) {
            newEdges = newEdges.map(e => {
              if (directEdges.some(de => de.id === e.id)) {
                return {
                  ...e,
                  source: pair.junctionId,
                  type: 'family',
                  sourceHandle: 'child-out'
                };
              }
              return e;
            });
            hasChanged = true;
          }
        }
      }
    });

    if (shouldRearrange) {
      const { nodes: alignedNodes, edges: alignedEdges } = layoutTree(newNodes, newEdges);
      console.log('layoutTree result nodes:', alignedNodes.map(n => ({id:n.id, pos:n.position})));
      newNodes = alignedNodes;
      newEdges = alignedEdges;
      hasChanged = true;
    } else {
      // 3. Auto-align sibling children with overlap prevention
      const childrenByParent = {};
      newEdges.forEach(e => {
        if (e.type === 'family') {
          if (!childrenByParent[e.source]) childrenByParent[e.source] = [];
          childrenByParent[e.source].push(e.target);
        }
      });

      Object.entries(childrenByParent).forEach(([parentId, childIds]) => {
        const siblingNodes = childIds.map(id => newNodes.find(n => n.id === id)).filter(Boolean);
        if (siblingNodes.length === 0) return;

        // Determine the target Y for this row of siblings
        const parentNode = newNodes.find(n => n.id === parentId);
        let targetY = 0;
        let centerX = 0;
        
        if (parentNode) {
          centerX = parentNode.position.x + (parentNode.type === 'member' ? 80 : 6);
          // If parent is a junction, children should be exactly 80px below the junction branching point
          // If parent is a member, children should be 280px below (standard generation height)
          targetY = parentNode.position.y + (parentNode.type === 'junction' ? 80 : 300);
        } else {
          // Fallback to maxY if no parent found (shouldn't happen)
          siblingNodes.forEach(node => { if (node.position.y > targetY) targetY = node.position.y; });
        }

        siblingNodes.sort((a, b) => a.position.x - b.position.x);
        
        const siblingUnits = siblingNodes.map(node => {
          const spouseEdge = newEdges.find(e => e.type === 'spouse' && (e.source === node.id || e.target === node.id));
          const spouseId = spouseEdge ? (spouseEdge.source === node.id ? spouseEdge.target : spouseEdge.source) : null;
          
          // Check if spouse is also a child of another parent/branch in the tree
          const isSpouseAlsoChild = spouseId && newEdges.some(e => e.target === spouseId && (e.type === 'family' || e.type === 'deletable'));
          
          // If the spouse is also a child in the tree, do not bundle them with this sibling unit
          // to prevent positioning conflicts between their respective parent branches.
          const shouldBundleSpouse = spouseId && !isSpouseAlsoChild;

          return {
            id: node.id,
            width: shouldBundleSpouse ? 400 : 180,
            node: node,
            spouseId: shouldBundleSpouse ? spouseId : null
          };
        });

        const totalWidth = siblingUnits.reduce((acc, unit) => acc + unit.width, 0);
        let currentX = centerX - totalWidth / 2;

        siblingUnits.forEach((unit) => {
          const currentTargetX = Math.round(currentX + (unit.width === 400 ? 0 : 10));
          const spouseNode = unit.spouseId ? newNodes.find(n => n.id === unit.spouseId) : null;
          const isNodeFemaleSpouseMale = unit.node?.data?.gender === 'female' && spouseNode?.data?.gender === 'male';

          if (unit.spouseId && spouseNode) {
            const nodeTargetX = isNodeFemaleSpouseMale ? currentTargetX + 220 : currentTargetX;
            const spouseTargetX = isNodeFemaleSpouseMale ? currentTargetX : currentTargetX + 220;

            if (Math.abs(unit.node.position.x - nodeTargetX) > 1 || Math.abs(unit.node.position.y - targetY) > 1) {
              const nodeIndex = newNodes.findIndex(n => n.id === unit.id);
              newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: { x: nodeTargetX, y: targetY } };
              hasChanged = true;
            }

            if (Math.abs(spouseNode.position.x - spouseTargetX) > 1 || Math.abs(spouseNode.position.y - targetY) > 1) {
              const sIdx = newNodes.findIndex(n => n.id === spouseNode.id);
              newNodes[sIdx] = { ...spouseNode, position: { x: spouseTargetX, y: targetY } };
              hasChanged = true;
            }

            // Normalize the spouse edge so source is on the left and target is on the right
            const leftId = isNodeFemaleSpouseMale ? spouseNode.id : unit.node.id;
            const rightId = isNodeFemaleSpouseMale ? unit.node.id : spouseNode.id;
            const sEdgeIdx = newEdges.findIndex(e => e.type === 'spouse' && 
              ((e.source === unit.node.id && e.target === spouseNode.id) || (e.source === spouseNode.id && e.target === unit.node.id))
            );
            if (sEdgeIdx !== -1) {
              if (newEdges[sEdgeIdx].source !== leftId || newEdges[sEdgeIdx].target !== rightId) {
                newEdges[sEdgeIdx] = {
                  ...newEdges[sEdgeIdx],
                  id: `s-${leftId}-${rightId}`,
                  source: leftId,
                  target: rightId,
                  sourceHandle: 'spouse-out',
                  targetHandle: 'spouse-in'
                };
                hasChanged = true;
              }
            }
          } else {
            if (Math.abs(unit.node.position.x - currentTargetX) > 1 || Math.abs(unit.node.position.y - targetY) > 1) {
              const nodeIndex = newNodes.findIndex(n => n.id === unit.id);
              newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: { x: currentTargetX, y: targetY } };
              hasChanged = true;
            }
          }

          currentX += unit.width;
        });
      });
    }

    if (hasChanged) {
      setNodes(newNodes);
      setEdges(newEdges);
      takeSnapshot();
      if (shouldRearrange) {
        setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 100);
      }
    }
  }, [setNodes, setEdges, takeSnapshot, fitView]);

  // Fetch family tree from API on mount, with LocalStorage fallback
  useEffect(() => {
    const loadTree = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/tree');
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const data = await res.json();
        
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
          setDbStatus('connected');
          console.log('Kinship: Loaded family tree from database server.');
          
          // Trigger family tree auto-alignment layout cleanup
          setTimeout(() => cleanupTree(true), 300);
        } else {
          setDbStatus('fallback');
        }
      } catch (err) {
        console.warn('Kinship: Could not connect to API server. Falling back to local storage.', err);
        setDbStatus('fallback');
      }
    };

    loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNodes, setEdges]); // cleanupTree not listed as dependency because of ref updates

  const rearrangeEverything = useCallback(() => {
    takeSnapshot();
    const { nodes: alignedNodes, edges: alignedEdges } = layoutTree(nodes, edges);
    setNodes(alignedNodes);
    setEdges(alignedEdges);
    setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 100);
  }, [nodes, edges, takeSnapshot, fitView, setNodes, setEdges]);


  // Run cleanup once after mount — empty dep array so it only fires once
  useEffect(() => {
    const timer = setTimeout(() => cleanupTree(true), 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once on mount only

  const onConnect = useCallback(
    (params) => {
      takeSnapshot();
      let type = 'deletable';
      if (params.sourceHandle === 'spouse-out' || params.targetHandle === 'spouse-in') {
        type = 'spouse';
      } else if (params.sourceHandle === 'child-out' || params.targetHandle === 'parent-in') {
        type = 'family';
      }
      setEdges((eds) => addEdge({ ...params, type }, eds));
      setTimeout(() => cleanupTree(true), 50); 
    },
    [setEdges, takeSnapshot, cleanupTree],
  );

  const handleAddRelative = useCallback((memberId, type) => {
    setModalState({
      isOpen: true,
      mode: 'add',
      activeMemberId: memberId,
      relativeType: type,
    });
  }, []);

  const handleEdit = useCallback((memberId) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      activeMemberId: memberId,
      relativeType: null,
    });
  }, []);

  const handleDelete = useCallback((memberId) => {
    if (window.confirm('Are you sure you want to remove this person?')) {
      takeSnapshot();
      setNodes((nds) => nds.filter((n) => n.id !== memberId));
      setEdges((eds) => eds.filter((e) => e.source !== memberId && e.target !== memberId));
      setModalState({ isOpen: false, mode: 'add', activeMemberId: null, relativeType: null });
      setTimeout(() => cleanupTree(true), 100);
    }
  }, [setNodes, setEdges, takeSnapshot, cleanupTree]);

  const handleClearTree = () => {
    if (window.confirm('This will delete your entire tree. Are you sure?')) {
      takeSnapshot();
      setNodes([]);
      setEdges([]);
      localStorage.removeItem('family-tree-nodes');
      localStorage.removeItem('family-tree-edges');
    }
  };
  const handleExportTree = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({
        version: "1.0",
        name: treeName,
        nodes: nodes,
        edges: edges
      }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href",     dataStr);
    downloadAnchor.setAttribute("download", `${treeName.replace(/\s+/g, '_')}_backup.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportTree = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.nodes || !data.edges) {
          alert("Invalid backup file: 'nodes' or 'edges' data is missing.");
          return;
        }
        
        if (window.confirm("Importing this backup will overwrite your current family tree. Continue?")) {
          takeSnapshot();
          if (data.name) {
            setTreeName(data.name);
            localStorage.setItem('family-tree-name', data.name);
          }
          const { nodes: migratedNodes, edges: migratedEdges } = migrateLegacyIds(data.nodes, data.edges);
          setNodes(migratedNodes);
          setEdges(migratedEdges);
          localStorage.setItem('family-tree-nodes', JSON.stringify(migratedNodes));
          localStorage.setItem('family-tree-edges', JSON.stringify(migratedEdges));
          
          setTimeout(() => cleanupTree(true), 150);

          // Show toast
          setShowSaveToast(true);
          setTimeout(() => setShowSaveToast(false), 2000);
        }
      } catch (err) {
        alert("Failed to parse JSON backup file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  const handleSaveMember = (formData) => {
    takeSnapshot();
    if (modalState.mode === 'edit') {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === modalState.activeMemberId) {
            return {
              ...node,
              data: { ...node.data, ...formData },
            };
          }
          return node;
        })
      );
    } else {
      // Generate a stable unique ID (UUID for database compatibility)
      const newId = crypto.randomUUID();
      const parentNode = nodes.find((n) => n.id === modalState.activeMemberId);

      let x, y;

      if (parentNode) {
        // Offset from parent position in flow-space (no viewport conversion needed)
        x = parentNode.position.x;
        y = parentNode.position.y;
        if (modalState.relativeType === 'child')  { x += 0;   y += 270; }
        if (modalState.relativeType === 'spouse') { x += 220; y += 0;   }
        if (modalState.relativeType === 'parent') { x += 0;   y -= 270; }
      } else {
        // No parent: place at current viewport center
        const center = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        x = center.x - 80;
        y = center.y - 90;
      }

      const newNode = {
        id: newId,
        type: 'member',
        position: { x, y },
        data: { ...formData },
      };

      if (parentNode && modalState.relativeType === 'spouse') {
        setNodes((nds) => nds.concat(newNode));
        setEdges((eds) => {
          const edgeId = `s-${parentNode.id}-${newId}`;
          if (eds.some(e => e.id === edgeId)) return eds;
          return eds.concat({
            id: edgeId,
            source: parentNode.id,
            target: newId,
            sourceHandle: 'spouse-out',
            targetHandle: 'spouse-in',
            type: 'spouse'
          });
        });

      } else if (parentNode && modalState.relativeType === 'child') {
        const isJunction = parentNode.type === 'junction';
        let junctionId = isJunction ? parentNode.id : findMarriageJunction(parentNode.id);

        setNodes((nds) => nds.concat(newNode));

        if (junctionId) {
          setEdges((eds) => {
            const edgeId = `e-${junctionId}-${newId}`;
            if (eds.some(e => e.id === edgeId)) return eds;
            return eds.concat({
              id: edgeId,
              source: junctionId,
              target: newId,
              sourceHandle: 'child-out',
              targetHandle: 'parent-in',
              type: 'family'
            });
          });
        } else {
          // If no junction, but parent has a spouse, we should ideally find the spouse edge.
          // But for now, we'll just connect to parent directly and let cleanup handle it.
          setEdges((eds) => {
            const edgeId = `e-${parentNode.id}-${newId}`;
            if (eds.some(e => e.id === edgeId)) return eds;
            return eds.concat({
              id: edgeId,
              source: parentNode.id,
              target: newId,
              sourceHandle: 'child-out',
              targetHandle: 'parent-in',
              type: 'family'
            });
          });
        }

      } else if (parentNode && modalState.relativeType === 'parent') {
        // Add parent above the current node
        setNodes((nds) => nds.concat(newNode));
        setEdges((eds) => {
          const edgeId = `e-${newId}-${parentNode.id}`;
          if (eds.some(e => e.id === edgeId)) return eds;
          return eds.concat({
            id: edgeId,
            source: newId,
            target: parentNode.id,
            sourceHandle: 'child-out',
            targetHandle: 'parent-in',
            type: 'deletable'
          });
        });

      } else {
        setNodes((nds) => nds.concat(newNode));
      }
    }
    setModalState({ isOpen: false, mode: 'add', activeMemberId: null, relativeType: null });
    setTimeout(() => cleanupTree(true), 100);
  };

  const onNodeDrag = useCallback((event, draggedNode) => {
    if (draggedNode.type !== 'member') return;

    setNodes((nds) => {
      const connectedJunctionIds = edges
        .filter(e => e.type === 'marriage' && (e.source === draggedNode.id || e.target === draggedNode.id))
        .map(e => e.source === draggedNode.id ? e.target : e.source);

      return nds.map(n => {
        if (n.id === draggedNode.id) {
          return { ...n, position: draggedNode.position };
        }
        if (n.type === 'junction' && connectedJunctionIds.includes(n.id)) {
          const mEdges = edges.filter(e => e.target === n.id && e.type === 'marriage');
          if (mEdges.length === 2) {
            const parentAId = mEdges[0].source;
            const parentBId = mEdges[1].source;
            const pANode = parentAId === draggedNode.id ? draggedNode : nds.find(node => node.id === parentAId);
            const pBNode = parentBId === draggedNode.id ? draggedNode : nds.find(node => node.id === parentBId);
            if (pANode && pBNode) {
              const targetX = Math.round((pANode.position.x + pBNode.position.x) / 2 + 80 - 10);
              const targetY = Math.round(Math.max(pANode.position.y, pBNode.position.y) + 200);
              return { ...n, position: { x: targetX, y: targetY } };
            }
          }
        }
        return n;
      });
    });
  }, [edges, setNodes]);

  const onNodeDragStop = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const nodesWithCallbacks = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onAddRelative: handleAddRelative,
        onEdit: handleEdit,
      },
    }));
  }, [nodes, handleAddRelative, handleEdit]);

  const activeMember = modalState.activeMemberId
    ? nodes.find(n => n.id === modalState.activeMemberId)
    : null;

  return (
    <>
      <header className="k-header">
        <div className="k-header-left">
          <div className="k-logo">
            <div className="k-logo-icon">
              <TreePine size={18} />
            </div>
            <span className="k-logo-text">Kinship</span>
          </div>

          <div className="k-divider-v" />

          <input
            className="k-tree-name"
            value={treeName}
            onChange={(e) => setTreeName(e.target.value)}
            placeholder="Untitled Tree"
          />

          <div className="k-divider-v" />

          <div className={`db-status-badge ${dbStatus}`}>
            <span className="db-status-dot" />
            <span>{dbStatus === 'connected' ? 'Cloud Sync' : dbStatus === 'loading' ? 'Connecting...' : 'Local Mode'}</span>
          </div>
        </div>

        <div className="k-header-center">
          <div className="k-search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search people…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchResults.length > 0 && (
            <div className="search-results-dropdown">
              {searchResults.map(node => (
                <div
                  key={node.id}
                  className="search-result-item"
                  onClick={() => handleSelectSearchResult(node)}
                >
                  <div className="search-result-name">{node.data.name}</div>
                  <div className="search-result-meta">{node.data.birthYear || 'Unknown'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="k-header-right">
          <button className="k-tool-btn" onClick={undo} title="Undo (Ctrl+Z)" disabled={history.length === 0}>
            <Undo2 size={16} />
          </button>
          <button className="k-tool-btn" onClick={redo} title="Redo (Ctrl+Y)" disabled={redoStack.length === 0}>
            <Redo2 size={16} />
          </button>

          <div className="k-divider-v" />

          <button className="k-tool-btn accent" onClick={rearrangeEverything} title="Magic Align">
            <Wand2 size={16} />
            <span>Align</span>
          </button>

          <button className="k-tool-btn danger" onClick={handleClearTree} title="Clear entire tree">
            <Trash2 size={16} />
          </button>

          <button className="k-tool-btn" onClick={handleExportTree} title="Export Backup (JSON)">
            <Download size={16} />
          </button>

          <button className="k-tool-btn" onClick={handleImportClick} title="Import Backup (JSON)">
            <Upload size={16} />
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleImportTree}
            />
          </button>

          <div className="k-divider-v" />

          <button className="k-save-btn" onClick={handleSaveClick} disabled={isSaving}>
            <Save size={15} />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </header>

      <main style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          defaultEdgeOptions={{ type: 'deletable' }}
        >
          <Controls />
          <MiniMap />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>

        <button
          className="k-fab"
          onClick={() => setModalState({ isOpen: true, mode: 'add', activeMemberId: null, relativeType: null })}
          title="Add a New Person"
        >
          <Plus size={22} />
        </button>
      </main>

      {modalState.isOpen && (
        <MemberModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          member={activeMember}
          onClose={() => setModalState({ ...modalState, isOpen: false })}
          onSave={handleSaveMember}
          onDelete={handleDelete}
        />
      )}

      {/* Save Toast */}
      <div className={`k-toast ${showSaveToast ? 'visible' : ''}`}>
        <Check size={16} />
        <span>{saveToastMsg}</span>
      </div>
      </>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowApp />
    </ReactFlowProvider>
  );
}
