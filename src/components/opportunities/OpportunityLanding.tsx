import { OpportunityBusy } from './OpportunityBusy';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { OpportunityLandingDemo } from './OpportunityLandingDemo';
import { OpportunityMark } from './OpportunityMark';
import { opportunitySupabase as supabase } from '../../lib/opportunitySupabase';
import { OPPORTUNITY_CURATED_COLLECTION_PATH } from '../../lib/opportunities/routes';
import {
  discardProductUpdatesSignIn,
  prepareProductUpdatesSignIn,
} from '../../lib/opportunities/productUpdates';
import { OpportunityProductUpdatesOptIn } from './OpportunityProductUpdatesOptIn';

const GOOGLE_IDENTITY_SCOPES = 'openid email profile';
// Replace this temporary destination with the published extension listing.
const CHROME_EXTENSION_STORE_URL = 'https://chromewebstore.google.com/category/extensions';

const safeNextPath = () => {
  const candidate = new URLSearchParams(window.location.search).get('next');
  return candidate &&
    candidate.startsWith('/opportunities/') &&
    !candidate.startsWith('//')
    ? candidate
    : null;
};

export default function OpportunityLanding() {
  const mobileHeader = useRef<HTMLElement>(null);
  const mobileMenuButton = useRef<HTMLButtonElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const authDialog = useRef<HTMLDialogElement>(null);
  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [productUpdatesOptIn, setProductUpdatesOptIn] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const session = data.session;
        if (!active || !session?.access_token || session.user.is_anonymous) {
          if (active) setChecking(false);
          return;
        }

        const response = await fetch('/api/opportunities/session', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        if (!active) return;
        if (response.ok) {
          const payload = await response.json();
          window.location.replace(
            safeNextPath() || `/opportunities/${payload.profile.username}`,
          );
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!mobileHeader.current?.contains(event.target as Node)) setMobileMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        mobileMenuButton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [mobileMenuOpen]);

  const signIn = async () => {
    setSigningIn(true);
    setError('');
    const callback = new URL(
      '/opportunities/auth/callback',
      window.location.origin,
    );
    const next = safeNextPath();
    if (next) callback.searchParams.set('next', next);

    prepareProductUpdatesSignIn(callback, productUpdatesOptIn);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: GOOGLE_IDENTITY_SCOPES,
          redirectTo: callback.toString(),
          queryParams: { prompt: 'select_account' },
        },
      });
      if (authError) throw authError;
    } catch {
      discardProductUpdatesSignIn(callback);
      setError('Google sign-in could not start. Please try again.');
      setSigningIn(false);
    }
  };

  return (
    <div className="otl-landing">
      <header className="otl-header" ref={mobileHeader}>
        <a
          className="otl-brand"
          href="/opportunities"
          aria-label="Opportunity Tracker home"
        >
          <OpportunityMark />
          <span className="otl-wordmark"><strong>opportunity</strong> tracker</span>
          <ArrowUpRight className="otl-brand-arrow" size={13} aria-hidden="true" />
        </a>
        <nav className="otl-desktop-nav" aria-label="Product navigation">
          <a href="#how-it-works">How it works?</a>
          <button
            className="otl-header-signin"
            type="button"
            aria-haspopup="dialog"
            aria-controls="otl-signin-dialog"
            disabled={checking || signingIn}
            onClick={() => authDialog.current?.showModal()}
          >
            Sign in
          </button>
        </nav>
        <div className="otl-mobile-controls">
          <button type="button" className="otl-mobile-signin" disabled={checking || signingIn} aria-haspopup="dialog" aria-controls="otl-signin-dialog" onClick={() => { setMobileMenuOpen(false); authDialog.current?.showModal(); }}>Sign in</button>
          <button type="button" ref={mobileMenuButton} className="otl-mobile-menu-toggle" aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenuOpen} aria-controls="otl-mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>
            {mobileMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>
        <nav id="otl-mobile-navigation" className="otl-mobile-nav" aria-label="Mobile product navigation" hidden={!mobileMenuOpen} onClick={(event) => { if ((event.target as Element).closest('a')) setMobileMenuOpen(false); }}>
          <a href="#how-it-works">How it works?</a>
        </nav>
      </header>
      <section className="otl-hero" aria-labelledby="opportunities-title">
        <h1 id="opportunities-title">
          It wasn’t a rejection.<br />
          You just never applied.
        </h1>
        <p className="otl-hero-tagline">What if you actually applied?</p>
        <p className="otl-intro">
          Save grants, jobs and conferences with just <strong>one click</strong>.<br />
          Keep every deadline in view.
        </p>
        <div className="otl-hero-actions">
          <a className="otl-hero-install" href={CHROME_EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer">
            <img src="/images/google/chrome-logo.svg" width="22" height="22" alt="" />
            Install Chrome Extension <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
        <p className="otl-hero-demo">or <a href={OPPORTUNITY_CURATED_COLLECTION_PATH}>Try the demo</a> before installing.</p>
      </section>
      <dialog
        ref={authDialog}
        id="otl-signin-dialog"
        className="otl-auth-dialog"
        aria-labelledby="otl-signin-title"
        {...({ closedby: 'any' } as React.HTMLAttributes<HTMLDialogElement>)}
        onClick={(event) => {
          if (
            'closedBy' in HTMLDialogElement.prototype ||
            event.target !== event.currentTarget
          )
            return;
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            event.currentTarget.close();
        }}
      >
        <div className="otl-auth-dialog-top">
          <h2 id="otl-signin-title">Start your private radar.</h2>
          <form method="dialog">
            <button type="submit" aria-label="Close sign-in">
              <X size={20} aria-hidden="true" />
            </button>
          </form>
        </div>
        <p className="otl-auth-dialog-intro">
          Sign in to save opportunities across devices.
        </p>
        <div className="otl-auth">
          <button
            type="button"
            className="otl-google-button"
            autoFocus
            onClick={signIn}
            disabled={checking || signingIn}
            aria-busy={signingIn}
          >
            <img
              src="/images/google/g-logo.png"
              width="20"
              height="20"
              alt=""
            />
            {signingIn ? (
              <OpportunityBusy inline>Connecting to Google</OpportunityBusy>
            ) : (
              'Continue with Google'
            )}
          </button>
          <OpportunityProductUpdatesOptIn
            checked={productUpdatesOptIn}
            onChange={setProductUpdatesOptIn}
            disabled={checking || signingIn}
          />
          {error && (
            <p className="otl-auth-error" role="alert">
              {error}
            </p>
          )}
          <p className="otl-disclosure">
            Google sign-in shares your name, email and profile photo so we can
            create and personalize your tracker account. We do not request
            access to Gmail, Drive, Calendar or Contacts.{' '}
            <a href="/privacy">Privacy details</a>.
          </p>
        </div>
      </dialog>
      <section id="who-is-it-for" className="otl-audience" aria-labelledby="otl-audience-title" tabIndex={-1}>
        <div className="otl-section-heading">
          <p className="otl-eyebrow">BUILT WITH LOVE</p>
          <h2 id="otl-audience-title" className="otl-audience-headline"><span>For artists, researchers, and founders</span>{' '}<span>who have that “hunger”.</span></h2>
        </div>
      </section>
      <OpportunityLandingDemo />
      <section className="otl-next-step" aria-labelledby="otl-next-step-title">
        <p className="otl-eyebrow">WHAT TO DO NEXT</p>
        <h2 id="otl-next-step-title">Keep the next good find.</h2>
        <p className="otl-next-step-intro">Add the Chrome extension. When you find an opportunity, save it with one click. Keep its details and deadline on your radar, with reminders for when to act.</p>
        <a className="otl-primary" href={CHROME_EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer">
          <img src="/images/google/chrome-logo.svg" width="24" height="24" alt="" />
          Install the Chrome Extension
        </a>
        <span className="otl-next-step-store-note">Chrome Web Store listing coming soon.</span>
        <div className="otl-next-step-browse">
          <p>Want to look around first?</p>
          <a href={OPPORTUNITY_CURATED_COLLECTION_PATH}>Browse Abodid’s curated opportunities <ArrowUpRight size={17} aria-hidden="true" /></a>
          <span>No sign-in needed.</span>
        </div>
      </section>
      <dialog
        ref={helpDialog}
        className="otl-help"
        aria-labelledby="otl-help-title"
        {...({ closedby: 'any' } as React.HTMLAttributes<HTMLDialogElement>)}
        onClick={(event) => {
          if ('closedBy' in HTMLDialogElement.prototype) return;
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          ) {
            event.currentTarget.close();
          }
        }}
      >
        <form method="dialog" className="otl-help-top">
          <span className="otl-eyebrow">A QUICK START</span>
          <button type="submit" autoFocus aria-label="Close getting started">
            <X size={20} aria-hidden="true" />
          </button>
        </form>
        <h2 id="otl-help-title">Your next move starts here.</h2>
        <p className="otl-help-intro">
          Try the collection first. Save something worth pursuing.
        </p>
        <ol className="otl-help-steps">
          <li>
            <strong>Find something useful.</strong>
            <p>
              Browse opportunities without signing in. Choose “Add to my radar”
              and sign in with Google to keep one in your private collection.
            </p>
          </li>
          <li>
            <strong>Bring your own finds.</strong>
            <p>
              Paste a link, write a note or attach a file in your radar. AI
              helps pull out the key details; review them before relying on a
              deadline.
            </p>
          </li>
          <li>
            <strong>Keep it close with Telegram.</strong>
            <p>
              Connect Telegram from your radar’s Settings, then send links,
              PDFs, images or voice notes to your connected bot.
            </p>
          </li>
        </ol>
        <details className="otl-help-faq">
          <summary>What uses an AI attempt?</summary>
          <p>
            Processing a new opportunity with AI uses an attempt, including
            requests that fail after processing begins. Adding an existing
            opportunity from the collection does not. Check “Your usage” in
            Settings for your remaining allowance or to request more credits.
          </p>
        </details>
        <div className="otl-help-actions">
          <a className="otl-primary" href={OPPORTUNITY_CURATED_COLLECTION_PATH}>
            Browse opportunities <ArrowUpRight size={17} aria-hidden="true" />
          </a>
          <a href="mailto:hello@abodid.com">
            Email support <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
        <p className="otl-help-support">Support team of Abodid &amp; Co.</p>
      </dialog>
      <footer className="otl-footer">
        <div className="otl-footer-inner">
          <div className="otl-footer-credit">
            <a className="otl-footer-brand" href="/opportunities" aria-label="Opportunity Tracker home"><strong>opportunity</strong><span>tracker</span></a>
            <a href="/studio">Designed and developed by Abodid &amp; Co.</a>
          </div>
          <nav aria-label="Product information">
            <a href="/privacy"><span>Privacy</span></a>
            <a href="/privacy#details-heading"><span>Terms</span></a>
            <button type="button" onClick={() => helpDialog.current?.showModal()}><span>Support</span></button>
            <a href="mailto:hello@abodid.com"><span>Contact</span> <ArrowUpRight size={12} aria-hidden="true" /></a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
