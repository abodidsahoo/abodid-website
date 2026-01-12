import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminDashboard() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ stories: 0, films: 0, posts: 0, projects: 0 });
    const [selectedTable, setSelectedTable] = useState(null); // 'stories', 'posts', etc.

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
        const tableNames = ['photography', 'films', 'blog', 'research'];
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
                    <h2 className="text-serif hero-title">Dashboard</h2>
                    <p className="subtext">Welcome back, {session.user.email}</p>
                </div>
                <div className="header-actions">
                    {selectedTable && (
                        <button onClick={() => setSelectedTable(null)} className="btn-back">← Back</button>
                    )}
                    <button onClick={handleLogout} className="btn-logout">Sign Out</button>
                </div>
            </header>

            {!selectedTable ? (
                <div className="stats-grid">
                    <DashboardCard
                        title="Photography"
                        count={stats.photography}
                        onCheck={() => setSelectedTable('photography')}
                        onCreate={() => window.location.href = '/admin/editor?table=photography&id=new'}
                    />
                    <DashboardCard
                        title="Blog"
                        count={stats.blog}
                        onCheck={() => setSelectedTable('blog')}
                        onCreate={() => window.location.href = '/admin/editor?table=blog&id=new'}
                    />
                    <DashboardCard
                        title="Research"
                        count={stats.research}
                        onCheck={() => setSelectedTable('research')}
                        onCreate={() => window.location.href = '/admin/editor?table=research&id=new'}
                    />
                    <DashboardCard
                        title="Films"
                        count={stats.films}
                        onCheck={() => setSelectedTable('films')}
                        onCreate={() => window.location.href = '/admin/editor?table=films&id=new'}
                    />
                </div>
            ) : (
                <ListView table={selectedTable} />
            )}

            <style>{`
        .loading-screen { 
            height: 100vh; display: flex; align-items: center; justify-content: center; 
            color: var(--text-secondary); font-family: var(--font-sans);
        }
        .dashboard-container { max-width: 1200px; margin: 0 auto; padding: 4rem 2rem; }
        
        .dash-header {
            display: flex; justify-content: space-between; align-items: flex-start;
            margin-bottom: 5rem; 
        }
        .hero-title { 
            font-size: 4rem; margin: 0 0 0.5rem 0; font-weight: 400; color: #fff;
            letter-spacing: -0.03em;
        }
        .subtext { color: #666; margin: 0; font-size: 0.9rem; }
        
        .header-actions { display: flex; gap: 1rem; align-items: center; }
        
        .btn-logout, .btn-back {
            background: transparent; border: none; font-size: 0.9rem;
            color: #666; cursor: pointer; font-weight: 500;
        }
        .btn-logout:hover, .btn-back:hover { color: #fff; }

        /* Minimal Card Grid */
        .stats-grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem;
        }
        .stat-card {
            background: #111; border: 1px solid #222;
            border-radius: 8px; padding: 2.5rem 2rem; text-align: center;
            display: flex; flex-direction: column; align-items: center; justify-content: space-between;
            min-height: 280px; transition: 0.2s;
        }
        .stat-card:hover { border-color: #333; }
        
        .stat-card h3 { 
            margin: 0; font-size: 0.75rem; text-transform: uppercase; 
            letter-spacing: 0.15em; color: #666; font-weight: 600;
        }
        .count { 
            font-size: 5rem; font-weight: 300; margin: 0; line-height: 1;
            font-family: var(--font-serif); color: #fff;
        }
        
        .card-actions {
            display: flex; gap: 10px; width: 100%; justify-content: center;
        }
        
        .btn-action {
            padding: 0.6rem 1.5rem; border-radius: 4px; font-weight: 500; font-size: 0.85rem;
            cursor: pointer; border: none; transition: 0.2s; min-width: 80px;
        }
        .btn-primary { background: #fff; color: #000; font-weight: 600; }
        .btn-primary:hover { background: #ccc; }
        
        .btn-secondary { background: #1a1a1a; color: #ccc; border: 1px solid #333; }
        .btn-secondary:hover { border-color: #666; color: #fff; }

        /* List View */
        .list-container { animation: fadeIn 0.3s ease; }
        .list-table { width: 100%; border-collapse: collapse; margin-top: 2rem; }
        .list-table th { text-align: left; padding: 1rem; border-bottom: 1px solid #333; color: #666; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .list-table td { padding: 1.2rem 1rem; border-bottom: 1px solid #222; color: #ccc; }
        
        .status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 8px; }
        .status-dot.published { background: #10B981; }
        .status-dot.draft { background: #444; }
        
        .row-actions { display: flex; gap: 1rem; justify-content: flex-end; }
        .btn-icon { background: none; border: none; cursor: pointer; color: #666; font-size: 0.85rem; transition: 0.2s; }
        .btn-icon:hover { color: #fff; }
        .btn-icon.delete:hover { color: #ef4444; }
      `}</style>
        </div>
    );
}

function DashboardCard({ title, count, onCheck, onCreate }) {
    return (
        <div className="stat-card" onClick={onCheck} style={{ cursor: 'pointer' }}>
            <h3>{title}</h3>
            <p className="count">{count}</p>
            <div className="card-actions">
                <button onClick={(e) => { e.stopPropagation(); onCheck(); }} className="btn-action btn-secondary">List</button>
                <button onClick={(e) => { e.stopPropagation(); onCreate(); }} className="btn-action btn-primary">+ New</button>
            </div>
        </div>
    );
}

function ListView({ table }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchItems();
    }, [table]);

    const fetchItems = async () => {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setItems(data);
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (!error) fetchItems(); // Refresh
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="list-container">
            <h3 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '2rem' }}>All {table}</h3>
            {items.length === 0 ? (
                <p style={{ color: '#666' }}>No items found.</p>
            ) : (
                <table className="list-table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => (
                            <tr key={item.id}>
                                <td><strong>{item.title}</strong></td>
                                <td>
                                    <span className={`status-dot ${item.published ? 'published' : 'draft'}`}></span>
                                    {item.published ? 'Live' : 'Draft'}
                                </td>
                                <td className="row-actions">
                                    <a href={`/admin/editor?table=${table}&id=${item.id}`} className="btn-icon">Edit</a>
                                    <button onClick={() => handleDelete(item.id)} className="btn-icon delete">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
