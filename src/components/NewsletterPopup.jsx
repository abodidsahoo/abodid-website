import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NewsletterForm from "./NewsletterForm";
import {
    isFooterFormSessionSuppressed,
    markFooterFormSessionSuppressed,
    markNewsletterPopupDismissed,
    markNewsletterPopupShownForSession,
    readNewsletterPopupState,
    shouldSuppressNewsletterPopup,
} from "../lib/newsletter/popupState";

const MIN_SESSION_AGE_MS = 90 * 1000;
const MIN_CURRENT_PAGE_DWELL_MS = 20 * 1000;
const FOOTER_BOUNCE_PAGE_DWELL_MS = 60 * 1000;
const FOOTER_ZONE_HOLD_MS = 3 * 1000;
const FOOTER_BOUNCE_DELAY_MS = 3 * 1000;
const GLOBAL_IDLE_MS = 5 * 1000;
const HIRE_INTENT_IDLE_MS = 6 * 1000;
const EXPLORER_IDLE_MS = 6 * 1000;
const FOOTER_BOUNCE_UP_SCROLL_PX = 500;
const FOOTER_SCROLL_THRESHOLD = 0.88;
const RECENT_TYPING_GRACE_MS = 2 * 1000;
const EVALUATION_INTERVAL_MS = 500;

const BLOCKED_EXACT_PATHS = new Set([
    "/contact",
    "/newsletter",
    "/unsubscribe",
]);

const HIRE_INTENT_RULES = [
    { prefix: "/about", bucket: "/about" },
    { prefix: "/services", bucket: "/services" },
    { prefix: "/experience", bucket: "/experience" },
    { prefix: "/press", bucket: "/press" },
    { prefix: "/workshops", bucket: "/workshops" },
    { prefix: "/fundraising", bucket: "/fundraising" },
];

const cleanString = (value) =>
    typeof value === "string" ? value.trim() : "";

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const parseTimestamp = (value) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const isBlockedPath = (path) =>
    BLOCKED_EXACT_PATHS.has(path) || path.startsWith("/admin");

const getHireIntentBucket = (path) => {
    for (const rule of HIRE_INTENT_RULES) {
        if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
            return rule.bucket;
        }
    }

    return "";
};

const isHireIntentPath = (path) => Boolean(getHireIntentBucket(path));

const getVisitSequence = (snapshot) =>
    Array.isArray(snapshot?.visitSequence) ? snapshot.visitSequence : [];

const getJourneySnapshot = () => {
    if (typeof window === "undefined") return null;

    try {
        if (
            window.__abodidJourney &&
            typeof window.__abodidJourney.getSnapshot === "function"
        ) {
            const snapshot = window.__abodidJourney.getSnapshot();

            if (snapshot && typeof snapshot === "object") {
                return {
                    ...snapshot,
                    currentPath:
                        cleanString(snapshot.currentPath) ||
                        window.location.pathname,
                };
            }
        }
    } catch (_error) {
        // no-op
    }

    return null;
};

const getSessionAgeMs = (snapshot, now) => {
    const startedAtMs = parseTimestamp(snapshot?.startedAt);
    if (startedAtMs === null) return 0;
    return Math.max(0, now - startedAtMs);
};

const getCurrentPageDwellMs = (snapshot, now) => {
    const currentPath = cleanString(snapshot?.currentPath);
    const visitSequence = getVisitSequence(snapshot);

    for (let index = visitSequence.length - 1; index >= 0; index -= 1) {
        const eventItem = visitSequence[index];
        if (cleanString(eventItem?.path) !== currentPath) continue;

        const enteredAtMs = parseTimestamp(eventItem?.enteredAt);
        if (enteredAtMs === null) return 0;

        return Math.max(0, now - enteredAtMs);
    }

    return 0;
};

const hasVisitedAboutPage = (snapshot) =>
    getVisitSequence(snapshot).some(
        (eventItem) => cleanString(eventItem?.path) === "/about",
    );

const getVisitedHireIntentBuckets = (snapshot) => {
    const buckets = new Set();

    getVisitSequence(snapshot).forEach((eventItem) => {
        const bucket = getHireIntentBucket(cleanString(eventItem?.path));
        if (bucket) buckets.add(bucket);
    });

    return buckets;
};

const getScrollDepth = () => {
    if (typeof window === "undefined") return 0;

    const documentHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = Math.max(documentHeight - viewportHeight, 0);

    if (maxScroll <= 0) return 0;

    return Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
};

const NewsletterPopup = () => {
    const [isVisible, setIsVisible] = useState(false);
    const isVisibleRef = useRef(false);
    const sessionIdRef = useRef("");
    const footerVisibleRef = useRef(false);
    const inlineFormVisibleRef = useRef(false);
    const inlineFormFocusedRef = useRef(false);
    const lastInlineInputAtRef = useRef(0);
    const lastScrollAtRef = useRef(Date.now());
    const footerZoneEnteredAtRef = useRef(null);
    const footerZoneQualifiedRef = useRef(false);
    const footerPeakScrollYRef = useRef(0);
    const footerBounceReadyAtRef = useRef(null);

    useEffect(() => {
        isVisibleRef.current = isVisible;
    }, [isVisible]);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;

        const currentPath = window.location.pathname;
        if (isBlockedPath(currentPath)) return undefined;

        let footerObserver;
        let inlineFormObserver;
        let attachTargetsIntervalId = 0;
        let evaluationIntervalId = 0;
        let footerNode = null;
        let inlineFormNode = null;
        let removeInlineFormListeners = () => {};

        const registerFooterFormEngagement = () => {
            const snapshot = getJourneySnapshot();
            const sessionId = cleanString(snapshot?.sessionId) || sessionIdRef.current;

            if (sessionId) {
                sessionIdRef.current = sessionId;
            }

            markFooterFormSessionSuppressed(sessionId);
        };

        const updateFooterBounceState = (now = Date.now()) => {
            const scrollY = Math.max(window.scrollY || 0, 0);
            const deepZoneActive =
                footerVisibleRef.current || getScrollDepth() >= FOOTER_SCROLL_THRESHOLD;

            if (deepZoneActive) {
                footerBounceReadyAtRef.current = null;
                footerPeakScrollYRef.current = Math.max(
                    footerPeakScrollYRef.current,
                    scrollY,
                );

                if (footerZoneEnteredAtRef.current === null) {
                    footerZoneEnteredAtRef.current = now;
                }

                if (
                    !footerZoneQualifiedRef.current &&
                    now - footerZoneEnteredAtRef.current >= FOOTER_ZONE_HOLD_MS
                ) {
                    footerZoneQualifiedRef.current = true;
                }

                return;
            }

            footerZoneEnteredAtRef.current = null;

            if (!footerZoneQualifiedRef.current) {
                footerPeakScrollYRef.current = scrollY;
                return;
            }

            footerPeakScrollYRef.current = Math.max(
                footerPeakScrollYRef.current,
                scrollY,
            );

            const upwardTravel = footerPeakScrollYRef.current - scrollY;
            if (upwardTravel >= FOOTER_BOUNCE_UP_SCROLL_PX) {
                if (!footerBounceReadyAtRef.current) {
                    footerBounceReadyAtRef.current = now;
                }
            }
        };

        const showPopup = (sessionId) => {
            if (isVisibleRef.current) return;

            isVisibleRef.current = true;
            markNewsletterPopupShownForSession(sessionId);
            setIsVisible(true);
        };

        const isFooterBounceEligible = (snapshot, now, currentPageDwellMs) => {
            if (currentPageDwellMs < FOOTER_BOUNCE_PAGE_DWELL_MS) return false;
            if (!footerZoneQualifiedRef.current) return false;
            if (!footerBounceReadyAtRef.current) return false;
            if (footerVisibleRef.current || inlineFormVisibleRef.current) return false;

            return now - footerBounceReadyAtRef.current >= FOOTER_BOUNCE_DELAY_MS;
        };

        const isHireIntentEligible = (snapshot, currentPagePath, currentPageDwellMs) => {
            if (!isHireIntentPath(currentPagePath)) return false;
            if (currentPageDwellMs < MIN_CURRENT_PAGE_DWELL_MS) return false;
            if (!hasVisitedAboutPage(snapshot)) return false;

            const visitedHireIntentBuckets = getVisitedHireIntentBuckets(snapshot);
            const hasSecondHireIntentPage = visitedHireIntentBuckets.size >= 2;
            const hasEnoughUniquePages = toNumber(snapshot?.uniquePagesVisited) >= 3;
            const hasEnoughTrackedTime = toNumber(snapshot?.totalTrackedMs) >= 150000;

            return (
                hasSecondHireIntentPage ||
                hasEnoughUniquePages ||
                hasEnoughTrackedTime
            );
        };

        const isExplorerEligible = (snapshot, currentPageDwellMs) => {
            if (currentPageDwellMs < MIN_CURRENT_PAGE_DWELL_MS) return false;

            return (
                toNumber(snapshot?.uniquePagesVisited) >= 3 &&
                toNumber(snapshot?.totalPageViews) >= 4 &&
                toNumber(snapshot?.totalTrackedMs) >= 120000
            );
        };

        const evaluatePopup = () => {
            if (isVisibleRef.current) return;

            const snapshot = getJourneySnapshot();
            if (!snapshot) return;

            const now = Date.now();
            const currentPagePath =
                cleanString(snapshot.currentPath) || window.location.pathname;
            const sessionId = cleanString(snapshot.sessionId) || sessionIdRef.current;

            if (sessionId) {
                sessionIdRef.current = sessionId;
            }

            if (isBlockedPath(currentPagePath)) return;

            const popupState = readNewsletterPopupState();
            if (shouldSuppressNewsletterPopup(popupState, sessionId, now)) return;
            if (isFooterFormSessionSuppressed(sessionId)) return;
            if (footerVisibleRef.current || inlineFormVisibleRef.current) return;
            if (inlineFormFocusedRef.current) return;

            const recentlyTyped =
                lastInlineInputAtRef.current > 0 &&
                now - lastInlineInputAtRef.current < RECENT_TYPING_GRACE_MS;
            if (recentlyTyped) return;

            const sessionAgeMs = getSessionAgeMs(snapshot, now);
            if (sessionAgeMs < MIN_SESSION_AGE_MS) return;

            const currentPageDwellMs = getCurrentPageDwellMs(snapshot, now);
            if (currentPageDwellMs < MIN_CURRENT_PAGE_DWELL_MS) return;

            const idleMs = now - lastScrollAtRef.current;
            if (idleMs < GLOBAL_IDLE_MS) return;

            if (isFooterBounceEligible(snapshot, now, currentPageDwellMs)) {
                showPopup(sessionId);
                return;
            }

            if (
                idleMs >= HIRE_INTENT_IDLE_MS &&
                isHireIntentEligible(snapshot, currentPagePath, currentPageDwellMs)
            ) {
                showPopup(sessionId);
                return;
            }

            if (
                idleMs >= EXPLORER_IDLE_MS &&
                isExplorerEligible(snapshot, currentPageDwellMs)
            ) {
                showPopup(sessionId);
            }
        };

        const bindInlineFormListeners = (node) => {
            const handleFocusIn = () => {
                inlineFormFocusedRef.current = true;
                registerFooterFormEngagement();
            };

            const handleFocusOut = () => {
                window.setTimeout(() => {
                    inlineFormFocusedRef.current = node.contains(document.activeElement);
                }, 0);
            };

            const handleInput = () => {
                lastInlineInputAtRef.current = Date.now();
                registerFooterFormEngagement();
            };

            const handleSubmit = () => {
                registerFooterFormEngagement();
            };

            node.addEventListener("focusin", handleFocusIn);
            node.addEventListener("focusout", handleFocusOut);
            node.addEventListener("input", handleInput);
            node.addEventListener("submit", handleSubmit);

            return () => {
                node.removeEventListener("focusin", handleFocusIn);
                node.removeEventListener("focusout", handleFocusOut);
                node.removeEventListener("input", handleInput);
                node.removeEventListener("submit", handleSubmit);
            };
        };

        const attachTargets = () => {
            if (!footerNode) {
                const nextFooterNode = document.querySelector("[data-newsletter-footer]");
                if (nextFooterNode && footerObserver) {
                    footerNode = nextFooterNode;
                    footerObserver.observe(footerNode);
                }
            }

            if (!inlineFormNode) {
                const nextInlineFormNode = document.querySelector(
                    "[data-newsletter-inline-form]",
                );

                if (nextInlineFormNode && inlineFormObserver) {
                    inlineFormNode = nextInlineFormNode;
                    inlineFormObserver.observe(inlineFormNode);
                    removeInlineFormListeners = bindInlineFormListeners(inlineFormNode);
                }
            }
        };

        const handleScroll = () => {
            lastScrollAtRef.current = Date.now();
            updateFooterBounceState(lastScrollAtRef.current);
        };

        const handleResize = () => {
            updateFooterBounceState(Date.now());
            evaluatePopup();
        };

        footerObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    footerVisibleRef.current =
                        entry.isIntersecting && entry.intersectionRatio > 0.08;

                    updateFooterBounceState(Date.now());
                });
            },
            { threshold: [0, 0.08, 0.2, 0.4] },
        );

        inlineFormObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    inlineFormVisibleRef.current =
                        entry.isIntersecting && entry.intersectionRatio > 0.08;
                });
            },
            { threshold: [0, 0.08, 0.2, 0.4] },
        );

        footerPeakScrollYRef.current = Math.max(window.scrollY || 0, 0);
        attachTargets();
        handleScroll();
        evaluatePopup();

        attachTargetsIntervalId = window.setInterval(attachTargets, 1000);
        evaluationIntervalId = window.setInterval(evaluatePopup, EVALUATION_INTERVAL_MS);

        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleResize);

            if (attachTargetsIntervalId) {
                window.clearInterval(attachTargetsIntervalId);
            }

            if (evaluationIntervalId) {
                window.clearInterval(evaluationIntervalId);
            }

            if (footerObserver && footerNode) {
                footerObserver.unobserve(footerNode);
            }

            if (inlineFormObserver && inlineFormNode) {
                inlineFormObserver.unobserve(inlineFormNode);
            }

            footerObserver?.disconnect();
            inlineFormObserver?.disconnect();
            removeInlineFormListeners();
        };
    }, []);

    const handleClose = (options = {}) => {
        setIsVisible(false);
        isVisibleRef.current = false;

        if (options.persistDismissal === false) return;

        markNewsletterPopupDismissed();
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="newsletter-backdrop"
                        onClick={() => handleClose()}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="newsletter-popup-wrapper"
                        role="dialog"
                        aria-modal="true"
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
                 inset: 0;
                 z-index: 99999;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 pointer-events: none;
                 padding: 1rem;
            }
            
            .newsletter-popup-wrapper > * {
                pointer-events: auto;
            }
          `}</style>
                </>
            )}
        </AnimatePresence>
    );
};

export default NewsletterPopup;
