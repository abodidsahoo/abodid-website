import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { downloadScreenshot, downloadVisiblePDF, downloadFullBoardPDF } from '../utils/photoBoardExport';
import PhotoBoardManager from './photoboard/PhotoBoardManager';

const COLORS = [
    { name: 'Dark Blue', value: '#14225d', label: 'Dark Blue' },
    { name: 'Pop Blue', value: '#2444ca', label: 'Blue' },
    { name: 'Pop Pink', value: '#ff7eb5', label: 'Pink' },
    { name: 'Pop Cream', value: '#fff8e8', label: 'Cream' },
    { name: 'Pop Yellow', value: '#ffe44f', label: 'Yellow' },
    { name: 'Studio Dark', value: '#080808', label: 'Dark' },
];

const ThemeWidget = ({ currentItems = [], onSelectBoard, onNewBlankBoard }) => {
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
    const [isPdfMenuOpen, setIsPdfMenuOpen] = useState(false);
    const [activeColor, setActiveColor] = useState('#fff8e8');
    const [isCapturing, setIsCapturing] = useState(false);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [exportProgressText, setExportProgressText] = useState('');
    const [toastMessage, setToastMessage] = useState(null);

    const backdropRef = useRef(null);
    const instructionsRef = useRef(null);
    const pdfMenuRef = useRef(null);
    const toastTimerRef = useRef(null);

    const showToast = (message) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMessage(message);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage(null);
        }, 3500);
    };

    // Listen for custom toast events
    useEffect(() => {
        const handleToastEvent = (e) => {
            if (e.detail && e.detail.message) {
                showToast(e.detail.message);
            }
        };
        window.addEventListener('photoboard:toast', handleToastEvent);
        return () => window.removeEventListener('photoboard:toast', handleToastEvent);
    }, []);

    const applyTheme = (color) => {
        const hex = color.replace('#', '');
        const normalizedHex = hex.length === 3
            ? hex.split('').map((char) => char + char).join('')
            : hex;
        const r = parseInt(normalizedHex.slice(0, 2), 16) || 0;
        const g = parseInt(normalizedHex.slice(2, 4), 16) || 0;
        const b = parseInt(normalizedHex.slice(4, 6), 16) || 0;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const isDark = brightness < 150;

        document.documentElement.style.setProperty('--polaroid-hub-bg', color);
        document.documentElement.style.setProperty(
            '--polaroid-hub-grid-line',
            isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(21, 19, 15, 0.09)',
        );
        document.documentElement.style.setProperty(
            '--polaroid-hub-control-text',
            '#15130f',
        );
        document.documentElement.style.setProperty(
            '--polaroid-hub-control-border',
            '#15130f',
        );
        document.documentElement.style.setProperty(
            '--polaroid-hub-control-bg',
            '#fff8e8',
        );
        document.documentElement.style.setProperty(
            '--polaroid-hub-panel-bg',
            '#fff8e8',
        );
    };

    useEffect(() => {
        applyTheme(activeColor);
    }, []);

    // Click Outside Handling — deferred by one tick so the opening click
    // itself doesn't immediately trigger the outside-click handler (prevents flicker).
    useEffect(() => {
        if (!isPaletteOpen && !isInstructionsOpen && !isPdfMenuOpen) return;

        const handleClickOutside = (event) => {
            if (isPaletteOpen && backdropRef.current && !backdropRef.current.contains(event.target)) {
                setIsPaletteOpen(false);
            }
            if (isInstructionsOpen && instructionsRef.current && !instructionsRef.current.contains(event.target)) {
                setIsInstructionsOpen(false);
            }
            if (isPdfMenuOpen && pdfMenuRef.current && !pdfMenuRef.current.contains(event.target)) {
                setIsPdfMenuOpen(false);
            }
        };

        // Defer attachment so the originating click event doesn't fire this handler
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isPaletteOpen, isInstructionsOpen, isPdfMenuOpen]);

    // Escape key
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsPaletteOpen(false);
                setIsInstructionsOpen(false);
                setIsPdfMenuOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleColorChange = (color) => {
        setActiveColor(color);
        applyTheme(color);
    };

    const handleSaveState = () => {
        window.dispatchEvent(new CustomEvent('photoboard:save-state'));
    };

    const handleScreenshot = async () => {
        if (isCapturing) return;
        setIsCapturing(true);
        try {
            const filename = await downloadScreenshot();
            showToast(`✓ Screenshot saved (${filename})`);
        } catch (err) {
            console.error('Screenshot capture failed:', err);
            showToast('⚠️ Screenshot failed. Please try again.');
        } finally {
            setIsCapturing(false);
        }
    };

    const handlePrintVisiblePDF = async () => {
        setIsPdfMenuOpen(false);
        if (isExportingPDF) return;
        setIsExportingPDF(true);
        setExportProgressText('Preparing PDF...');
        try {
            const filename = await downloadVisiblePDF((progress) => {
                setExportProgressText(progress);
            });
            showToast(`✓ Viewport PDF generated (${filename})`);
        } catch (err) {
            console.error('Visible PDF export failed:', err);
            showToast('⚠️ PDF export failed. Please try again.');
        } finally {
            setIsExportingPDF(false);
            setExportProgressText('');
        }
    };

    const handlePrintFullBoardPDF = async () => {
        setIsPdfMenuOpen(false);
        if (isExportingPDF) return;
        setIsExportingPDF(true);
        setExportProgressText('Rendering full board...');
        try {
            const filename = await downloadFullBoardPDF((progress) => {
                setExportProgressText(progress);
            });
            showToast(`✓ Full Board PDF saved (${filename})`);
        } catch (err) {
            console.error('Full Board PDF export failed:', err);
            showToast('⚠️ Full PDF export failed. Please try again.');
        } finally {
            setIsExportingPDF(false);
            setExportProgressText('');
        }
    };

    const stepVariants = {
        hidden: { opacity: 0, y: 8 },
        visible: (i) => ({
            opacity: 1,
            y: 0,
            transition: {
                delay: i * 0.08,
                duration: 0.22,
                ease: 'easeOut',
            },
        }),
    };

    return (
        <div className="photoboard-corner-controls-root">
            {/* ========================================================================= */}
            {/* 1. TOP-RIGHT CORNER: Backdrop + Instructions (Side by Side) */}
            {/* ========================================================================= */}
            <div className="pop-corner-topright">
                {/* Backdrop Color Picker — icon-only swatch dot button */}
                <div className="pop-dropdown-wrapper" ref={backdropRef}>
                    <button
                        type="button"
                        className={`pop-corner-btn pop-backdrop-btn pop-backdrop-icon-btn ${isPaletteOpen ? 'is-active' : ''}`}
                        onClick={() => {
                            setIsPaletteOpen(!isPaletteOpen);
                            setIsInstructionsOpen(false);
                        }}
                        aria-expanded={isPaletteOpen}
                        aria-label="Change backdrop color"
                        title="Change backdrop color"
                    >
                        <span className="pop-theme-dot" style={{ backgroundColor: activeColor }} />
                    </button>

                    {/* Backdrop Palette Panel (Opens Downward) — compact, no header */}
                    <AnimatePresence>
                        {isPaletteOpen && (
                            <motion.div
                                className="pop-floating-panel pop-theme-panel"
                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                transition={{ type: 'spring', stiffness: 440, damping: 30 }}
                            >
                                <div className="pop-theme-swatches-compact">
                                    {COLORS.map((c) => {
                                        const isSelected = activeColor === c.value;
                                        const isLight = c.value === '#fff8e8' || c.value === '#ffe44f' || c.value === '#ff7eb5';
                                        return (
                                            <button
                                                key={c.value}
                                                type="button"
                                                onClick={() => { handleColorChange(c.value); setIsPaletteOpen(false); }}
                                                className={`pop-swatch-compact-btn ${isSelected ? 'is-selected' : ''}`}
                                                title={c.label}
                                            >
                                                <span
                                                    className="pop-swatch-large-circle"
                                                    style={{ backgroundColor: c.value }}
                                                >
                                                    {isSelected && (
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            width="11"
                                                            height="11"
                                                            stroke={isLight ? '#15130f' : '#ffffff'}
                                                            strokeWidth="3"
                                                            fill="none"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                    )}
                                                </span>
                                                <span className="pop-swatch-compact-label">{c.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Instructions Button & Panel (Top-Right Corner) */}
                <div className="pop-dropdown-wrapper" ref={instructionsRef}>
                    <button
                        type="button"
                        className={`pop-corner-btn pop-instructions-btn ${isInstructionsOpen ? 'is-active' : ''}`}
                        onClick={() => {
                            setIsInstructionsOpen(!isInstructionsOpen);
                            setIsPaletteOpen(false);
                        }}
                        aria-expanded={isInstructionsOpen}
                        aria-label="Toggle instructions"
                    >
                        <span className="pop-btn-sparkle-box">
                            <svg viewBox="0 0 12 12" width="11" height="11" fill="#ffe44f" aria-hidden="true">
                                <path d="M6 0 C6 3.5 6 3.5 9.5 6 C6 8.5 6 8.5 6 12 C6 8.5 6 8.5 2.5 6 C6 3.5 6 3.5 6 0 Z" />
                            </svg>
                        </span>
                        <span>Instructions</span>
                        <motion.span
                            animate={{ rotate: isInstructionsOpen ? 180 : 0 }}
                            transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
                            className="pop-chevron-wrapper"
                        >
                            <svg viewBox="0 0 10 6" width="9" height="5.5" fill="currentColor" aria-hidden="true">
                                <path d="M0.5 0.5 L5 5 L9.5 0.5 Z" />
                            </svg>
                        </motion.span>
                    </button>

                    {/* Instructions Dropdown Panel */}
                    <AnimatePresence>
                        {isInstructionsOpen && (
                            <motion.div
                                className="pop-floating-panel pop-instructions-card"
                                initial={{ opacity: 0, y: -10, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.96 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                            >
                                <div className="pop-panel-header">
                                    <div className="pop-panel-eyebrow pop-badge-pink">HOW TO EXPLORE</div>
                                    <button
                                        type="button"
                                        className="pop-close-icon-btn"
                                        onClick={() => setIsInstructionsOpen(false)}
                                        aria-label="Close instructions"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="pop-instructions-steps">
                                    <motion.div
                                        className="pop-step-item"
                                        custom={0}
                                        initial="hidden"
                                        animate="visible"
                                        variants={stepVariants}
                                    >
                                        <div className="pop-step-number pop-step-pink">01</div>
                                        <div className="pop-step-content">
                                            <div className="pop-step-title">Drag & Uncover</div>
                                            <p className="pop-step-desc">
                                                Click and drag polaroids anywhere on the canvas to scatter and reveal photos layered beneath.
                                            </p>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        className="pop-step-item"
                                        custom={1}
                                        initial="hidden"
                                        animate="visible"
                                        variants={stepVariants}
                                    >
                                        <div className="pop-step-number pop-step-yellow">02</div>
                                        <div className="pop-step-content">
                                            <div className="pop-step-title">Click to Enlarge</div>
                                            <p className="pop-step-desc">
                                                Tap any photograph to open the full-screen view and extract its dynamic color palette.
                                            </p>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        className="pop-step-item"
                                        custom={2}
                                        initial="hidden"
                                        animate="visible"
                                        variants={stepVariants}
                                    >
                                        <div className="pop-step-number pop-step-lime">03</div>
                                        <div className="pop-step-content">
                                            <div className="pop-step-title">Infinite Studio</div>
                                            <p className="pop-step-desc">
                                                Scroll down freely to explore infinite layers of photographic archives.
                                            </p>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        className="pop-step-item"
                                        custom={3}
                                        initial="hidden"
                                        animate="visible"
                                        variants={stepVariants}
                                    >
                                        <div className="pop-step-number pop-step-blue">04</div>
                                        <div className="pop-step-content">
                                            <div className="pop-step-title">Rotate & Save Layout</div>
                                            <p className="pop-step-desc">
                                                Hover over any corner to rotate with curved arrows. Click <strong>Save</strong> to store your custom arrangement.
                                            </p>
                                        </div>
                                    </motion.div>
                                </div>

                                <div className="pop-instructions-footer">
                                    <button
                                        type="button"
                                        className="pop-reset-layout-btn"
                                        onClick={() => {
                                            if (window.confirm('Reset polaroid scatter layout back to initial defaults?')) {
                                                window.dispatchEvent(new CustomEvent('photoboard:reset-state'));
                                            }
                                        }}
                                    >
                                        ↺ Reset Board Layout
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 2. BOTTOM-LEFT CORNER: Sign In / My Boards + Save Button */}
            {/* ========================================================================= */}
            <div className="pop-corner-bottomleft">
                <PhotoBoardManager
                    currentItems={currentItems}
                    activeBackdrop={activeColor}
                    onLoadBoard={onSelectBoard}
                    onNewBlankBoard={onNewBlankBoard}
                />

                <button
                    type="button"
                    className="pop-corner-btn pop-save-btn"
                    onClick={handleSaveState}
                    title="Save current polaroid layout arrangement"
                    aria-label="Save layout"
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
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                    </svg>
                    <span>Save</span>
                </button>
            </div>

            {/* ========================================================================= */}
            {/* 3. BOTTOM-RIGHT CORNER: Screenshot + Print PDF */}
            {/* ========================================================================= */}
            <div className="pop-corner-bottomright">
                {/* Screenshot Button */}
                <button
                    type="button"
                    className="pop-corner-btn pop-snap-btn"
                    onClick={handleScreenshot}
                    disabled={isCapturing}
                    title="Take an optically framed screenshot of the visible screen"
                    aria-label="Screenshot visible area"
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
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span>{isCapturing ? 'Snapping...' : 'Screenshot'}</span>
                </button>

                {/* Print PDF Dropdown Button (Opens Upward) */}
                <div className="pop-dropdown-wrapper" ref={pdfMenuRef}>
                    <button
                        type="button"
                        className={`pop-corner-btn pop-pdf-btn ${isPdfMenuOpen ? 'is-active' : ''}`}
                        onClick={() => {
                            setIsPdfMenuOpen(!isPdfMenuOpen);
                        }}
                        disabled={isExportingPDF}
                        title="Choose PDF print layout (Visible screen or Full board)"
                        aria-expanded={isPdfMenuOpen}
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
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                        </svg>
                        <span>{isExportingPDF ? (exportProgressText ? 'Rendering...' : 'Exporting...') : 'Print PDF'}</span>
                        <motion.span
                            animate={{ rotate: isPdfMenuOpen ? 180 : 0 }}
                            transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
                            className="pop-chevron-wrapper"
                        >
                            <svg viewBox="0 0 10 6" width="9" height="5.5" fill="currentColor" aria-hidden="true">
                                <path d="M0.5 0.5 L5 5 L9.5 0.5 Z" />
                            </svg>
                        </motion.span>
                    </button>

                    {/* PDF Layout Choice Dropdown Panel (Opens Upward) */}
                    <AnimatePresence>
                        {isPdfMenuOpen && (
                            <motion.div
                                className="pop-floating-panel pop-pdf-menu pop-menu-upward"
                                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                            >
                                <div className="pop-panel-header">
                                    <div className="pop-panel-eyebrow pop-badge-yellow">CHOOSE PDF LAYOUT</div>
                                    <button
                                        type="button"
                                        className="pop-close-icon-btn"
                                        onClick={() => setIsPdfMenuOpen(false)}
                                        aria-label="Close print menu"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="pop-pdf-options">
                                    {/* Option 1: Visible Viewport */}
                                    <button
                                        type="button"
                                        className="pop-pdf-option-btn"
                                        onClick={handlePrintVisiblePDF}
                                    >
                                        <div className="pop-pdf-option-text">
                                            <div className="pop-pdf-option-title-row">
                                                <span className="pop-pdf-option-title">Visible Viewport</span>
                                                <span className="pop-pdf-badge pop-badge-fast">Fast</span>
                                            </div>
                                            <p className="pop-pdf-option-desc">
                                                Instant 1-page framed PDF of what is currently on screen.
                                            </p>
                                        </div>
                                    </button>

                                    {/* Option 2: Full Board Archive */}
                                    <button
                                        type="button"
                                        className="pop-pdf-option-btn pop-pdf-full-btn"
                                        onClick={handlePrintFullBoardPDF}
                                    >
                                        <div className="pop-pdf-option-text">
                                            <div className="pop-pdf-option-title-row">
                                                <span className="pop-pdf-option-title">Full Board Archive</span>
                                                <span className="pop-pdf-badge pop-badge-crisp">Crisp Print</span>
                                            </div>
                                            <p className="pop-pdf-option-desc">
                                                Complete continuous scroll with all scattered photos from top to bottom.
                                            </p>
                                        </div>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* Pop Editorial Notification Toast */}
            {/* ========================================================================= */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        className="photoboard-toast"
                        initial={{ opacity: 0, y: -16, scale: 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.94 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                        <span>{toastMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .photoboard-corner-controls-root {
                    font-family: var(--font-mono, "Satoshi-Variable", monospace);
                    user-select: none;
                }

                /* Fixed Corner Containers */
                .pop-corner-topright {
                    position: fixed;
                    top: 1.5rem;
                    right: 1.5rem;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                }

                .pop-corner-bottomleft {
                    position: fixed;
                    bottom: 1.5rem;
                    left: 1.5rem;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                }

                .pop-corner-bottomright {
                    position: fixed;
                    bottom: 1.5rem;
                    right: 1.5rem;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                }

                .pop-dropdown-wrapper {
                    position: relative;
                    display: inline-flex;
                }

                /* Base Pop Editorial Button */
                .pop-corner-btn {
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

                .pop-corner-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 0 rgba(21, 19, 15, 0.3), 0 8px 16px rgba(0, 0, 0, 0.08);
                }

                .pop-corner-btn:active {
                    transform: translateY(1px);
                    box-shadow: 0 1px 0 rgba(21, 19, 15, 0.25);
                }

                .pop-corner-btn:disabled {
                    opacity: 0.6;
                    cursor: wait;
                }

                /* Distinct Category Pop Color Palette */
                .pop-backdrop-btn {
                    background: #fff8e8;
                    color: #15130f;
                }
                .pop-backdrop-btn:hover, .pop-backdrop-btn.is-active {
                    background: #ffffff;
                }

                .pop-instructions-btn {
                    background: #2444ca;
                    color: #ffffff;
                }
                .pop-instructions-btn:hover, .pop-instructions-btn.is-active {
                    background: #1b37af;
                }

                .pop-save-btn {
                    background: #caff48;
                    color: #15130f;
                }
                .pop-save-btn:hover {
                    background: #b8f331;
                }

                .pop-snap-btn {
                    background: #ff7eb5;
                    color: #15130f;
                }
                .pop-snap-btn:hover {
                    background: #ff64a5;
                }

                .pop-pdf-btn {
                    background: #caff48;
                    color: #15130f;
                }
                .pop-pdf-btn:hover, .pop-pdf-btn.is-active {
                    background: #b8f331;
                }

                /* Dots, Sparkles & Centered Chevrons */
                .pop-theme-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    border: 1.5px solid #15130f;
                    display: inline-block;
                    flex-shrink: 0;
                    box-sizing: border-box;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
                }

                .pop-btn-sparkle-box {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    flex-shrink: 0;
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

                /* Floating Dropdown Panels */
                .pop-floating-panel {
                    position: absolute;
                    background: #fff8e8;
                    color: #15130f;
                    border: 1.5px solid #15130f;
                    border-radius: 18px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18), 0 3px 0 rgba(21, 19, 15, 0.3);
                    box-sizing: border-box;
                    z-index: 10050;
                }

                /* Top Right panels open downward */
                .pop-corner-topright .pop-floating-panel {
                    top: calc(100% + 0.6rem);
                    right: 0;
                    transform-origin: top right;
                }

                /* Bottom Right panels open upward */
                .pop-corner-bottomright .pop-floating-panel {
                    bottom: calc(100% + 0.6rem);
                    right: 0;
                    transform-origin: bottom right;
                }

                .pop-panel-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 0.85rem;
                    padding-bottom: 0.55rem;
                    border-bottom: 1.5px solid rgba(21, 19, 15, 0.15);
                }

                .pop-panel-eyebrow {
                    font-family: var(--font-mono, "Satoshi-Variable", monospace);
                    font-size: 0.68rem;
                    font-weight: 850;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: #15130f;
                    padding: 0.22rem 0.55rem;
                    border-radius: 6px;
                    border: 1px solid #15130f;
                }

                .pop-badge-lime { background: #caff48; }
                .pop-badge-pink { background: #ff7eb5; }
                .pop-badge-yellow { background: #ffe44f; }

                .pop-close-icon-btn {
                    background: transparent;
                    border: none;
                    color: #15130f;
                    font-size: 0.9rem;
                    font-weight: 800;
                    cursor: pointer;
                    padding: 0.2rem 0.4rem;
                    line-height: 1;
                    border-radius: 4px;
                    transition: transform 120ms ease, background-color 120ms ease;
                }

                .pop-close-icon-btn:hover {
                    background: rgba(21, 19, 15, 0.08);
                    transform: scale(1.15);
                }

                /* Compact backdrop icon-only button */
                .pop-backdrop-icon-btn {
                    padding: 0.45rem 0.6rem;
                    gap: 0;
                }

                /* Theme Swatches — compact pill row */
                .pop-theme-panel {
                    width: auto;
                    min-width: 9rem;
                    padding: 0.7rem 0.8rem;
                }

                .pop-theme-swatches-compact {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                }

                .pop-swatch-compact-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.32rem 0.5rem;
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: var(--font-mono, "Satoshi-Variable", monospace);
                    text-align: left;
                    transition: background 100ms ease, border-color 100ms ease;
                    width: 100%;
                }

                .pop-swatch-compact-btn:hover {
                    background: rgba(21, 19, 15, 0.06);
                    border-color: rgba(21, 19, 15, 0.15);
                }

                .pop-swatch-compact-btn.is-selected {
                    background: rgba(21, 19, 15, 0.06);
                    border-color: rgba(21, 19, 15, 0.25);
                }

                .pop-swatch-large-circle {
                    width: 1.1rem;
                    height: 1.1rem;
                    border-radius: 999px;
                    border: 1.2px solid rgba(21, 19, 15, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .pop-swatch-compact-label {
                    font-size: 0.74rem;
                    font-weight: 700;
                    color: #15130f;
                    letter-spacing: 0.01em;
                }

                /* Instructions Panel */
                .pop-instructions-card {
                    width: min(22rem, calc(100vw - 3rem));
                    padding: 1.2rem 1.35rem;
                }

                .pop-instructions-steps {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-bottom: 0.85rem;
                }

                .pop-step-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                }

                .pop-step-number {
                    font-size: 0.72rem;
                    font-weight: 850;
                    padding: 0.25rem 0.45rem;
                    border-radius: 6px;
                    border: 1px solid #15130f;
                    line-height: 1;
                    flex-shrink: 0;
                    color: #15130f;
                }

                .pop-step-pink { background: #ff7eb5; }
                .pop-step-yellow { background: #ffe44f; }
                .pop-step-lime { background: #caff48; }
                .pop-step-blue { background: #85a2ff; }

                .pop-step-content {
                    flex: 1;
                }

                .pop-step-title {
                    font-size: 0.82rem;
                    font-weight: 800;
                    color: #15130f;
                    margin-bottom: 0.15rem;
                }

                .pop-step-desc {
                    margin: 0;
                    font-size: 0.73rem;
                    line-height: 1.38;
                    color: rgba(21, 19, 15, 0.75);
                }

                .pop-instructions-footer {
                    padding-top: 0.65rem;
                    border-top: 1.5px solid rgba(21, 19, 15, 0.15);
                    display: flex;
                    justify-content: flex-end;
                }

                .pop-reset-layout-btn {
                    background: transparent;
                    border: 1px dashed rgba(21, 19, 15, 0.4);
                    border-radius: 6px;
                    padding: 0.35rem 0.65rem;
                    font-family: inherit;
                    font-size: 0.7rem;
                    font-weight: 750;
                    color: #15130f;
                    cursor: pointer;
                    transition: background 120ms ease, border-color 120ms ease;
                }

                .pop-reset-layout-btn:hover {
                    background: #ffe44f;
                    border-color: #15130f;
                }

                /* PDF Layout Options Panel */
                .pop-pdf-menu {
                    width: min(21rem, calc(100vw - 3rem));
                    padding: 1.1rem 1.15rem;
                }

                .pop-pdf-options {
                    display: flex;
                    flex-direction: column;
                    gap: 0.65rem;
                }

                .pop-pdf-option-btn {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                    background: #ffffff;
                    border: 1.5px solid #15130f;
                    border-radius: 14px;
                    padding: 0.75rem 0.85rem;
                    cursor: pointer;
                    text-align: left;
                    box-shadow: 0 2.5px 0 rgba(21, 19, 15, 0.25);
                    transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
                }

                .pop-pdf-option-btn:hover {
                    background: #fffdf7;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 0 rgba(21, 19, 15, 0.3);
                }

                .pop-pdf-option-btn:active {
                    transform: translateY(1px);
                    box-shadow: 0 1px 0 rgba(21, 19, 15, 0.25);
                }

                .pop-pdf-full-btn:hover {
                    background: #f4ffdc !important;
                }

                .pop-pdf-option-text {
                    flex: 1;
                }

                .pop-pdf-option-title-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 0.25rem;
                }

                .pop-pdf-option-title {
                    font-size: 0.82rem;
                    font-weight: 850;
                    color: #15130f;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                .pop-pdf-badge {
                    font-size: 0.6rem;
                    font-weight: 850;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    padding: 0.15rem 0.4rem;
                    border-radius: 999px;
                    border: 1px solid #15130f;
                }

                .pop-badge-fast {
                    background: #ff7eb5;
                    color: #15130f;
                }

                .pop-badge-crisp {
                    background: #caff48;
                    color: #15130f;
                }

                .pop-pdf-option-desc {
                    margin: 0;
                    font-size: 0.72rem;
                    color: #5a574f;
                    line-height: 1.35;
                }

                /* Notification Toast */
                .photoboard-toast {
                    position: fixed;
                    top: 1.5rem;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 10050;
                    background: #fff8e8;
                    color: #15130f;
                    border: 1.5px solid #15130f;
                    border-radius: 999px;
                    padding: 0.55rem 1.25rem;
                    font-family: var(--font-mono, "Satoshi-Variable", monospace);
                    font-size: 0.82rem;
                    font-weight: 800;
                    letter-spacing: 0.02em;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 3px 0 rgba(21, 19, 15, 0.25);
                    pointer-events: none;
                }

                @media (max-width: 640px) {
                    .pop-corner-topright {
                        top: 1rem;
                        right: 1rem;
                        gap: 0.45rem;
                    }
                    .pop-corner-bottomleft {
                        bottom: 1rem;
                        left: 1rem;
                        gap: 0.45rem;
                    }
                    .pop-corner-bottomright {
                        bottom: 1rem;
                        right: 1rem;
                        gap: 0.45rem;
                    }
                    .pop-corner-btn {
                        padding: 0.4rem 0.75rem;
                        font-size: 0.75rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default ThemeWidget;
