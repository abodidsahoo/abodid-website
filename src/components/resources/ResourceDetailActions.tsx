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
            alert('Unable to create session. Please try again.');
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
        } catch (error) {
            setIsBookmarked(!next);
            console.error('Failed to toggle bookmark:', error);
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
        } catch (error) {
            setIsUpvoted(!next);
            setUpvotesCount((prev) => Math.max(0, prev + (next ? -1 : 1)));
            console.error('Failed to toggle upvote:', error);
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <div className="detail-actions" aria-label="Resource actions">
            <button
                type="button"
                className={`detail-action-btn ${isUpvoted ? 'active' : ''}`}
                onClick={handleToggleUpvote}
                disabled={busyAction !== null}
                aria-pressed={isUpvoted}
            >
                <span>Upvote</span>
                <span className="count">{upvotesCount}</span>
            </button>

            <button
                type="button"
                className={`detail-action-btn ${isBookmarked ? 'active' : ''}`}
                onClick={handleToggleBookmark}
                disabled={busyAction !== null}
                aria-pressed={isBookmarked}
            >
                <span>Save</span>
            </button>

            <style>{`
                .detail-actions {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 10px;
                    margin-top: 28px;
                }

                .detail-action-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid transparent;
                    background: var(--bg-surface-hover);
                    color: var(--text-primary);
                    border-radius: 12px;
                    padding: 11px 16px;
                    font-size: 0.92rem;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: inset 0 0 0 1px var(--border-subtle);
                    transition: all 0.2s ease, box-shadow 0.2s ease;
                }

                .detail-action-btn:hover:not(:disabled) {
                    background: var(--bg-surface);
                    box-shadow: inset 0 0 0 1px var(--text-primary);
                    transform: translateY(-1px);
                }

                .detail-action-btn.active {
                    background: var(--text-primary);
                    color: var(--bg-color);
                    box-shadow: none;
                }

                .detail-action-btn:disabled {
                    opacity: 0.65;
                    cursor: not-allowed;
                }

                .detail-action-btn .count {
                    color: var(--text-tertiary);
                    background: rgba(15, 23, 42, 0.08);
                    font-size: 0.85rem;
                    min-width: 1.6ch;
                    padding: 0 7px;
                    border-radius: 999px;
                    line-height: 1.4;
                }

                .detail-action-btn.active .count {
                    color: var(--bg-color);
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
}
