import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Loader2, AlertCircle, CheckCircle, TreePine } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ResetPasswordScreen({ onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleReset = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccessMessage('Password updated successfully! Redirecting...');
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg-gradient-1" />
      <div className="auth-bg-gradient-2" />

      <motion.div 
        className="auth-card-wrapper"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="auth-card">
          <div className="auth-logo-section">
            <div className="auth-logo-icon">
              <TreePine size={28} />
            </div>
            <h1 className="auth-title">Kinship</h1>
            <p className="auth-subtitle">Update Your Password</p>
          </div>

          <h2 className="auth-form-title">Enter New Password</h2>
          <p className="auth-form-subtitle">Choose a strong, secure password for your account</p>

          <form onSubmit={handleReset} className="auth-form">
            <div className="auth-input-group">
              <label className="auth-label">New Password</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type="password"
                  className="auth-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Confirm New Password</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type="password"
                  className="auth-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {errorMessage && (
              <div className="auth-message error">
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="auth-message success">
                <CheckCircle size={15} />
                <span>{successMessage}</span>
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Save Password</span>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
