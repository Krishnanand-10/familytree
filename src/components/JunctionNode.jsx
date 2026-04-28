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
      borderRadius: '50%',
      background: 'rgba(177,177,183,0.35)',  /* subtle dot, nearly invisible */
      position: 'relative',
    }}>
      {/* Parents arrive from left & right */}
      <Handle type="target" position={Position.Left}   id="parent-left"  style={{ opacity: 0, left: -1 }} />
      <Handle type="target" position={Position.Right}  id="parent-right" style={{ opacity: 0, right: -1 }} />
      {/* Parent-only (single-parent) arrives from top */}
      <Handle type="target" position={Position.Top}    id="parent-in"   style={{ opacity: 0 }} />
      {/* Children drop from bottom */}
      <Handle type="source" position={Position.Bottom} id="child-out"   style={{ opacity: 0 }} />
    </div>
  );
};

export default memo(JunctionNode);
