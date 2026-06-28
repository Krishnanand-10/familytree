import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Trash2, TreePine } from 'lucide-react';

/**
 * BranchSwitcher
 * Shows a dropdown of all saved trees. Allows creating and deleting trees.
 * Also integrates the editable tree name input to prevent duplicate "My Family Tree" labels.
 */
export default function BranchSwitcher({
  branches,
  activeBranchId,
  onSwitch,
  onCreate,
  onDelete,
  treeName,
  setTreeName,
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef(null);

  // Close dropdown on any click anywhere — using capture so React Flow canvas clicks are caught too
  useEffect(() => {
    const close = (e) => {
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
      }
    };
    window.addEventListener('click', close, true);
    window.addEventListener('pointerdown', close, true);
    return () => {
      window.removeEventListener('click', close, true);
      window.removeEventListener('pointerdown', close, true);
    };
  }, [open]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
    setCreating(false);
    setOpen(false);
  };


  return (
    <div className="branch-switcher" ref={ref}>
      <div className="branch-trigger-container">
        <div className="branch-icon-wrap" onClick={() => setOpen(v => !v)} title="Toggle list of trees">
          <TreePine size={14} />
        </div>
        
        <input
          className="branch-name-input"
          value={treeName}
          onChange={(e) => setTreeName(e.target.value)}
          placeholder="My Family Tree"
          title="Edit tree name"
        />

        <button
          className="branch-dropdown-toggle"
          onClick={() => setOpen(v => !v)}
          title="Switch Family Tree"
        >
          <ChevronDown size={13} className={`branch-chevron ${open ? 'open' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="branch-dropdown">
          <div className="branch-list">
            {branches.map(branch => (
              <div
                key={branch.id}
                className={`branch-item ${branch.id === activeBranchId ? 'active' : ''}`}
              >
                <button
                  className="branch-item-btn"
                  onClick={() => { onSwitch(branch.id); setOpen(false); }}
                >
                  <TreePine size={13} />
                  <span>{branch.name}</span>
                  {branch.id === activeBranchId && <span className="branch-active-dot" />}
                </button>
                {branches.length > 1 && (
                  <button
                    className="branch-delete-btn"
                    title="Delete tree"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(branch.id, branch.name);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="branch-divider" />

          {creating ? (
            <div className="branch-create-form">
              <input
                autoFocus
                className="branch-create-input"
                placeholder="Tree name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
              />
              <button className="branch-create-confirm" onClick={handleCreate}>Create</button>
            </div>
          ) : (
            <button className="branch-new-btn" onClick={() => setCreating(true)}>
              <Plus size={14} /> New Tree
            </button>
          )}
        </div>
      )}
    </div>
  );
}
