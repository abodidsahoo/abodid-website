import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminEditButton({ resourceId }: { resourceId: string }) {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const check = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (data?.role === 'admin') {
                    setIsAdmin(true);
                }
            }
        };
        check();
    }, []);

    if (!isAdmin) return null;

    return (
        <a
            href={`/resources/${resourceId}/edit`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-primary)',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
            }}
            onMouseOver={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = 'var(--text-primary)';
                e.currentTarget.style.color = 'var(--bg-color)';
            }}
            onMouseOut={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = 'var(--bg-surface)';
                e.currentTarget.style.color = 'var(--text-primary)';
            }}
        >
            <span style={{ fontSize: '1.2em', marginRight: '8px' }}>✎</span>
            Edit Resource
        </a>
    );
}
