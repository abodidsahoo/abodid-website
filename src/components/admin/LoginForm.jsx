import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';


export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [session, setSession] = useState(null);



  // Shared redirect logic
  const handleRedirect = async (userId, force = false) => {
    // Check for redirect param
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect');

    console.log('Redirect check. Param:', redirectUrl);

    // Check for loop prevention (skip if forced, e.g. after manual login)
    const reason = urlParams.get('reason');
    if (!force && reason === 'auth_failed') {
      console.warn('Redirect loop detected (auth_failed). Stopping auto-redirect.');
      return;
    }

    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }

    // Check role to determine default redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    console.log('User role:', profile?.role);

    if (profile?.role === 'admin') {
      window.location.assign("/admin/dashboard");
    } else {
      window.location.assign("/resources/dashboard");
    }
  };

  // Check auth on mount
  React.useEffect(() => {
    const checkSession = async () => {
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (activeSession?.user) {
        console.log('Already logged in as:', activeSession.user.email);
        setSession(activeSession);
        handleRedirect(activeSession.user.id);
      }
    };
    checkSession();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);



    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {} // Pass to Supabase (optional, relies on Dashboard setting)
    });

    if (error) {
      console.error("Login error:", error);
      setError(error.message);
      setLoading(false);
      setLoading(false);
    } else {
      // Sync email to profile for admin too
      if (data.user) {
        console.log('Login successful for:', email);

        try {
          await supabase.from('profiles').update({ email: email }).eq('id', data.user.id);
        } catch (e) {
          console.warn('Profile sync warning:', e);
        }

        // Reuse shared redirect logic - force redirect after manual login
        await handleRedirect(data.user.id, true);
      }
    }
  };



  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    window.location.reload();
  };

  if (session) {
    return (
      <div className="login-container">
        <div className="welcome-back">
          <h2>Welcome back!</h2>
          <p>You are logged in as <strong>{session.user.email}</strong></p>
          <div className="button-group">
            <button
              onClick={() => handleRedirect(session.user.id, true)}
              className="btn-login"
            >
              Go to Dashboard
            </button>
            <button
              onClick={handleSignOut}
              className="btn-secondary"
            >
              Sign Out
            </button>
          </div>
        </div>
        <style>{`
          .welcome-back {
            text-align: center;
            padding: 2rem;
            background: var(--bg-surface);
            border-radius: 12px;
            border: 1px solid var(--border-subtle);
          }
          .welcome-back h2 {
            margin-bottom: 0.5rem;
            color: var(--text-primary);
          }
          .welcome-back p {
            margin-bottom: 2rem;
            color: var(--text-secondary);
          }
          .button-group {
            display: flex;
            flex-direction: column;
            gap: 1rem;
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
          }
          .btn-secondary {
            width: 100%;
            padding: 1rem;
            background: transparent;
            color: var(--text-primary);
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .btn-secondary:hover {
            background: var(--bg-color);
            border-color: var(--text-primary);
          }
        `}</style>
      </div>
    );
  }

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
