import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  applyEdgeChanges, 
  applyNodeChanges 
} from 'reactflow';
import 'reactflow/dist/style.css';
import PersonCard from './PersonCard';
import { supabase } from '../supabaseClient';

const nodeTypes = {
  person: PersonCard,
};

const TreeCanvas = (props) => {
  const { branchId } = props;
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const fetchData = useCallback(async () => {
    const { data: people, error: pError } = await supabase
      .from('people')
      .select('*')
      .eq('branch_id', branchId);

    if (pError) return console.error(pError);

    const newNodes = people.map((p, index) => ({
      id: p.id,
      type: 'person',
      data: { ...p },
      position: { 
        x: p.x ?? (100 + (index % 4) * 200), 
        y: p.y ?? (50 + Math.floor(index / 4) * 250) 
      }
    }));

    const { data: rels, error: rError } = await supabase
      .from('relationships')
      .select('*');

    if (!rError) {
      const newEdges = rels.map(r => ({
        id: r.id,
        source: r.person_a,
        target: r.person_b,
        type: 'smoothstep', // Gives the 90-degree corner look!
        label: r.type === 'spouse' ? '❤️' : '',
        labelStyle: { fontSize: '1.2rem', fill: '#fb7185' },
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        animated: r.type === 'spouse'
      }));
      setEdges(newEdges);
    }
    setNodes(newNodes);
  }, [branchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onNodeDragStop = useCallback(async (event, node) => {
    await supabase
      .from('people')
      .update({ x: node.position.x, y: node.position.y })
      .eq('id', node.id);
  }, []);

  const onConnect = (params) => props.onConnect?.(params);
  const onNodeClick = (event, node) => props.onNodeClick?.(node.data);
  const onEdgeClick = (event, edge) => props.onEdgeClick?.(edge.id);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f1f5f9' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#cbd5e1" gap={20} variant="dots" />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default TreeCanvas;
