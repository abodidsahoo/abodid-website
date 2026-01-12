import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Redirect to dashboard on success
      window.location.href = "/admin/dashboard";
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form">
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
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

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading} className="btn-login">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <style>{`
        .login-container {
          width: 100%;
        }
        .login-form {
          width: 100%;
          padding: 0;
          background: transparent;
          border: none;
          box-shadow: none;
        }

        .form-group {
          margin-bottom: 1rem;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid var(--border-subtle);
          background: var(--bg-color);
          color: var(--text-primary);
          border-radius: 4px;
          font-size: 1rem;
          box-sizing: border-box;
        }
        input:focus {
          border-color: var(--text-primary);
          outline: none;
        }
        .btn-login {
          width: 100%;
          padding: 0.875rem;
          background: var(--text-primary);
          color: var(--bg-color);
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
          margin-top: 0.5rem;
        }
        .btn-login:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .error-message {
          color: #e53e3e;
          background: #fff5f5;
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
