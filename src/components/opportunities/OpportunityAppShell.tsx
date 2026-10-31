import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { OpportunityMark } from './OpportunityMark';
import '../../styles/opportunity-app-shell.css';

interface Props {
    children: React.ReactNode;
    accountActions?: React.ReactNode;
    signedIn?: boolean;
    isOwner?: boolean;
    checking?: boolean;
    signInHref?: string;
    radarHref?: string;
    onSignIn?: () => void;
    signingIn?: boolean;
    onStartTour?: () => void;
}

export function OpportunityAppShell({ children, accountActions, signedIn = false, isOwner = false, checking = false, signInHref = '/opportunities', radarHref, onStartTour, onSignIn, signingIn = false }: Props) {
    const help = useRef<HTMLDialogElement>(null);
    const openHelp = () => help.current?.showModal();
    return <div className="opp-app-frame">
        <header className="opp-app-header">
            <div className="opp-app-header-inner">
                <a className="opp-app-brand" href="/opportunities" aria-label="Opportunity Tracker home">
                    <OpportunityMark /><span><strong>opportunity</strong> tracker</span>
                </a>
                <nav className="opp-app-actions" aria-label="Tracker account">
                    {(!signedIn || isOwner) && <button type="button" onClick={openHelp} aria-haspopup="dialog">Help</button>}
                    {signedIn && !isOwner && radarHref && <a href={radarHref}>My radar</a>}
                    {accountActions}
                    {!checking && !signedIn && (onSignIn
                        ? <button className="opp-app-signin" type="button" onClick={onSignIn} disabled={signingIn} aria-busy={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'}</button>
                        : <a className="opp-app-signin" href={signInHref}>Sign in</a>)}
                </nav>
            </div>
        </header>
        <div className="opp-app-content">{children}</div>
        <footer className="opp-app-footer">
            <a href="/studio">An Abodid &amp; Co. product</a>
            <nav aria-label="Tracker information"><button type="button" onClick={openHelp}>Help</button><span aria-hidden="true">·</span><a href="/privacy">Privacy</a></nav>
        </footer>
        <dialog ref={help} className="opp-app-help" data-pop-surface="cream" aria-labelledby="opp-app-help-title">
            <button className="opp-app-help-close" type="button" aria-label="Close help" onClick={() => help.current?.close()}><X size={20} aria-hidden="true" /></button>
            <h2 id="opp-app-help-title">{isOwner ? 'Your radar, at a glance.' : 'Keep an opportunity worth pursuing.'}</h2>
            <p>{isOwner ? 'Save a link, add a note, or attach a file. Open a card to review its details, track your application, and set reminders.' : 'Browse and search public collections freely. Choose “Add to my radar” to keep an opportunity. If you need to sign in, your selection is saved so you can pick up where you left off.'}</p>
            <p>{signedIn ? 'Settings contains your profile, public collection controls, Telegram connection, Chrome extension guide, usage, and Log out. These settings apply to your own account.' : 'Google sign-in creates or opens your private tracker. Public collection browsing does not require an account.'}</p>
            {onStartTour && <button className="opp-app-tour" type="button" onClick={() => { help.current?.close(); onStartTour(); }}>Show me around</button>}
            <a href="mailto:hello@abodid.com">Contact support ↗</a>
        </dialog>
    </div>;
}
