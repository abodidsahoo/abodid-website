import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';

export default function PhotoBoardAuthModal({ isOpen, onClose, onAuthSuccess }) {
    const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [confirmationSent, setConfirmationSent] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setErrorMsg('');
            setLoading(false);
            setConfirmationSent(false);
        }
    }, [isOpen]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleGoogleAuth = async () => {
        if (!supabase) {
            setErrorMsg('Authentication service is not configured.');
            return;
        }
        setLoading(true);
        setErrorMsg('');
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: new URL('/lab/photo-board', window.location.origin).toString(),
                },
            });
            if (error) throw error;
        } catch (err) {
            console.error('Google Auth Error:', err);
            setErrorMsg(err.message || 'Google sign-in failed.');
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        if (!supabase) {
            setErrorMsg('Authentication service is not configured.');
            return;
        }
        if (!email || !password) {
            setErrorMsg('Please enter both email and password.');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            if (mode === 'signup') {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: new URL('/lab/photo-board', window.location.origin).toString(),
                        data: {
                            full_name: name || 'Photo Board Creator',
                        },
                    },
                });
                if (error) throw error;
                if (data.session?.user) {
                    window.dispatchEvent(
                        new CustomEvent('photoboard:toast', {
                            detail: { message: '✓ Account created successfully!', type: 'success' },
                        })
                    );
                    if (typeof onAuthSuccess === 'function') onAuthSuccess(data.session.user);
                    onClose();
                } else if (data.user) {
                    setConfirmationSent(true);
                }
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                if (data.user) {
                    window.dispatchEvent(
                        new CustomEvent('photoboard:toast', {
                            detail: { message: `✓ Welcome back!`, type: 'success' },
                        })
                    );
                    if (typeof onAuthSuccess === 'function') onAuthSuccess(data.user);
                    onClose();
                }
            }
        } catch (err) {
            console.error('Auth Error:', err);
            setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="pop-auth-backdrop" onClick={onClose}>
                <motion.div
                    className="pop-auth-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pb-auth-title"
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 20 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                >
                    {/* Header with Eyebrow Badge & Close Button */}
                    <div className="pop-auth-header">
                        <div className="pop-auth-badge">
                            <span className="pop-auth-dot"></span>
                            <span>CLOUD BOARDS</span>
                        </div>
                        <button
                            type="button"
                            className="pop-auth-close-btn"
                            onClick={onClose}
                            aria-label="Close dialog"
                        >
                            ✕
                        </button>
                    </div>

                    {confirmationSent ? (
                        <div className="pop-auth-confirmation" role="status">
                            <span className="pop-auth-confirmation-mark" aria-hidden="true">✓</span>
                            <h2 id="pb-auth-title" className="pop-auth-title">Check your inbox</h2>
                            <p className="pop-auth-subtitle">Confirm your email, then return here. Your Supabase session will reconnect automatically and load boards saved to your user ID.</p>
                            <button type="button" className="pop-auth-submit-btn" onClick={onClose}>Back to Photo Board</button>
                        </div>
                    ) : <>
                    {/* Mode Segmented Tab Switcher */}
                    <div className="pop-auth-tabs">
                        <button
                            type="button"
                            className={`pop-auth-tab ${mode === 'signin' ? 'active' : ''}`}
                            onClick={() => {
                                setMode('signin');
                                setErrorMsg('');
                            }}
                        >
                            Sign In
                        </button>
                        <button
                            type="button"
                            className={`pop-auth-tab ${mode === 'signup' ? 'active' : ''}`}
                            onClick={() => {
                                setMode('signup');
                                setErrorMsg('');
                            }}
                        >
                            Create Account
                        </button>
                    </div>

                    <h2 id="pb-auth-title" className="pop-auth-title">
                        {mode === 'signin' ? 'Sign in to your boards' : 'Start your permanent collection'}
                    </h2>
                    <p className="pop-auth-subtitle">
                        {mode === 'signin'
                            ? 'Access and sync your custom photo arrangements across devices.'
                            : 'Save up to 30 photos per board, custom backdrops, and layout states permanently.'}
                    </p>

                    {/* Primary Google 1-Click OAuth Button */}
                    <button
                        type="button"
                        className="pop-google-btn"
                        onClick={handleGoogleAuth}
                        disabled={loading}
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                            />
                        </svg>
                        <span>Continue with Google</span>
                    </button>

                    <div className="pop-auth-divider">
                        <span className="pop-divider-line"></span>
                        <span className="pop-divider-text">OR EMAIL</span>
                        <span className="pop-divider-line"></span>
                    </div>

                    {/* Email / Password Form */}
                    <form onSubmit={handleEmailAuth} className="pop-auth-form">
                        {mode === 'signup' && (
                            <div className="pop-form-group">
                                <label className="pop-label" htmlFor="pb-auth-name">Your Name</label>
                                <input
                                    id="pb-auth-name"
                                    type="text"
                                    className="pop-input"
                                    placeholder="Abodid Sahoo"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="pop-form-group">
                            <label className="pop-label" htmlFor="pb-auth-email">Email Address</label>
                            <input
                                id="pb-auth-email"
                                type="email"
                                className="pop-input"
                                placeholder="name@domain.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="pop-form-group">
                            <label className="pop-label" htmlFor="pb-auth-password">Password</label>
                            <input
                                id="pb-auth-password"
                                type="password"
                                className="pop-input"
                                placeholder="••••••••"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {errorMsg && (
                            <div className="pop-auth-error">
                                <span>⚠️ {errorMsg}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="pop-auth-submit-btn"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="pop-btn-spinner">Processing...</span>
                            ) : mode === 'signin' ? (
                                'Sign In & Save Board'
                            ) : (
                                'Create Account & Save'
                            )}
                        </button>
                    </form>

                    <div className="pop-auth-footer">
                        {mode === 'signin' ? (
                            <p>
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    className="pop-mode-link"
                                    onClick={() => {
                                        setMode('signup');
                                        setErrorMsg('');
                                    }}
                                >
                                    Create one
                                </button>
                            </p>
                        ) : (
                            <p>
                                Already have an account?{' '}
                                <button
                                    type="button"
                                    className="pop-mode-link"
                                    onClick={() => {
                                        setMode('signin');
                                        setErrorMsg('');
                                    }}
                                >
                                    Sign In
                                </button>
                            </p>
                        )}
                    </div>
                    </>}
                </motion.div>

                {/* Pop Editorial Self-Contained Styles */}
                <style>{`
                    .pop-auth-backdrop {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        width: 100vw;
                        height: 100vh;
                        background: rgba(14, 18, 38, 0.76);
                        backdrop-filter: blur(14px);
                        -webkit-backdrop-filter: blur(14px);
                        z-index: 999999;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                        box-sizing: border-box;
                    }

                    .pop-auth-modal {
                        position: relative;
                        width: 100%;
                        max-width: 440px;
                        background: #fff8e8;
                        border: 2.5px solid #15130f;
                        border-radius: 20px;
                        padding: 28px 30px;
                        box-shadow:
                            0 16px 0 #15130f,
                            0 28px 50px rgba(0, 0, 0, 0.45);
                        box-sizing: border-box;
                        color: #15130f;
                        font-family: var(--font-body, "Satoshi-Variable", "Poppins", sans-serif);
                    }

                    .pop-auth-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 16px;
                    }

                    .pop-auth-badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        background: #ffe44f;
                        border: 1.8px solid #15130f;
                        border-radius: 9999px;
                        padding: 4px 10px;
                        font-size: 10.5px;
                        font-weight: 900;
                        letter-spacing: 0.12em;
                        text-transform: uppercase;
                        color: #15130f;
                        box-shadow: 0 2px 0 #15130f;
                    }

                    .pop-auth-dot {
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background: #ff7eb5;
                        border: 1px solid #15130f;
                    }

                    .pop-auth-close-btn {
                        background: #ffffff;
                        border: 2px solid #15130f;
                        border-radius: 50%;
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 13px;
                        font-weight: 900;
                        color: #15130f;
                        cursor: pointer;
                        box-shadow: 0 3px 0 #15130f;
                        transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.1s ease;
                    }
                    .pop-auth-close-btn:hover {
                        background: #ff7eb5;
                        transform: translateY(-1px);
                        box-shadow: 0 4px 0 #15130f;
                    }
                    .pop-auth-close-btn:active {
                        transform: translateY(2px);
                        box-shadow: 0 1px 0 #15130f;
                    }

                    .pop-auth-tabs {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        background: #ffffff;
                        border: 2px solid #15130f;
                        border-radius: 12px;
                        padding: 3px;
                        gap: 4px;
                        margin-bottom: 18px;
                        box-shadow: 0 3px 0 #15130f;
                    }

                    .pop-auth-tab {
                        min-height: 44px;
                        padding: 8px 12px;
                        font-size: 12.5px;
                        font-weight: 800;
                        border: none;
                        background: transparent;
                        border-radius: 8px;
                        color: #5a574f;
                        cursor: pointer;
                        transition: all 0.15s ease;
                    }
                    .pop-auth-tab.active {
                        background: #ff7eb5;
                        color: #15130f;
                        border: 1.5px solid #15130f;
                        box-shadow: 0 2px 0 #15130f;
                    }

                    .pop-auth-title {
                        font-size: 20px;
                        font-weight: 900;
                        line-height: 1.25;
                        color: #15130f;
                        margin: 0 0 6px 0;
                        letter-spacing: -0.02em;
                    }

                    .pop-auth-subtitle {
                        font-size: 13px;
                        color: #5a574f;
                        line-height: 1.45;
                        margin: 0 0 18px 0;
                    }

                    .pop-google-btn {
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        background: #ffffff;
                        border: 2px solid #15130f;
                        min-height: 52px;
                        border-radius: 14px;
                        padding: 11px 18px;
                        font-size: 13.5px;
                        font-weight: 800;
                        color: #15130f;
                        cursor: pointer;
                        box-shadow: 0 4px 0 #15130f;
                        transition: transform 0.1s ease, box-shadow 0.1s ease, background 0.1s ease;
                    }
                    .pop-google-btn:hover:not(:disabled) {
                        background: #fffcf4;
                        transform: translateY(-2px);
                        box-shadow: 0 6px 0 #15130f;
                    }
                    .pop-google-btn:active:not(:disabled) {
                        transform: translateY(2px);
                        box-shadow: 0 2px 0 #15130f;
                    }
                    .pop-google-btn:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }

                    .pop-auth-divider {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        margin: 16px 0;
                    }
                    .pop-divider-line {
                        flex: 1;
                        height: 1.5px;
                        background: rgba(21, 19, 15, 0.2);
                    }
                    .pop-divider-text {
                        font-size: 10.5px;
                        font-weight: 900;
                        letter-spacing: 0.1em;
                        color: #7a766c;
                    }

                    .pop-auth-form {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }

                    .pop-form-group {
                        display: flex;
                        flex-direction: column;
                        gap: 5px;
                        text-align: left;
                    }

                    .pop-label {
                        font-size: 11.5px;
                        font-weight: 800;
                        letter-spacing: 0.04em;
                        text-transform: uppercase;
                        color: #15130f;
                    }

                    .pop-input {
                        width: 100%;
                        background: #ffffff;
                        border: 2px solid #15130f;
                        border-radius: 10px;
                        min-height: 52px;
                        padding: 10px 14px;
                        font-size: 13.5px;
                        font-weight: 600;
                        color: #15130f;
                        box-shadow: 0 2px 0 #15130f;
                        box-sizing: border-box;
                        transition: border-color 0.15s ease, box-shadow 0.15s ease;
                    }
                    .pop-input:focus {
                        outline: none;
                        border-color: #2444ca;
                        box-shadow: 0 4px 0 #2444ca;
                    }
                    .pop-input::placeholder {
                        color: #9d998d;
                    }

                    .pop-auth-error {
                        background: #ffe3e3;
                        border: 1.5px solid #d92d20;
                        border-radius: 8px;
                        padding: 8px 12px;
                        font-size: 12px;
                        font-weight: 700;
                        color: #b42318;
                        text-align: left;
                    }

                    .pop-auth-submit-btn {
                        width: 100%;
                        background: #ff7eb5;
                        border: 2px solid #15130f;
                        min-height: 52px;
                        border-radius: 14px;
                        padding: 12px 18px;
                        font-size: 13.5px;
                        font-weight: 900;
                        letter-spacing: 0.03em;
                        text-transform: uppercase;
                        color: #15130f;
                        cursor: pointer;
                        box-shadow: 0 4px 0 #15130f;
                        margin-top: 4px;
                        transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.1s ease;
                    }
                    .pop-auth-submit-btn:hover:not(:disabled) {
                        background: #ff60a0;
                        transform: translateY(-2px);
                        box-shadow: 0 6px 0 #15130f;
                    }
                    .pop-auth-submit-btn:active:not(:disabled) {
                        transform: translateY(2px);
                        box-shadow: 0 2px 0 #15130f;
                    }
                    .pop-auth-submit-btn:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }

                    .pop-auth-footer {
                        margin-top: 14px;
                        font-size: 12px;
                        color: #5a574f;
                        text-align: center;
                    }
                    .pop-auth-footer p {
                        margin: 0;
                    }

                    .pop-auth-confirmation {
                        padding: 20px 0 4px;
                    }

                    .pop-auth-confirmation-mark {
                        display: grid;
                        place-items: center;
                        width: 64px;
                        height: 64px;
                        margin-bottom: 22px;
                        border: 2px solid #15130f;
                        border-radius: 18px;
                        background: #caff48;
                        color: #15130f;
                        font-size: 28px;
                        font-weight: 900;
                    }

                    .pop-mode-link {
                        background: none;
                        border: none;
                        padding: 0;
                        color: #15130f;
                        font-weight: 800;
                        text-decoration: underline;
                        cursor: pointer;
                    }
                    .pop-mode-link:hover {
                        color: #ff7eb5;
                    }
                `}</style>
            </div>
        </AnimatePresence>
    );
}
