import React from 'react';
import { EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import { X } from 'lucide-react';

export default function MarriageEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  selected,
}) {
  // Always go STRAIGHT DOWN from parent, then STRAIGHT SIDE to junction
  const edgePath = `M ${sourceX} ${sourceY} L ${sourceX} ${targetY} L ${targetX} ${targetY}`;

  // Place label on the horizontal segment of the marriage line
  const labelX = (sourceX + targetX) / 2;
  const labelY = targetY;

  return (
    <>
      {/* Interaction path - thicker for easier clicking/hovering */}
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
                className="edge-menu-btn unlink"
                onClick={(event) => {
                  event.stopPropagation();
                  if (window.confirm('Remove this marriage link?')) {
                    window.dispatchEvent(new CustomEvent('edge-unlink', { detail: { id } }));
                  }
                }}
                title="Unlink"
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
