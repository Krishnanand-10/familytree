import { useState, useEffect, useCallback } from 'react';
import { X, UserPlus, Trash2, Mail, Shield, ShieldCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ShareModal = ({ isOpen, onClose, branchId, apiFetch, userEmail, userRole }) => {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState('viewer');
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchShares = useCallback(async () => {
    if (!branchId || branchId === 'default') return;
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/branches/${branchId}/shares`);
      if (res.ok) {
        const data = await res.json();
        setShares(data);
      }
    } catch (err) {
      console.error('Failed to load branch shares:', err);
    } finally {
      setLoading(false);
    }
  }, [branchId, apiFetch]);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchShares();
      setStatusMessage({ type: '', text: '' });
      setEmailInput('');
      setRoleInput('viewer');
    }
  }, [isOpen, fetchShares]);

  const handleAddShare = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    if (emailInput.trim().toLowerCase() === userEmail.toLowerCase()) {
      setStatusMessage({ type: 'error', text: "You cannot share a tree with yourself." });
      return;
    }

    setSubmitting(true);
    setStatusMessage({ type: '', text: '' });
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/branches/${branchId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim().toLowerCase(), role: roleInput })
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Tree shared successfully!' });
        setEmailInput('');
        fetchShares();
      } else {
        const errData = await res.json();
        setStatusMessage({ type: 'error', text: errData.error || 'Failed to share tree.' });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Error connecting to server.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeShare = async (shareId) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/branches/${branchId}/shares/${shareId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Access revoked successfully.' });
        fetchShares();
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to revoke access.' });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Error connecting to server.' });
    }
  };

  const handleUpdateRole = async (shareId, newRole) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/branches/${branchId}/shares/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Permission updated successfully.' });
        fetchShares();
      } else {
        const errData = await res.json();
        setStatusMessage({ type: 'error', text: errData.error || 'Failed to update permission.' });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Error connecting to server.' });
    }
  };

  const isOwner = userRole === 'owner';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.div
            className="modal-container share-modal"
            initial={{ opacity: 0, scale: 0.88, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 32 }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ maxWidth: '500px' }}
          >
            <div className="modal-header">
              <h2>Share Family Tree</h2>
              <motion.button
                onClick={onClose}
                className="close-btn"
                whileHover={{ scale: 1.15, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={18} />
              </motion.button>
            </div>

            <div className="modal-body" style={{ padding: '24px' }}>
              {isOwner ? (
                <form onSubmit={handleAddShare} className="share-invite-form" style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Invite Collaborator</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input
                        type="email"
                        placeholder="collaborator@example.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-alt)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <select
                      value={roleInput}
                      onChange={(e) => setRoleInput(e.target.value)}
                      style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-alt)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <motion.button
                      type="submit"
                      disabled={submitting}
                      style={{
                        padding: '10px 20px',
                        height: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#1a1a1a',
                        color: '#ffffff',
                        border: '1px solid rgba(0,0,0,0.15)',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: submitting ? 'default' : 'pointer',
                        opacity: submitting ? 0.6 : 1,
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                      whileHover={{ opacity: submitting ? 0.6 : 0.85 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                      <span>Invite</span>
                    </motion.button>
                  </div>
                </form>
              ) : (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', marginBottom: '24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Shield size={16} />
                  <span>You are a guest ({userRole}) on this tree. Only the owner can invite new members.</span>
                </div>
              )}

              {statusMessage.text && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    marginBottom: '16px',
                    backgroundColor: statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    color: statusMessage.type === 'error' ? '#ef4444' : '#22c55e',
                    border: `1px solid ${statusMessage.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`
                  }}
                >
                  {statusMessage.text}
                </div>
              )}

              <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>People with Access</h3>
              
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                </div>
              ) : (
                <div className="shares-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                  {shares.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      This tree is not shared with anyone yet.
                    </div>
                  )}
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{share.shared_with_email}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {share.role === 'editor' ? <ShieldCheck size={12} style={{ color: 'var(--accent-color)' }} /> : <Shield size={12} style={{ color: 'var(--text-muted)' }} />}
                          {isOwner ? (
                            <select
                              value={share.role}
                              onChange={(e) => handleUpdateRole(share.id, e.target.value)}
                              style={{
                                fontSize: '11px',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                outline: 'none',
                                borderRadius: '4px',
                                borderBottom: '1px dashed var(--border-color)'
                              }}
                            >
                              <option value="viewer">Viewer</option>
                              <option value="editor">Editor</option>
                            </select>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {share.role.charAt(0).toUpperCase() + share.role.slice(1)}
                            </span>
                          )}
                          {share.status === 'pending' && (
                            <span style={{ fontSize: '10px', color: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto' }}>
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {isOwner && (
                        <motion.button
                          onClick={() => handleRevokeShare(share.id)}
                          style={{
                            padding: '6px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: '8px'
                          }}
                          whileHover={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                          whileTap={{ scale: 0.95 }}
                          title="Revoke access"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareModal;
