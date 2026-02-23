import React, { useState } from 'react';
import type { AdminUser } from '../../lib/resources/admin';

interface Props {
    initialUsers: AdminUser[];
    currentUserId: string;
}

export default function UserManagementTable({ initialUsers, currentUserId }: Props) {
    const [users, setUsers] = useState<AdminUser[]>(initialUsers);
    const [filter, setFilter] = useState<'all' | 'unconfirmed' | 'users' | 'curators'>('all');
    const [loading, setLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const filteredUsers = users.filter(user => {
        if (filter === 'unconfirmed') return !user.email_confirmed_at;
        if (filter === 'users') return user.profile?.role === 'user';
        if (filter === 'curators') return user.profile?.role === 'curator';
        return true;
    });

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleConfirm = async (userId: string, email: string) => {
        if (!confirm(`Confirm ${email}'s account?`)) return;

        setLoading(userId);
        try {
            const res = await fetch('/api/admin/confirm-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const data = await res.json();

            if (data.success) {
                setUsers(users.map(u =>
                    u.id === userId
                        ? { ...u, email_confirmed_at: new Date().toISOString() }
                        : u
                ));
                showMessage('User confirmed successfully!', 'success');
            } else {
                showMessage(data.error || 'Failed to confirm user', 'error');
            }
        } catch (error) {
            showMessage('Network error', 'error');
        } finally {
            setLoading(null);
        }
    };

    const handleRoleChange = async (userId: string, newRole: 'user' | 'curator', username: string) => {
        const action = newRole === 'curator' ? 'Upgrade' : 'Demote';
        if (!confirm(`${action} ${username} to ${newRole}?`)) return;

        setLoading(userId);
        try {
            const res = await fetch('/api/admin/update-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole })
            });

            const data = await res.json();

            if (data.success) {
                setUsers(users.map(u =>
                    u.id === userId && u.profile
                        ? { ...u, profile: { ...u.profile, role: newRole } }
                        : u
                ));
                showMessage(`User ${action.toLowerCase()}d to ${newRole}!`, 'success');
            } else {
                showMessage(data.error || 'Failed to update role', 'error');
            }
        } catch (error) {
            showMessage('Network error', 'error');
        } finally {
            setLoading(null);
        }
    };

    const handleDelete = async (userId: string, email: string) => {
        if (!confirm(`⚠️ DELETE ${email}?\n\nThis will permanently remove:\n- User account\n- Profile\n- All submissions, bookmarks, and upvotes\n\nThis action CANNOT be undone.`)) {
            return;
        }

        setLoading(userId);
        try {
            const res = await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const data = await res.json();

            if (data.success) {
                setUsers(users.filter(u => u.id !== userId));
                showMessage('User deleted successfully', 'success');
            } else {
                showMessage(data.error || 'Failed to delete user', 'error');
            }
        } catch (error) {
            showMessage('Network error', 'error');
        } finally {
            setLoading(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return '#dc2626';
            case 'curator': return '#2563eb';
            default: return '#64748b';
        }
    };

    return (
        <div className="user-management">
            {/* Header */}
            <div className="management-header">
                <h2>User Management</h2>
                <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="filter-select">
                    <option value="all">All Users ({users.length})</option>
                    <option value="unconfirmed">Unconfirmed ({users.filter(u => !u.email_confirmed_at).length})</option>
                    <option value="users">Users Only ({users.filter(u => u.profile?.role === 'user').length})</option>
                    <option value="curators">Curators ({users.filter(u => u.profile?.role === 'curator').length})</option>
                </select>
            </div>

            {/* Message */}
            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Table */}
            <div className="table-container">
                <table className="user-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="empty-state">
                                    No users found
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map(user => {
                                const isCurrentUser = user.id === currentUserId;
                                const isConfirmed = !!user.email_confirmed_at;
                                const role = user.profile?.role || 'user';

                                return (
                                    <tr key={user.id} className={loading === user.id ? 'loading' : ''}>
                                        <td className="user-cell">
                                            {user.profile?.avatar_url ? (
                                                <img src={user.profile.avatar_url} alt="" className="avatar" />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {(user.profile?.full_name || user.email)[0].toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <div className="user-name">
                                                    {user.profile?.full_name || 'No Name'}
                                                </div>
                                                {user.profile?.username && (
                                                    <div className="username">@{user.profile.username}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span
                                                className="role-badge"
                                                style={{ backgroundColor: getRoleBadgeColor(role) }}
                                            >
                                                {role}
                                            </span>
                                        </td>
                                        <td>
                                            {isConfirmed ? (
                                                <span className="status confirmed">✓ Confirmed</span>
                                            ) : (
                                                <span className="status unconfirmed">⚠ Pending</span>
                                            )}
                                        </td>
                                        <td className="date-cell">{formatDate(user.created_at)}</td>
                                        <td className="actions-cell">
                                            {isCurrentUser ? (
                                                <span className="you-label">You</span>
                                            ) : (
                                                <div className="action-buttons">
                                                    {!isConfirmed && (
                                                        <button
                                                            onClick={() => handleConfirm(user.id, user.email)}
                                                            className="action-btn confirm"
                                                            disabled={loading === user.id}
                                                        >
                                                            ✓ Confirm
                                                        </button>
                                                    )}
                                                    {role === 'user' && (
                                                        <button
                                                            onClick={() => handleRoleChange(user.id, 'curator', user.profile?.username || user.email)}
                                                            className="action-btn upgrade"
                                                            disabled={loading === user.id}
                                                        >
                                                            → Curator
                                                        </button>
                                                    )}
                                                    {role === 'curator' && (
                                                        <button
                                                            onClick={() => handleRoleChange(user.id, 'user', user.profile?.username || user.email)}
                                                            className="action-btn demote"
                                                            disabled={loading === user.id}
                                                        >
                                                            ← User
                                                        </button>
                                                    )}
                                                    {role !== 'admin' && (
                                                        <button
                                                            onClick={() => handleDelete(user.id, user.email)}
                                                            className="action-btn delete"
                                                            disabled={loading === user.id}
                                                        >
                                                            🗑 Delete
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <style>{`
                .user-management {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 24px;
                }

                .management-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .management-header h2 {
                    font-family: var(--font-display);
                    font-size: 1.75rem;
                    font-weight: 600;
                    margin: 0;
                }

                .filter-select {
                    padding: 8px 16px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    background: var(--bg-surface);
                    color: var(--text-primary);
                    font-size: 14px;
                    cursor: pointer;
                }

                .message {
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    font-weight: 500;
                    font-size: 14px;
                }

                .message.success {
                    background: #dcfce7;
                    color: #166534;
                }

                .message.error {
                    background: #fee2e2;
                    color: #b91c1c;
                }

                .table-container {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    overflow: hidden;
                }

                .user-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .user-table thead {
                    background: var(--bg-surface-hover);
                    border-bottom: 1px solid var(--border-subtle);
                }

                .user-table th {
                    padding: 12px 16px;
                    text-align: left;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .user-table td {
                    padding: 16px;
                    border-bottom: 1px solid var(--border-subtle);
                }

                .user-table tbody tr:last-child td {
                    border-bottom: none;
                }

                .user-table tbody tr.loading {
                    opacity: 0.5;
                    pointer-events: none;
                }

                .user-cell {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .avatar, .avatar-placeholder {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }

                .avatar {
                    object-fit: cover;
                }

                .avatar-placeholder {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-surface-hover);
                    color: var(--text-secondary);
                    font-weight: 600;
                }

                .user-name {
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .username {
                    font-size: 13px;
                    color: var(--text-secondary);
                }

                .role-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 12px;
                    color: white;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: capitalize;
                }

                .status {
                    font-size: 13px;
                    font-weight: 500;
                }

                .status.confirmed {
                    color: #16a34a;
                }

                .status.unconfirmed {
                    color: #ea580c;
                }

                .date-cell {
                    color: var(--text-secondary);
                    font-size: 13px;
                }

                .actions-cell {
                    width: 200px;
                }

                .action-buttons {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }

                .action-btn {
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: 1px solid;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: var(--bg-surface);
                }

                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .action-btn.confirm {
                    color: #16a34a;
                    border-color: #16a34a;
                }

                .action-btn.confirm:hover:not(:disabled) {
                    background: #16a34a;
                    color: white;
                }

                .action-btn.upgrade {
                    color: #2563eb;
                    border-color: #2563eb;
                }

                .action-btn.upgrade:hover:not(:disabled) {
                    background: #2563eb;
                    color: white;
                }

                .action-btn.demote {
                    color: #ea580c;
                    border-color: #ea580c;
                }

                .action-btn.demote:hover:not(:disabled) {
                    background: #ea580c;
                    color: white;
                }

                .action-btn.delete {
                    color: #dc2626;
                    border-color: #dc2626;
                }

                .action-btn.delete:hover:not(:disabled) {
                    background: #dc2626;
                    color: white;
                }

                .you-label {
                    display: inline-block;
                    padding: 6px 12px;
                    background: var(--bg-surface-hover);
                    color: var(--text-secondary);
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                }

                .empty-state {
                    text-align: center;
                    padding: 48px 24px;
                    color: var(--text-secondary);
                }
            `}</style>
        </div>
    );
}
