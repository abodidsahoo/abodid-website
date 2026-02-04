import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ExperimentHeader = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    // --- ANIMATION VARIANTS ---

    // Panel expansion: Smooth & Elegant
    const menuPanelVariants = {
        closed: {
            height: 0,
            transition: {
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1]
            }
        },
        open: {
            height: '65vh',
            transition: {
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1]
            }
        }
    };

    // Stagger container for text
    const containerVariants = {
        open: {
            transition: {
                staggerChildren: 0.07, // Increased for distinct waterfall
                delayChildren: 0.05,
            }
        },
        closed: {
            transition: {
                staggerChildren: 0.02,
                staggerDirection: -1
            }
        }
    };

    // Item Reveal: Smooth Drift (Fade + Slide Up)
    const itemVariants = {
        closed: {
            y: 30, // Start slightly below
            opacity: 0,
            transition: { duration: 0.2 }
        },
        open: {
            y: 0,
            opacity: 1,
            transition: {
                duration: 0.8,
                ease: [0.23, 1, 0.32, 1] // easeOutQuint
            }
        }
    };

    return (
        <React.Fragment>
            {/* ... Navbar (unchanged) ... */}
            <div className="fixed-nav">
                <div className="nav-grid">
                    {/* LEFT: Logo */}
                    <div className="nav-left">
                        <a href="/" className="logo-text">
                            ABODID.IO
                        </a>
                    </div>

                    {/* CENTER: Menu Toggle */}
                    <div className="nav-center">
                        <button onClick={toggleMenu} className="menu-btn">
                            {isOpen ? 'CLOSE' : 'MENU'}
                        </button>
                    </div>

                    {/* RIGHT: Contact/Search placeholder */}
                    <div className="nav-right">
                        <a href="/contact" className="nav-link">CONTACT</a>
                    </div>
                </div>

                {/* Thin white line at bottom */}
                <div className="nav-border"></div>
            </div>

            {/* --- MEGA MENU BACKDROP & OVERLAY --- */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* 1. BACKDROP */}
                        <motion.div
                            className="menu-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            onClick={() => setIsOpen(false)}
                        />

                        {/* 2. MENU PANEL */}
                        <motion.div
                            className="mega-menu"
                            initial="closed"
                            animate="open"
                            exit="closed"
                            variants={menuPanelVariants}
                        >
                            {/* 50/50 Grid */}
                            <div className="menu-grid">

                                {/* LEFT EMPTY 50% */}
                                <div className="menu-spacer" onClick={() => setIsOpen(false)}></div>

                                {/* RIGHT CONTENT 50% */}
                                <motion.div className="menu-content" variants={containerVariants}>

                                    <div className="menu-columns">
                                        {/* COLUMN 1: MAJOR PAGES */}
                                        <div className="menu-col main-links">
                                            <div className="col-label">Directory</div>
                                            <MenuLink href="/photography" variants={itemVariants}>Photography</MenuLink>
                                            <MenuLink href="/films" variants={itemVariants}>Films</MenuLink>
                                            <MenuLink href="/research" variants={itemVariants}>Research</MenuLink>
                                            <MenuLink href="/resources" variants={itemVariants}>Resources</MenuLink>
                                        </div>

                                        {/* COLUMN 2: SECONDARY */}
                                        <div className="menu-col secondary-links">

                                            <div className="group">
                                                <div className="col-label">Socials</div>
                                                <MenuLink href="#" variants={itemVariants} small>Instagram</MenuLink>
                                                <MenuLink href="#" variants={itemVariants} small>LinkedIn</MenuLink>
                                                <MenuLink href="#" variants={itemVariants} small>Twitter</MenuLink>
                                            </div>

                                            <div className="group">
                                                <div className="col-label">Legal</div>
                                                <MenuLink href="/privacy" variants={itemVariants} small>Privacy Policy</MenuLink>
                                                <MenuLink href="/licensing" variants={itemVariants} small>Licensing</MenuLink>
                                            </div>

                                        </div>
                                    </div>

                                </motion.div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <style>{`
                /* FIXED NAV */
                .fixed-nav {
                    position: fixed;
                    top: 0; left: 0; width: 100%;
                    z-index: 1000;
                    background: rgba(5, 5, 5, 0.85);
                    backdrop-filter: blur(12px);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    padding: 0;
                }
                .nav-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    align-items: center;
                    height: 80px;
                    padding: 0 4vw;
                }
                .nav-center { display: flex; justify-content: center; }
                .nav-right { display: flex; justify-content: flex-end; }
                .nav-border { width: 100%; height: 1px; background: rgba(255,255,255, 0.15); margin-top: 0; }
                .logo-text, .nav-link, .menu-btn {
                    font-family: 'Space Mono', monospace;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    color: white;
                    text-decoration: none;
                    background: none;
                    border: none;
                    cursor: pointer;
                    letter-spacing: 0.05em;
                }
                .menu-btn:hover, .nav-link:hover { opacity: 0.7; }

                /* MENU BACKDROP */
                .menu-backdrop {
                    position: fixed;
                    top: 80px;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(8px);
                    z-index: 850;
                    cursor: pointer;
                }

                /* MENU PANEL - INVERTED (White/Light Theme) */
                .mega-menu {
                    position: fixed;
                    top: 81px;
                    left: 0;
                    width: 100%;
                    background-color: #F5F5F7; /* LIGHT GRAY/WHITE */
                    overflow: hidden;
                    z-index: 900;
                    border-bottom: 1px solid rgba(0,0,0,0.1); /* Dark border */
                    box-shadow: 0 20px 50px rgba(0,0,0,0.2);
                }

                .menu-grid { display: grid; grid-template-columns: 1fr 1fr; height: 100%; width: 100%; }
                .menu-content { padding: 4rem 4vw; height: 100%; }
                .menu-columns { display: grid; grid-template-columns: 1fr 1fr; height: 100%; gap: 2rem; }
                
                .col-label {
                    font-family: 'Space Mono', monospace;
                    font-size: 0.75rem;
                    color: #888; /* Softer gray on white */
                    text-transform: uppercase;
                    margin-bottom: 2rem;
                    border-bottom: 1px solid #ddd; /* Light gray line */
                    padding-bottom: 0.5rem;
                    width: 80%;
                }

                .menu-link-item {
                    display: block;
                    text-decoration: none;
                    margin-bottom: 0.5rem;
                    width: fit-content;
                }

                .menu-text {
                    color: #1a1a1a; /* DARK TEXT */
                    font-family: 'Poppins', sans-serif;
                    font-weight: 500;
                    /* REMOVED TRANSFORM TRANSITION to avoid conflict with Framer Motion */
                    transition: color 0.3s ease; 
                    display: block;
                }

                .menu-text.major {
                    font-size: 3rem;
                    font-weight: 600;
                    letter-spacing: -0.02em;
                    line-height: 1.1;
                }

                .menu-text.small {
                    font-size: 1.1rem;
                    font-weight: 400;
                }

                /* Hover: Color Only (Transform handled by Framer) */
                .menu-link-item:hover .menu-text {
                    color: #000; /* Darker black */
                }

                .secondary-links { display: flex; flex-direction: column; gap: 3rem; }

                @media (max-width: 768px) {
                    .nav-grid { padding: 0 1rem; }
                    .menu-grid { grid-template-columns: 1fr; }
                    .menu-columns { grid-template-columns: 1fr; gap: 2rem; }
                    .menu-text.major { font-size: 2rem; }
                }
            `}</style>
        </React.Fragment>
    );
};

const MenuLink = ({ children, href, variants, small }) => {
    return (
        <a href={href} className="menu-link-item">
            {/* Using whileHover in Framer Motion instead of CSS hover to avoid conflicts */}
            <motion.span
                className={`menu-text ${small ? 'small' : 'major'}`}
                variants={variants}
                whileHover={{
                    x: 10,
                    transition: { type: "spring", stiffness: 300, damping: 20 }
                }}
            >
                {children}
            </motion.span>
        </a>
    );
};

export default ExperimentHeader;
