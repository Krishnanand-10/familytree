import React, { useState } from 'react';
import TreeCanvas from './components/TreeCanvas';
import { supabase } from './supabaseClient';

function App() {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const currentBranch = { id: '00000000-0000-0000-0000-000000000000', name: 'The Smith Family' };

  const handleAddMember = async () => {
    const name = prompt("Enter full name:");
    if (!name) return;
    const gender = prompt("Enter gender (male/female):", "male").toLowerCase();

    await supabase.from('people').insert([{
      full_name: name,
      gender: gender,
      branch_id: currentBranch.id
    }]);
    window.location.reload();
  };

  const handleConnect = async (params) => {
    const type = prompt("Relationship type? (parent/spouse)", "parent");
    await supabase.from('relationships').insert([{
      person_a: params.source,
      person_b: params.target,
      type: type
    }]);
    window.location.reload();
  };

  const handleDeleteEdge = async (edgeId) => {
    if (window.confirm("Delete this link?")) {
      await supabase.from('relationships').delete().eq('id', edgeId);
      window.location.reload();
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <div style={{
        position: 'fixed', top: 20, left: 20, zIndex: 10,
        display: 'flex', gap: '10px', alignItems: 'center'
      }}>
        <h2 style={{ marginRight: '20px', color: '#1e293b' }}>🌳 {currentBranch.name}</h2>
        <button className="btn-primary" onClick={handleAddMember}>+ Add Person</button>
      </div>

      <TreeCanvas 
        branchId={currentBranch.id} 
        onConnect={handleConnect}
        onEdgeClick={handleDeleteEdge}
      />

      <div style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        fontSize: '0.8rem', color: '#64748b', background: '#fff', padding: '6px 12px', borderRadius: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        💡 Tip: Drag connections 🟢 | Partners on same horizontal line | Use "spouse" link for ❤️
      </div>
    </div>
  );
}

export default App;
