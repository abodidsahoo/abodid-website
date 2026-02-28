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
                    <h2 className="newsletter-headline">Get the Weekly Creative Drop.</h2>
                    <p className="newsletter-subhead">
                        10 handpicked resources to 10× your output—tools, references, workflows,
                        and ideas. Curated by designers, artists, and technologists from
                        Cambridge, Harvard, Google, RCA, NID + more.
                    </p>

                    <div className="newsletter-offer">
                        <p className="newsletter-label">What you’ll get:</p>
                        <ul className="newsletter-list">
                            <li>10 high-signal links (no fluff)</li>
                            <li>1 “steal this workflow” productivity upgrade</li>
                            <li>Occasional interviews with reputed practicing artists & designers</li>
                        </ul>
                    </div>

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
                                {isLoading ? "Sending..." : "Send me the Weekly Drop"}
                            </button>
                            <a href="/resources" className="secondary-link">
                                Preview the Curation Hub →
                            </a>
                        </div>
                        <p className="trust-microcopy">No spam. Unsubscribe anytime.</p>
                    </form>
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
               display: flex;
               flex-direction: column;
               border-radius: 16px;
               background: #0a0a0a;
               border: 1px solid rgba(255, 255, 255, 0.12);
               position: relative;
               box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
            }

            .newsletter-popup-container {
              width: 92%;
              max-width: 560px;
            }

             .newsletter-page-container {
                width: 100%;
                max-width: 600px;
                margin: 0 auto;
            }

            .newsletter-close-btn {
              position: absolute;
              top: 1rem;
              right: 1rem;
              background: rgba(255, 255, 255, 0.06);
              border: none;
              color: rgba(255, 255, 255, 0.8);
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
              background: rgba(255, 255, 255, 0.12);
              color: #fff;
            }

            .newsletter-main-content {
              padding: 2.5rem 2.5rem 2.75rem;
              display: flex;
              flex-direction: column;
              gap: 1.5rem;
            }

            .newsletter-headline {
              font-family: var(--font-h2);
              font-weight: 600;
              font-size: 1.85rem;
              line-height: 1.15;
              letter-spacing: -0.02em;
              color: #f5f5f5;
              margin: 0;
            }

            .newsletter-subhead {
              font-family: var(--font-ui);
              font-size: 0.98rem;
              font-weight: 400;
              line-height: 1.6;
              letter-spacing: 0em;
              color: #b6b6b6;
              margin: 0;
            }

            .newsletter-offer {
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
            }

            .newsletter-label {
              font-family: var(--font-ui);
              font-size: 0.8rem;
              font-weight: 600;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #7f7f7f;
              margin: 0;
            }

            .newsletter-list {
              list-style: none;
              padding: 0;
              margin: 0;
              display: grid;
              gap: 0.5rem;
              color: #d0d0d0;
              font-family: var(--font-ui);
              font-size: 0.95rem;
              line-height: 1.45;
            }

            .newsletter-list li {
              position: relative;
              padding-left: 1rem;
            }

            .newsletter-list li::before {
              content: "";
              position: absolute;
              left: 0;
              top: 0.6rem;
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: #a30021;
            }

            .newsletter-form {
              display: flex;
              flex-direction: column;
              gap: 0.85rem;
            }

            .form-group {
              width: 100%;
            }

            .newsletter-input {
              width: 100%;
              background: #0f0f0f;
              border: 1px solid rgba(255, 255, 255, 0.14);
              color: #f5f5f5;
              padding: 0.9rem 1rem;
              font-family: var(--font-ui);
              font-size: 0.95rem;
              font-weight: 400;
              line-height: 1.3;
              letter-spacing: 0em;
              border-radius: 10px;
              transition: border-color 0.2s, background 0.2s;
            }

            .newsletter-input:focus {
              outline: none;
              border-color: rgba(255, 255, 255, 0.35);
              background: #141414;
            }

            .newsletter-input::placeholder {
              color: #6b6b6b;
            }

            .form-actions {
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
              align-items: flex-start;
              margin-top: 0.25rem;
            }

            @media(min-width: 600px) {
                .form-actions {
                    flex-direction: row;
                    align-items: center;
                    gap: 1.25rem;
                }
            }
            
            .newsletter-submit-btn {
              background: #a30021;
              color: #fff;
              border: none;
              padding: 0.85rem 1.6rem;
              font-family: var(--font-ui);
              font-size: 0.85rem;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              font-weight: 700;
              line-height: 1.2;
              cursor: pointer;
              border-radius: 10px;
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
              font-family: var(--font-ui);
              font-size: 0.85rem;
              font-weight: 500;
              line-height: 1.2;
              letter-spacing: 0em;
              color: #8d8d8d;
              transition: color 0.2s;
              white-space: nowrap;
              text-decoration: none;
              max-width: 100%;
            }

            .secondary-link:hover {
              color: #d1d1d1;
            }

            .trust-microcopy {
              margin-top: 0.5rem;
              font-family: var(--font-ui);
              font-size: 0.74rem;
              color: #6d6d6d;
            }

            .error-msg {
                color: #a30021;
                font-size: 0.85rem;
                margin-top: -0.5rem;
            }

            /* Success State */
            .newsletter-success {
                text-align: center;
                padding: 3rem 2.5rem 3rem;
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
                font-family: var(--font-h2);
                font-size: 1.6rem;
                font-weight: 600;
                margin: 0;
            }

            .newsletter-success p {
                color: #9a9a9a;
                font-family: var(--font-ui);
                margin-bottom: 1.25rem;
                font-size: 1rem;
            }

            .newsletter-close-text-btn {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #fff;
                padding: 0.75rem 1.4rem;
                font-family: var(--font-ui);
                font-size: 0.85rem;
                text-transform: uppercase;
                cursor: pointer;
                transition: all 0.2s;
                text-decoration: none;
                display: inline-block;
                border-radius: 10px;
            }

            .newsletter-close-text-btn:hover {
                background: #fff;
                color: #000;
                border-color: #fff;
            }

            @media (max-width: 600px) {
              .newsletter-popup-container {
                max-width: 94vw;
                border-radius: 12px;
              }
              
              .newsletter-main-content {
                padding: 1.75rem 1.25rem 2rem;
                gap: 1.2rem;
              }
              
              .newsletter-headline {
                font-size: 1.4rem;
              }

              .newsletter-subhead,
              .newsletter-list {
                font-size: 0.9rem;
              }

              .newsletter-input {
                padding: 0.8rem 0.9rem;
                font-size: 0.9rem;
              }

              .newsletter-submit-btn {
                padding: 0.75rem 1rem;
                font-size: 0.8rem;
                width: 100%;
              }

              .secondary-link {
                white-space: normal;
              }

              .newsletter-success {
                padding: 2.5rem 1.5rem 2.5rem;
              }

              .trust-microcopy {
                font-size: 0.7rem;
                margin-top: 0.65rem;
              }
          }
          `}</style>
        </div>
    );
};

export default NewsletterForm;
