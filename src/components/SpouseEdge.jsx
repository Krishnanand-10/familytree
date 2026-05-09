import React from 'react';
import { EdgeLabelRenderer, BaseEdge, getSmoothStepPath } from '@xyflow/react';
import { X, Plus } from 'lucide-react';

export default function SpouseEdge({
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
  // A simple straight or smooth-step line for spouses without children
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#ff6b35' : (style.stroke || '#b1b1b7'),
          strokeWidth: selected ? 3 : 2,
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
                <span>Add Child</span>
              </button>
              <div className="edge-menu-divider" />
              <button
                className="edge-menu-btn unlink"
                onClick={(event) => {
                  event.stopPropagation();
                  if (window.confirm('Remove this marriage link?')) {
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
