import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User, Users, Plus, Edit2, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';

const MemberNode = ({ data, id }) => {
  const { name, birthYear, deathYear, gender, imageUrl, isAlive, onAddRelative, onEdit } = data;

  const isFemale = gender === 'female';
  const accentColor = isFemale ? '#e91e63' : '#2196f3';

  const dateLabel = [
    birthYear || '',
    deathYear ? deathYear : (isAlive ? 'Present' : (birthYear ? 'Unknown' : ''))
  ].filter(Boolean).join(' – ');

  return (
    // ⚠️ Keep the ROOT element as a plain div — React Flow needs it
    // to correctly measure node size and position edges.
    <div className={`member-node-portrait ${isFemale ? 'female' : 'male'}`}>

      {/* React Flow handles */}
      <Handle type="target"  position={Position.Top}    id="parent-in"  />
      <Handle type="source"  position={Position.Bottom} id="child-out"  />
      <Handle type="source"  position={Position.Right}  id="spouse-out" />
      <Handle type="target"  position={Position.Left}   id="spouse-in"  />

      {/* Photo — animate on mount only (no transform on root) */}
      <motion.div
        className="portrait-photo"
        style={{ borderColor: accentColor }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={name} />
        ) : (
          <User size={44} color={accentColor} />
        )}
      </motion.div>

      {/* Info */}
      <div className="portrait-info" onClick={() => onEdit(id)}>
        <div className="portrait-name">{name || 'Unknown'}</div>
        {dateLabel && <div className="portrait-dates">{dateLabel}</div>}
      </div>

      {/* Bottom icon strip — animate on parent hover via CSS, buttons animate via Framer */}
      <div className="card-icon-strip">
        <motion.button
          className="cis-btn"
          title="Add Child"
          whileHover={{ scale: 1.18, backgroundColor: '#2196f3', color: '#fff' }}
          whileTap={{ scale: 0.88 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { e.stopPropagation(); onAddRelative(id, 'child'); }}
        >
          <Plus size={14} />
        </motion.button>
        <motion.button
          className="cis-btn"
          title="Add Spouse"
          whileHover={{ scale: 1.18, backgroundColor: '#e91e63', color: '#fff' }}
          whileTap={{ scale: 0.88 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { e.stopPropagation(); onAddRelative(id, 'spouse'); }}
        >
          <Users size={14} />
        </motion.button>
        <motion.button
          className="cis-btn"
          title="Add Parent"
          whileHover={{ scale: 1.18, backgroundColor: '#9c27b0', color: '#fff' }}
          whileTap={{ scale: 0.88 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { e.stopPropagation(); onAddRelative(id, 'parent'); }}
        >
          <UserPlus size={14} />
        </motion.button>
        <motion.button
          className="cis-btn edit"
          title="Edit"
          whileHover={{ scale: 1.18, backgroundColor: '#ff6b35', color: '#fff' }}
          whileTap={{ scale: 0.88 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { e.stopPropagation(); onEdit(id); }}
        >
          <Edit2 size={14} />
        </motion.button>
      </div>

    </div>
  );
};

export default memo(MemberNode);
