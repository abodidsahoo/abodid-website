import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const safeReturnPath = (value) => {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
};

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);

  const [session, setSession] = useState(null);



  // Shared redirect logic
  const handleRedirect = async (userId, force = false) => {
    // Check for redirect param
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = safeReturnPath(urlParams.get('next') || urlParams.get('redirect'));

    // Check for loop prevention (skip if forced, e.g. after manual login)
    const reason = urlParams.get('reason');
    if (!force && reason === 'auth_failed') {
      console.warn('Redirect loop detected (auth_failed). Stopping auto-redirect.');
      return;
    }

    // Check role to determine default redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role === 'admin') {
      window.location.assign(redirectUrl || '/admin/dashboard');
    } else {
      window.location.assign("/resources/dashboard");
    }
  };

  // Check auth on mount
  React.useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session: activeSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (activeSession?.user) {
          setSession(activeSession);
          await handleRedirect(activeSession.user.id);
        } else {
          const params = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(window.location.hash.slice(1));
          const oauthError = params.get('error_description') || hashParams.get('error_description');
          if (oauthError) setError(oauthError.replace(/\+/g, ' '));
        }
      } catch (authError) {
        setError(authError.message || 'Could not complete sign-in. Please try again.');
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
    });

    if (error) {
      console.error("Login error:", error);
      setError(error.message);
      setLoading(false);
    } else {
      // Sync email to profile for admin too
      if (data.user) {
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

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: new URL('/admin/login', window.location.origin).toString(),
          queryParams: { prompt: 'select_account' },
        },
      });
      if (oauthError) throw oauthError;
    } catch (authError) {
      setError(authError.message || 'Google sign-in could not start. Please try again.');
      setGoogleLoading(false);
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
            autoComplete="email"
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>

        {/* Turnstile Widget */}


        {error && <div className="error-message" role="alert">{error}</div>}

        <button type="submit" disabled={loading || googleLoading} className="btn-login">
          {loading ? 'Verifying & Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="alternative-auth">
        <div className="auth-divider"><span>or continue with</span></div>
        <button
          type="button"
          className="btn-google"
          disabled={loading || googleLoading}
          onClick={handleGoogleLogin}
        >
          <svg className="google-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.76 7.18l7.73 6C44.42 38.03 46.98 31.89 46.98 24.55Z" />
            <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.51 2.56 10.78l7.97-6.19Z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.92-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.88 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48Z" />
          </svg>
          {googleLoading ? 'Opening Google...' : 'Continue with Google'}
        </button>
      </div>

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

        .alternative-auth {
          margin-top: 1.5rem;
        }

        .auth-divider {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          margin-bottom: 1.5rem;
          color: var(--text-tertiary);
          font-size: 0.75rem;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .auth-divider::before,
        .auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border-subtle);
        }

        .btn-google {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          min-height: 51px;
          padding: 0.75rem 1rem;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background: var(--bg-surface);
          color: var(--text-primary);
          font: inherit;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
        }

        .btn-google:hover:not(:disabled) {
          background: var(--bg-surface-hover);
          border-color: var(--text-secondary);
          transform: translateY(-1px);
        }

        .btn-google:focus-visible,
        .btn-login:focus-visible {
          outline: 2px solid var(--text-primary);
          outline-offset: 3px;
        }

        .btn-google:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .google-icon {
          width: 19px;
          height: 19px;
          flex: none;
        }
      `}</style>
    </div>
  );
}
