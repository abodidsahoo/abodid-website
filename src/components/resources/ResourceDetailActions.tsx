import React, { useEffect, useState } from 'react';
import { getMyBookmarks, getMyUpvotes, toggleBookmark, toggleUpvote } from '../../lib/resources/db';
import { ensureSession } from '../../lib/anonymousAuth';

interface Props {
    resourceId: string;
    initialUpvotes: number;
}

export default function ResourceDetailActions({ resourceId, initialUpvotes }: Props) {
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isUpvoted, setIsUpvoted] = useState(false);
    const [upvotesCount, setUpvotesCount] = useState(initialUpvotes);
    const [busyAction, setBusyAction] = useState<'bookmark' | 'upvote' | null>(null);

    useEffect(() => {
        let active = true;

        const loadUserState = async () => {
            try {
                const [bookmarks, upvotes] = await Promise.all([getMyBookmarks(), getMyUpvotes()]);
                if (!active) {
                    return;
                }
                setIsBookmarked(bookmarks.includes(resourceId));
                setIsUpvoted(upvotes.includes(resourceId));
            } catch (error) {
                console.error('Failed to load resource actions state:', error);
            }
        };

        loadUserState();
        return () => {
            active = false;
        };
    }, [resourceId]);

    const ensureReadySession = async (): Promise<boolean> => {
        const session = await ensureSession();
        if (!session) {
            const currentPath = window.location.pathname;
            window.location.href = `/resources/login?redirect=${encodeURIComponent(currentPath)}`;
            return false;
        }
        return true;
    };

    const handleToggleBookmark = async () => {
        if (busyAction) {
            return;
        }

        const hasSession = await ensureReadySession();
        if (!hasSession) {
            return;
        }

        const next = !isBookmarked;
        setBusyAction('bookmark');
        setIsBookmarked(next);

        try {
            await toggleBookmark(resourceId);
        } catch (error: any) {
            setIsBookmarked(!next);
            if (error?.message?.includes('Must be logged in') || error?.message?.includes('JWT')) {
                const currentPath = window.location.pathname;
                window.location.href = `/resources/login?redirect=${encodeURIComponent(currentPath)}`;
            } else {
                console.error('Failed to toggle bookmark:', error);
            }
        } finally {
            setBusyAction(null);
        }
    };

    const handleToggleUpvote = async () => {
        if (busyAction) {
            return;
        }

        const hasSession = await ensureReadySession();
        if (!hasSession) {
            return;
        }

        const next = !isUpvoted;
        setBusyAction('upvote');
        setIsUpvoted(next);
        setUpvotesCount((prev) => Math.max(0, prev + (next ? 1 : -1)));

        try {
            await toggleUpvote(resourceId);
        } catch (error: any) {
            setIsUpvoted(!next);
            setUpvotesCount((prev) => Math.max(0, prev + (next ? -1 : 1)));
            if (error?.message?.includes('Must be logged in') || error?.message?.includes('JWT')) {
                const currentPath = window.location.pathname;
                window.location.href = `/resources/login?redirect=${encodeURIComponent(currentPath)}`;
            } else {
                console.error('Failed to toggle upvote:', error);
            }
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <div className="detail-actions" aria-label="Resource actions">
            <button
                type="button"
                className={`detail-action-btn btn-upvote ${isUpvoted ? 'active' : ''}`}
                onClick={handleToggleUpvote}
                disabled={busyAction !== null}
                aria-pressed={isUpvoted}
            >
                <span>{isUpvoted ? '▲ Upvoted' : '▲ Upvote'}</span>
                <span className="count">{upvotesCount}</span>
            </button>

            <button
                type="button"
                className={`detail-action-btn btn-save ${isBookmarked ? 'active' : ''}`}
                onClick={handleToggleBookmark}
                disabled={busyAction !== null}
                aria-pressed={isBookmarked}
            >
                <span>{isBookmarked ? '🔖 Saved' : '🔖 Save'}</span>
            </button>

            <style>{`
                .detail-actions {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 12px;
                    margin-top: 24px;
                    margin-bottom: 24px;
                }

                .detail-action-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 44px;
                    padding: 10px 20px;
                    border: 1px solid var(--pop-border, color-mix(in srgb, var(--color-text) 78%, transparent)) !important;
                    border-radius: 12px !important;
                    background: var(--color-background) !important;
                    color: var(--color-text) !important;
                    font: 700 0.9rem/1 var(--resources-font, system-ui) !important;
                    cursor: pointer;
                    box-shadow: none !important;
                    transition: background 180ms ease, transform 180ms ease;
                }

                .detail-action-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                }

                .detail-action-btn.btn-upvote:hover:not(:disabled) {
                    background: var(--color-button) !important;
                }

                .detail-action-btn.btn-save:hover:not(:disabled) {
                    background: var(--color-secondary) !important;
                }

                .detail-action-btn.btn-upvote.active {
                    background: var(--color-button) !important;
                    color: var(--color-button-text) !important;
                    border-color: var(--color-text) !important;
                    font-weight: 800 !important;
                }

                .detail-action-btn.btn-save.active {
                    background: var(--color-secondary) !important;
                    color: var(--color-text) !important;
                    border-color: var(--color-text) !important;
                    font-weight: 800 !important;
                }

                .detail-action-btn:disabled {
                    opacity: 0.65;
                    cursor: not-allowed;
                }

                .detail-action-btn .count {
                    color: var(--color-text);
                    background: var(--color-background);
                    border: 1px solid var(--pop-border, color-mix(in srgb, var(--color-text) 78%, transparent));
                    font: 750 0.78rem/1 var(--resources-mono, monospace);
                    padding: 3px 8px;
                    border-radius: 999px;
                    margin-left: 2px;
                }

                .detail-action-btn.active .count {
                    background: var(--color-background);
                    color: var(--color-text);
                }
            `}</style>
        </div>
    );
}
