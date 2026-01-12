import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminDashboard() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ stories: 0, films: 0, posts: 0, projects: 0 });

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (!session) window.location.href = '/admin/login';
            else fetchStats();
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session) window.location.href = '/admin/login';
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchStats = async () => {
        const tableNames = ['stories', 'films', 'posts', 'projects'];
        const newStats = {};
        for (const name of tableNames) {
            const { count, error } = await supabase.from(name).select('*', { count: 'exact', head: true });
            if (!error) newStats[name] = count;
        }
        setStats(prev => ({ ...prev, ...newStats }));
    };

    const handleLogout = async () => { await supabase.auth.signOut(); };

    if (loading) return <div className="loading-screen">Authenticating...</div>;
    if (!session) return null;

    return (
        <div className="dashboard-container animation-fade-in">
            <header className="dash-header">
                <div>
                    <h2 className="text-serif">Dashboard</h2>
                    <p className="subtext">Welcome back, {session.user.email}</p>
                </div>
                <button onClick={handleLogout} className="btn-logout">Sign Out</button>
            </header>

            <div className="stats-grid">
                <DashboardCard
                    title="Photography"
                    count={stats.stories}
                    link="/admin/editor?table=stories&id=new"
                    label="New Story"
                />
                <DashboardCard
                    title="Journal"
                    count={stats.posts}
                    link="/admin/editor?table=posts&id=new"
                    label="New Post"
                />
                <DashboardCard
                    title="Research"
                    count={stats.projects}
                    link="/admin/editor?table=projects&id=new"
                    label="New Project"
                />
                <DashboardCard
                    title="Films"
                    count={stats.films}
                    link="/admin/editor?table=films&id=new"
                    label="New Film"
                />
            </div>

            <style>{`
        .loading-screen { 
            height: 100vh; display: flex; align-items: center; justify-content: center; 
            color: var(--text-secondary); font-family: var(--font-sans);
        }
        .dashboard-container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
        .dash-header {
            display: flex; justify-content: space-between; align-items: flex-start;
            margin-bottom: 4rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border-subtle);
        }
        .dash-header h2 { font-size: 2.5rem; margin: 0 0 0.5rem 0; font-weight: 500; }
        .subtext { color: var(--text-secondary); margin: 0; }
        
        .btn-logout {
            background: rgba(0,0,0,0.05); border: none; padding: 0.6em 1.2em;
            border-radius: 20px; color: var(--text-secondary); cursor: pointer;
            transition: all 0.2s ease; font-size: 0.9rem;
        }
        .btn-logout:hover { background: rgba(0,0,0,0.1); color: var(--text-primary); }

        .stats-grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 2rem;
        }
        .stat-card {
            background: var(--bg-surface); border: 1px solid var(--border-subtle);
            border-radius: 12px; padding: 2rem; text-align: center;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .stat-card:hover {
            transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.04);
            border-color: var(--border-color);
        }
        .stat-card h3 { 
            margin: 0; font-size: 0.9rem; text-transform: uppercase; 
            letter-spacing: 0.1em; color: var(--text-tertiary);
        }
        .count { 
            font-size: 4rem; font-weight: 300; margin: 1rem 0; 
            font-family: var(--font-serif); color: var(--text-primary);
        }
        .btn-action {
            display: inline-block; width: 100%; padding: 0.8rem;
            background: var(--text-primary); color: var(--bg-color);
            text-decoration: none; border-radius: 6px; font-weight: 500;
            transition: opacity 0.2s ease;
        }
        .btn-action:hover { opacity: 0.9; }
      `}</style>
        </div>
    );
}

function DashboardCard({ title, count, link, label }) {
    return (
        <div className="stat-card">
            <h3>{title}</h3>
            <p className="count">{count}</p>
            <a href={link} className="btn-action">+ {label}</a>
        </div>
    );
}
