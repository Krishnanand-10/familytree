import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { TreePine, Mail, Lock, Loader2, ArrowRight, UserPlus, LogIn, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuthScreen({ initialError, redirectTo = window.location.origin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError || '');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Clear legacy tokens if they existed, so they don't conflict with Supabase
    localStorage.removeItem('old_app_token');
    localStorage.removeItem('legacy_user_data');
  }, []);

  const validateForm = () => {
    if (!email) {
      setErrorMessage('Email address is required.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }
    if (!isForgotPassword) {
      if (!password) {
        setErrorMessage('Password is required.');
        return false;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return false;
      }
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
      if (isForgotPassword) {
        // Trigger password reset flow
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (error) throw error;
        setSuccessMessage('Password reset link sent! Check your email inbox.');
      } else if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
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

  const handleSocialLogin = async (provider) => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo
        }
      });
      if (error) throw error;
    } catch (err) {
      setErrorMessage(err.message || `Failed to sign in with ${provider}.`);
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
              key={isForgotPassword ? 'forgot' : isSignUp ? 'signup' : 'signin'}
              initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="auth-form-title">
                {isForgotPassword 
                  ? 'Reset Password' 
                  : isSignUp ? 'Create an Account' : 'Welcome Back'}
              </h2>
              <p className="auth-form-subtitle">
                {isForgotPassword
                  ? 'Enter your email to receive a password reset link'
                  : isSignUp 
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
                  data-testid="auth-email-input"
                  className="auth-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div className="auth-input-group">
                <label className="auth-label">Password</label>
                <div className="auth-input-wrapper" style={{ position: 'relative' }}>
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    data-testid="auth-password-input"
                    className="auth-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    style={{ paddingRight: '40px' }}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.4)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0,
                      outline: 'none'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {!isSignUp && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '12px', cursor: 'pointer', outline: 'none' }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}

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
              data-testid="auth-submit-btn"
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
                  <span>
                    {isForgotPassword 
                      ? 'Send Reset Link' 
                      : isSignUp ? 'Sign Up' : 'Sign In'}
                  </span>
                  {isForgotPassword ? <ArrowRight size={16} /> : isSignUp ? <UserPlus size={16} /> : <LogIn size={16} />}
                </>
              )}
            </button>
          </form>

          {/* Social Logins */}
          {!isForgotPassword && (
            <>
              <div className="auth-divider">
                <span>or continue with</span>
              </div>
              <div className="auth-social-buttons">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  className="auth-social-btn google"
                  disabled={loading}
                >
                  <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('github')}
                  className="auth-social-btn github"
                  disabled={loading}
                >
                  <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                    />
                  </svg>
                  <span>GitHub</span>
                </button>
              </div>
            </>
          )}

          {/* Toggle Button */}
          <div className="auth-toggle-wrapper">
            {isForgotPassword ? (
              <button
                type="button"
                className="auth-toggle-btn"
                onClick={() => {
                  setIsForgotPassword(false);
                  setIsSignUp(false);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowLeft size={14} />
                <span>Back to Sign In</span>
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
