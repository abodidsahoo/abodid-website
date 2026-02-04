import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Breadcrumbs from './Breadcrumbs';

const Header = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    // --- ANIMATION VARIANTS ---

    // ANIMATION: Use clip-path for performance provided 'smooth' feel without layout thrashing
    const menuPanelVariants = {
        closed: {
            clipPath: "inset(0% 0% 100% 0%)",
            transition: { duration: 0.5, ease: [0.32, 0, 0.67, 0] }
        },
        open: {
            clipPath: "inset(0% 0% 0% 0%)",
            transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
        }
    };

    // No stagger - Instant Text
    const containerVariants = {
        open: {
            transition: {
                staggerChildren: 0,
                delayChildren: 0,
            }
        },
        closed: {
            transition: {
                staggerChildren: 0
            }
        }
    };

    // Item Reveal: Immediate (No animation)
    const itemVariants = {
        closed: {
            y: 0,
            opacity: 1,
            transition: { duration: 0 }
        },
        open: {
            y: 0,
            opacity: 1,
            transition: { duration: 0 }
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


                    {/* RIGHT: Breadcrumbs (replaces Contact) */}
                    <div className="nav-right">
                        <Breadcrumbs />
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
                            transition={{ duration: 0.3 }}
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
                            {/* 25/75 Grid - Full Width */}
                            <div className="menu-grid">

                                {/* LEFT PANEL: RED BLOCK with Credits */}
                                <div className="menu-panel left-panel">
                                    <div className="credits-text">
                                        This website is designed and developed by me with a lot of love and care.
                                        <br /><br />
                                        Super thankful to everyone who shared their feedback and ideas with me. Special thanks to Bharat, Aswin, Mehenaz, Sabya Bhai, and my wife, Yashaswinee.
                                    </div>
                                </div>

                                {/* RIGHT PANEL: WHITE - ALL BUTTONS */}
                                <motion.div className="menu-panel right-panel" variants={containerVariants}>
                                    <div className="panel-content">
                                        <div className="menu-columns">
                                            {/* COLUMN 1: DIRECTORY (Reordered) */}
                                            <div className="menu-col main-links">
                                                <div className="col-label">Directory</div>
                                                <MenuLink href="/research" variants={itemVariants}>Research</MenuLink>
                                                <MenuLink href="/photography" variants={itemVariants}>Photography</MenuLink>
                                                <MenuLink href="/films" variants={itemVariants}>Films</MenuLink>
                                                <MenuLink href="/blog" variants={itemVariants}>Blogs</MenuLink>
                                                <MenuLink href="https://read.cv/abodid" target="_blank" variants={itemVariants}>Resume</MenuLink>
                                                <MenuLink href="/about" variants={itemVariants}>About</MenuLink>
                                            </div>

                                            {/* COLUMN 2: MINDHUB */}
                                            <div className="menu-col mindhub-links">
                                                <div className="group" style={{ marginBottom: '3rem' }}>
                                                    <div className="col-label">MindHub</div>
                                                    <MenuLink href="/resources" variants={itemVariants} small>Resource Hub</MenuLink>
                                                    <MenuLink href="/research/second-brain" variants={itemVariants} small>Second Brain Club</MenuLink>
                                                    <MenuLink href="/fundraising" variants={itemVariants} small>Fundraising</MenuLink>
                                                    <MenuLink href="/press" variants={itemVariants} small>Press Mentions</MenuLink>
                                                    <MenuLink href="/testimonials" variants={itemVariants} small>Testimonials</MenuLink>
                                                </div>

                                                <div className="group">
                                                    <div className="col-label">Legal</div>
                                                    <MenuLink href="/privacy" variants={itemVariants} small>Privacy Policy</MenuLink>
                                                    <MenuLink href="/licensing" variants={itemVariants} small>Licensing</MenuLink>
                                                </div>
                                            </div>

                                            {/* COLUMN 3: CONTACT + SOCIALS */}
                                            <div className="menu-col contact-links">
                                                <div className="col-label">Contact</div>
                                                <div className="contact-details" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    <a href="mailto:hello@abodid.com" className="menu-text" style={{ fontSize: '1rem', textDecoration: 'none' }}>hello@abodid.com</a>
                                                    <a href="tel:+918295699650" className="menu-text" style={{ fontSize: '1rem', textDecoration: 'none' }}>+91 82956 99650</a>
                                                </div>

                                                <div className="col-label">Socials</div>
                                                <MenuLink href="https://www.instagram.com/abodid.sahoo" variants={itemVariants} small target="_blank">Instagram</MenuLink>
                                                <MenuLink href="https://uk.linkedin.com/in/abodidsahoo" variants={itemVariants} small target="_blank">LinkedIn</MenuLink>
                                                <MenuLink href="https://vimeo.com/abodidsahoo" variants={itemVariants} small target="_blank">Vimeo</MenuLink>
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
                .logo-text, .menu-btn {
                    mix-blend-mode: difference; /* Ensure visibility over menu */
                    z-index: 1100;
                }
                .menu-btn:hover, .nav-link:hover { opacity: 0.7; }

                /* MENU BACKDROP */
                .menu-backdrop {
                    position: fixed;
                    top: 80px;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    z-index: 850;
                    cursor: pointer;
                }

                /* MENU CONTAINER */
                .mega-menu {
                    position: fixed;
                    top: 0; /* Full height including behind nav */
                    left: 0;
                    width: 100%;
                    /* height set by animation */ 
                    background-color: transparent; 
                    overflow: hidden;
                    z-index: 900;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.2);
                    padding-top: 80px; /* Space for Nav */
                }

                .menu-grid { 
                    display: grid; 
                    grid-template-columns: 25% 75%; /* Tighter Left Panel */
                    height: 100%; 
                    width: 100%; 
                }

                /* PANELS */
                .menu-panel {
                    height: 100%;
                    padding: 4rem 4vw;
                    /* overflow-y: auto;  - removed to prevent double scrollbars if not needed, add back if content overflows */
                }

                /* LEFT PANEL: RED BLOCK */
                .left-panel {
                    background-color: #D00000; /* Vibrant Red */
                    border-right: 1px solid rgba(0,0,0,0.1);
                    display: flex;
                    flex-direction: column;
                }
                
                .credits-text {
                    font-family: 'Space Mono', monospace;
                    color: rgba(255,255,255,0.9);
                    font-size: 0.7rem;
                    line-height: 1.6;
                    max-width: 300px;
                }

                /* RIGHT PANEL: WHITE */
                .right-panel {
                    background-color: #F5F5F7;
                    color: #1a1a1a;
                    padding: 4rem 4vw 4rem 8vw; /* More space on left */
                }

                .panel-content {
                   /* width: 100%; */
                }
                
                .menu-columns { 
                    display: grid; 
                    grid-template-columns: 1.2fr 1fr 0.8fr; /* 3-Column Layout: Directory | MindHub | Socials */
                    gap: 4rem; 
                }
                
                .col-label {
                    font-family: 'Space Mono', monospace;
                    font-size: 0.75rem;
                    color: inherit;
                    opacity: 0.5;
                    text-transform: uppercase;
                    margin-bottom: 2rem;
                    border-bottom: 1px solid currentColor;
                    padding-bottom: 0.5rem;
                    width: 80%;
                }

                .menu-link-item {
                    display: block;
                    text-decoration: none;
                    margin-bottom: 0.5rem;
                    width: fit-content;
                }

                /* Text Styles */
                .menu-text {
                    font-family: 'Poppins', sans-serif;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    display: block;
                    color: inherit; /* Inherit from parent panel */
                }

                /* Normal (White Panel) Text */
                .right-panel .menu-text {
                    color: #1a1a1a;
                }
                .right-panel .menu-link-item:hover .menu-text {
                    color: #000;
                }

                .menu-text.major {
                    font-size: 2.5rem;
                    font-weight: 600;
                    letter-spacing: -0.02em;
                    line-height: 1.1;
                }

                .menu-text.small {
                    font-size: 1.0rem;
                    font-weight: 400;
                    color: #444; /* Slightly softer for small links */
                }

                /* .secondary-links removed, replaced by direct cols */

                @media (max-width: 768px) {
                    .menu-grid { grid-template-columns: 1fr; }
                    .left-panel { display: none; } /* Hide red block on mobile? */
                    .right-panel { padding-top: 2rem; }
                    .menu-columns { grid-template-columns: 1fr; gap: 3rem; }
                    .menu-text.major { font-size: 2rem; }
                }
            `}</style>
        </React.Fragment>
    );
};

const MenuLink = ({ children, href, variants, small, className, ...props }) => {
    return (
        <a href={href} className={className || "menu-link-item"} {...props}>
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

export default Header;
