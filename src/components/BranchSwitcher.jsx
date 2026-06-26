import { useState } from 'react';
import { ChevronDown, Plus, Trash2, TreePine } from 'lucide-react';

/**
 * BranchSwitcher
 * Shows a dropdown of all saved trees. Allows creating and deleting trees.
 * Calls onSwitch(branchId) when the user picks a tree.
 * Calls onCreate(name) to create a new tree.
 * Calls onDelete(branchId) to delete a tree.
 */
export default function BranchSwitcher({ branches, activeBranchId, onSwitch, onCreate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const activeBranch = branches.find(b => b.id === activeBranchId);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
    setCreating(false);
    setOpen(false);
  };

  return (
    <div className="branch-switcher" onMouseLeave={() => { setOpen(false); setCreating(false); }}>
      <button
        className="branch-trigger"
        onClick={() => setOpen(v => !v)}
        title="Switch Family Tree"
      >
        <TreePine size={14} />
        <span className="branch-name">{activeBranch?.name || 'My Family Tree'}</span>
        <ChevronDown size={13} className={`branch-chevron ${open ? 'open' : ''}`} />
      </button>

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
                      if (window.confirm(`Delete "${branch.name}"? This cannot be undone.`)) {
                        onDelete(branch.id);
                      }
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
