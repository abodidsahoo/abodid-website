import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Turnstile from '../../components/Turnstile';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] = useState('');

  // Helper to verify captcha on our server
  const verifyCaptcha = async (token) => {
    if (!token) return false;
    try {
      const res = await fetch("/api/turnstile/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      return data.success === true;
    } catch (e) {
      console.error("Captcha Verification Error:", e);
      return false;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Client-Side Check
    if (!captchaToken) {
      setError("Please complete the captcha.");
      setLoading(false);
      return;
    }

    // 2. Server-Side Verification (Our API)
    // We enforce this regardless of Supabase setting
    const isHuman = await verifyCaptcha(captchaToken);
    if (!isHuman) {
      setError("Captcha verification failed. Please refresh and try again.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken } // Pass to Supabase (optional, relies on Dashboard setting)
    });

    if (error) {
      console.error("Login error:", error);
      setError(error.message);
      setLoading(false);
      // Reset captcha on failure
      if (window.turnstile) window.turnstile.reset();
      setCaptchaToken('');
    } else {
      // Sync email to profile for admin too
      if (data.user) {
        console.log('Login successful for:', email);

        try {
          await supabase.from('profiles').update({ email: email }).eq('id', data.user.id);
        } catch (e) {
          console.warn('Profile sync warning:', e);
        }

        // Check for redirect param
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get('redirect');

        console.log('Redirect param found:', redirectUrl);

        if (redirectUrl) {
          console.log('Redirecting to param URL:', redirectUrl);
          window.location.assign(redirectUrl);
          return;
        }

        // Check role to determine default redirect
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        console.log('User role detected:', profile?.role);

        if (profile?.role === 'admin') {
          console.log('Redirecting to Admin Dashboard');
          window.location.assign("/admin/dashboard");
        } else {
          // Curators and regular users go to unified dashboard
          console.log('Redirecting to Unified Dashboard');
          window.location.assign("/resources/dashboard");
        }
      }
    }
  };

  // Callback for Turnstile - use useCallback to keep it stable
  const handleTurnstile = useCallback((token) => {
    console.log('Turnstile token received:', token ? 'token present' : 'no token');
    setCaptchaToken(token);
    setError(null); // Clear any captcha errors when token is received
  }, []);

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form">
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="name@example.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>

        {/* Turnstile Widget */}
        <div className="form-group">
          <Turnstile onToken={handleTurnstile} action="admin_login" />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading} className="btn-login">
          {loading ? 'Verifying & Signing in...' : 'Sign In'}
        </button>
      </form>

      <style>{`
        .login-container {
          width: 100%;
        }
        .login-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        input {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          color: var(--text-primary);
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        input:focus {
          border-color: var(--text-primary);
          background: var(--bg-color);
          outline: none;
          box-shadow: 0 0 0 2px rgba(var(--text-primary-rgb), 0.1);
        }

        .btn-login {
          width: 100%;
          padding: 1rem;
          background: var(--text-primary);
          color: var(--bg-color);
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 0.5rem;
        }

        .btn-login:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .btn-login:active {
          transform: translateY(0);
        }

        .btn-login:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .error-message {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          padding: 0.75rem;
          border-radius: 8px;
          font-size: 0.875rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
