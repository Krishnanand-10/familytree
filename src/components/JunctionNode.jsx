import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

/**
 * JunctionNode — an invisible marriage-midpoint node.
 * Has a small non-zero bounding box so React Flow can correctly
 * compute handle positions (Left/Right/Bottom) for edge routing.
 *
 * Visual: a tiny dot (hidden by default, shown on hover for debug).
 */
const JunctionNode = () => {
  return (
    <div className="junction-node-container" style={{
      width: 20,
      height: 50,
      position: 'relative',
    }}>
      {/* The central junction dot */}
      <div className="junction-dot" style={{
        position: 'absolute',
        top: 3,
        left: 3,
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: 'var(--primary-color)',
        border: '2px solid white',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        zIndex: 10,
      }} />

      {/* The shared stem */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 9,
        width: 2,
        height: 40,
        background: 'var(--edge-color)',
        opacity: 0.6,
        zIndex: -1,
      }} />

      {/* Connection Handles - Larger hit area */}
      <Handle type="target" position={Position.Left}   id="parent-left"  style={{ width: 12, height: 12, opacity: 0, left: 10, top: 10 }} />
      <Handle type="target" position={Position.Right}  id="parent-right" style={{ width: 12, height: 12, opacity: 0, right: 10, top: 10 }} />
      <Handle type="target" position={Position.Top}    id="parent-in"    style={{ width: 12, height: 12, opacity: 0, left: 10, top: 10 }} />
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="child-out" 
        style={{ width: 40, height: 1, opacity: 0, top: 40, left: 10, transform: 'translateX(-50%)' }} 
      />
    </div>
  );
};

export default memo(JunctionNode);
