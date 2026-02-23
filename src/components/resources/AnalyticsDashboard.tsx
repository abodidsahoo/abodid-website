import React from 'react';
import type { SystemStats, TopResource, ActivityItem } from '../../lib/resources/analytics';

interface Props {
    stats: SystemStats;
    topBookmarked: TopResource[];
    topUpvoted: TopResource[];
    activity: ActivityItem[];
}

export default function AnalyticsDashboard({ stats, topBookmarked, topUpvoted, activity }: Props) {
    return (
        <div className="analytics-dashboard">
            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <h3>Total Users</h3>
                    <div className="kpi-value">{stats.totalUsers}</div>
                    <div className="kpi-sub">
                        <span className="text-success">{stats.totalUsers - stats.anonymousUsers} registered</span>
                        <span className="separator">•</span>
                        <span className="text-secondary">{stats.anonymousUsers} anonymous</span>
                    </div>
                </div>
                <div className="kpi-card">
                    <h3>Active (24h)</h3>
                    <div className="kpi-value">{stats.activeUsers24h}</div>
                    <div className="kpi-sub text-secondary">Unique logins</div>
                </div>
                <div className="kpi-card">
                    <h3>Total Resources</h3>
                    <div className="kpi-value">{stats.totalResources}</div>
                    <div className="kpi-sub text-secondary">Submit + Approved</div>
                </div>
                <div className="kpi-card">
                    <h3>Engagement</h3>
                    <div className="kpi-value">{stats.totalBookmarks + stats.totalUpvotes}</div>
                    <div className="kpi-sub">
                        <span>🔖 {stats.totalBookmarks}</span>
                        <span className="separator">•</span>
                        <span>👍 {stats.totalUpvotes}</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Top Content Column */}
                <div className="content-column">
                    <div className="section-card">
                        <h2>🏆 Most Bookmarked</h2>
                        <ul className="resource-list">
                            {topBookmarked.map(item => (
                                <li key={item.id} className="resource-item">
                                    <div className="resource-info">
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="resource-title">
                                            {item.title}
                                        </a>
                                    </div>
                                    <div className="resource-count">
                                        🔖 {item.count}
                                    </div>
                                </li>
                            ))}
                            {topBookmarked.length === 0 && <li className="empty-state">No bookmarks yet</li>}
                        </ul>
                    </div>

                    <div className="section-card">
                        <h2>🔥 Most Upvoted</h2>
                        <ul className="resource-list">
                            {topUpvoted.map(item => (
                                <li key={item.id} className="resource-item">
                                    <div className="resource-info">
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="resource-title">
                                            {item.title}
                                        </a>
                                    </div>
                                    <div className="resource-count">
                                        👍 {item.count}
                                    </div>
                                </li>
                            ))}
                            {topUpvoted.length === 0 && <li className="empty-state">No upvotes yet</li>}
                        </ul>
                    </div>
                </div>

                {/* Activity Feed Column */}
                <div className="activity-column">
                    <div className="section-card full-height">
                        <h2>Recent Activity</h2>
                        <div className="activity-feed">
                            {activity.map(item => (
                                <div key={item.id} className="activity-item">
                                    <div className="activity-icon">
                                        {item.action === 'signup' && '👤'}
                                        {item.action === 'bookmark' && '🔖'}
                                        {item.action === 'upvote' && '👍'}
                                        {item.action === 'submit' && '📤'}
                                    </div>
                                    <div className="activity-content">
                                        <div className="activity-header">
                                            <span className={`username ${item.is_anonymous ? 'anonymous' : ''}`}>
                                                {item.username}
                                            </span>
                                            <span className="action-text">
                                                {item.action === 'signup' && 'joined the community'}
                                                {item.action === 'bookmark' && 'bookmarked'}
                                                {item.action === 'upvote' && 'upvoted'}
                                                {item.action === 'submit' && 'submitted'}
                                            </span>
                                        </div>
                                        {item.resource_title && (
                                            <div className="activity-target">
                                                {item.resource_title}
                                            </div>
                                        )}
                                        <div className="activity-time">
                                            {new Date(item.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {activity.length === 0 && <div className="empty-state">No recent activity</div>}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .analytics-dashboard {
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                /* KPI Grid */
                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 20px;
                }

                .kpi-card {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                }

                .kpi-card h3 {
                    margin: 0;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .kpi-value {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin: 8px 0;
                    font-family: var(--font-display);
                }

                .kpi-sub {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    display: flex;
                    gap: 8px;
                }

                .text-success { color: #10b981; }
                .text-secondary { color: var(--text-secondary); }
                .separator { opacity: 0.3; }

                /* Dashboard Grid */
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 32px;
                }

                @media (max-width: 900px) {
                    .dashboard-grid {
                        grid-template-columns: 1fr;
                    }
                }

                .content-column, .activity-column {
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                .section-card {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 16px;
                    padding: 24px;
                }

                .section-card.full-height {
                    height: 100%;
                }

                .section-card h2 {
                    margin: 0 0 20px 0;
                    font-size: 1.25rem;
                    font-weight: 600;
                    font-family: var(--font-display);
                }

                /* Resource List */
                .resource-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .resource-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    background: var(--bg-surface-hover);
                    border-radius: 8px;
                    transition: transform 0.2s;
                }

                .resource-item:hover {
                    transform: translateX(4px);
                }

                .resource-info {
                    flex: 1;
                    min-width: 0;
                    padding-right: 16px;
                }

                .resource-title {
                    color: var(--text-primary);
                    text-decoration: none;
                    font-weight: 500;
                    display: block;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .resource-count {
                    font-weight: 600;
                    font-size: 0.9rem;
                    color: var(--primary-color);
                    background: rgba(var(--primary-rgb), 0.1);
                    padding: 4px 10px;
                    border-radius: 20px;
                }

                /* Activity Feed */
                .activity-feed {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                }

                .activity-item {
                    display: flex;
                    gap: 16px;
                    padding: 16px 0;
                    border-bottom: 1px solid var(--border-subtle);
                }

                .activity-item:last-child {
                    border-bottom: none;
                }

                .activity-icon {
                    width: 32px;
                    height: 32px;
                    background: var(--bg-surface-hover);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    flex-shrink: 0;
                }

                .activity-content {
                    flex: 1;
                    min-width: 0;
                }

                .activity-header {
                    font-size: 0.95rem;
                    margin-bottom: 4px;
                }

                .username {
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .username.anonymous {
                    color: var(--text-secondary);
                    font-style: italic;
                }

                .action-text {
                    color: var(--text-secondary);
                    margin-left: 6px;
                }

                .activity-target {
                    font-weight: 500;
                    color: var(--primary-color);
                    margin-bottom: 4px;
                }

                .activity-time {
                    font-size: 0.8rem;
                    color: var(--text-tertiary);
                }

                .empty-state {
                    text-align: center;
                    color: var(--text-secondary);
                    padding: 32px;
                    font-style: italic;
                }
            `}</style>
        </div>
    );
}
