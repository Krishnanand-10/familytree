import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const JunctionNode = () => {
  return (
    <div style={{ 
      width: 0, 
      height: 0, 
      background: 'transparent',
      position: 'relative'
    }}>

      {/* Target handle for parents */}
      <Handle type="target" position={Position.Top} id="parent-in" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} id="parent-left" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right} id="parent-right" style={{ opacity: 0 }} />
      
      {/* Source handle for children */}
      <Handle type="source" position={Position.Bottom} id="child-out" style={{ opacity: 0 }} />
    </div>
  );
};

export default memo(JunctionNode);
