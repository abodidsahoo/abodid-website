import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminDashboard() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ stories: 0, films: 0, posts: 0, projects: 0 });

    useEffect(() => {
        // 1. Check Auth
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (!session) {
                window.location.href = '/admin/login';
            } else {
                fetchStats();
            }
            setLoading(false);
        });

        // 2. Listen for changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session) window.location.href = '/admin/login';
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchStats = async () => {
        const tableNames = ['stories', 'films', 'posts', 'projects'];
        const newStats = {};

        for (const name of tableNames) {
            const { count, error } = await supabase
                .from(name)
                .select('*', { count: 'exact', head: true });
            if (!error) newStats[name] = count;
        }
        setStats(prev => ({ ...prev, ...newStats }));
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading admin panel...</div>;
    if (!session) return null; // Will redirect

    return (
        <div className="dashboard-container">
            <header className="dash-header">
                <h2>Dashboard</h2>
                <div className="user-info">
                    <span className="email">{session.user.email}</span>
                    <button onClick={handleLogout} className="btn-logout">Logout</button>
                </div>
            </header>

            <div className="stats-grid">
                <div className="stat-card">
                    <h3>Photography</h3>
                    <p className="count">{stats.stories}</p>
                    <a href="/admin/editor/stories/new" className="btn-action">+ New Story</a>
                </div>
                <div className="stat-card">
                    <h3>Journal</h3>
                    <p className="count">{stats.posts}</p>
                    <a href="/admin/editor/posts/new" className="btn-action">+ New Post</a>
                </div>
                <div className="stat-card">
                    <h3>Research</h3>
                    <p className="count">{stats.projects}</p>
                    <a href="/admin/editor/projects/new" className="btn-action">+ New Project</a>
                </div>
                <div className="stat-card">
                    <h3>Films</h3>
                    <p className="count">{stats.films}</p>
                    <a href="/admin/editor/films/new" className="btn-action">+ New Film</a>
                </div>
            </div>

            <div className="coming-soon">
                <p>Select a category above to create new content.</p>
            </div>

            <style>{`
        .dashboard-container {
            max-width: 1000px;
            margin: 0 auto;
        }
        .dash-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border-subtle);
        }
        .email {
            margin-right: 1rem;
            color: var(--text-secondary);
        }
        .btn-logout {
            background: none;
            border: 1px solid var(--border-subtle);
            padding: 0.5rem 1rem;
            cursor: pointer;
            border-radius: 4px;
            color: var(--text-tertiary);
        }
        .btn-logout:hover {
            color: var(--text-primary);
            border-color: var(--text-primary);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 2rem;
            margin-bottom: 4rem;
        }
        .stat-card {
            background: var(--bg-surface);
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            border: 1px solid var(--border-subtle);
        }
        .stat-card h3 {
            margin: 0;
            font-size: 1rem;
            color: var(--text-secondary);
        }
        .count {
            font-size: 3rem;
            font-weight: 600;
            margin: 1rem 0;
            color: var(--text-primary);
        }
        .btn-action {
            display: block;
            width: 100%;
            padding: 0.75rem;
            background: var(--text-primary);
            color: var(--bg-color);
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
        }
        .btn-action:hover {
            opacity: 0.9;
        }
        .coming-soon {
            text-align: center;
            color: var(--text-secondary);
            font-style: italic;
        }
      `}</style>
        </div>
    );
}
