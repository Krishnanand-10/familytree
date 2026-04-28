import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User, Users, Plus, Edit2, Camera } from 'lucide-react';

const MemberNode = ({ data, id }) => {
  const { name, birthYear, deathYear, gender, imageUrl, isAlive, onAddRelative, onEdit } = data;
  
  return (
    <div className={`member-node ${gender === 'female' ? 'female' : 'male'}`}>
      {/* Top Handles for parents */}
      <Handle type="target" position={Position.Top} id="parent-in" style={{ background: '#555' }} />
      
      <div className="member-content">
        <div className={`member-avatar ${imageUrl ? 'has-photo' : ''}`}>
          {imageUrl ? (
            <img src={imageUrl} alt={name} />
          ) : (
            <User size={30} color={gender === 'female' ? '#e91e63' : '#2196f3'} />
          )}
        </div>
        
        <div className="member-info" onClick={() => onEdit(id)}>
          <div className="member-name">{name}</div>
          <div className="member-dates">
            {birthYear} — {deathYear || (isAlive ? 'Present' : 'Unknown')}
          </div>
        </div>
      </div>

      <div className="member-actions">
        <button 
          className="action-btn" 
          title="Add Child"
          onClick={(e) => { e.stopPropagation(); onAddRelative(id, 'child'); }}
        >
          <Plus size={16} />
        </button>
        <button 
          className="action-btn" 
          title="Add Spouse"
          onClick={(e) => { e.stopPropagation(); onAddRelative(id, 'spouse'); }}
        >
          <Users size={16} />
        </button>
        <button 
          className="action-btn" 
          title="Edit"
          onClick={(e) => { e.stopPropagation(); onEdit(id); }}
        >
          <Edit2 size={16} />
        </button>
      </div>

      {/* Bottom Handles for children */}
      <Handle type="source" position={Position.Bottom} id="child-out" style={{ background: '#555' }} />
      
      {/* Side Handles for spouses */}
      <Handle type="source" position={Position.Right} id="spouse-out" style={{ background: '#ff6b35', top: '50%' }} />
      <Handle type="target" position={Position.Left} id="spouse-in" style={{ background: '#ff6b35', top: '50%' }} />
    </div>
  );
};

export default memo(MemberNode);
