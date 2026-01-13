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
                    <h2 className="text-serif hero-title">{selectedTable ? selectedTable.charAt(0).toUpperCase() + selectedTable.slice(1) : 'Dashboard'}</h2>
                    {!selectedTable && (
                        <p className="subtext">Welcome back, <span className="user-email">{session.user.email}</span></p>
                    )}
                </div>
                <div className="header-actions">
                    {selectedTable && (
                        <button onClick={() => setSelectedTable(null)} className="btn-back">← Back</button>
                    )}
                    <button onClick={handleLogout} className="btn-logout-prominent">Sign Out</button>
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
                        title="Films"
                        count={stats.films}
                        onCheck={() => setSelectedTable('films')}
                        onCreate={() => window.location.href = '/admin/editor?table=films&id=new'}
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
                </div>
            ) : (
                <ListView table={selectedTable} />
            )}

            <style>{`
        .loading-screen { 
            height: 100vh; display: flex; align-items: center; justify-content: center; 
            color: var(--text-secondary); font-family: var(--font-sans);
        }
        /* Full width container, remove max-width restriction if desired, or keep it wide */
        .dashboard-container { 
            width: 100%; 
            min-height: 100vh;
            padding: 4rem 3rem; 
            box-sizing: border-box;
            background-color: var(--bg-color); /* Ensure it matches site bg */
            color: var(--text-primary);
        }
        
        .dash-header {
            display: flex; justify-content: space-between; align-items: flex-end;
            margin-bottom: 5rem; 
            border-bottom: 1px solid var(--border-subtle);
            padding-bottom: 2rem;
            max-width: 1600px; margin-left: auto; margin-right: auto; /* Limit header width for readability */
        }
        .hero-title { 
            font-size: 3.5rem; margin: 0 0 0.5rem 0; font-weight: 400; color: var(--text-primary);
            letter-spacing: -0.02em;
            line-height: 1.1;
        }
        .subtext { color: var(--text-secondary); margin: 0; font-size: 1rem; }
        .user-email { color: var(--text-primary); font-weight: 500; }
        
        .header-actions { display: flex; gap: 1.5rem; align-items: center; }
        
        .btn-back {
            background: transparent; border: none; font-size: 0.9rem;
            color: var(--text-secondary); cursor: pointer; font-weight: 500;
        }
        .btn-back:hover { color: var(--text-primary); }

        .btn-logout-prominent {
            background: transparent;
            border: 1px solid var(--border-strong);
            color: var(--text-primary);
            padding: 0.6rem 1.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            cursor: pointer;
            transition: all 0.2s ease;
            border-radius: 4px;
        }
        .btn-logout-prominent:hover {
            border-color: var(--text-primary);
            background: var(--text-primary);
            color: var(--bg-color);
        }

        .stats-grid {
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
            gap: 2rem;
            max-width: 1600px; margin: 0 auto;
        }
        
        .stat-card {
            background: var(--bg-surface); 
            border: 1px solid var(--border-subtle);
            border-radius: 12px; 
            padding: 2.5rem; 
            text-align: center; /* Center align everything */
            display: flex; 
            flex-direction: column; /* Vertical Layout */
            align-items: center; 
            justify-content: center;
            min-height: 240px; /* Taller card */
            transition: all 0.2s ease;
            cursor: pointer;
            position: relative;
            gap: 1.5rem;
        }
        .stat-card:hover { 
            border-color: var(--text-secondary); 
            background: var(--bg-surface-hover);
            transform: translateY(-4px);
            box-shadow: 0 10px 30px -10px rgba(0,0,0,0.1);
        }
        
        .card-content {
            display: flex; flex-direction: column; gap: 0.5rem; align-items: center;
        }

        .stat-card h3 { 
            margin: 0; 
            font-size: 1.5rem;
            color: var(--text-primary); 
            font-weight: 500;
            letter-spacing: -0.01em;
        }
        .count { 
            font-size: 0.875rem;
            font-weight: 500; 
            color: var(--text-secondary);
            margin: 0; 
            font-family: var(--font-sans);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        /* New Line + Button */
        .btn-new-mini {
            width: 44px; height: 44px; /* Larger */
            border-radius: 50%;
            background: transparent; 
            color: var(--text-tertiary);
            border: 1px solid var(--border-subtle);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.5rem; /* Larger symbol */
            font-weight: 300;
            cursor: pointer;
            transition: 0.2s;
            margin-top: 0.5rem; /* Space from count */
        }
        .btn-new-mini:hover {
            transform: scale(1.1);
            background: var(--text-primary);
            color: var(--bg-color);
            border-color: var(--text-primary);
        }

        @media (max-width: 1000px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
            .stats-grid { grid-template-columns: 1fr; }
            .dash-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
            .header-actions { width: 100%; justify-content: space-between; }
        }

        .list-container { 
            animation: fadeIn 0.3s ease; 
            max-width: 1600px; margin: 0 auto;
        }
        .list-table { width: 100%; border-collapse: collapse; margin-top: 0; }
        .list-table tr { border-bottom: 1px solid var(--border-subtle); }
        .list-table th { text-align: left; padding: 1rem 0; border-bottom: 1px solid var(--border-strong); color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .list-table td { padding: 1.5rem 0; color: var(--text-primary); vertical-align: middle; }
        
        .status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 8px; }
        .status-dot.published { background: #10B981; }
        .status-dot.draft { background: var(--text-tertiary); }
        
        .row-actions { display: flex; gap: 1rem; justify-content: flex-end; }
        .btn-icon { background: none; border: none; cursor: pointer; color: var(--text-secondary); font-size: 0.875rem; transition: 0.2s; font-weight: 500; text-decoration: none; }
        .btn-icon:hover { color: var(--text-primary); }
        .btn-icon.delete:hover { color: #ef4444; }
      `}</style>
        </div>
    );
}

function DashboardCard({ title, count, onCheck, onCreate }) {
    return (
        <div className="stat-card" onClick={onCheck}>
            <div className="card-content">
                <h3>{title}</h3>
                <p className="count">{count} Items</p>
            </div>
            {/* Button is now below the content due to flex-col */}
            <button
                onClick={(e) => { e.stopPropagation(); onCreate(); }}
                className="btn-new-mini"
                title="Create New"
            >
                +
            </button>
        </div>
    );
}

function ListView({ table }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        fetchItems();
    }, [table]);

    const fetchItems = async () => {
        try {
            const sortCol = table === 'blog' ? 'published_at' : 'created_at';
            setLoading(true);
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .order(sortCol, { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error('Error fetching items:', err);
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (!error) fetchItems(); // Refresh
        else alert('Error deleting: ' + error.message);
    };

    if (loading) return <div style={{ color: 'var(--text-secondary)' }}>Loading list...</div>;
    if (errorMsg) return <div style={{ color: '#ef4444' }}>Error loading items: {errorMsg}</div>;

    return (
        <div className="list-container">
            {items.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No items found.</p>
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
                                <td><strong style={{ fontWeight: 500 }}>{item.title || '(No Title)'}</strong></td>
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
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
