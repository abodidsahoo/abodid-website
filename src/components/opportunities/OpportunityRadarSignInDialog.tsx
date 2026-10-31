import { X } from 'lucide-react';
import { OpportunityBusy } from './OpportunityBusy';
import React, { useEffect, useRef, useState } from 'react';
import { OpportunityProductUpdatesOptIn } from './OpportunityProductUpdatesOptIn';
import type { Opportunity } from '../../lib/opportunities/types';
import { formatOpportunityTitle } from '../../lib/opportunities/ui-helpers';

interface OpportunityRadarSignInDialogProps {
    opportunity: Opportunity | null;
    isStarting: boolean;
    error: string;
    onClose: () => void;
    onContinue: (productUpdatesOptIn: boolean) => void;
}

export const OpportunityRadarSignInDialog: React.FC<OpportunityRadarSignInDialogProps> = ({
    opportunity,
    isStarting,
    error,
    onClose,
    onContinue,
}) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [productUpdatesOptIn, setProductUpdatesOptIn] = useState(false);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        setProductUpdatesOptIn(false);
        if (opportunity && !dialog.open) dialog.showModal();
        if (!opportunity && dialog.open) dialog.close();
    }, [opportunity]);

    const closeDialog = () => {
        if (!isStarting) dialogRef.current?.close();
    };

    return (
        <dialog
            ref={dialogRef}
            className="opp-radar-auth-dialog" data-pop-surface="cream"
            aria-labelledby="opp-radar-auth-title"
            aria-describedby="opp-radar-auth-description"
            onClose={onClose}
            onCancel={(event) => {
                event.preventDefault();
                closeDialog();
            }}
        >
            <button type="button" className="opp-radar-auth-close" onClick={closeDialog} disabled={isStarting} aria-label="Close sign-in">
                <X size={20} aria-hidden="true" />
            </button>
            <div className="opp-radar-auth-accent" aria-hidden="true" />
            <p className="opp-radar-auth-label">YOUR PRIVATE RADAR</p>
            <h2 id="opp-radar-auth-title">Keep this opportunity</h2>
            <p id="opp-radar-auth-description">
                Sign in to add <strong>{formatOpportunityTitle(opportunity?.title || 'this opportunity')}</strong>. We’ll finish automatically.
            </p>
            {error && <p className="opp-radar-auth-error" role="alert">{error}</p>}
            <div className="opp-radar-auth-actions">
                <button
                    type="button"
                    className="opp-google-signin opp-radar-auth-google"
                    onClick={() => onContinue(productUpdatesOptIn)}
                    disabled={isStarting}
                    aria-busy={isStarting}
                    autoFocus
                >
                    <img className="opp-google-mark" src="/images/google/g-logo.png" width="20" height="20" alt="" aria-hidden="true" />
                    <span className="opp-google-label">{isStarting ? <OpportunityBusy inline>Connecting to Google</OpportunityBusy> : 'Continue with Google'}</span>
                        <span className="opp-google-arrow" aria-hidden="true">→</span>
                </button>
            </div>
            <OpportunityProductUpdatesOptIn checked={productUpdatesOptIn} onChange={setProductUpdatesOptIn} disabled={isStarting} />
            <p className="opp-radar-auth-privacy">Only your basic Google profile is used to create your tracker.</p>
        </dialog>
    );
};

export default OpportunityRadarSignInDialog;
