import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getBookmarkedResources, getAllTags } from '../../lib/resources/db';
import ResourceFeed from './ResourceFeed';
import type { HubResource, HubTag } from '../../lib/resources/types';

export default function SavedResourceList() {
    const [resources, setResources] = useState<HubResource[]>([]);
    const [tags, setTags] = useState<HubTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const init = async () => {
            if (!supabase) return;
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                // Not logged in
                window.location.href = '/login?redirect=/resources/saved';
                return;
            }
            setUser(user);

            const [resData, tagsData] = await Promise.all([
                getBookmarkedResources(user.id),
                getAllTags()
            ]);

            setResources(resData);
            setTags(tagsData);
            setLoading(false);
        };

        init();
    }, []);

    if (loading) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading your collection...
            </div>
        );
    }

    if (resources.length === 0) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No saved resources yet.</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Browse the hub, open any resource, then tap Save to keep it for later.
                </p>
                <a href="/resources" className="hub-btn-primary">Browse Hub</a>
                {/* Internal style for button since we are in React and might not have global css scope for this class if valid, but assuming it exists or inline it */}
                <style>{`
                    .hub-btn-primary {
                        background: var(--text-primary);
                        color: var(--bg-color);
                        padding: 10px 20px;
                        border-radius: 100px;
                        text-decoration: none;
                        font-weight: 600;
                        font-size: 14px;
                        display: inline-block;
                    }
                 `}</style>
            </div>
        );
    }

    return (
        <ResourceFeed initialResources={resources} availableTags={tags} />
    );
}
