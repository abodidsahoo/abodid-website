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
                    <p className="subtext">Welcome back, <span className="user-email">{session.user.email}</span></p>
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
        .dashboard-container { max-width: 1400px; margin: 0 auto; padding: 4rem 3rem; }
        
        .dash-header {
            display: flex; justify-content: space-between; align-items: flex-end; /* Align bottom for "downwards" feel */
            margin-bottom: 5rem; 
            border-bottom: 1px solid #222;
            padding-bottom: 2rem;
        }
        .hero-title { 
            font-size: 4rem; margin: 0 0 0.5rem 0; font-weight: 400; color: #fff;
            letter-spacing: -0.03em;
        }
        .subtext { color: #666; margin: 0; font-size: 0.9rem; }
        .user-email { color: #fff; border-bottom: 1px dotted #666; }
        
        .header-actions { display: flex; gap: 1.5rem; align-items: center; }
        
        .btn-back {
            background: transparent; border: none; font-size: 0.9rem;
            color: #666; cursor: pointer; font-weight: 500;
        }
        .btn-back:hover { color: #fff; }

        /* Prominent Sign Out Button */
        .btn-logout-prominent {
            background: transparent;
            border: 1px solid #444;
            color: #ccc;
            padding: 0.6rem 1.5rem;
            font-size: 0.9rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 1rem; /* Push slightly downwards if needed, but flex-end handles it */
        }
        .btn-logout-prominent:hover {
            border-color: #fff;
            color: #fff;
            background: rgba(255,255,255,0.05);
            box-shadow: 0 0 15px rgba(255,255,255,0.1);
        }

        /* 4-Column Grid */
        .stats-grid {
            display: grid; 
            grid-template-columns: repeat(4, 1fr); /* Force 4 columns */
            gap: 1.5rem;
        }
        
        /* Compact Card Styling */
        .stat-card {
            background: #111; 
            border: 1px solid #222;
            border-radius: 4px; 
            padding: 1.5rem; 
            text-align: left;
            display: flex; 
            flex-direction: row; /* Horizontal Layout inside? User said "blocks", let's keep vertical but compact */
            align-items: center; 
            justify-content: space-between;
            min-height: 120px; /* Smaller height */
            transition: 0.2s;
            cursor: pointer;
            position: relative;
        }
        .stat-card:hover { 
            border-color: #444; 
            background: #161616;
        }
        
        .card-content {
            display: flex; flex-direction: column; gap: 0.2rem;
        }

        .stat-card h3 { 
            margin: 0; 
            font-size: 1.8rem; /* Way larger text */
            color: #fff; 
            font-weight: 400;
            letter-spacing: -0.02em;
        }
        .count { 
            font-size: 0.75rem; /* Very small number */
            font-weight: 400; 
            color: #666;
            margin: 0; 
            font-family: var(--font-sans);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .btn-new-mini {
            width: 32px; height: 32px;
            border-radius: 50%;
            background: #fff; color: #000;
            border: none;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.2rem;
            font-weight: 300;
            cursor: pointer;
            transition: 0.2s;
        }
        .btn-new-mini:hover {
            transform: scale(1.1);
            background: #ccc;
        }

        /* Responsive Breakpoint - Collapse to 2 cols on smaller screens if needed */
        @media (max-width: 1000px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* List View */
        .list-container { animation: fadeIn 0.3s ease; }
        .list-table { width: 100%; border-collapse: collapse; margin-top: 2rem; }
        .list-table tr { border-bottom: 1px solid #222; }
        .list-table th { text-align: left; padding: 1rem; border-bottom: 1px solid #333; color: #666; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .list-table td { padding: 1.2rem 1rem; color: #ccc; }
        
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
        <div className="stat-card" onClick={onCheck}>
            <div className="card-content">
                <h3>{title}</h3>
                <p className="count">{count} Items</p>
            </div>
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

    if (loading) return <div style={{ color: '#666' }}>Loading list...</div>;
    if (errorMsg) return <div style={{ color: '#ef4444' }}>Error loading items: {errorMsg}</div>;

    return (
        <div className="list-container">
            <h3 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '2rem', color: '#fff' }}>All {table}</h3>
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
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
