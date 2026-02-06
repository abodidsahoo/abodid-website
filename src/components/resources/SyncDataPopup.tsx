import React, { useState, useEffect } from 'react';

interface Props {
    show: boolean;
    bookmarkCount: number;
    onCreateAccount: () => void;
    onDismiss: () => void;
}

export default function SyncDataPopup({ show, bookmarkCount, onCreateAccount, onDismiss }: Props) {
    const [isVisible, setIsVisible] = useState(show);

    useEffect(() => {
        setIsVisible(show);
    }, [show]);

    if (!isVisible) return null;

    const handleCreateAccount = () => {
        setIsVisible(false);
        onCreateAccount();
    };

    const handleDismiss = () => {
        setIsVisible(false);
        onDismiss();
    };

    return (
        <>
            <div className="popup-backdrop" onClick={handleDismiss} />
            <div className="sync-popup">
                <div className="popup-content">
                    <div className="popup-icon">🔖</div>
                    <h2 className="popup-title">Save your bookmarks anywhere?</h2>
                    <p className="popup-body">
                        You&apos;ve saved <strong>{bookmarkCount}</strong> resource{bookmarkCount !== 1 ? 's' : ''}!
                        Create an account to sync your bookmarks across all your devices.
                    </p>
                    <p className="popup-note">
                        Skip for now and they&apos;ll stay on this device only.
                    </p>

                    <div className="popup-actions">
                        <button
                            className="btn-primary"
                            onClick={handleCreateAccount}
                        >
                            Create Account
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={handleDismiss}
                        >
                            Not Now
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .popup-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 9998;
                    animation: fadeIn 0.2s ease;
                }

                .sync-popup {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 9999;
                    animation: slideUp 0.3s cubic-bezier(0.2, 0, 0, 1);
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -40%);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%);
                    }
                }

                .popup-content {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 16px;
                    padding: 32px;
                    max-width: 440px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    text-align: center;
                }

                .popup-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                }

                .popup-title {
                    font-family: 'Poppins', sans-serif;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin: 0 0 12px;
                }

                .popup-body {
                    color: var(--text-primary);
                    line-height: 1.6;
                    margin: 0 0 8px;
                    font-size: 15px;
                }

                .popup-note {
                    color: var(--text-secondary);
                    font-size: 13px;
                    margin: 0 0 24px;
                }

                .popup-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .btn-primary,
                .btn-secondary {
                    width: 100%;
                    padding: 14px 24px;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 15px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }

                .btn-primary {
                    background: var(--text-primary);
                    color: var(--bg-color);
                }

                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
                }

                .btn-secondary {
                    background: transparent;
                    color: var(--text-secondary);
                    border: 1px solid var(--border-subtle);
                }

                .btn-secondary:hover {
                    background: var(--bg-surface-hover);
                    color: var(--text-primary);
                }

                @media (max-width: 480px) {
                    .popup-content {
                        margin: 0 16px;
                        padding: 24px;
                    }

                    .popup-title {
                        font-size: 1.25rem;
                    }
                }
            `}</style>
        </>
    );
}
