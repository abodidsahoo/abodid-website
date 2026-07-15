import React, { useState } from "react";
import { markNewsletterPopupSubscribed } from "../lib/newsletter/popupState";

const getJourneyTrackingSnapshot = () => {
    if (typeof window === "undefined") return null;

    try {
        if (
            window.__abodidAnalytics &&
            typeof window.__abodidAnalytics.getSessionId === "function"
        ) {
            return { sessionId: window.__abodidAnalytics.getSessionId() };
        }
    } catch (_error) {
        // no-op
    }

    return { sessionId: "" };
};

const trackGaEvent = (eventName, params = {}) => {
    if (typeof window === "undefined") return;
    try {
        if (typeof window.gtag === "function") {
            window.gtag("event", eventName, params);
        }
    } catch (_error) {
        // no-op
    }
};

const NewsletterForm = ({ onClose, variant = "popup" }) => {
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        setErrorMsg("");

        try {
            const formData = new FormData();
            formData.append("email", email);
            if (name) formData.append("name", name);
            formData.append(
                "source",
                variant === "page" ? "newsletter-page" : "newsletter-popup",
            );

            if (
                window.__abodidAnalytics &&
                typeof window.__abodidAnalytics.prepareSubmission === "function"
            ) {
                await window.__abodidAnalytics.prepareSubmission();
            }
            const tracking = getJourneyTrackingSnapshot();
            if (tracking) {
                formData.append("tracking", JSON.stringify(tracking));
            }

            const response = await fetch("/api/subscribe", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Subscription failed");
            }

            setSuccessMsg(result.message);
            setIsSubmitted(true);
            trackGaEvent("sign_up", {
                method: "newsletter",
                source_page: window.location.pathname,
                destination_page: window.location.pathname,
                form_variant: variant,
            });

            if (variant === "popup") {
                markNewsletterPopupSubscribed();
                if (onClose) {
                    setTimeout(() => {
                        onClose({ persistDismissal: false });
                    }, 5000);
                }
            }
        } catch (error) {
            setErrorMsg(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const isPage = variant === "page";
    const titleId = `newsletter-${variant}-title`;
    const descriptionId = `newsletter-${variant}-description`;

    return (
        <div
            className={`newsletter-container ${isPage ? "newsletter-page-container" : "newsletter-popup-container"}`}
        >
            {!isPage && onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    className="newsletter-close-btn"
                    aria-label="Close"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                        aria-hidden="true"
                    >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            )}

            {!isSubmitted ? (
                <div className="newsletter-main-content">
                    <h2 className="newsletter-headline" id={titleId}>
                        Subscribe to my newsletter.
                    </h2>
                    <p className="newsletter-subhead">
                        Good stuff only. Promise.
                    </p>

                    <div className="newsletter-description" id={descriptionId}>
                        <p className="newsletter-frequency">
                            I send a newsletter every Friday.
                        </p>
                        <p>
                            Must-read articles. Must watch videos. Stunning photo-stories.
                            In-depth interviews. Mind boggling art exhibitions. You receive the
                            best things I come across in the entire week. Straight in your inbox.
                        </p>
                    </div>

                    <form className="newsletter-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label
                                className="newsletter-sr-only"
                                htmlFor={`newsletter-${variant}-name`}
                            >
                                Name (optional)
                            </label>
                            <input
                                id={`newsletter-${variant}-name`}
                                type="text"
                                name="name"
                                autoComplete="name"
                                placeholder="Name (optional)"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                className="newsletter-input"
                            />
                        </div>

                        <div className="form-group">
                            <label
                                className="newsletter-sr-only"
                                htmlFor={`newsletter-${variant}-email`}
                            >
                                Email address
                            </label>
                            <input
                                id={`newsletter-${variant}-email`}
                                type="email"
                                name="email"
                                autoComplete="email"
                                inputMode="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                                className="newsletter-input"
                            />
                        </div>

                        {errorMsg && (
                            <p className="error-msg" role="alert">
                                {errorMsg}
                            </p>
                        )}

                        <div className="form-actions">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="newsletter-submit-btn"
                                aria-busy={isLoading}
                            >
                                {isLoading ? "Sending…" : "Send it to my inbox"}
                            </button>
                        </div>
                        <p className="trust-microcopy">
                            No spam. Unsubscribe anytime.
                        </p>
                    </form>
                </div>
            ) : (
                <div className="newsletter-success" role="status">
                    <div className="success-icon" aria-hidden="true">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="42"
                            height="42"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="square"
                            strokeLinejoin="miter"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <h3>You’re in.</h3>
                    <p>{successMsg || "Keep an eye on your inbox this Friday."}</p>
                    {!isPage && onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="newsletter-close-text-btn"
                        >
                            Close
                        </button>
                    )}
                    {isPage && (
                        <a href="/" className="newsletter-close-text-btn">
                            Return home
                        </a>
                    )}
                </div>
            )}

            <style>{`
                .newsletter-container {
                    --newsletter-bg: #0d0d0d;
                    --newsletter-surface: #151515;
                    --newsletter-text: #f7f7f3;
                    --newsletter-copy: #c7c7c1;
                    --newsletter-muted: #9b9b94;
                    --newsletter-placeholder: #9b9b94;
                    --newsletter-border: #3f3f3f;
                    --newsletter-border-strong: #686862;
                    --newsletter-focus: #ff6a86;
                    --newsletter-button: #bb182e;
                    --newsletter-button-hover: #87001b;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    border: 1px solid var(--newsletter-border);
                    border-radius: 18px;
                    background: var(--newsletter-bg);
                    color: var(--newsletter-text);
                    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
                    font-family: "Satoshi-Variable", "Satoshi-Regular", var(--font-ui), sans-serif;
                    transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease;
                }

                .newsletter-popup-container {
                    width: min(520px, calc(100vw - 2rem));
                    max-height: calc(100dvh - 4rem);
                    overflow-y: auto;
                    overscroll-behavior: contain;
                }

                .newsletter-page-container {
                    width: 100%;
                    max-width: 520px;
                    margin: 0 auto;
                }

                html[data-theme="light"] .newsletter-container {
                    --newsletter-bg: #faf9f6;
                    --newsletter-surface: #ffffff;
                    --newsletter-text: #11110f;
                    --newsletter-copy: #3f3f3b;
                    --newsletter-muted: #66665f;
                    --newsletter-placeholder: #686862;
                    --newsletter-border: #cac9c2;
                    --newsletter-border-strong: #777770;
                    --newsletter-focus: #7d0018;
                    --newsletter-button: #bb182e;
                    --newsletter-button-hover: #7d0018;
                    box-shadow: 0 24px 64px rgba(20, 20, 18, 0.2);
                }

                .newsletter-close-btn {
                    position: absolute;
                    top: 0.9rem;
                    right: 0.9rem;
                    z-index: 10;
                    display: flex;
                    width: 36px;
                    height: 36px;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    border: 1px solid var(--newsletter-border);
                    border-radius: 50%;
                    background: var(--newsletter-surface);
                    color: var(--newsletter-copy);
                    cursor: pointer;
                    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
                }

                .newsletter-close-btn:hover {
                    border-color: var(--newsletter-border-strong);
                    color: var(--newsletter-text);
                }

                .newsletter-close-btn:focus-visible,
                .newsletter-submit-btn:focus-visible,
                .newsletter-close-text-btn:focus-visible {
                    outline: 3px solid var(--newsletter-focus);
                    outline-offset: 3px;
                }

                .newsletter-main-content {
                    padding: 2rem;
                }

                .newsletter-headline {
                    max-width: calc(100% - 2.5rem);
                    margin: 0;
                    color: var(--newsletter-text);
                    font-family: "Satoshi-Variable", "Satoshi-Regular", var(--font-h2), sans-serif;
                    font-size: clamp(2rem, 4.2vw, 2.2rem);
                    font-weight: 650;
                    letter-spacing: -0.045em;
                    line-height: 1.05;
                    text-wrap: balance;
                }

                .newsletter-subhead {
                    margin: 0.55rem 0 0;
                    color: var(--newsletter-copy);
                    font-family: inherit;
                    font-size: 1rem;
                    font-weight: 550;
                    letter-spacing: -0.01em;
                    line-height: 1.4;
                }

                .newsletter-description {
                    display: grid;
                    gap: 0.45rem;
                    margin: 1.35rem 0 1.5rem;
                    color: var(--newsletter-copy);
                }

                .newsletter-description p {
                    margin: 0;
                    font-family: inherit;
                    font-size: 0.9rem;
                    font-weight: 430;
                    letter-spacing: -0.005em;
                    line-height: 1.52;
                }

                .newsletter-description .newsletter-frequency {
                    color: var(--newsletter-text);
                    font-weight: 650;
                }

                .newsletter-form {
                    display: flex;
                    flex-direction: column;
                    gap: 0.65rem;
                }

                .form-group {
                    width: 100%;
                }

                .newsletter-sr-only {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                    white-space: nowrap;
                    border: 0;
                }

                .newsletter-input {
                    width: 100%;
                    min-height: 46px;
                    padding: 0.75rem 0.9rem;
                    border: 1px solid var(--newsletter-border);
                    border-radius: 9px;
                    background: var(--newsletter-surface);
                    color: var(--newsletter-text);
                    font-family: inherit;
                    font-size: 0.9rem;
                    font-weight: 450;
                    letter-spacing: -0.005em;
                    line-height: 1.2;
                    transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
                }

                .newsletter-input:focus {
                    outline: none;
                    border-color: var(--newsletter-focus);
                    box-shadow: 0 0 0 3px color-mix(in srgb, var(--newsletter-focus) 24%, transparent);
                }

                .newsletter-input::placeholder {
                    color: var(--newsletter-placeholder);
                    opacity: 1;
                }

                .form-actions {
                    width: 100%;
                    margin-top: 0.1rem;
                }

                .newsletter-submit-btn {
                    width: 100%;
                    min-height: 46px;
                    padding: 0.78rem 1rem;
                    border: 1px solid var(--newsletter-button);
                    border-radius: 9px;
                    background: var(--newsletter-button);
                    color: #ffffff;
                    font-family: inherit;
                    font-size: 0.88rem;
                    font-weight: 650;
                    letter-spacing: -0.005em;
                    line-height: 1.2;
                    cursor: pointer;
                    transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
                }

                .newsletter-submit-btn:hover {
                    border-color: var(--newsletter-button-hover);
                    background: var(--newsletter-button-hover);
                    transform: translateY(-1px);
                }

                .newsletter-submit-btn:active {
                    transform: scale(0.985);
                }

                .newsletter-submit-btn:disabled {
                    opacity: 0.68;
                    cursor: not-allowed;
                    transform: none;
                }

                .trust-microcopy {
                    margin: 0.15rem 0 0;
                    color: var(--newsletter-muted);
                    font-family: inherit;
                    font-size: 0.72rem;
                    line-height: 1.4;
                    text-align: center;
                }

                .error-msg {
                    margin: 0;
                    color: var(--newsletter-focus);
                    font-family: inherit;
                    font-size: 0.8rem;
                    line-height: 1.35;
                }

                .newsletter-success {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                    padding: 2.75rem 2rem;
                    text-align: center;
                }

                .success-icon {
                    color: var(--newsletter-button);
                }

                .newsletter-success h3 {
                    margin: 0;
                    color: var(--newsletter-text);
                    font-family: inherit;
                    font-size: 1.6rem;
                    font-weight: 650;
                }

                .newsletter-success p {
                    margin: 0 0 0.5rem;
                    color: var(--newsletter-copy);
                    font-family: inherit;
                    font-size: 0.95rem;
                    line-height: 1.5;
                }

                .newsletter-close-text-btn {
                    display: inline-block;
                    padding: 0.75rem 1.4rem;
                    border: 1px solid var(--newsletter-border);
                    border-radius: 9px;
                    background: var(--newsletter-surface);
                    color: var(--newsletter-text);
                    font-family: inherit;
                    font-size: 0.85rem;
                    text-decoration: none;
                    cursor: pointer;
                    transition: background-color 0.2s ease, border-color 0.2s ease;
                }

                .newsletter-close-text-btn:hover {
                    border-color: var(--newsletter-border-strong);
                }

                @media (max-width: 600px) {
                    .newsletter-popup-container {
                        width: min(90vw, 26rem);
                        max-height: 60dvh;
                        border-radius: 14px;
                    }

                    .newsletter-main-content {
                        padding: 1.15rem 1.1rem 1.2rem;
                    }

                    .newsletter-headline {
                        max-width: calc(100% - 2rem);
                        font-size: clamp(1.55rem, 7.5vw, 1.75rem);
                        letter-spacing: -0.04em;
                        line-height: 1.08;
                    }

                    .newsletter-subhead {
                        margin-top: 0.35rem;
                        font-size: 0.88rem;
                    }

                    .newsletter-description {
                        gap: 0.3rem;
                        margin: 0.85rem 0 1rem;
                    }

                    .newsletter-description p {
                        font-size: 0.79rem;
                        line-height: 1.42;
                    }

                    .newsletter-input {
                        min-height: 42px;
                        padding: 0.62rem 0.75rem;
                        font-size: 0.82rem;
                    }

                    .newsletter-submit-btn {
                        min-height: 42px;
                        padding: 0.65rem 0.85rem;
                        font-size: 0.8rem;
                    }

                    .newsletter-close-btn {
                        top: 0.7rem;
                        right: 0.7rem;
                        width: 32px;
                        height: 32px;
                    }

                    .newsletter-success {
                        padding: 2rem 1.25rem;
                    }

                    .trust-microcopy {
                        font-size: 0.67rem;
                    }
                }

                @media (max-height: 650px) and (max-width: 600px) {
                    .newsletter-main-content {
                        padding-block: 0.9rem 1rem;
                    }

                    .newsletter-description {
                        margin-block: 0.7rem 0.8rem;
                    }

                    .newsletter-form {
                        gap: 0.5rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default NewsletterForm;
