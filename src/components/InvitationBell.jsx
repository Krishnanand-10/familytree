import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Check, X, Eye, Pencil, TreePine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');

export default function InvitationBell({ apiFetch, onInvitationAccepted }) {
  const [invitations, setInvitations] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const dropdownRef = useRef(null);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/invitations`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      }
    } catch {
      // Silently ignore — bell just shows nothing
    }
  }, [apiFetch]);

  // Fetch on mount, then poll every 60s
  useEffect(() => {
    fetchInvitations();
    const interval = setInterval(fetchInvitations, 60000);
    return () => clearInterval(interval);
  }, [fetchInvitations]);

  // Close on outside click — use capture so React Flow canvas clicks are caught too
  useEffect(() => {
    const close = (e) => {
      if (!isOpen) return;
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('click', close, true);
    window.addEventListener('pointerdown', close, true);
    return () => {
      window.removeEventListener('click', close, true);
      window.removeEventListener('pointerdown', close, true);
    };
  }, [isOpen]);

  const handleAccept = async (invitation) => {
    setProcessingId(invitation.id);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/invitations/${invitation.id}/accept`, {
        method: 'POST'
      });
      if (res.ok) {
        setInvitations(prev => prev.filter(i => i.id !== invitation.id));
        onInvitationAccepted();
      }
    } catch { /* noop */ } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitation) => {
    setProcessingId(invitation.id);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/invitations/${invitation.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setInvitations(prev => prev.filter(i => i.id !== invitation.id));
      }
    } catch { /* noop */ } finally {
      setProcessingId(null);
    }
  };

  const count = invitations.length;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>

      {/* ── Bell Button ── */}
      <motion.button
        onClick={() => setIsOpen(prev => !prev)}
        className={`k-tool-btn${count > 0 ? ' accent' : ''}`}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        title="Invitations"
        style={{ position: 'relative' }}
      >
        <Bell size={17} strokeWidth={1.8} />

        {/* Small glowing dot — no number, just a pulse */}
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key="dot"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#f87171',
                boxShadow: '0 0 0 2px var(--bg-toolbar, #1a1a2e), 0 0 6px rgba(248,113,113,0.7)',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Dropdown Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              right: 0,
              width: '300px',
              background: '#111116',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05) inset',
              zIndex: 99999,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '13px 16px 11px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <Bell size={14} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{
                fontWeight: 600,
                fontSize: '13px',
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: '0.01em',
              }}>
                Invitations
              </span>
              {count > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  backgroundColor: 'rgba(248,113,113,0.12)',
                  color: '#f87171',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '999px',
                  letterSpacing: '0.03em',
                }}>
                  {count} new
                </span>
              )}
            </div>

            {/* List */}
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {count === 0 ? (
                <div style={{
                  padding: '36px 16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <TreePine size={26} style={{ color: 'rgba(255,255,255,0.15)' }} />
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                    No pending invitations
                  </span>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {invitations.map((inv) => {
                    const treeName = inv.family_branches?.name || 'Unnamed Tree';
                    const role = inv.role || 'viewer';
                    const isProcessing = processingId === inv.id;

                    return (
                      <motion.div
                        key={inv.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.07)',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                          {/* Tree info row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                            {/* Icon */}
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.12))',
                              border: '1px solid rgba(99,102,241,0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <TreePine size={17} style={{ color: '#818cf8' }} />
                            </div>

                            {/* Name + role */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: 'rgba(255,255,255,0.88)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                marginBottom: '3px',
                              }}>
                                {treeName}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: 'rgba(255,255,255,0.35)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}>
                                {role === 'editor'
                                  ? <Pencil size={10} style={{ color: '#a78bfa' }} />
                                  : <Eye size={10} />
                                }
                                {role === 'editor' ? 'Can edit' : 'View only'}
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <motion.button
                              onClick={() => handleAccept(inv)}
                              disabled={isProcessing}
                              whileHover={!isProcessing ? { scale: 1.02 } : {}}
                              whileTap={!isProcessing ? { scale: 0.97 } : {}}
                              style={{
                                flex: 1,
                                padding: '8px 0',
                                borderRadius: '8px',
                                border: '1px solid rgba(74,222,128,0.25)',
                                background: 'rgba(74,222,128,0.08)',
                                color: '#4ade80',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: isProcessing ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                opacity: isProcessing ? 0.45 : 1,
                                fontFamily: 'inherit',
                                letterSpacing: '0.01em',
                                transition: 'background 0.15s',
                              }}
                            >
                              <Check size={12} strokeWidth={2.5} />
                              Accept
                            </motion.button>

                            <motion.button
                              onClick={() => handleDecline(inv)}
                              disabled={isProcessing}
                              whileHover={!isProcessing ? { scale: 1.02 } : {}}
                              whileTap={!isProcessing ? { scale: 0.97 } : {}}
                              style={{
                                flex: 1,
                                padding: '8px 0',
                                borderRadius: '8px',
                                border: '1px solid rgba(248,113,113,0.2)',
                                background: 'rgba(248,113,113,0.06)',
                                color: '#f87171',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: isProcessing ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                opacity: isProcessing ? 0.45 : 1,
                                fontFamily: 'inherit',
                                letterSpacing: '0.01em',
                                transition: 'background 0.15s',
                              }}
                            >
                              <X size={12} strokeWidth={2.5} />
                              Decline
                            </motion.button>
                          </div>

                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
