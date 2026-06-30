import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { TreePine, Mail, Lock, Loader2, ArrowRight, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const validateForm = () => {
    if (!email) {
      setErrorMessage('Email address is required.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setErrorMessage('Password is required.');
      return false;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        // Supabase has automatic email confirmation enabled by default in new projects,
        // but if it is enabled or disabled, let the user know accordingly.
        if (data.session) {
          setSuccessMessage('Registration successful! Logging you in...');
        } else {
          setSuccessMessage('Registration successful! Please check your email to verify your account.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setSuccessMessage('Successfully logged in! Opening family tree...');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Dynamic Background Gradients */}
      <div className="auth-bg-gradient-1" />
      <div className="auth-bg-gradient-2" />

      <motion.div 
        className="auth-card-wrapper"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="auth-card">
          {/* Logo Section */}
          <div className="auth-logo-section">
            <div className="auth-logo-icon">
              <TreePine size={28} />
            </div>
            <h1 className="auth-title">Kinship</h1>
            <p className="auth-subtitle">Premium Family Tree Builder</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={isSignUp ? 'signup' : 'signin'}
              initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="auth-form-title">
                {isSignUp ? 'Create an Account' : 'Welcome Back'}
              </h2>
              <p className="auth-form-subtitle">
                {isSignUp 
                  ? 'Sign up to build and secure your family lineage' 
                  : 'Sign in to access your family tree dashboard'}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleAuth} className="auth-form">
            <div className="auth-input-group">
              <label className="auth-label">Email Address</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  type="email"
                  className="auth-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Password</label>
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

            {/* Error and Success Notifications */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div 
                  className="auth-message error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <AlertCircle size={15} />
                  <span>{errorMessage}</span>
                </motion.div>
              )}

              {successMessage && (
                <motion.div 
                  className="auth-message success"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <AlertCircle size={15} />
                  <span>{successMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit" 
              className="auth-submit-btn" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
                  {isSignUp ? <UserPlus size={16} /> : <LogIn size={16} />}
                </>
              )}
            </button>
          </form>

          {/* Toggle Button */}
          <div className="auth-toggle-wrapper">
            <span className="auth-toggle-text">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </span>
            <button
              type="button"
              className="auth-toggle-btn"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMessage('');
                setSuccessMessage('');
              }}
              disabled={loading}
            >
              {isSignUp ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
