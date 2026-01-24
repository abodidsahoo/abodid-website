import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function UserList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Fetch profiles. Assuming 'email' is now populated.
            const { data, error } = await supabase
                .from('profiles')
                .select('*');
            //.order('updated_at', { ascending: false }); // 'created_at' might be missing, let's just default sort or sort by username if needed.
            // If we want consistent order, maybe ID?

            if (data) {
                // Client side sort if needed or just leave as is
                data.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
            }

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (userId, action, value) => {
        try {
            const updates = {};
            if (action === 'role') updates.role = value;
            if (action === 'approve') updates.is_approved = value;

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);

            if (error) throw error;

            // Optimistic update
            setUsers(users.map(u => u.id === userId ? { ...u, ...updates } : u));
            // Optional: You could show a small toast here
        } catch (err) {
            alert("Action failed: " + err.message);
            // Revert optimistic update if needed, but for now strict alert is enough
            fetchUsers();
        }
    };

    if (loading) return <div className="loading">Loading users...</div>;
    if (error) return <div className="error">Error: {error}</div>;

    return (
        <div className="user-list-container">
            <h3 className="section-header">Registered Users ({users.length})</h3>

            <div className="list-container">
                {users.map(user => (
                    <div key={user.id} className={`list-row-card ${!user.is_approved ? 'dimmed' : ''}`}>
                        <div className="row-main-info">
                            <div className="user-cell">
                                <div className="avatar-placeholder">
                                    {(user.full_name || user.username || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="user-info">
                                    <div className="user-name">{user.full_name || user.username || 'Unknown'}</div>
                                    {user.email && <div className="user-email">{user.email}</div>}
                                </div>
                            </div>

                            <span className={`status-pill role-${user.role}`}>
                                {user.role}
                            </span>

                            <span className={`status-pill status-${user.is_approved ? 'active' : 'blocked'}`}>
                                <span className="status-dot-inner"></span>
                                {user.is_approved ? 'Approved' : 'Blocked'}
                            </span>
                        </div>

                        <div className="row-actions">
                            {user.role !== 'admin' && (
                                <>
                                    <select
                                        className="action-select"
                                        value={user.role}
                                        onChange={(e) => handleAction(user.id, 'role', e.target.value)}
                                    >
                                        <option value="user">User</option>
                                        <option value="curator">Curator</option>
                                    </select>

                                    <button
                                        className={`btn-action-box ${user.is_approved ? 'delete' : 'approve'}`}
                                        onClick={() => handleAction(user.id, 'approve', !user.is_approved)}
                                    >
                                        {user.is_approved ? 'Block' : 'Unblock'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                .user-list-container {
                    animation: fadeIn 0.3s ease;
                }
                .section-header {
                    margin-bottom: 2rem;
                    font-size: 1.5rem;
                    font-weight: 500;
                }

                .list-container { 
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
                    gap: 2rem;
                    min-width: 0;
                }

                .user-cell {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    min-width: 250px;
                }
                .avatar-placeholder {
                    width: 40px; height: 40px;
                    border-radius: 50%;
                    background: var(--bg-surface-hover);
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 600;
                    color: var(--text-secondary);
                    font-size: 1rem;
                }
                .user-info { display: flex; flex-direction: column; }
                .user-name { font-weight: 600; font-size: 0.95rem; color: var(--text-primary); }
                .user-email { font-size: 0.8rem; color: var(--text-tertiary); }

                .status-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 0.3rem 0.8rem;
                    border-radius: 100px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    text-transform: uppercase;
                }
                .status-dot-inner { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

                .role-admin { background: #fee2e2; color: #b91c1c; }
                .role-curator { background: #dbeafe; color: #1e40af; }
                .role-user { background: var(--bg-surface-hover); color: var(--text-secondary); border: 1px solid var(--border-subtle); }
                
                .status-active { background: #dcfce7; color: #15803d; }
                .status-blocked { background: #f3f4f6; color: #9ca3af; text-decoration: line-through; }
                
                .dimmed { opacity: 0.6; }
                
                .row-actions { 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    margin-left: 2rem;
                }
                
                .action-select {
                    padding: 0.4rem 0.8rem;
                    border-radius: 6px;
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-color);
                    color: var(--text-primary);
                    font-size: 0.85rem;
                }

                .btn-action-box { 
                    background: transparent;
                    border: 1px solid var(--border-subtle); 
                    cursor: pointer; 
                    color: var(--text-primary); 
                    font-size: 0.85rem; 
                    font-weight: 500; 
                    padding: 0.4rem 1rem;
                    border-radius: 6px; 
                    transition: all 0.2s;
                }
                .btn-action-box.delete:hover { background: #fee2e2; color: #ef4444; border-color: #ef4444; }
                .btn-action-box.approve:hover { background: #dcfce7; color: #15803d; border-color: #15803d; }

                @media (max-width: 768px) {
                    .list-row-card { flex-direction: column; align-items: flex-start; gap: 1rem; }
                    .row-main-info { flex-direction: column; align-items: flex-start; gap: 1rem; width: 100%; }
                    .row-actions { width: 100%; justify-content: flex-end; margin-left: 0; padding-top: 1rem; border-top: 1px solid var(--border-subtle); }
                }
            `}</style>
        </div>
    );
}
