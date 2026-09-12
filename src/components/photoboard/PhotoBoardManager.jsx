import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import {
    fetchUserBoards,
    saveBoardToCloud,
    deleteBoardFromCloud,
} from '../../lib/photoboard/db';
import PhotoBoardAuthModal from './PhotoBoardAuthModal';

export default function PhotoBoardManager({
    currentItems = [],
    activeBackdrop = '#14225d',
    onLoadBoard,
    onNewBlankBoard,
}) {
    const [user, setUser] = useState(null);
    const [boards, setBoards] = useState([]);
    const [activeBoardId, setActiveBoardId] = useState(null);
    const [activeBoardTitle, setActiveBoardTitle] = useState('Untitled Board');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingBoardId, setEditingBoardId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const menuRef = useRef(null);

    // Sync Auth State
    useEffect(() => {
        if (!supabase) return;

        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user || null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user || null);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Load User Boards when user changes
    useEffect(() => {
        if (!user) {
            setBoards([]);
            return;
        }

        fetchUserBoards().then((data) => {
            setBoards(data);
            if (data.length && !activeBoardId) {
                // Keep default or first
            }
        });
    }, [user]);

    // Handle Click Outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    // Listen for Save Board events
    useEffect(() => {
        const handleSaveTrigger = async () => {
            if (!user) {
                setIsAuthOpen(true);
                return;
            }

            setIsSaving(true);
            try {
                const saved = await saveBoardToCloud({
                    id: activeBoardId || undefined,
                    title: activeBoardTitle,
                    backdrop_color: activeBackdrop,
                    items: currentItems,
                });

                if (saved) {
                    setActiveBoardId(saved.id);
                    // Refresh board list
                    const updatedList = await fetchUserBoards();
                    setBoards(updatedList);
                    window.dispatchEvent(
                        new CustomEvent('photoboard:toast', {
                            detail: {
                                message: `✓ Board "${saved.title}" saved to your cloud account!`,
                                type: 'success',
                            },
                        })
                    );
                }
            } catch (err) {
                console.error('Failed saving board to cloud:', err);
                window.dispatchEvent(
                    new CustomEvent('photoboard:toast', {
                        detail: { message: '⚠️ Failed to save board. Please try again.', type: 'error' },
                    })
                );
            } finally {
                setIsSaving(false);
            }
        };

        window.addEventListener('photoboard:save-state', handleSaveTrigger);
        return () => window.removeEventListener('photoboard:save-state', handleSaveTrigger);
    }, [user, activeBoardId, activeBoardTitle, activeBackdrop, currentItems]);

    const handleSelectBoard = (board) => {
        setActiveBoardId(board.id);
        setActiveBoardTitle(board.title);
        setIsMenuOpen(false);

        if (typeof onLoadBoard === 'function') {
            onLoadBoard(board);
        }

        window.dispatchEvent(
            new CustomEvent('photoboard:toast', {
                detail: { message: `✓ Loaded board "${board.title}"`, type: 'info' },
            })
        );
    };

    const handleCreateBlank = () => {
        const defaultName = `Board #${boards.length + 1}`;
        setActiveBoardId(null);
        setActiveBoardTitle(defaultName);
        setIsMenuOpen(false);

        if (typeof onNewBlankBoard === 'function') {
            onNewBlankBoard(defaultName);
        }

        window.dispatchEvent(
            new CustomEvent('photoboard:toast', {
                detail: { message: `✓ Started new blank board: "${defaultName}"`, type: 'info' },
            })
        );
    };

    const handleDeleteBoard = async (e, boardId, title) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete board "${title}"?`)) return;

        const success = await deleteBoardFromCloud(boardId);
        if (success) {
            setBoards((prev) => prev.filter((b) => b.id !== boardId));
            if (activeBoardId === boardId) {
                handleCreateBlank();
            }
            window.dispatchEvent(
                new CustomEvent('photoboard:toast', {
                    detail: { message: `✓ Deleted board "${title}"`, type: 'info' },
                })
            );
        }
    };

    const handleStartRename = (e, board) => {
        e.stopPropagation();
        setEditingBoardId(board.id);
        setEditTitle(board.title);
    };

    const handleSaveRename = async (e, boardId) => {
        e.stopPropagation();
        if (!editTitle.trim()) return;

        const board = boards.find((b) => b.id === boardId);
        if (!board) return;

        const updated = await saveBoardToCloud({
            ...board,
            title: editTitle.trim(),
        });

        if (updated) {
            setBoards((prev) =>
                prev.map((b) => (b.id === boardId ? { ...b, title: updated.title } : b))
            );
            if (activeBoardId === boardId) {
                setActiveBoardTitle(updated.title);
            }
        }
        setEditingBoardId(null);
    };

    const handleSignOut = async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        setUser(null);
        setBoards([]);
        setIsMenuOpen(false);
        window.dispatchEvent(
            new CustomEvent('photoboard:toast', {
                detail: { message: '✓ Signed out. Switched to Guest Mode.', type: 'info' },
            })
        );
    };

    return (
        <div className="photoboard-manager-container" ref={menuRef}>
            {user ? (
                // Logged In: Multi-Board Dropdown
                <div className="pop-boards-dropdown-wrapper">
                    <button
                        type="button"
                        className={`pop-toolbar-btn pop-boards-btn ${isMenuOpen ? 'is-active' : ''}`}
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-expanded={isMenuOpen}
                        title="Manage and switch your saved boards"
                    >
                        <span className="pop-board-folder-icon">📁</span>
                        <span className="pop-active-board-name">{activeBoardTitle}</span>
                        <motion.span
                            animate={{ rotate: isMenuOpen ? 180 : 0 }}
                            transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
                            className="pop-chevron-wrapper"
                        >
                            <svg viewBox="0 0 10 6" width="9" height="5.5" fill="currentColor" aria-hidden="true">
                                <path d="M0.5 0.5 L5 5 L9.5 0.5 Z" />
                            </svg>
                        </motion.span>
                    </button>

                    <AnimatePresence>
                        {isMenuOpen && (
                            <motion.div
                                className="pop-boards-menu"
                                initial={{ opacity: 0, y: -10, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.96 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                            >
                                <div className="pop-boards-menu-header">
                                    <div className="pop-theme-eyebrow">MY SAVED BOARDS</div>
                                    <button
                                        type="button"
                                        className="pop-new-board-btn"
                                        onClick={handleCreateBlank}
                                    >
                                        ➕ New Board
                                    </button>
                                </div>

                                <div className="pop-boards-list">
                                    {boards.length === 0 ? (
                                        <div className="pop-no-boards">
                                            No cloud boards saved yet. Click <strong>Save</strong> to store this board!
                                        </div>
                                    ) : (
                                        boards.map((b) => {
                                            const isSelected = activeBoardId === b.id;
                                            const isEditing = editingBoardId === b.id;

                                            return (
                                                <div
                                                    key={b.id}
                                                    className={`pop-board-item ${isSelected ? 'is-selected' : ''}`}
                                                    onClick={() => !isEditing && handleSelectBoard(b)}
                                                >
                                                    {isEditing ? (
                                                        <div
                                                            className="pop-board-rename-box"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <input
                                                                type="text"
                                                                value={editTitle}
                                                                onChange={(e) => setEditTitle(e.target.value)}
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleSaveRename(e, b.id);
                                                                    if (e.key === 'Escape') setEditingBoardId(null);
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleSaveRename(e, b.id)}
                                                            >
                                                                ✓
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="pop-board-item-info">
                                                                <span className="pop-board-dot" style={{ backgroundColor: b.backdrop_color || '#14225d' }} />
                                                                <span className="pop-board-title">{b.title}</span>
                                                                <span className="pop-board-count">
                                                                    ({b.items?.length || 0} photos)
                                                                </span>
                                                            </div>

                                                            <div className="pop-board-item-actions">
                                                                <button
                                                                    type="button"
                                                                    className="pop-board-action-btn"
                                                                    onClick={(e) => handleStartRename(e, b)}
                                                                    title="Rename board"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="pop-board-action-btn pop-board-del-btn"
                                                                    onClick={(e) => handleDeleteBoard(e, b.id, b.title)}
                                                                    title="Delete board"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="pop-boards-menu-footer">
                                    <span className="pop-user-email">{user.email}</span>
                                    <button
                                        type="button"
                                        className="pop-signout-btn"
                                        onClick={handleSignOut}
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                // Guest Mode: Sign In Button
                <button
                    type="button"
                    className="pop-toolbar-btn pop-signin-btn"
                    onClick={() => setIsAuthOpen(true)}
                    title="Sign in with Google or Email to save boards permanently"
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Sign In</span>
                </button>
            )}

            {/* Auth Modal */}
            <PhotoBoardAuthModal
                isOpen={isAuthOpen}
                onClose={() => setIsAuthOpen(false)}
                onAuthSuccess={(u) => {
                    setUser(u);
                    setIsAuthOpen(false);
                }}
            />

            <style>{`
                .photoboard-manager-container {
                    display: inline-flex;
                    align-items: center;
                }

                .pop-boards-dropdown-wrapper {
                    position: relative;
                }

                .pop-toolbar-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    padding: 0.45rem 0.95rem;
                    border: 1.5px solid #15130f;
                    border-radius: 999px;
                    font-family: var(--font-mono, "Satoshi-Variable", monospace);
                    font-size: 0.82rem;
                    font-weight: 800;
                    letter-spacing: 0.02em;
                    cursor: pointer;
                    box-shadow: 0 2.5px 0 rgba(21, 19, 15, 0.25), 0 4px 10px rgba(0, 0, 0, 0.05);
                    transition: transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1),
                                box-shadow 140ms cubic-bezier(0.34, 1.56, 0.64, 1),
                                background-color 140ms ease;
                    white-space: nowrap;
                }

                .pop-toolbar-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 0 rgba(21, 19, 15, 0.3), 0 8px 16px rgba(0, 0, 0, 0.08);
                }

                .pop-toolbar-btn:active {
                    transform: translateY(1px);
                    box-shadow: 0 1px 0 rgba(21, 19, 15, 0.25);
                }

                .pop-boards-btn {
                    background: #ffe44f !important;
                    color: #15130f !important;
                }
                .pop-boards-btn:hover, .pop-boards-btn.is-active {
                    background: #ffd914 !important;
                }

                .pop-signin-btn {
                    background: #ffe44f !important;
                    color: #15130f !important;
                }
                .pop-signin-btn:hover {
                    background: #ffd914 !important;
                }

                .pop-board-folder-icon {
                    font-size: 0.95rem;
                    line-height: 1;
                }

                .pop-active-board-name {
                    max-width: 9rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .pop-boards-menu {
                    position: absolute;
                    bottom: calc(100% + 0.6rem);
                    left: 0;
                    width: min(22rem, calc(100vw - 2rem));
                    background: #fff8e8;
                    color: #15130f;
                    border: 1.5px solid #15130f;
                    border-radius: 18px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18), 0 3px 0 rgba(21, 19, 15, 0.3);
                    padding: 1.1rem 1.25rem;
                    box-sizing: border-box;
                    z-index: 10050;
                    transform-origin: bottom left;
                    font-family: var(--font-mono, "Satoshi-Variable", monospace);
                }

                .pop-boards-menu-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 0.85rem;
                    padding-bottom: 0.55rem;
                    border-bottom: 1.5px solid rgba(21, 19, 15, 0.18);
                }

                .pop-new-board-btn {
                    background: #caff48;
                    border: 1px solid #15130f;
                    border-radius: 6px;
                    padding: 0.3rem 0.6rem;
                    font-family: var(--font-mono, "Satoshi-Variable", monospace);
                    font-size: 0.7rem;
                    font-weight: 800;
                    color: #15130f;
                    cursor: pointer;
                    transition: transform 120ms ease, box-shadow 120ms ease;
                }

                .pop-new-board-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 0 #15130f;
                }

                .pop-boards-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    max-height: 16rem;
                    overflow-y: auto;
                    margin-bottom: 0.85rem;
                }

                .pop-no-boards {
                    font-size: 0.8rem;
                    line-height: 1.4;
                    color: rgba(21, 19, 15, 0.7);
                    text-align: center;
                    padding: 1.5rem 0.5rem;
                }

                .pop-board-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.55rem 0.75rem;
                    background: #ffffff;
                    border: 1.2px solid rgba(21, 19, 15, 0.3);
                    border-radius: 10px;
                    cursor: pointer;
                    transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
                }

                .pop-board-item:hover {
                    border-color: #15130f;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 0 #15130f;
                }

                .pop-board-item.is-selected {
                    background: #ffe44f;
                    border-color: #15130f;
                    border-width: 1.5px;
                    box-shadow: inset 0 -2px 0 #15130f;
                }

                .pop-board-item-info {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    min-width: 0;
                    flex: 1;
                }

                .pop-board-dot {
                    width: 0.75rem;
                    height: 0.75rem;
                    border-radius: 999px;
                    border: 1px solid #15130f;
                    flex-shrink: 0;
                }

                .pop-board-title {
                    font-size: 0.78rem;
                    font-weight: 750;
                    color: #15130f;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .pop-board-count {
                    font-size: 0.68rem;
                    color: rgba(21, 19, 15, 0.6);
                    font-weight: 600;
                    flex-shrink: 0;
                }

                .pop-board-item-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                }

                .pop-board-action-btn {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 0.8rem;
                    padding: 0.15rem 0.25rem;
                    border-radius: 4px;
                    line-height: 1;
                    transition: transform 100ms ease;
                }

                .pop-board-action-btn:hover {
                    transform: scale(1.2);
                }

                .pop-board-rename-box {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    width: 100%;
                }

                .pop-board-rename-box input {
                    flex: 1;
                    padding: 0.3rem 0.5rem;
                    border: 1.5px solid #15130f;
                    border-radius: 6px;
                    font-family: inherit;
                    font-size: 0.75rem;
                    font-weight: 700;
                }

                .pop-board-rename-box button {
                    background: #caff48;
                    border: 1px solid #15130f;
                    border-radius: 6px;
                    padding: 0.3rem 0.5rem;
                    cursor: pointer;
                    font-weight: 800;
                }

                .pop-boards-menu-footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-top: 0.65rem;
                    border-top: 1.5px solid rgba(21, 19, 15, 0.18);
                    font-size: 0.72rem;
                }

                .pop-user-email {
                    color: rgba(21, 19, 15, 0.7);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 12rem;
                }

                .pop-signout-btn {
                    background: transparent;
                    border: none;
                    color: #a30021;
                    font-family: inherit;
                    font-size: 0.72rem;
                    font-weight: 750;
                    cursor: pointer;
                    text-decoration: underline;
                    padding: 0;
                }

                .pop-chevron-wrapper {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 10px;
                    height: 10px;
                    flex-shrink: 0;
                    transform-origin: center center;
                    line-height: 1;
                    margin-left: 0.1rem;
                }
            `}</style>
        </div>
    );
}
