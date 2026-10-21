import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import './opportunity-admin-shell.css';
import './opportunity-users.css';

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
});

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
});

const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : dateFormatter.format(date);
};

const formatTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : `${timeFormatter.format(date)} IST`;
};

const initialsFor = (name) => String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

const getAdminToken = async (providedToken) => {
    if (providedToken) return providedToken;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your admin session has expired.');
    return session.access_token;
};

export default function OpportunityUsers({ accessToken, directory, loading, error, onRetry }) {
    const dialogRef = useRef(null);
    const openedDeepLinkRef = useRef(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [collection, setCollection] = useState({ loading: false, error: '', opportunities: [] });

    const openCollection = useCallback(async (user) => {
        setSelectedUser(user);
        setCollection({ loading: true, error: '', opportunities: [] });

        try {
            const token = await getAdminToken(accessToken);
            const response = await fetch(`/api/admin/opportunity-users/${encodeURIComponent(user.id)}`, {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not load this collection.');
            setSelectedUser(payload.user || user);
            setCollection({ loading: false, error: '', opportunities: payload.opportunities || [] });
        } catch (collectionError) {
            setCollection({
                loading: false,
                error: collectionError instanceof Error ? collectionError.message : 'Could not load this collection.',
                opportunities: [],
            });
        }
    }, [accessToken]);

    useEffect(() => {
        if (!selectedUser || dialogRef.current?.open) return;
        dialogRef.current?.showModal();
    }, [selectedUser]);

    useEffect(() => {
        if (loading || openedDeepLinkRef.current || directory.users.length === 0) return;
        const requestedUserId = new URLSearchParams(window.location.search).get('user');
        if (!requestedUserId) return;
        openedDeepLinkRef.current = true;
        const requestedUser = directory.users.find((user) => user.id === requestedUserId);
        if (requestedUser) void openCollection(requestedUser);
    }, [directory.users, loading, openCollection]);

    const clearUserQuery = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('user');
        window.history.replaceState({}, '', url);
    };

    const closeDialog = () => {
        dialogRef.current?.close();
        setSelectedUser(null);
        setCollection({ loading: false, error: '', opportunities: [] });
        clearUserQuery();
    };

    return (
        <div className="opportunity-users">
            <section className="opportunity-admin-collection" aria-labelledby="opportunity-users-directory-title">
                <header className="opportunity-admin-results-heading">
                    <h3 id="opportunity-users-directory-title" className="opportunity-admin-counter">
                        {loading ? 'Users' : `${(directory.summary?.total || 0).toLocaleString()} ${(directory.summary?.total || 0) === 1 ? 'user' : 'users'}`}
                    </h3>
                    <p>
                        {loading
                            ? 'Loading directory…'
                            : `${(directory.summary?.savedOpportunities || 0).toLocaleString()} saved opportunities · Newest first`}
                    </p>
                </header>

                <div
                    className="opportunity-users-table-shell"
                    role="region"
                    aria-labelledby="opportunity-users-directory-title"
                    tabIndex="0"
                >
                {loading && <p className="opportunity-users-state" role="status">Loading users…</p>}
                {!loading && error && (
                    <div className="opportunity-users-state is-error" role="alert">
                        <p>{error}</p>
                        <button type="button" onClick={onRetry}>Try again</button>
                    </div>
                )}
                {!loading && !error && directory.users.length === 0 && (
                    <p className="opportunity-users-state">No users yet.</p>
                )}
                {!loading && !error && directory.users.length > 0 && (
                    <table className="opportunity-users-table">
                        <caption>People who have onboarded to Opportunity Tracker</caption>
                        <colgroup>
                            <col className="opportunity-users-col-user" />
                            <col className="opportunity-users-col-onboarded" />
                            <col className="opportunity-users-col-saved" />
                            <col className="opportunity-users-col-collection" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th scope="col">User</th>
                                <th scope="col">Onboarded</th>
                                <th scope="col">Saved</th>
                                <th scope="col">Collection</th>
                            </tr>
                        </thead>
                        <tbody>
                            {directory.users.map((user) => (
                                <tr key={user.id}>
                                    <th scope="row">
                                        <span className="opportunity-user-profile">
                                            <span className="opportunity-user-avatar" aria-hidden="true">
                                                {user.avatarUrl
                                                    ? <img src={user.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                                                    : initialsFor(user.displayName)}
                                            </span>
                                            <span className="opportunity-user-identity">
                                                <strong>{user.displayName}</strong>
                                                <small>{user.email || `@${user.username}`}</small>
                                            </span>
                                        </span>
                                    </th>
                                    <td data-label="Onboarded">
                                        <strong className="opportunity-user-date">{formatDate(user.onboardedAt)}</strong>
                                        <small>{formatTime(user.onboardedAt)}</small>
                                    </td>
                                    <td data-label="Saved">
                                        <strong className="opportunity-user-count">{user.opportunityCount}</strong>
                                    </td>
                                    <td data-label="Collection">
                                        <button
                                            type="button"
                                            className="opportunity-user-view"
                                            onClick={() => {
                                                const url = new URL(window.location.href);
                                                url.searchParams.set('user', user.id);
                                                window.history.replaceState({}, '', url);
                                                void openCollection(user);
                                            }}
                                            aria-label={`View ${user.displayName}'s collection`}
                                        >
                                            <span>View collection</span>
                                            <ArrowUpRight size={17} strokeWidth={2} aria-hidden="true" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                </div>
            </section>

            <dialog
                ref={dialogRef}
                className="opportunity-collection-dialog"
                aria-labelledby="opportunity-collection-title"
                onCancel={(event) => {
                    event.preventDefault();
                    closeDialog();
                }}
                onClose={() => {
                    setSelectedUser(null);
                    setCollection({ loading: false, error: '', opportunities: [] });
                    clearUserQuery();
                }}
                onClick={(event) => {
                    if (event.target === event.currentTarget) closeDialog();
                }}
            >
                <header>
                    <div>
                        <p>Private collection</p>
                        <h3 id="opportunity-collection-title">{selectedUser?.displayName || 'Collection'}</h3>
                    </div>
                    <button type="button" onClick={closeDialog} aria-label="Close collection">
                        <X size={22} strokeWidth={2} aria-hidden="true" />
                    </button>
                </header>

                <div className="opportunity-collection-body">
                    {collection.loading && <p className="opportunity-collection-state" role="status">Loading collection…</p>}
                    {!collection.loading && collection.error && <p className="opportunity-collection-state is-error" role="alert">{collection.error}</p>}
                    {!collection.loading && !collection.error && collection.opportunities.length === 0 && (
                        <p className="opportunity-collection-state">No saved opportunities yet.</p>
                    )}
                    {!collection.loading && !collection.error && collection.opportunities.length > 0 && (
                        <ol className="opportunity-collection-list">
                            {collection.opportunities.map((opportunity) => (
                                <li key={opportunity.id}>
                                    <div>
                                        <span>{opportunity.organisation || opportunity.category || 'Opportunity'}</span>
                                        <h4>{opportunity.title}</h4>
                                        <p>
                                            {opportunity.deadlineAt ? `Deadline ${formatDate(opportunity.deadlineAt)}` : 'No deadline'}
                                            {' · '}{opportunity.status}
                                        </p>
                                    </div>
                                    {opportunity.sourceUrl && (
                                        <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">
                                            <span>Source</span>
                                            <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </dialog>
        </div>
    );
}
