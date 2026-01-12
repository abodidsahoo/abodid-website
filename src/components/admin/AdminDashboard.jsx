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
                <div className="header-actions">
                    {selectedTable && (
                        <button onClick={() => setSelectedTable(null)} className="btn-back">← Back to Overview</button>
                    )}
                    <button onClick={handleLogout} className="btn-logout">Sign Out</button>
                </div>
            </header>

            {!selectedTable ? (
                <div className="stats-grid">
                    <DashboardCard
                        title="Photography"
                        count={stats.stories}
                        onCheck={() => setSelectedTable('stories')}
                        onCreate={() => window.location.href = '/admin/editor?table=stories&id=new'}
                        label="Story"
                    />
                    <DashboardCard
                        title="Journal"
                        count={stats.posts}
                        onCheck={() => setSelectedTable('posts')}
                        onCreate={() => window.location.href = '/admin/editor?table=posts&id=new'}
                        label="Post"
                    />
                    <DashboardCard
                        title="Research"
                        count={stats.projects}
                        onCheck={() => setSelectedTable('projects')}
                        onCreate={() => window.location.href = '/admin/editor?table=projects&id=new'}
                        label="Project"
                    />
                    <DashboardCard
                        title="Films"
                        count={stats.films}
                        onCheck={() => setSelectedTable('films')}
                        onCreate={() => window.location.href = '/admin/editor?table=films&id=new'}
                        label="Film"
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
        .dashboard-container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
        .dash-header {
            display: flex; justify-content: space-between; align-items: flex-start;
            margin-bottom: 3rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border-subtle);
        }
        .dash-header h2 { font-size: 2rem; margin: 0 0 0.5rem 0; font-weight: 500; }
        .subtext { color: var(--text-secondary); margin: 0; font-size: 0.9rem; }
        
        .header-actions { display: flex; gap: 1rem; }
        
        .btn-logout, .btn-back {
            background: rgba(0,0,0,0.05); border: none; padding: 0.6em 1.2em;
            border-radius: 20px; color: var(--text-secondary); cursor: pointer;
            transition: all 0.2s ease; font-size: 0.85rem; font-weight: 500;
        }
        .btn-logout:hover, .btn-back:hover { background: rgba(0,0,0,0.1); color: var(--text-primary); }

        /* Card Grid */
        .stats-grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;
        }
        .stat-card {
            background: var(--bg-surface); border: 1px solid var(--border-subtle);
            border-radius: 12px; padding: 2rem; text-align: center;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            display: flex; flex-direction: column; align-items: center; justify-content: space-between;
            min-height: 220px;
        }
        .stat-card:hover {
            transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.04);
            border-color: var(--border-strong);
        }
        .stat-card h3 { 
            margin: 0; font-size: 0.85rem; text-transform: uppercase; 
            letter-spacing: 0.1em; color: var(--text-tertiary);
        }
        .count { 
            font-size: 3.5rem; font-weight: 300; margin: 1rem 0; 
            font-family: var(--font-serif); color: var(--text-primary);
        }
        
        .card-actions {
            display: flex; gap: 0.8rem; width: 100%;
        }
        
        .btn-action {
            flex: 1; padding: 0.8rem;
            text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 0.9rem;
            transition: opacity 0.2s ease; cursor: pointer; border: none;
        }
        .btn-primary { background: var(--text-primary); color: var(--bg-color); }
        .btn-secondary { background: var(--bg-surface-hover); color: var(--text-primary); border: 1px solid var(--border-subtle); }
        
        .btn-action:hover { opacity: 0.9; }
        .btn-secondary:hover { background: #e0e0e0; }

        /* List View */
        .list-container { animation: fadeIn 0.3s ease; }
        .list-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        .list-table th { text-align: left; padding: 1rem; border-bottom: 2px solid var(--border-subtle); color: var(--text-tertiary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .list-table td { padding: 1rem; border-bottom: 1px solid var(--border-subtle); }
        .list-table tr:last-child td { border-bottom: none; }
        
        .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
        .status-dot.published { background: #10B981; }
        .status-dot.draft { background: #E5E7EB; }
        
        .row-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
        .btn-icon { background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 0.4rem; border-radius: 4px; transition: background 0.2s; }
        .btn-icon:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
        .btn-icon.delete:hover { color: #EF4444; background: #FEF2F2; }
      `}</style>
        </div>
    );
}

function DashboardCard({ title, count, onCheck, onCreate, label }) {
    return (
        <div className="stat-card" onClick={onCheck} style={{ cursor: 'pointer' }}>
            <div>
                <h3>{title}</h3>
                <p className="count">{count}</p>
            </div>
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

    if (loading) return <div>Loading list...</div>;

    return (
        <div className="list-container">
            <h3>Managing {table}</h3>
            {items.length === 0 ? (
                <p>No items found.</p>
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
                                    <a href={`/admin/editor?table=${table}&id=${item.id}`} className="btn-icon">✎ Edit</a>
                                    <button onClick={() => handleDelete(item.id)} className="btn-icon delete">🗑 Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
