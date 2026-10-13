import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { OPPORTUNITY_RESERVED_USERNAMES, normalizeOpportunityUsername } from '../../lib/opportunities/username';

type SettingsProfile = {
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_public: boolean;
};

export default function OpportunitySettings() {
    const [token, setToken] = useState('');
    const [profile, setProfile] = useState<SettingsProfile | null>(null);
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        void supabase.auth.getSession().then(async ({ data }) => {
            const session = data.session;
            if (!session?.access_token || session.user.is_anonymous) {
                window.location.replace('/opportunities?next=%2Fopportunities%2Fsettings');
                return;
            }
            setToken(session.access_token);
            const response = await fetch('/api/opportunities/profile', {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: 'no-store',
            });
            if (!response.ok) {
                setMessage('Your profile could not be loaded.');
                setLoading(false);
                return;
            }
            const payload = await response.json();
            const nextProfile = payload.profile as SettingsProfile;
            setProfile(nextProfile);
            setUsername(nextProfile.username);
            setDisplayName(nextProfile.display_name);
            setIsPublic(nextProfile.is_public);
            setLoading(false);
        });
    }, []);

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        const cleanUsername = normalizeOpportunityUsername(username);
        if (cleanUsername.length < 3 || OPPORTUNITY_RESERVED_USERNAMES.has(cleanUsername)) {
            setMessage('Choose 3–24 lowercase letters, numbers or underscores.');
            return;
        }

        setSaving(true);
        setMessage('');
        const response = await fetch('/api/opportunities/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ username: cleanUsername, display_name: displayName, is_public: isPublic }),
        });
        const payload = await response.json();
        if (!response.ok) {
            setMessage(payload.error || 'Settings could not be saved.');
            setSaving(false);
            return;
        }
        setProfile(payload.profile);
        setUsername(payload.profile.username);
        setDisplayName(payload.profile.display_name);
        setIsPublic(payload.profile.is_public);
        setMessage('Settings saved.');
        setSaving(false);
        if (profile && profile.username !== payload.profile.username) {
            window.history.replaceState({}, '', '/opportunities/settings');
        }
    };

    if (loading) return <div className="opp-auth-loading" role="status">Loading settings…</div>;
    if (!profile) return <div className="opp-auth-loading">{message || 'Profile unavailable.'}</div>;

    return (
        <main className="opp-settings-shell">
            <a className="opp-settings-back" href={`/opportunities/${profile.username}`}>← My Opportunities</a>
            <section className="opp-settings-card">
                <div className="opp-settings-heading">
                    <div>
                        <span>OPPORTUNITY TRACKER · PROFILE & SHARING</span>
                        <h1>Collection settings</h1>
                    </div>
                </div>
                <form onSubmit={save}>
                    <label htmlFor="opportunity-display-name">Display name</label>
                    <input id="opportunity-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} required />

                    <label htmlFor="opportunity-username">Personal URL</label>
                    <div className="opp-settings-url-field">
                        <span>abodid.com/opportunities/</span>
                        <input id="opportunity-username" value={username} onChange={(event) => setUsername(normalizeOpportunityUsername(event.target.value))} minLength={3} maxLength={24} required />
                    </div>
                    <p className="opp-settings-field-note">This is your URL slug. The brand name does not change it.</p>

                    <label className="opp-visibility-toggle">
                        <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
                        <span>
                            <strong>Public collection</strong>
                            <small>{isPublic ? 'Anyone with your URL can view shared opportunity details.' : 'Only you can access your opportunities.'}</small>
                        </span>
                    </label>

                    <div className="opp-settings-actions">
                        <button type="submit" className="opp-btn opp-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Settings →'}</button>
                        {message && <span role="status">{message}</span>}
                    </div>
                </form>
            </section>
        </main>
    );
}
