import { getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import { X, Plus } from 'lucide-react';

export default function DeletableEdge({
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
  sourceHandleId,
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0,
  });

  const isSpouseEdge = sourceHandleId === 'spouse-out';
  const addButtonLabel = isSpouseEdge ? 'Add Child' : 'Add More Children';

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
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('edge-add-person', {
                    detail: { sourceId: source, targetId: target, edgeId: id }
                  }));
                }}
                title="Add Person"
              >
                <Plus size={14} />
                <span>{addButtonLabel}</span>
              </button>

              <div className="edge-menu-divider" />

              <button
                className="edge-menu-btn unlink"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to unlink these two people?')) {
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
