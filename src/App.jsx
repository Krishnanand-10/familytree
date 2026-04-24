import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import MemberNode from './components/MemberNode';
import MemberModal from './components/MemberModal';
import DeletableEdge from './components/DeletableEdge';
import FamilyEdge from './components/FamilyEdge';
import MarriageEdge from './components/MarriageEdge';
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
};

export default function App() {
  const [treeName, setTreeName] = useState(() => {
    return localStorage.getItem('family-tree-name') || 'My Family Tree';
  });

  // Start with empty arrays if nothing is saved
  const [nodes, setNodes, onNodesChange] = useNodesState(() => {
    const saved = localStorage.getItem('family-tree-nodes');
    return saved ? JSON.parse(saved) : [];
  });
  const [edges, setEdges, onEdgesChange] = useEdgesState(() => {
    const saved = localStorage.getItem('family-tree-edges');
    const parsed = saved ? JSON.parse(saved) : [];
    // Migration: ensure all old edges use the new 'deletable' type
    return parsed.map(edge => ({
      ...edge,
      type: (edge.type === 'smoothstep' || !edge.type) ? 'deletable' : edge.type
    }));
  });

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
    let newEdges = [...edges];
    let newNodes = [...nodes];

    // 1. Create junctions for married pairs who don't have one
    const members = nodes.filter(n => n.type === 'member');
    for (const parentA of members) {
      // Find a spouse (connected via 'Married' label or 'spouse-out' handle)
      const spouseEdge = newEdges.find(e =>
        (e.source === parentA.id || e.target === parentA.id) &&
        (e.label === 'Married' || e.sourceHandle === 'spouse-out') &&
        nodes.find(n => n.id === (e.source === parentA.id ? e.target : e.source))?.type === 'member'
      );

      if (spouseEdge) {
        const parentBId = spouseEdge.source === parentA.id ? spouseEdge.target : spouseEdge.source;
        const parentB = nodes.find(n => n.id === parentBId);

        // Only create if neither has a junction already
        if (parentB && !findMarriageJunction(parentA.id) && !findMarriageJunction(parentBId)) {
          const junctionId = `j-${parentA.id}-${parentBId}`;

          // Check if already exists in our local list to avoid duplicates in this loop
          if (!newNodes.find(n => n.id === junctionId)) {
            newNodes.push({
              id: junctionId,
              type: 'junction',
              position: {
                x: (parentA.position.x + parentB.position.x + 220) / 2,
                y: parentA.position.y + 130
              },
              data: {}
            });

            newEdges.push(
              { id: `e-${parentA.id}-${junctionId}`, source: parentA.id, target: junctionId, sourceHandle: 'child-out', targetHandle: 'parent-left', type: 'marriage' },
              { id: `e-${parentBId}-${junctionId}`, source: parentBId, target: junctionId, sourceHandle: 'child-out', targetHandle: 'parent-right', type: 'marriage' }
            );

            newEdges = newEdges.filter(e => e.id !== spouseEdge.id);
            hasChanged = true;
          }
        }
      }
    }

    // 2. Migrate direct parent-child edges to junctions if they exist
    newEdges = newEdges.map(edge => {
      const parent = nodes.find(n => n.id === edge.source);
      if (parent && parent.type === 'member' && edge.targetHandle === 'parent-in' && edge.sourceHandle === 'child-out') {
        const junctionId = findMarriageJunction(parent.id);
        if (junctionId && edge.source !== junctionId) {
          hasChanged = true;
          return { ...edge, source: junctionId, type: 'family' };
        }
        if (junctionId && edge.type !== 'family') {
          hasChanged = true;
          return { ...edge, type: 'family' };
        }
      }
      return edge;
    });

    if (hasChanged) {
      setNodes(newNodes);
      setEdges(newEdges);
      takeSnapshot();
    }
  }, [nodes, edges, findMarriageJunction, setNodes, setEdges, takeSnapshot]);

  // Run cleanup once on load to fix any messy existing lines
  useEffect(() => {
    const timer = setTimeout(() => {
      cleanupTree();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const onConnect = useCallback(
    (params) => {
      takeSnapshot();
      setEdges((eds) => addEdge({ ...params, type: 'deletable' }, eds));
    },
    [setEdges, takeSnapshot],
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
      const newId = Date.now().toString();
      const parentNode = nodes.find((n) => n.id === modalState.activeMemberId);

      let x = window.innerWidth / 2 - 110;
      let y = 100;

      if (parentNode) {
        x = parentNode.position.x;
        y = parentNode.position.y;

        if (modalState.relativeType === 'child') y += 200;
        if (modalState.relativeType === 'spouse') x += 250;
        if (modalState.relativeType === 'parent') y -= 200;
      }

      const newNode = {
        id: newId,
        type: 'member',
        position: { x, y },
        data: { ...formData },
      };

      if (parentNode && modalState.relativeType === 'spouse') {
        const junctionId = `j-${parentNode.id}-${newId}`;
        const junctionNode = {
          id: junctionId,
          type: 'junction',
          position: {
            x: (parentNode.position.x + x + 220) / 2,
            y: parentNode.position.y + 110
          },
          data: {}
        };

        setNodes((nds) => nds.concat(newNode, junctionNode));
        setEdges((eds) => {
          // Remove any direct marriage edge if it exists
          const filtered = eds.filter(e => !(
            (e.source === parentNode.id && e.target === newId) ||
            (e.source === newId && e.target === parentNode.id)
          ));
          return filtered.concat([
            { id: `e-${parentNode.id}-${junctionId}`, source: parentNode.id, target: junctionId, sourceHandle: 'child-out', targetHandle: 'parent-left', type: 'marriage' },
            { id: `e-${newId}-${junctionId}`, source: newId, target: junctionId, sourceHandle: 'child-out', targetHandle: 'parent-right', type: 'marriage' }
          ]);
        });
      } else if (parentNode && modalState.relativeType === 'child') {
        const isJunction = parentNode.type === 'junction';
        const junctionId = isJunction ? parentNode.id : findMarriageJunction(parentNode.id);

        setNodes((nds) => nds.concat(newNode));

        if (junctionId) {
          setEdges((eds) => eds.concat({
            id: `e-${junctionId}-${newId}`,
            source: junctionId,
            target: newId,
            sourceHandle: 'child-out',
            targetHandle: 'parent-in',
            type: 'family'
          }));
        } else {
          setEdges((eds) => eds.concat({
            id: `e-${parentNode.id}-${newId}`,
            source: parentNode.id,
            target: newId,
            sourceHandle: 'child-out',
            targetHandle: 'parent-in',
            type: 'deletable'
          }));
        }

      } else {
        setNodes((nds) => nds.concat(newNode));
      }
    }
    setModalState({ isOpen: false, mode: 'add', activeMemberId: null, relativeType: null });
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
