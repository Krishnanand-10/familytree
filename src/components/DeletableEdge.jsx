import { useState } from 'react';
import { getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import { X, Plus, Tag } from 'lucide-react';

const RELATIONSHIP_LABELS = [
  { value: '',           display: 'None' },
  { value: 'Biological', display: 'Biological' },
  { value: 'Adopted',    display: 'Adopted' },
  { value: 'Step-child', display: 'Step-child' },
  { value: 'Guardian',   display: 'Guardian' },
  { value: 'Foster',     display: 'Foster' },
];

const LABEL_COLORS = {
  'Biological': '#2196f3',
  'Adopted':    '#9c27b0',
  'Step-child': '#ff9800',
  'Guardian':   '#4caf50',
  'Foster':     '#00bcd4',
};

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
  label,
  selected,
  sourceHandleId,
}) {
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0,
  });

  const isSpouseEdge = sourceHandleId === 'spouse-out' || label === 'Married';
  const addButtonLabel = isSpouseEdge ? 'Add Child' : 'Add More Children';
  const labelColor = LABEL_COLORS[label] || '#888';

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

            {/* Relationship label pill — always visible if set */}
            {label && (
              <div
                className="edge-label-pill"
                style={{ background: labelColor }}
                title={label}
              >
                {label}
              </div>
            )}

            {/* Action menu — shown on hover/select */}
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

              {/* Label picker toggle — only for family/child edges */}
              {!isSpouseEdge && (
                <>
                  <div className="edge-label-picker-wrap">
                    <button
                      className="edge-menu-btn label-btn"
                      onClick={(e) => { e.stopPropagation(); setShowLabelPicker(v => !v); }}
                      title="Set Relationship Label"
                    >
                      <Tag size={14} />
                      <span>{label || 'Label'}</span>
                    </button>

                    {showLabelPicker && (
                      <div className="edge-label-dropdown" onClick={e => e.stopPropagation()}>
                        {RELATIONSHIP_LABELS.map(opt => (
                          <button
                            key={opt.value}
                            className={`edge-label-option ${label === opt.value ? 'active' : ''}`}
                            style={opt.value ? { '--opt-color': LABEL_COLORS[opt.value] } : {}}
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(new CustomEvent('edge-set-label', {
                                detail: { id, label: opt.value }
                              }));
                              setShowLabelPicker(false);
                            }}
                          >
                            {opt.value && (
                              <span
                                className="edge-label-dot"
                                style={{ background: LABEL_COLORS[opt.value] }}
                              />
                            )}
                            {opt.display}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="edge-menu-divider" />
                </>
              )}

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
