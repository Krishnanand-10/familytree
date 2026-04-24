import React from 'react';
import { EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import { X, Plus } from 'lucide-react';

export default function FamilyEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}) {
  // Set to 0 to make the marriage line and sibling line the same
  const junctionDrop = 0; 
  
  // Create a "Comb" path: Down -> Horizontal -> Down
  const edgePath = `M ${sourceX} ${sourceY} 
                    L ${sourceX} ${sourceY + junctionDrop} 
                    L ${targetX} ${sourceY + junctionDrop} 
                    L ${targetX} ${targetY}`;

  // Calculate label position (on the horizontal bar)
  const labelX = (sourceX + targetX) / 2;
  const labelY = sourceY + junctionDrop;

  return (
    <>
      {/* Interaction path */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        style={{ cursor: 'pointer' }}
      />
      
      {/* Visible edge */}
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{ 
          ...style, 
          stroke: selected ? '#ff6b35' : (style.stroke || '#b1b1b7'),
          strokeWidth: selected ? 3 : 2
        }} 
      />
      
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1001,
          }}
          className="nodrag nopan"
        >
          <div className={`edge-controls-container ${selected ? 'is-selected' : ''}`}>
            <div className="edge-action-menu">
              <button 
                className="edge-menu-btn add" 
                onClick={(event) => {
                  event.stopPropagation();
                  window.dispatchEvent(new CustomEvent('edge-add-person', { 
                    detail: { sourceId: source, targetId: target, edgeId: id } 
                  }));
                }}
              >
                <Plus size={14} />
                <span>Add More Children</span>
              </button>
              
              <div className="edge-menu-divider" />
              
              <button 
                className="edge-menu-btn unlink" 
                onClick={(event) => {
                  event.stopPropagation();
                  if (window.confirm('Unlink this child?')) {
                    window.dispatchEvent(new CustomEvent('edge-unlink', { detail: { id } }));
                  }
                }}
              >
                <X size={14} />
                <span>Unlink</span>
              </button>
            </div>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
