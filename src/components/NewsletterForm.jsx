import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const getJourneyTrackingSnapshot = () => {
    if (typeof window === "undefined") return null;

    try {
        if (
            window.__abodidJourney &&
            typeof window.__abodidJourney.getSnapshot === "function"
        ) {
            return window.__abodidJourney.getSnapshot();
        }
    } catch (_error) {
        // no-op
    }

    return {
        currentPath: window.location.pathname,
        initialReferrer: document.referrer || "",
    };
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

    const handleSubmit = async (e) => {
        e.preventDefault();
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

            // Success
            setSuccessMsg(result.message);
            setIsSubmitted(true);
            trackGaEvent("sign_up", {
                method: "newsletter",
                source_page:
                    tracking?.lastSourcePage ||
                    tracking?.currentPath ||
                    window.location.pathname,
                destination_page: window.location.pathname,
                form_variant: variant,
            });
            if (variant === "popup") {
                localStorage.setItem("newsletter_popup_dismissed", "true");
                // Auto close popup after success message
                if (onClose) {
                    setTimeout(() => {
                        onClose();
                    }, 5000);
                }
            }
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const isPage = variant === "page";

    return (
        <div className={`newsletter-container ${isPage ? "newsletter-page-container" : "newsletter-popup-container"}`}>
            {/* Close Button - Only for Popup */}
            {!isPage && onClose && (
                <button
                    onClick={onClose}
                    className="newsletter-close-btn"
                    aria-label="Close"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                    >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            )}

            {!isSubmitted ? (
                <div className="newsletter-main-content">
                    <div className="newsletter-header">
                        <h2 className="newsletter-headline">
                            Get a curated set of super useful resources to boost your creative cells every week.
                        </h2>
                    </div>
                    <div className="newsletter-body">
                        <p className="newsletter-desc">
                            Read with me. Every month, designers, artists, and technologists from
                            places like Cambridge, Harvard, Google, RCA, NID, and more share the
                            best ideas and resources they’ve discovered. We filter the noise and
                            send you only what’s genuinely worth your time.
                        </p>

                        <form className="newsletter-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <input
                                    type="text"
                                    placeholder="Name (Optional)"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="newsletter-input"
                                />
                            </div>
                            <div className="form-group">
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="newsletter-input"
                                />
                            </div>

                            {errorMsg && <p className="error-msg">{errorMsg}</p>}

                            <div className="form-actions">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="newsletter-submit-btn"
                                >
                                    {isLoading ? "Subscribing..." : "Subscribe"}
                                </button>
                                <a href="/resources" className="secondary-link">
                                    Preview the Curation Hub →
                                </a>
                            </div>
                            <p className="trust-microcopy">
                                No spam. Ever. Just high-signal resources, once a month.
                            </p>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="newsletter-success">
                    <div className="success-icon">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#a30021"
                            strokeWidth="1.5"
                            strokeLinecap="square"
                            strokeLinejoin="miter"
                        >
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <h3>Welcome to the circle.</h3>
                    <p>{successMsg || "You’re on the list. Keep an eye on your inbox."}</p>
                    {!isPage && onClose && (
                        <button onClick={onClose} className="newsletter-close-text-btn">
                            Close
                        </button>
                    )}
                    {isPage && (
                        <a href="/" className="newsletter-close-text-btn">
                            Return Home
                        </a>
                    )}
                </div>
            )}

            <style>{`
            .newsletter-container {
               overflow: hidden; 
               display: flex;
               flex-direction: column;
               border-radius: 16px; 
               background: #0a0a0a;
               border: 1px solid rgba(255, 255, 255, 0.1); 
               position: relative;
               box-shadow: 
                 0 20px 40px rgba(0,0,0,0.8),
                 0 0 0 1px rgba(255, 255, 255, 0.05), 
                 0 0 30px rgba(255, 255, 255, 0.08); 
               max-height: 90vh; /* New: Prevent exceeding viewport */
            }

            .newsletter-popup-container {
              width: 90%;
              max-width: 500px;
            }

             .newsletter-page-container {
                width: 100%;
                max-width: 600px;
                margin: 0 auto;
            }

            .newsletter-header {
                background: #a30021; /* Menu Red */
                padding: 3rem 2.5rem 2.5rem;
                margin-bottom: 0;
                position: relative;
            }

            .newsletter-body {
                padding: 2.5rem;
                overflow-y: auto; /* Allow scrolling within the body */
            }

            .newsletter-close-btn {
              position: absolute;
              top: 1.25rem;
              right: 1.25rem;
              background: rgba(0,0,0,0.2);
              border: none;
              color: rgba(255,255,255,0.8);
              cursor: pointer;
              transition: all 0.2s;
              padding: 6px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 10;
            }

            .newsletter-close-btn:hover {
              background: rgba(0,0,0,0.4);
              color: #fff;
            }

            .newsletter-headline {
              font-family: var(--feature-newsletter-title-font, var(--font-display));
              font-weight: var(--feature-newsletter-title-weight, 700);
              font-size: var(--feature-newsletter-title-size, 1.75rem);
              line-height: var(--feature-newsletter-title-line-height, 1.1);
              letter-spacing: var(--feature-newsletter-title-letter-spacing, -0.03em);
              color: var(--feature-newsletter-title-color, #fff);
              margin: 0;
            }

            .newsletter-desc {
              font-family: var(--feature-newsletter-body-font, var(--font-ui));
              font-size: var(--feature-newsletter-body-size, 0.95rem);
              font-weight: var(--feature-newsletter-body-weight, 400);
              line-height: var(--feature-newsletter-body-line-height, 1.6);
              letter-spacing: var(--feature-newsletter-body-letter-spacing, 0em);
              color: var(--feature-newsletter-body-color, #a0a0a0);
              margin-bottom: 2rem;
            }

            .newsletter-form {
              display: flex;
              flex-direction: column;
              gap: 1rem;
            }

            .form-group {
              width: 100%;
            }

            .newsletter-input {
              width: 100%;
              background: #111;
              border: 1px solid #333;
              color: var(--feature-newsletter-input-color, white);
              padding: 1.1rem;
              font-family: var(--feature-newsletter-input-font, var(--font-ui));
              font-size: var(--feature-newsletter-input-size, 0.95rem);
              font-weight: var(--feature-newsletter-input-weight, 400);
              line-height: var(--feature-newsletter-input-line-height, 1.3);
              letter-spacing: var(--feature-newsletter-input-letter-spacing, 0em);
              border-radius: 8px; /* Matching curvature */
              transition: border-color 0.2s, background 0.2s;
            }

            .newsletter-input:focus {
              outline: none;
              border-color: #666;
              background: #161616;
            }

            .newsletter-input::placeholder {
              color: #555;
            }

            .form-actions {
              display: flex;
              flex-direction: column;
              gap: 1rem;
              align-items: flex-start;
              margin-top: 0.5rem;
            }

            @media(min-width: 600px) {
                .form-actions {
                    flex-direction: row;
                    align-items: center;
                    justify-content: space-between;
                }
            }
            
            .newsletter-submit-btn {
              background: #a30021; /* Matching Red */
              color: var(--feature-newsletter-button-color, #fff);
              border: none;
              padding: 0.9rem 1.8rem;
              font-family: var(--feature-newsletter-button-font, var(--font-ui));
              font-size: var(--feature-newsletter-button-size, 0.85rem);
              text-transform: uppercase;
              letter-spacing: var(--feature-newsletter-button-letter-spacing, 0.05em);
              font-weight: var(--feature-newsletter-button-weight, 700);
              line-height: var(--feature-newsletter-button-line-height, 1.2);
              cursor: pointer;
              border-radius: 8px; 
              transition: all 0.2s;
            }

            .newsletter-submit-btn:hover {
              background: #c10027;
              transform: translateY(-1px);
            }

            .newsletter-submit-btn:active {
                transform: scale(0.98);
            }

            .newsletter-submit-btn:disabled {
                opacity: 0.7;
                cursor: not-allowed;
            }

            .secondary-link {
              font-family: var(--feature-newsletter-secondary-link-font, var(--font-ui));
              font-size: var(--feature-newsletter-secondary-link-size, 0.85rem);
              font-weight: var(--feature-newsletter-secondary-link-weight, 400);
              line-height: var(--feature-newsletter-secondary-link-line-height, 1.2);
              letter-spacing: var(--feature-newsletter-secondary-link-letter-spacing, 0em);
              color: var(--feature-newsletter-secondary-link-color, #666);
              transition: color 0.2s;
              white-space: nowrap;
              text-decoration: none;
            }

            .secondary-link:hover {
              color: #aaa;
            }

            .trust-microcopy {
              margin-top: 1rem;
              font-family: var(--font-ui);
              font-size: 0.75rem;
              color: #444;
            }

            .error-msg {
                color: #a30021;
                font-size: 0.85rem;
                margin-top: -0.5rem;
            }

            /* Success State */
            .newsletter-success {
                text-align: center;
                padding: 4rem 2.5rem;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1.5rem;
            }
            
            .success-icon {
                margin-bottom: 0.5rem;
            }

            .newsletter-success h3 {
                color: #fff;
                font-family: var(--font-display);
                font-size: 1.75rem;
                font-weight: 600;
                margin: 0;
            }

            .newsletter-success p {
                color: #888;
                font-family: var(--font-ui);
                margin-bottom: 1.5rem;
                font-size: 1.1rem;
            }

            .newsletter-close-text-btn {
                background: transparent;
                border: 1px solid #333;
                color: #fff;
                padding: 0.8rem 1.5rem;
                font-family: var(--font-ui);
                font-size: 0.85rem;
                text-transform: uppercase;
                cursor: pointer;
                transition: all 0.2s;
                text-decoration: none;
                display: inline-block;
                border-radius: 8px;
            }

            .newsletter-close-text-btn:hover {
                background: #fff;
                color: #000;
                border-color: #fff;
            }

            @media (max-width: 600px) {
              .newsletter-popup-container {
                max-width: 95vw;
                max-height: 85vh; /* prevent full viewport blockage */
                border-radius: 12px;
              }
              
              .newsletter-header {
                padding: 1.5rem 1.25rem 1.25rem; /* Reduced padding */
              }
              
              .newsletter-headline {
                font-size: 1.25rem; /* Smaller headline */
              }
              
              .newsletter-close-btn {
                top: 0.5rem;
                right: 0.5rem;
                padding: 8px; /* Easier touch target but less intrusive position */
              }
              
              .newsletter-body {
                padding: 1.25rem; /* Reduced body padding */
              }
              
              .newsletter-desc {
                font-size: 0.85rem;
                margin-bottom: 1.25rem;
                line-height: 1.5;
              }
              
              .newsletter-input {
                padding: 0.75rem; /* Compact inputs */
                font-size: 0.9rem;
              }
              
              .newsletter-submit-btn {
                padding: 0.75rem;
                font-size: 0.8rem;
                width: 100%;
            }
            
            .trust-microcopy {
                 font-size: 0.7rem;
                 margin-top: 0.75rem;
            }
          }
          `}</style>
        </div>
    );
};

export default NewsletterForm;
