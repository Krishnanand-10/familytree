import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, ShieldAlert, Camera, LogOut, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function UserProfileSettingsModal({ isOpen, onClose, session, onSessionUpdate }) {
  const fileInputRef = useRef(null);
  
  // Current user metadata
  const user = session?.user;
  const userMeta = user?.user_metadata || {};
  const currentUsername = userMeta?.username || userMeta?.user_name || userMeta?.full_name || '';
  const currentAvatar = userMeta?.avatar_url || userMeta?.picture || '';

  const [username, setUsername] = useState(currentUsername);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatar);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState({ type: '', message: '' });
  
  // Danger Zone Deletion Flow
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  // Handle saving new changes
  const handleSaveChanges = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateStatus({ type: '', message: '' });

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          username: username.trim(),
          full_name: username.trim(), // Keep full_name updated too for compatibility with nav bar display
          avatar_url: avatarUrl
        }
      });

      if (error) throw error;

      setUpdateStatus({ type: 'success', message: 'Profile updated successfully!' });
      
      // Update session locally
      if (onSessionUpdate && data?.user) {
        onSessionUpdate({
          ...session,
          user: data.user
        });
      }
      
      setTimeout(() => {
        setUpdateStatus({ type: '', message: '' });
      }, 3000);
    } catch (err) {
      console.error('Update profile error:', err);
      setUpdateStatus({ type: 'error', message: err.message || 'Failed to update profile details.' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Process and convert image uploads to base64
  const handleUploadFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setUpdateStatus({ type: 'error', message: 'Upload photo of size less than 2mb' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarUrl(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Perform Account Deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      const { data: branches, error: fetchError } = await supabase
        .from('family_branches')
        .select('id')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      if (branches && branches.length > 0) {
        const branchIds = branches.map(b => b.id);
        const { error: deleteError } = await supabase
          .from('family_branches')
          .delete()
          .in('id', branchIds);
          
        if (deleteError) throw deleteError;
      }

      await supabase.auth.signOut();
      onClose();
      window.location.reload();
    } catch (err) {
      console.error('Account deletion error:', err);
      alert('Error during deletion: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay user-profile-settings-overlay">
        {/* Backdrop overlay */}
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal Container */}
        <motion.div
          className="modal-container user-profile-settings-modal"
          style={{ maxWidth: '600px' }} // Wider modal to comfortably fit the 2-column layout
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        >
          {/* Header */}
          <div className="modal-header settings-header">
            <div className="header-title-wrap">
              <h2>Profile Settings</h2>
            </div>
            <button className="close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="modal-body settings-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {!showDeleteConfirm ? (
              <form onSubmit={handleSaveChanges} className="profile-settings-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* ── Card 1: Personal Information ── */}
                <div className="profile-card-section" style={{
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#fff', margin: '0 0 20px 0', fontWeight: '700' }}>
                    <User size={16} />
                    Personal Information
                  </h3>

                  <div className="personal-info-grid" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                    {/* Left Column: Avatar */}
                    <div className="left-avatar-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '150px', flexShrink: 0 }}>
                      <div className="avatar-preview-wrapper" style={{ position: 'relative', width: '110px', height: '110px' }}>
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt="Profile Avatar" 
                            style={{ width: '110px', height: '110px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.12)' }}
                          />
                        ) : (
                          <div style={{ width: '110px', height: '110px', borderRadius: '50%', background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '38px', fontWeight: '800', border: '2px solid rgba(255,255,255,0.1)' }}>
                            {username ? username.charAt(0).toUpperCase() : <User size={42} />}
                          </div>
                        )}
                      </div>
                      
                      <button 
                        type="button"
                        className="change-image-btn"
                        onClick={() => fileInputRef.current.click()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: '#fff',
                          padding: '6px 12px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          width: '100%'
                        }}
                      >
                        <Camera size={14} />
                        Change Image
                      </button>
                      
                      <input 
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleUploadFile}
                      />
                    </div>

                    {/* Right Column: Fields */}
                    <div className="right-fields-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-group-modern">
                        <label className="field-label" style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '6px', display: 'block' }}>Username</label>
                        <div className="input-with-icon">
                          <User size={15} className="field-icon" />
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group-modern disabled-group">
                        <label className="field-label" style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '6px', display: 'block' }}>Email Address</label>
                        <div className="input-with-icon">
                          <Mail size={15} className="field-icon" />
                          <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                          />
                        </div>
                        <span className="field-helper-text" style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.35)', marginTop: '4px', display: 'block' }}>
                          Your email is synced with your Google account and cannot be changed here.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {updateStatus.message && (
                  <div className={`form-status-alert ${updateStatus.type}`}>
                    {updateStatus.message}
                  </div>
                )}

                {/* ── Action buttons row ── */}
                <div className="settings-action-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <button 
                    type="button" 
                    className="modal-sign-out-btn" 
                    onClick={() => {
                      supabase.auth.signOut();
                      onClose();
                    }}
                    style={{ margin: 0 }}
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>

                  <button type="submit" className="save-settings-btn" disabled={isUpdating}>
                    {isUpdating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Profile'
                    )}
                  </button>
                </div>

              </form>
            ) : (
              /* Delete confirmation panel */
              <div className="delete-account-verification animate-fade-in">
                <div className="warning-banner">
                  <ShieldAlert className="warning-banner-icon" size={24} />
                  <h3>Account Deletion Verification</h3>
                </div>
                <p className="delete-warning-desc">
                  This action is permanent and cannot be undone. All family trees, branches, 
                  members, and settings owned by this account will be erased from our systems.
                </p>
                <div className="form-group-modern">
                  <label className="field-label danger-label">
                    Type <strong>DELETE</strong> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    placeholder="Type DELETE..."
                    className="danger-text-input"
                  />
                </div>
                
                <div className="danger-action-row">
                  <button 
                    type="button" 
                    className="cancel-delete-btn" 
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmationText('');
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="confirm-delete-btn" 
                    disabled={deleteConfirmationText !== 'DELETE' || isDeleting}
                    onClick={handleDeleteAccount}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Permanently Erase Account'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── Card 2: Danger Zone ── */}
            {!showDeleteConfirm && (
              <div className="profile-card-section danger-zone-wrapper" style={{
                border: '1px solid rgba(239, 68, 68, 0.18)',
                background: 'rgba(239, 68, 68, 0.02)',
                borderRadius: '12px',
                padding: '20px',
                marginTop: '4px'
              }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#ef4444', margin: '0 0 12px 0', fontWeight: '700' }}>
                  <ShieldAlert size={16} />
                  Danger Zone
                </h3>
                
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'rgba(255, 255, 255, 0.55)', lineHeight: '1.4' }}>
                  Permanently erase your account and all associated data. This action cannot be reversed.
                </p>
                
                <button 
                  type="button" 
                  className="trigger-delete-btn" 
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    background: 'transparent',
                    color: '#f87171',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} />
                  Delete Account
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
