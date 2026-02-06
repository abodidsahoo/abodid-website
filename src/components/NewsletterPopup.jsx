import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NewsletterForm from "./NewsletterForm";

const NewsletterPopup = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // 1. Initial Check: Has user already dismissed it?
        const dismissed = localStorage.getItem("newsletter_popup_dismissed");
        if (dismissed) return;

        // 2. Determine Trigger Logic based on current Path
        const path = window.location.pathname;

        // Define "Content Pages" where we want scroll-based triggers
        // Adjust these prefixes based on your actual routing structure
        const contentPrefixes = ["/blog", "/films", "/photography", "/research", "/architecture", "/visual-experiments"];
        const isContentPage = contentPrefixes.some(prefix => path.startsWith(prefix));

        if (isContentPage) {
            // --- SCROLL BASED TRIGGER (> 35%) ---
            const handleScroll = () => {
                // Remove listener if already visible or dismissed
                if (isVisible || localStorage.getItem("newsletter_popup_dismissed")) {
                    window.removeEventListener("scroll", handleScroll);
                    return;
                }

                const scrollTop = window.scrollY;
                const docHeight = document.documentElement.scrollHeight;
                const winHeight = window.innerHeight;

                // Calculate scroll percentage (0 to 1)
                const scrollPercent = scrollTop / (docHeight - winHeight);

                // Trigger if scrolled more than 35%
                if (scrollPercent > 0.35) {
                    setIsVisible(true);
                    window.removeEventListener("scroll", handleScroll);
                }
            };

            window.addEventListener("scroll", handleScroll, { passive: true });
            return () => window.removeEventListener("scroll", handleScroll);

        } else {
            // --- TIMER BASED TRIGGER (30 Second Delay) ---
            // For Home, About, or any other non-long-form content pages
            const timer = setTimeout(() => {
                // Re-check dismissal just in case they dismissed it in another tab in the meantime
                if (!localStorage.getItem("newsletter_popup_dismissed")) {
                    setIsVisible(true);
                }
            }, 30000); // 30 seconds

            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    const handleClose = () => {
        setIsVisible(false);
        localStorage.setItem("newsletter_popup_dismissed", "true");
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="newsletter-backdrop"
                        onClick={handleClose}
                    />

                    {/* Popup Modal */}
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="newsletter-popup-wrapper"
                    >
                        <NewsletterForm onClose={handleClose} variant="popup" />
                    </motion.div>

                    <style>{`
            .newsletter-backdrop {
              position: fixed;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              background: rgba(0, 0, 0, 0.6);
              backdrop-filter: blur(8px);
              z-index: 99998;
            }
            
            .newsletter-popup-wrapper {
                 position: fixed;
                 top: 50%;
                 left: 50%;
                 transform: translate(-50%, -50%) !important;
                 z-index: 99999;
                 width: 100%;
                 display: flex;
                 justify-content: center;
                 pointer-events: none; /* Let clicks pass through wrapper to backdrop if clicked outside form */
            }
            
            .newsletter-popup-wrapper > * {
                pointer-events: auto; /* Re-enable clicks on the form itself */
            }
          `}</style>
                </>
            )}
        </AnimatePresence>
    );
};

export default NewsletterPopup;
