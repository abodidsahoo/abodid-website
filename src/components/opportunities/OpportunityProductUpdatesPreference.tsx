import React, { useEffect, useState } from 'react';
import { PRODUCT_UPDATES_CONSENT_VERSION } from '../../lib/opportunities/productUpdates';
import { OpportunityProductUpdatesOptIn } from './OpportunityProductUpdatesOptIn';

export function OpportunityProductUpdatesPreference({ accessToken, isOpen }: { accessToken: string | null; isOpen: boolean }) {
    const [optedIn, setOptedIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (!isOpen) return;
        if (!accessToken) {
            setLoading(false);
            setError('Sign in again to manage email preferences.');
            return;
        }
        const controller = new AbortController();
        setLoading(true); setError(''); setMessage('');
        void fetch('/api/opportunities/product-updates', {
            headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', signal: controller.signal,
        }).then(async (response) => {
            if (!response.ok) throw new Error('Your email preference could not be loaded.');
            const payload = await response.json();
            if (!controller.signal.aborted) setOptedIn(payload.opt_in === true);
        }).catch(() => {
            if (!controller.signal.aborted) setError('Your email preference could not be loaded.');
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [isOpen, accessToken, retry]);

    const changePreference = async (next: boolean) => {
        if (!accessToken || saving) return;
        setSaving(true); setMessage(''); setError('');
        try {
            const response = await fetch('/api/opportunities/product-updates', {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ opt_in: next, source: 'profile', consent_version: PRODUCT_UPDATES_CONSENT_VERSION }),
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) throw new Error('Your email preference could not be saved.');
            setOptedIn(next);
            setMessage(next ? 'Product updates enabled.' : 'Product updates turned off.');
        } catch {
            setError('Your email preference could not be saved. Please try again.');
        } finally { setSaving(false); }
    };

    return <section className="opp-product-updates-preference" aria-label="Email preferences">
        <h3>Email preferences</h3>
        <OpportunityProductUpdatesOptIn checked={optedIn} onChange={(value) => void changePreference(value)}
            disabled={loading || saving || !accessToken || Boolean(error)} />
        {(loading || saving || message) && <p role="status">{loading ? 'Loading email preferences…' : saving ? 'Saving preference…' : message}</p>}
        {error && <p role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></p>}
    </section>;
}
