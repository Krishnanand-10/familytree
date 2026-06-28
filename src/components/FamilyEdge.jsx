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
  style = {},
  markerEnd,
  selected,
}) {
  // The source handle is already at the bottom of the junction stem.
  // We just need to go horizontal to the child's X, then down to the child's Y.
  const edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${sourceY} L ${targetX} ${targetY}`;

  // Calculate label position (on the horizontal segment)
  const labelX = (sourceX + targetX) / 2;
  const labelY = sourceY;

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
                  window.dispatchEvent(new CustomEvent('edge-unlink', { detail: { id, type: 'family' } }));
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
