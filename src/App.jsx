import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { Search, Settings, Share2, Users, LayoutGrid, HelpCircle, Save, Plus } from 'lucide-react';

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

// Inner component that can use useReactFlow()
function FlowApp() {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [treeName, setTreeName] = useState(() => {
    return localStorage.getItem('family-tree-name') || 'My Family Tree';
  });

  const [nodes, setNodes, onNodesChange] = useNodesState(() => {
    const saved = localStorage.getItem('family-tree-nodes');
    return saved ? JSON.parse(saved) : initialNodes;
  });
  const [edges, setEdges, onEdgesChange] = useEdgesState(() => {
    const saved = localStorage.getItem('family-tree-edges');
    return saved ? JSON.parse(saved) : initialEdges;
  });

  // Track latest nodes/edges for cleanup logic to avoid stale closures
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
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
      const { sourceId, targetId, edgeId } = event.detail;
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
      (e.source === memberId || e.target === memberId) &&
      nodes.find(n => n.id === (e.source === memberId ? e.target : e.source))?.type === 'junction'
    );
    return edge ? (edge.source === memberId ? edge.target : edge.source) : null;
  }, [nodes, edges]);

  // Cleanup and migrate old edges to junctions

  const cleanupTree = useCallback(() => {
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

    // NEW: Find pairs from shared children (useful when parents r added from a child card)
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
      // Find children connected to either parent OR the junction
      const childEdges = newEdges.filter(e => 
        (e.source === pair.junctionId || e.source === pair.parentAId || e.source === pair.parentBId) && 
        (e.type === 'family' || e.targetHandle === 'parent-in')
      );
      const hasChildren = childEdges.length > 0;

      if (hasChildren && !pair.junctionId) {
        // Need to CREATE a junction
        const pA = newNodes.find(n => n.id === pair.parentAId);
        const pB = newNodes.find(n => n.id === pair.parentBId);
        if (pA && pB) {
          const junctionId = `j-${pA.id}-${pB.id}`;
          const jX = Math.round((pA.position.x + pB.position.x) / 2 + 80 - 6);
          const jY = Math.round(Math.max(pA.position.y, pB.position.y) + 200);
          
          if (!newNodes.find(n => n.id === junctionId)) {
            newNodes.push({
              id: junctionId,
              type: 'junction',
              position: { x: jX, y: jY },
              data: {}
            });
            hasChanged = true;
          }

          // Replace direct spouse edge with marriage edges
          newEdges = newEdges.filter(e => !((e.source === pA.id && e.target === pB.id) || (e.source === pB.id && e.target === pA.id)));
          
          if (!newEdges.find(e => e.id === `e-${pA.id}-${junctionId}`)) {
            newEdges.push({ id: `e-${pA.id}-${junctionId}`, source: pA.id, target: junctionId, sourceHandle: 'child-out', targetHandle: 'parent-left', type: 'marriage' });
            hasChanged = true;
          }
          if (!newEdges.find(e => e.id === `e-${pB.id}-${junctionId}`)) {
            newEdges.push({ id: `e-${pB.id}-${junctionId}`, source: pB.id, target: junctionId, sourceHandle: 'child-out', targetHandle: 'parent-right', type: 'marriage' });
            hasChanged = true;
          }

          // Re-route children to the new junction and remove duplicates
          const seenChildren = new Set();
          newEdges = newEdges.filter(e => {
            if (childEdges.some(ce => ce.id === e.id)) {
              if (seenChildren.has(e.target)) return false; // Remove redundant parent-to-child lines
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
        // Need to REMOVE the junction and replace with direct spouse link
        newNodes = newNodes.filter(n => n.id !== pair.junctionId);
        newEdges = newEdges.filter(e => e.target !== pair.junctionId && e.source !== pair.junctionId);
        
        const edgeId = `s-${pair.parentAId}-${pair.parentBId}`;
        if (!newEdges.find(e => e.id === edgeId)) {
          newEdges.push({
            id: edgeId,
            source: pair.parentAId,
            target: pair.parentBId,
            sourceHandle: 'spouse-out',
            targetHandle: 'spouse-in',
            type: 'spouse'
          });
        }
        hasChanged = true;
      } else if (hasChildren && pair.junctionId) {
        // Ensure junction is centered
        const pA = newNodes.find(n => n.id === pair.parentAId);
        const pB = newNodes.find(n => n.id === pair.parentBId);
        const node = newNodes.find(n => n.id === pair.junctionId);
        if (pA && pB && node) {
          const targetX = Math.round((pA.position.x + pB.position.x) / 2 + 80 - 6);
          const targetY = Math.round(Math.max(pA.position.y, pB.position.y) + 200);
          if (Math.abs(node.position.x - targetX) > 1 || Math.abs(node.position.y - targetY) > 1) {
            const idx = newNodes.findIndex(n => n.id === node.id);
            newNodes[idx] = { ...node, position: { x: targetX, y: targetY } };
            hasChanged = true;
          }
        }
      }
    });

    // 3. Auto-align sibling children (same as before)
    const childrenByParent = {};
    newEdges.forEach(e => {
      if (e.type === 'family') {
        if (!childrenByParent[e.source]) childrenByParent[e.source] = [];
        childrenByParent[e.source].push(e.target);
      }
    });

    Object.entries(childrenByParent).forEach(([parentId, childIds]) => {
      if (childIds.length > 1) {
        const siblingNodes = childIds.map(id => newNodes.find(n => n.id === id)).filter(Boolean);
        if (siblingNodes.length === 0) return;

        let maxY = 0;
        siblingNodes.forEach(node => { if (node.position.y > maxY) maxY = node.position.y; });

        siblingNodes.sort((a, b) => a.position.x - b.position.x);
        const spacing = 220;
        const parentNode = newNodes.find(n => n.id === parentId);
        
        let centerX = 0;
        if (parentNode) {
          centerX = parentNode.position.x + (parentNode.type === 'member' ? 80 : 6);
        }

        const startX = centerX - ((siblingNodes.length - 1) * spacing) / 2;

        siblingNodes.forEach((node, i) => {
          const targetX = Math.round(startX + i * spacing - 80); 
          const targetY = Math.round(maxY);
          if (Math.abs(node.position.x - targetX) > 1 || Math.abs(node.position.y - targetY) > 1) {
            const nodeIndex = newNodes.findIndex(n => n.id === node.id);
            newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: { x: targetX, y: targetY } };
            hasChanged = true;
          }
        });
      }
    });

    if (hasChanged) {
      setNodes(newNodes);
      setEdges(newEdges);
      takeSnapshot();
    }
  }, [setNodes, setEdges, takeSnapshot]);

  // Run cleanup once after mount — empty dep array so it only fires once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = setTimeout(cleanupTree, 800);
    return () => clearTimeout(timer);
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
      setTimeout(cleanupTree, 50); 
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
    }
  }, [setNodes, setEdges, takeSnapshot]);

  const handleClearTree = () => {
    if (window.confirm('This will delete your entire tree. Are you sure?')) {
      takeSnapshot();
      setNodes([]);
      setEdges([]);
      localStorage.removeItem('family-tree-nodes');
      localStorage.removeItem('family-tree-edges');
    }
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
      // Generate a stable unique ID (timestamp + random suffix to avoid collisions)
      const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
    setTimeout(cleanupTree, 100);
  };

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
      <header className="navbar">
        <div className="navbar-left">
          <div className="logo">
            <div className="logo-icon">M</div>
            MyHeritage
          </div>
          <nav className="nav-links">
            <a href="#" className="nav-link">Home</a>
            <a href="#" className="nav-link active">Family tree</a>
            <a href="#" className="nav-link">Discoveries</a>
            <a href="#" className="nav-link">Photos</a>
            <a href="#" className="nav-link">DNA</a>
            <a href="#" className="nav-link">Research</a>
          </nav>
        </div>
        <div className="navbar-right" style={{ display: 'flex', gap: '10px' }}>
          <button className="action-btn" onClick={handleClearTree} title="Clear Tree" style={{ color: '#e91e63' }}>
            Reset
          </button>
          <button className="save-btn" style={{ padding: '6px 12px', fontSize: '13px' }}>
            <Save size={14} /> Save Tree
          </button>
        </div>
      </header>

      <div className="toolbar">
        <input
          className="tree-title"
          value={treeName}
          onChange={(e) => setTreeName(e.target.value)}
          style={{ border: 'none', background: 'transparent', width: 'auto', minWidth: '150px', outline: 'none', cursor: 'pointer' }}
          placeholder="Enter Tree Name..."
        />
        <div style={{ flex: 1 }}></div>
        <div className="nav-links" style={{ gap: '10px' }}>
          <button className="action-btn" title="Family View"><Users size={18} /> Family view</button>
          <button className="action-btn"><Share2 size={18} /></button>
          <button className="action-btn"><LayoutGrid size={18} /></button>
        </div>
        <div style={{ borderLeft: '1px solid #ddd', height: '24px', margin: '0 10px' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f5f5f5', padding: '4px 12px', borderRadius: '20px' }}>
          <Search size={16} color="#666" />
          <input type="text" placeholder="Find a person..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px' }} />
        </div>
        <button className="action-btn"><Settings size={18} /></button>
        <button className="action-btn"><HelpCircle size={18} /></button>
      </div>

      <main style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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
          className="save-btn"
          style={{ position: 'absolute', bottom: '20px', right: '20px', borderRadius: '50%', width: '50px', height: '50px', padding: 0, justifyContent: 'center', zIndex: 10 }}
          onClick={() => setModalState({ isOpen: true, mode: 'add', activeMemberId: null, relativeType: null })}
          title="Add Starting Person"
        >
          <Plus size={24} />
        </button>
      </main>

      <MemberModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        member={activeMember}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onSave={handleSaveMember}
        onDelete={handleDelete}
      />
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
