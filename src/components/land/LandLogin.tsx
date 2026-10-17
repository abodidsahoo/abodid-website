import React, { useState } from 'react';

export default function LandLogin() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/land/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, remember }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error_od || result.error || 'Sign-in failed.');
      window.location.replace('/land');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'ରେକର୍ଡ ଖୋଲିପାରିଲା ନାହିଁ।');
      setPending(false);
    }
  };

  return (
    <section className="land-login-shell" aria-labelledby="land-login-title">
      <a className="land-back-to-site" href="/">← Back to abodid.com</a>
      <div className="land-login-card" data-pop-surface="cream">
        <p className="land-kicker">ABODID · PRIVATE FAMILY RECORD</p>
        <h1 id="land-login-title">ପରିବାର ଜମି ରେକର୍ଡ</h1>
        <p className="land-login-english">Family Land Register</p>
        <p className="land-login-intro">
          ପରିବାରର ବ୍ୟକ୍ତିଗତ ରେକର୍ଡ ଦେଖିବା ପାଇଁ ପାସୱାର୍ଡ ଦିଅନ୍ତୁ।
          <span lang="en"> Enter the family password to continue.</span>
        </p>

        <form className="land-login-form" onSubmit={submit}>
          <label htmlFor="land-password">ପାସୱାର୍ଡ / Password</label>
          <div className="land-password-row">
            <input
              id="land-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoFocus
            />
            <button type="button" className="land-button land-button--secondary" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? 'ଲୁଚାନ୍ତୁ / Hide' : 'ଦେଖାନ୍ତୁ / Show'}
            </button>
          </div>
          <label className="land-checkbox-row" htmlFor="land-remember">
            <input
              id="land-remember"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>ଏହି ବିଶ୍ୱସ୍ତ କମ୍ପ୍ୟୁଟରରେ ସାଇନ୍ ଇନ୍ ରଖନ୍ତୁ / Stay signed in on this trusted computer</span>
          </label>
          {error && <p className="land-form-error" role="alert">{error}</p>}
          <button className="land-button land-button--primary land-login-submit" type="submit" disabled={pending}>
            {pending ? 'ଖୋଲୁଛି… / Opening…' : 'ରେକର୍ଡ ଖୋଲନ୍ତୁ / Open records'}
          </button>
        </form>
        <p className="land-privacy-note">ଏହା ପରିବାର ପାଇଁ ବ୍ୟକ୍ତିଗତ ପୃଷ୍ଠା। This page is private and is not indexed.</p>
      </div>
    </section>
  );
}

