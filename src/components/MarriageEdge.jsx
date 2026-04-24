import React from 'react';
import { BaseEdge } from '@xyflow/react';

export default function MarriageEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  selected,
}) {
  // Always go STRAIGHT DOWN from parent, then STRAIGHT SIDE to junction
  // This ensures the horizontal line is perfectly straight and single
  const edgePath = `M ${sourceX} ${sourceY} L ${sourceX} ${targetY} L ${targetX} ${targetY}`;

  return (
    <BaseEdge 
      path={edgePath} 
      markerEnd={markerEnd} 
      style={{ 
        ...style, 
        stroke: selected ? '#ff6b35' : (style.stroke || '#b1b1b7'),
        strokeWidth: selected ? 3 : 2
      }} 
    />
  );
}
