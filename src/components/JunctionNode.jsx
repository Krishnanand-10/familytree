import React, { memo } from 'react';
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
    <div style={{
      width: 12,
      height: 12,
      position: 'relative',
    }}>
      {/* The central junction dot */}
      <div style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: 'var(--edge-color)',
        opacity: 0.5,
      }} />

      {/* The shared stem — ensures only one vertical line comes from the junction */}
      <div style={{
        position: 'absolute',
        top: 6, // center of dot
        left: 5, // centered horizontally (12/2 - 1/2)
        width: 2,
        height: 30,
        background: 'var(--edge-color)',
        opacity: 0.8,
        zIndex: -1,
      }} />

      {/* Parents arrive from left & right */}
      <Handle type="target" position={Position.Left}   id="parent-left"  style={{ opacity: 0, left: -1 }} />
      <Handle type="target" position={Position.Right}  id="parent-right" style={{ opacity: 0, right: -1 }} />
      {/* Parent-only (single-parent) arrives from top */}
      <Handle type="target" position={Position.Top}    id="parent-in"   style={{ opacity: 0 }} />
      
      {/* Children drop from the bottom of the shared stem (30px down from center) */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="child-out" 
        style={{ opacity: 0, bottom: -24 }} // 30px total drop from center - 6px radius
      />
    </div>
  );
};

export default memo(JunctionNode);
