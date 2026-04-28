import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User, Users, Plus, Edit2 } from 'lucide-react';

const MemberNode = ({ data, id }) => {
  const { name, birthYear, deathYear, gender, imageUrl, isAlive, onAddRelative, onEdit } = data;

  const isFemale = gender === 'female';
  const accentColor = isFemale ? '#e91e63' : '#2196f3';

  const dateLabel = [
    birthYear || '',
    deathYear ? deathYear : (isAlive ? 'Present' : (birthYear ? 'Unknown' : ''))
  ].filter(Boolean).join(' – ');

  return (
    <div className={`member-node-portrait ${isFemale ? 'female' : 'male'}`}>

      {/* React Flow handles */}
      <Handle type="target"  position={Position.Top}    id="parent-in"  />
      <Handle type="source"  position={Position.Bottom} id="child-out"  />
      <Handle type="source"  position={Position.Right}  id="spouse-out" />
      <Handle type="target"  position={Position.Left}   id="spouse-in"  />

      {/* Top-corner action buttons */}
      <div className="portrait-actions">
        <button
          className="pa-btn"
          title="Add Child"
          onClick={(e) => { e.stopPropagation(); onAddRelative(id, 'child'); }}
        >
          <Plus size={12} />
        </button>
        <button
          className="pa-btn"
          title="Add Spouse"
          onClick={(e) => { e.stopPropagation(); onAddRelative(id, 'spouse'); }}
        >
          <Users size={12} />
        </button>
        <button
          className="pa-btn edit"
          title="Edit"
          onClick={(e) => { e.stopPropagation(); onEdit(id); }}
        >
          <Edit2 size={12} />
        </button>
      </div>

      {/* Photo */}
      <div className="portrait-photo" style={{ borderColor: accentColor }}>
        {imageUrl ? (
          <img src={imageUrl} alt={name} />
        ) : (
          <User size={36} color={accentColor} />
        )}
      </div>

      {/* Info */}
      <div className="portrait-info" onClick={() => onEdit(id)}>
        <div className="portrait-name">{name || 'Unknown'}</div>
        {dateLabel && <div className="portrait-dates">{dateLabel}</div>}
      </div>

    </div>
  );
};

export default memo(MemberNode);
