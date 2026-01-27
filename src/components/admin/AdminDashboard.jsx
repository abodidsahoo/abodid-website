import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import UserList from './UserList';
import TagInput from '../resources/TagInput';
import ListView from './ListView';
import BrandManager from './BrandManager';

const SECTIONS = [
    { id: 'dashboard', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'brands', label: 'Brands', icon: '🏷️' },
    { id: 'photography', label: 'Photography', icon: '📸' },
    { id: 'films', label: 'Films', icon: '🎬' },
    { id: 'blog', label: 'Blog', icon: '✍️' },
    { id: 'research', label: 'Research', icon: '🔬' },
    { id: 'hub_resources', label: 'Resources', icon: '📚' },
    { id: 'page_metadata', label: 'Metadata', icon: '⚙️' },
];

export default function AdminDashboard() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ photography: 0, films: 0, posts: 0, projects: 0, metadata: 0, users: 0, resources: 0 });
    const [activeSection, setActiveSection] = useState('dashboard');
    const [recentActivity, setRecentActivity] = useState([]);
    const [connectionError, setConnectionError] = useState(null);
    const [showResourceModal, setShowResourceModal] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        console.log("AdminDashboard: Mounted");
        // URL State Sync
        const params = new URLSearchParams(window.location.search);
        const section = params.get('section');
        if (section) setActiveSection(section);

        // Simple, robust auth check
        const checkAuth = async () => {
            try {
                // 1. Get Session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) throw sessionError;

                if (!session) {
                    console.warn("AdminDashboard: No session found, redirecting.");
                    window.location.href = '/admin/login?reason=no_session';
                    return;
                }

                // 2. Check Admin Role
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (profileError) {
                    console.error("AdminDashboard: Profile fetch error", profileError);
                    // Decide if you want to block or just warn. Blocking is safer for admin.
                    throw new Error("Could not verify admin profile.");
                }

                if (profile?.role !== 'admin') {
                    console.warn("AdminDashboard: User is not admin. Role:", profile?.role);
                    setConnectionError("Access Denied: You do not have admin privileges.");
                    setLoading(false);
                    return;
                }

                // 3. Success
                setSession(session);
                await Promise.all([
                    fetchStats(),
                    fetchRecentActivity()
                ]);

            } catch (err) {
                console.error("AdminDashboard: Auth check failed:", err);
                setConnectionError(err.message || "Authentication check failed.");
            } finally {
                setLoading(false);
            }
        };

        if (supabase) {
            checkAuth();

            // Listen for auth changes
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                if (_event === 'SIGNED_OUT') {
                    setSession(null);
                    window.location.href = '/admin/login';
                } else if (_event === 'SIGNED_IN' && session) {
                    setSession(session);
                }
            });

            return () => subscription.unsubscribe();
        } else {
            setConnectionError("Supabase client not initialized.");
            setLoading(false);
        }
    }, []);

    const handleNav = (id) => {
        setActiveSection(id);
        const url = new URL(window.location);
        url.searchParams.set('section', id);
        window.history.pushState({}, '', url);
    };

    const fetchStats = async () => {
        if (!supabase) return;
        const tableNames = ['photography', 'films', 'blog', 'research', 'hub_resources', 'page_metadata', 'profiles'];
        const newStats = {};
        for (const name of tableNames) {
            const { count, error } = await supabase.from(name).select('*', { count: 'exact', head: true });
            if (!error) {
                const key = name === 'page_metadata' ? 'metadata' : (name === 'profiles' ? 'users' : (name === 'hub_resources' ? 'resources' : name));
                newStats[key] = count;
            } else {
                console.warn(`Error fetching count for ${name}:`, error.message);
            }
        }

        // Fetch pending count specifically
        const { count: pendingCount } = await supabase.from('hub_resources')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        newStats['pendingResources'] = pendingCount || 0;

        setStats(prev => ({ ...prev, ...newStats }));
    };

    const fetchRecentActivity = async () => {
        if (!supabase) return;
        try {
            const tables = [
                { name: 'photography', type: 'Photography', icon: '📸' },
                { name: 'films', type: 'Film', icon: '🎬' },
                { name: 'blog', type: 'Post', icon: '✍️' },
                { name: 'research', type: 'Research', icon: '🔬' },
                { name: 'hub_resources', type: 'Resource', icon: '📚' },
                { name: 'profiles', type: 'User', icon: '👤' }
            ];

            let allActivities = [];

            for (const t of tables) {
                const { data } = await supabase
                    .from(t.name)
                    .select('*')
                    // Using created_at for "Activity". 
                    // Note: If some tables use a different timestamp, handling might be needed.
                    // Assuming standard 'created_at' exists.
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (data) {
                    const mapped = data.map(item => ({
                        id: item.id,
                        type: t.type,
                        icon: t.icon,
                        title: item.title || item.username || item.full_name || item.page_title || 'Untitled',
                        date: new Date(item.created_at),
                        original: item
                    }));
                    allActivities = [...allActivities, ...mapped];
                }
            }

            // Sort merged list by date desc
            allActivities.sort((a, b) => b.date - a.date);
            // Take top 10
            setRecentActivity(allActivities.slice(0, 10));

        } catch (err) {
            console.error("Error fetching activity:", err);
        }
    };

    const handleLogout = async () => { await supabase.auth.signOut(); };

    // Helper for "Time Algo"
    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " mins ago";
        return Math.floor(seconds) + " seconds ago";
    };

    // Blocking Loading State (Clean, no glitchy skeletons)
    if (loading) return (
        <div className="loading-screen">
            <LoadingState message="Loading Dashboard..." />
        </div>
    );

    if (!session && !connectionError) return null;

    if (connectionError) {
        return (
            <div className="loading-screen" style={{ flexDirection: 'column', gap: '1rem', fontFamily: 'var(--font-sans)' }}>
                <div style={{ textAlign: 'center', maxWidth: '320px' }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
                        I'm sorry, we're facing some hiccups.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                        <a
                            href="/resources"
                            style={{
                                fontSize: '0.875rem',
                                padding: '0.5rem 1.25rem',
                                textDecoration: 'none',
                                background: 'var(--text-primary)',
                                color: 'var(--bg-color)',
                                borderRadius: '6px',
                                fontWeight: 500
                            }}
                        >
                            View Resources Instead
                        </a>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-tertiary)',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            Try reloading
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-layout">
            {/* Sidebar Navigation */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1 className="brand-title">Admin Panel</h1>
                </div>
                <div className="user-info-block">
                    <div className="user-badge">
                        <span className="user-icon">👤</span>
                        <span className="user-email" title={session?.user?.email}>{session?.user?.email?.split('@')[0]}</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {SECTIONS.map(section => (
                        <button
                            key={section.id}
                            onClick={() => handleNav(section.id)}
                            className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{section.icon}</span>
                            <span className="nav-label">{section.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <a href="/resources/dashboard" className="btn-curator-link" style={{ display: 'block', textAlign: 'center', padding: '10px', marginBottom: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', textDecoration: 'none', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>
                        📚 Curator Dashboard
                    </a>
                    <button onClick={handleLogout} className="btn-logout-sidebar">
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            {/* Main Content Area */}
            <main className="main-content">
                <div className="content-body">
                    {activeSection === 'dashboard' && (
                        <>
                            <header className="content-header" style={{ marginBottom: '2rem' }}>
                                <h2 className="section-title">Overview</h2>
                            </header>

                            {/* Stats Grid - Priority View */}
                            <div className="stats-grid">
                                <DashboardCard title="Users" count={stats.users} icon="👥" onClick={() => setActiveSection('users')} loading={loading} />
                                <DashboardCard title="Photography" count={stats.photography} icon="📸" onClick={() => setActiveSection('photography')} loading={loading} />
                                <DashboardCard title="Films" count={stats.films} icon="🎬" onClick={() => setActiveSection('films')} loading={loading} />
                                <DashboardCard title="Blog" count={stats.blog} icon="✍️" onClick={() => setActiveSection('blog')} loading={loading} />
                                <DashboardCard title="Research" count={stats.research} icon="🔬" onClick={() => setActiveSection('research')} loading={loading} />
                                <DashboardCard title="Resources" count={stats.pendingResources > 0 ? `${stats.resources} (${stats.pendingResources} Pending)` : stats.resources} icon="📚" onClick={() => setActiveSection('hub_resources')} loading={loading} />
                            </div>

                            {/* Split View: Activity + Planning */}
                            <div className="dashboard-split-view">
                                {/* Left Column: Activity */}
                                <div className="activity-section">
                                    <div className="activity-board">
                                        <div className="activity-header-row">
                                            <h3 className="activity-header">Recent Activity</h3>
                                        </div>

                                        <div className="activity-list">
                                            {loading ? (
                                                <LoadingState message="Loading Activity..." />
                                            ) : (
                                                <>
                                                    {recentActivity.map((item, idx) => (
                                                        <div key={idx} className="activity-row">
                                                            <div className="activity-icon">{item.icon}</div>
                                                            <div className="activity-content">
                                                                <div className="activity-top">
                                                                    <span className="activity-type">{item.type}</span>
                                                                    <span className="activity-time">{timeAgo(item.date)}</span>
                                                                </div>
                                                                <div className="activity-title">{item.title}</div>
                                                            </div>
                                                            <div className="activity-status badge-live">Live</div>
                                                        </div>
                                                    ))}
                                                    {recentActivity.length === 0 && (
                                                        <p className="no-activity">No recent activity found.</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Planning Station */}
                                <div className="planning-section">
                                    <LiveClock />

                                    <a href="/" target="_blank" className="btn-view-live">
                                        View Live Website ↗
                                    </a>

                                    <div className="planning-calendar-wrapper">
                                        <h4 className="planning-header" style={{ marginBottom: '1rem', fontWeight: 600 }}>Content Planner</h4>
                                        <PlanningCalendar activity={recentActivity} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeSection === 'users' && (
                        <>
                            <header className="content-header" style={{ marginBottom: '2rem' }}>
                                <h2 className="section-title">Users</h2>
                            </header>
                            <UserList />
                        </>
                    )}

                    {activeSection === 'brands' && (
                        <div className="brands-section">
                            <header className="content-header" style={{ marginBottom: '2rem' }}>
                                <h2 className="section-title">Brands & Logos</h2>
                            </header>
                            <BrandManager />
                        </div>
                    )}

                    {activeSection !== 'dashboard' && activeSection !== 'users' && activeSection !== 'brands' && (
                        <ListView
                            table={activeSection}
                            title={SECTIONS.find(s => s.id === activeSection)?.label}
                            onCreate={activeSection === 'hub_resources' ? () => setShowResourceModal(true) : null}
                            key={activeSection + refreshTrigger}
                        />
                    )}
                </div>
            </main>

            <ResourceModal
                isOpen={showResourceModal}
                onClose={() => setShowResourceModal(false)}
                onSave={() => {
                    setRefreshTrigger(prev => prev + 1);
                    fetchStats();
                    fetchRecentActivity();
                }}
            />

            <style>{`
                :root {
                    --sidebar-width: 280px;
                    --header-height: 80px;
                }

                .loading-screen { 
                    height: 100vh; display: flex; align-items: center; justify-content: center; 
                    color: var(--text-secondary); font-family: var(--font-sans);
                }

                .admin-layout {
                    display: flex;
                    min-height: 100vh;
                    background-color: var(--bg-color);
                    color: var(--text-primary);
                    font-family: var(--font-sans);
                }

                /* Sidebar Styles */
                .sidebar {
                    width: var(--sidebar-width);
                    background: var(--bg-surface);
                    border-right: 1px solid var(--border-subtle);
                    display: flex;
                    flex-direction: column;
                    padding: 0; /* Padding handled by children for alignment */
                    position: fixed;
                    height: 100vh;
                    left: 0; top: 0;
                    box-sizing: border-box;
                    z-index: 50;
                }

                .sidebar-header { 
                    height: var(--header-height);
                    margin-top: 2rem; /* Match main content padding */
                    padding: 0 2rem;
                    display: flex; align-items: center;
                }
                
                .brand-title { 
                    font-size: 2rem; font-weight: 500; margin: 0; 
                    letter-spacing: -0.02em; color: var(--text-primary);
                    /* Exact match to section-title */
                }
                
                .user-info-block {
                    padding: 0 2rem; margin-bottom: 3.5rem;
                }

                .user-badge {
                    display: inline-flex; align-items: center; gap: 0.5rem;
                    background: var(--bg-surface-hover); border: 1px solid var(--border-subtle);
                    padding: 0.5rem 0.75rem; border-radius: 8px;
                    width: fit-content;
                }
                .user-icon { font-size: 0.9rem; }
                .user-email { 
                    font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); 
                    margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;
                }

                .sidebar-nav { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; padding: 0 2rem; }
                .nav-item {
                    display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem;
                    border: 1px solid transparent; background: transparent; color: var(--text-secondary);
                    border-radius: 8px; cursor: pointer; transition: all 0.2s ease;
                    text-align: left; font-size: 0.95rem; font-weight: 500;
                }
                .nav-item:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
                .nav-item.active { background: var(--bg-surface-hover); color: var(--text-primary); border-color: var(--border-subtle); font-weight: 600; }
                .nav-icon { font-size: 1.2rem; display: flex; align-items: center; justify-content: center; width: 24px; }

                .sidebar-footer { margin-top: auto; padding: 2rem; border-top: 1px solid var(--border-subtle); }
                .btn-logout-sidebar {
                    width: 100%; padding: 0.8rem; background: transparent; border: 1px solid var(--border-strong);
                    color: var(--text-primary); border-radius: 8px; cursor: pointer; font-weight: 600;
                    text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.75rem; transition: all 0.2s;
                }
                .btn-logout-sidebar:hover { background: var(--text-primary); color: var(--bg-color); }

                /* Main Content Styles */
                .main-content { flex: 1; margin-left: var(--sidebar-width); padding: 2rem 4rem; }
                .content-header {
                    height: var(--header-height); display: flex; align-items: center;
                    justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid var(--border-subtle);
                }
                .section-title { font-size: 2rem; font-weight: 500; margin: 0; letter-spacing: -0.02em; }
                .btn-create-primary {
                    background: var(--text-primary); color: var(--bg-color); border: none; padding: 0.8rem 1.5rem;
                    border-radius: 8px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; font-size: 0.9rem;
                }
                .btn-create-primary:hover { opacity: 0.9; }

                /* Stats Grid */
                .stats-grid {
                    display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem;
                    animation: fadeIn 0.3s ease; margin-bottom: 2rem;
                }
                .stat-card {
                    background: var(--bg-surface); border: 1px solid var(--border-subtle);
                    border-radius: 12px; padding: 1.25rem;
                    display: flex; flex-direction: column; align-items: flex-start; gap: 0.75rem;
                    cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden;
                    min-height: 100px; /* Prevent layout jump */
                    justify-content: space-between;
                }
                .stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.06); border-color: var(--border-strong); }
                .stat-icon-wrapper { 
                    width: 100%; display: flex; justify-content: space-between; align-items: center;
                }
                .stat-icon { font-size: 1.5rem; opacity: 0.8; }
                .stat-info { display: flex; flex-direction: column; gap: 4px; }
                .stat-title { font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin: 0; }
                .stat-count { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1; font-family: 'Inter', sans-serif; letter-spacing: -0.03em; }

                /* Split View Layout */
                .dashboard-split-view {
                    display: grid; grid-template-columns: 1.5fr 1fr; gap: 2rem;
                    animation: fadeIn 0.4s ease;
                }

                /* Activity Board - Constrained & Styled */
                .activity-section { display: flex; flex-direction: column; }
                .activity-board {
                    background: var(--bg-surface); border: 1px solid var(--border-subtle);
                    border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;
                    height: 100%; max-height: 600px; /* Constrain height */
                }
                .activity-header-row {
                    padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-subtle);
                    background: var(--bg-surface-hover);
                }
                .activity-header { margin: 0; font-size: 1.1rem; font-weight: 600; }
                
                .activity-list {
                    flex: 1; overflow-y: auto; display: flex; flex-direction: column;
                }
                .activity-row {
                    display: flex; gap: 1rem; padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--border-subtle);
                    transition: background 0.2s;
                    align-items: flex-start; /* Correct for multiline */
                }
                .activity-row:last-child { border-bottom: none; }
                .activity-row:hover { background: var(--bg-surface-hover); }

                .activity-icon {
                    width: 40px; height: 40px; background: var(--bg-surface-hover);
                    border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-size: 1.25rem; flex-shrink: 0; border: 1px solid var(--border-subtle);
                }
                .activity-content { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
                .activity-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
                .activity-type { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
                .activity-time { font-size: 0.8rem; color: var(--text-tertiary); }
                .activity-title { font-size: 1rem; font-weight: 500; color: var(--text-primary); line-height: 1.4; word-break: break-word; }
                
                .activity-status { flex-shrink: 0; margin-left: 0.5rem; margin-top: 4px; }
                .badge-live {
                    font-size: 0.7rem; font-weight: 700; color: #10B981;
                    background: rgba(16, 185, 129, 0.1); padding: 0.25rem 0.6rem;
                    border-radius: 100px; text-transform: uppercase; letter-spacing: 0.05em;
                }
                .no-activity { padding: 3rem; text-align: center; color: var(--text-secondary); }

                /* Planning Section */
                .planning-section { display: flex; flex-direction: column; gap: 1.5rem; height: 100%; }
                .live-clock-card {
                    background: var(--bg-surface); border: 1px solid var(--border-subtle);
                    border-radius: 16px; padding: 1.5rem; flex-shrink: 0;
                    display: flex; flex-direction: column; align-items: center; 
                    justify-content: center; text-align: center; 
                    background: linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-hover) 100%);
                }
                .planning-calendar-wrapper {
                    background: var(--bg-surface); border: 1px solid var(--border-subtle);
                    border-radius: 16px; padding: 1.5rem;
                    flex: 1; display: flex; flex-direction: column; /* Fill remaining space */
                }
                
                .clock-time { font-size: 3rem; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; letter-spacing: -0.04em; line-height: 1; margin-bottom: 0.25rem; }
                .clock-date { font-size: 0.95rem; color: var(--text-secondary); font-weight: 500; }

                 .btn-view-live {
                    display: flex; align-items: center; justify-content: center;
                    background: var(--text-primary); color: var(--bg-color); padding: 1rem;
                    border-radius: 12px; font-weight: 600; text-decoration: none;
                    transition: transform 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    flex-shrink: 0;
                }
                .btn-view-live:hover { transform: translateY(-2px); opacity: 0.95; }
                
                /* Large Calendar Styles */
                .planning-calendar { display: flex; flex-direction: column; height: 100%; flex: 1; }
                .cal-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
                .cal-month-title { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); }
                .cal-grid-lg { 
                    display: grid; grid-template-columns: repeat(7, 1fr); 
                    gap: 1px; background: var(--border-subtle); border: 1px solid var(--border-subtle); border-radius: 12px;
                    flex: 1; min-height: 0;
                }
                .cal-cell-head { background: var(--bg-surface); padding: 0.5rem; text-align: center; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
                .cal-cell-day { 
                    background: var(--bg-surface); padding: 0.5rem; position: relative;
                    font-size: 0.9rem; color: var(--text-secondary); 
                    display: flex; flex-direction: column; align-items: flex-start;
                    transition: background 0.2s;
                }
                .cal-cell-day:hover { background: var(--bg-surface-hover); }
                .cal-cell-day.current { background: var(--bg-surface-hover); color: var(--text-primary); font-weight: 700; box-shadow: inset 0 0 0 2px var(--text-primary); }
                .cal-cell-day.has-activity::before {
                    content: ''; position: absolute; top: 6px; right: 6px;
                    width: 6px; height: 6px; background: #10B981; border-radius: 50%;
                }
                .cal-cell-day.empty { background: var(--bg-surface-hover); opacity: 0.5; }

                /* List View Styles - Card Rows */
                .list-container { 
                    animation: fadeIn 0.3s ease; 
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .list-row-card {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    padding: 1.25rem 1.5rem;
                    transition: all 0.2s ease;
                }
                
                .list-row-card:hover {
                    transform: translateY(-1px);
                    border-color: var(--text-secondary);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                }

                .row-main-info {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    min-width: 0; /* ellipsis fix */
                }

                .row-title {
                    font-weight: 600;
                    font-size: 1rem;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .status-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 0.4rem 0.85rem;
                    border-radius: 100px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                }
                .status-pill.published { background: #dcfce7; color: #166534; }
                .status-pill.draft { background: var(--bg-surface-hover); color: var(--text-secondary); border: 1px solid var(--border-subtle); }
                
                .status-dot-inner { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

                .row-actions { 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    margin-left: 2rem;
                }
                
                .btn-action-box { 
                    background: transparent;
                    border: 1px solid var(--border-subtle); 
                    cursor: pointer; 
                    color: var(--text-primary); 
                    font-size: 0.85rem; 
                    font-weight: 500; 
                    text-decoration: none; 
                    padding: 0.5rem 1rem;
                    border-radius: 6px; 
                    transition: all 0.2s;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
                
                .btn-action-box:hover { 
                    background: var(--text-primary); 
                    color: var(--bg-color);
                    border-color: var(--text-primary);
                }
                
                .btn-action-box.delete:hover { 
                    background: #fee2e2; 
                    color: #ef4444; 
                    border-color: #ef4444;
                }
                
                .btn-action-box.toggle-live {
                    border-color: #10B981;
                    color: #10B981;
                }
                .btn-action-box.toggle-live:hover {
                    background: #10B981;
                    color: white;
                }
                
                .btn-action-box.toggle-draft {
                    border-color: var(--text-tertiary);
                    color: var(--text-secondary);
                }

                /* Skeletons */
                .skeleton { background: var(--bg-surface-hover); animation: pulse 1.5s infinite; border-radius: 4px; }
                .skeleton.text { height: 1em; width: 60%; }
                .skeleton.circle { width: 32px; height: 32px; border-radius: 50%; }
                .skeleton.rect { height: 100%; width: 100%; }
                @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 0.3; } 100% { opacity: 0.5; } }

                @media (max-width: 1400px) { .stats-grid { grid-template-columns: repeat(3, 1fr); } }
                @media (max-width: 1024px) {
                    :root { --sidebar-width: 240px; }
                    .main-content { padding: 2rem; }
                    .stats-grid { grid-template-columns: repeat(2, 1fr); }
                    .dashboard-split-view { grid-template-columns: 1fr; }
                    .activity-board { max-height: none; } /* Allow natural height on mobile */
                }
                @media (max-width: 768px) {
                    .admin-layout { flex-direction: column; }
                    .sidebar { position: relative; width: 100%; height: auto; border-right: none; padding: 1rem; }
                    .main-content { margin-left: 0; padding: 1rem; }
                    .sidebar-nav { flex-direction: row; flex-wrap: wrap; }
                    .nav-item { flex: 1; justify-content: center; }
                    .stats-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
}

function DashboardCard({ title, count, icon, onClick, loading }) {
    return (
        <div className="stat-card" onClick={onClick}>
            <div className="stat-icon-wrapper">
                <div className="stat-icon">{icon}</div>
            </div>
            <div className="stat-info">
                <h3 className="stat-title">{title}</h3>
                {loading ? (
                    <div className="skeleton" style={{ width: '60px', height: '1.75rem' }}></div>
                ) : (
                    <p className="stat-count">{count}</p>
                )}
            </div>
        </div>
    );
}

function LiveClock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="live-clock-card">
            <div className="clock-time">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            <div className="clock-date">{time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
    );
}

function PlanningCalendar({ activity }) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const generateMonth = (month, year) => {
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
        return days;
    };

    const days = generateMonth(currentMonth, currentYear);
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    const hasActivity = (date) => {
        if (!date) return false;
        return activity.some(a => a.date.toDateString() === date.toDateString());
    };

    return (
        <div className="planning-calendar">
            <div className="cal-header-row">
                <span className="cal-month-title">{monthName}</span>
                {/* Could add prev/next buttons here later */}
            </div>
            <div className="cal-grid-lg">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="cal-cell-head">{d}</div>)}
                {days.map((d, i) => (
                    <div
                        key={i}
                        className={`cal-cell-day ${!d ? 'empty' : ''} ${d && d.toDateString() === now.toDateString() ? 'current' : ''} ${d && hasActivity(d) ? 'has-activity' : ''}`}
                    >
                        {d ? d.getDate() : ''}
                    </div>
                ))}
            </div>
        </div>
    );
}







function SkeletonRow() {
    return (
        <div className="activity-row">
            <div className="skeleton circle" style={{ width: '40px', height: '40px' }}></div>
            <div className="activity-content" style={{ gap: '8px' }}>
                <div className="skeleton text" style={{ width: '100px', height: '14px' }}></div>
                <div className="skeleton text" style={{ width: '200px', height: '18px' }}></div>
            </div>
        </div>
    );

}

function LoadingState({ message = "Loading..." }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '400px', width: '100%', color: 'var(--text-secondary)', gap: '1rem'
        }}>
            <div className="spinner"></div>
            <div style={{ fontSize: '1rem', fontWeight: 500, letterSpacing: '0.02em' }}>{message}</div>
            <style>{`
                .spinner {
                    width: 40px; height: 40px;
                    border: 3px solid var(--bg-surface-hover);
                    border-top-color: var(--text-primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

function ResourceModal({ isOpen, onClose, onSave }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        url: '',
        description: '',
        audience: 'General Audience',
        thumbnail_url: '',
        selectedTags: []
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();

            const { data: newResource, error } = await supabase.from('hub_resources').insert([{
                title: formData.title,
                url: formData.url,
                description: formData.description,
                audience: formData.audience,
                thumbnail_url: formData.thumbnail_url || null,
                status: 'approved', // Admin-created resources are auto-approved
                submitted_by: user?.id, // Track who created it
            }]).select().single();

            if (error) throw error;

            // Add tags if any selected
            if (newResource && formData.selectedTags.length > 0) {
                const tagLinks = formData.selectedTags.map(tagId => ({
                    resource_id: newResource.id,
                    tag_id: tagId
                }));

                const { error: tagError } = await supabase
                    .from('hub_resource_tags')
                    .insert(tagLinks);

                if (tagError) console.error('Error adding tags:', tagError);
            }

            onSave();
            onClose();
            setFormData({ title: '', url: '', description: '', audience: 'General Audience', thumbnail_url: '', selectedTags: [] });
        } catch (err) {
            alert('Error adding resource: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{
                background: 'var(--bg-surface)', padding: '2rem', borderRadius: '16px',
                width: '100%', maxWidth: '500px', border: '1px solid var(--border-subtle)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
            }}>
                <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Add Resource</h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Title</label>
                        <input
                            required
                            style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>URL</label>
                        <input
                            required type="url"
                            style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                            value={formData.url}
                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Audience</label>
                        <select
                            style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                            value={formData.audience}
                            onChange={e => setFormData({ ...formData, audience: e.target.value })}
                        >
                            <option value="General Audience">General Audience</option>
                            <option value="Designer">Designer</option>
                            <option value="Artist">Artist</option>
                            <option value="Filmmaker">Filmmaker</option>
                            <option value="Creative Technologist">Creative Technologist</option>
                            <option value="Researcher">Researcher</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Description</label>
                        <textarea
                            style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-color)', color: 'var(--text-primary)', minHeight: '80px' }}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Thumbnail URL</label>
                        <input
                            type="url"
                            placeholder="https://example.com/image.jpg"
                            style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                            value={formData.thumbnail_url}
                            onChange={e => setFormData({ ...formData, thumbnail_url: e.target.value })}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Tags</label>
                        <TagInput
                            selectedTags={formData.selectedTags}
                            onChange={(newTags) => setFormData(prev => ({ ...prev, selectedTags: newTags }))}
                            maxTags={5}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" disabled={loading} style={{ flex: 1, padding: '0.8rem', background: 'var(--text-primary)', border: 'none', color: 'var(--bg-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                            {loading ? 'Adding...' : 'Add Resource'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
