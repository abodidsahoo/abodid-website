import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Breadcrumbs from './Breadcrumbs';

const Header = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    // Lock body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // --- ANIMATION VARIANTS ---
    const menuPanelVariants = {
        closed: {
            y: "-100%",
            opacity: 1,
            transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } // Faster close
        },
        open: {
            y: "0%",
            opacity: 1,
            transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } // Faster open
        }
    };

    const containerVariants = {
        open: { transition: { staggerChildren: 0 } },
        closed: { transition: { staggerChildren: 0 } }
    };

    const itemVariants = {
        closed: { x: 0, opacity: 1 },
        open: { x: 0, opacity: 1 }
    };

    return (
        <React.Fragment>
            {/* FIXED NAV */}
            <div className="fixed-nav">
                <div className="nav-grid">
                    {/* LEFT: Logo */}
                    <div className="nav-left">
                        <a href="/" className="logo-image-link" aria-label="Abodid Home">
                            <img src="/images/signature-white.png" alt="Signature" className="header-logo-img" />
                        </a>
                    </div>

                    {/* CENTER: Empty (was Menu) */}
                    <div className="nav-center">
                        {/* Spacer or empty */}
                    </div>

                    {/* RIGHT: Menu Toggle & Breadcrumbs */}
                    <div className="nav-right">
                        <div className="desktop-breadcrumbs">
                            <Breadcrumbs />
                        </div>
                        <button onClick={toggleMenu} className="menu-btn">
                            <span>{isOpen ? 'CLOSE' : 'MENU'}</span>
                        </button>
                    </div>
                </div>

                {/* MOBILE BREADCRUMBS ROW */}
                <div className="mobile-breadcrumbs-row">
                    <Breadcrumbs />
                </div>
            </div>

            {/* --- DRAWER MENU --- */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* BACKDROP */}
                        <motion.div
                            className="menu-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            onClick={toggleMenu}
                        />

                        {/* DRAWER PANEL */}
                        <motion.div
                            className="mega-menu"
                            initial="closed"
                            animate="open"
                            exit="closed"
                            variants={menuPanelVariants}
                        >
                            <div className="menu-inner">
                                {/* 
                                    PANEL 1: RED (MAIN MENU) (~40%)
                                    UPDATED: MAtch Header Red
                                */}
                                <motion.div className="menu-panel left-panel" variants={containerVariants}>
                                    <div className="dominant-links-wrapper">
                                        <MenuLink href="/research" variants={itemVariants} className="dominant-link">Research</MenuLink>
                                        <MenuLink href="/photography" variants={itemVariants} className="dominant-link">Photography</MenuLink>
                                        <MenuLink href="/films" variants={itemVariants} className="dominant-link">Filmmaking</MenuLink>
                                        <MenuLink href="/blog" variants={itemVariants} className="dominant-link">Writing</MenuLink>
                                        <MenuLink href="/about" variants={itemVariants} className="dominant-link">About Me</MenuLink>
                                    </div>
                                </motion.div>

                                {/* 
                                    PANEL 2: WHITE (SECONDARY) (~60%)
                                */}
                                <div className="menu-panel right-panel">
                                    <div className="secondary-columns-container">

                                        {/* COL 1: Resources -> Work -> Credentials */}
                                        <div className="secondary-col">
                                            {/* Resources */}
                                            <div className="sidebar-block">
                                                <div className="mono-label">Resources</div>
                                                <MenuLink href="/resources" variants={itemVariants} className="mono-link">Curated Resources Mega Vault</MenuLink>
                                                <MenuLink href="/research/visual-moodboard" variants={itemVariants} className="mono-link">Visual Moodboard</MenuLink>
                                                <MenuLink href="/research/obsidian-vault" variants={itemVariants} className="mono-link">Personal Notes (Obsidian Vault)</MenuLink>
                                                <MenuLink href="/research/second-brain" variants={itemVariants} className="mono-link">Second Brain Club Membership</MenuLink>
                                            </div>

                                            {/* Work With Me */}
                                            <div className="sidebar-block">
                                                <div className="mono-label">Work With Me</div>
                                                <MenuLink href="/services" variants={itemVariants} className="mono-link">Services</MenuLink>
                                                <MenuLink href="/fundraising" variants={itemVariants} className="mono-link">Sponsorship</MenuLink>
                                            </div>

                                            {/* Credentials */}
                                            <div className="sidebar-block">
                                                <div className="mono-label">Credentials</div>
                                                <MenuLink href="/awards" variants={itemVariants} className="mono-link">Awards</MenuLink>
                                                <MenuLink href="/experience" variants={itemVariants} className="mono-link">Experience</MenuLink>
                                                <MenuLink href="/press" variants={itemVariants} className="mono-link">Press</MenuLink>

                                                <MenuLink href="https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/cv/Abodid%20Sahoo%20-%20Photography%20&%20AI%20-%20CV.pdf" target="_blank" variants={itemVariants} className="mono-link">CV</MenuLink>
                                            </div>
                                        </div>

                                        {/* COL 2: Contact & Socials */}
                                        <div className="secondary-col">
                                            {/* Contact */}
                                            <div className="sidebar-block">
                                                <div className="mono-label">Contact</div>
                                                <a href="mailto:hello@abodid.com" className="mono-text-link">hello@abodid.com</a>
                                                <a href="tel:+919439094370" className="mono-text-link">+91 94390 94370 <span className="country-label">(IN)</span></a>
                                                <a href="tel:+447522258768" className="mono-text-link">+44 7522 258768 <span className="country-label">(UK)</span></a>
                                            </div>

                                            {/* Socials - VERTICAL STACK */}
                                            <div className="sidebar-block">
                                                <div className="mono-label">Socials</div>
                                                <div className="social-stack">
                                                    <MenuLink href="https://www.instagram.com/abodid.sahoo" target="_blank" variants={itemVariants} className="mono-link">Instagram</MenuLink>
                                                    <MenuLink href="https://uk.linkedin.com/in/abodidsahoo" target="_blank" variants={itemVariants} className="mono-link">LinkedIn</MenuLink>
                                                    <MenuLink href="https://vimeo.com/abodidsahoo" target="_blank" variants={itemVariants} className="mono-link">Vimeo</MenuLink>
                                                    <MenuLink href="https://github.com/abodidsahoo" target="_blank" variants={itemVariants} className="mono-link">GitHub</MenuLink>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <style>{`
                /* FIXED NAV */
                .fixed-nav {
                    position: fixed; top: 0; left: 0; width: 100%;
                    z-index: 10005; /* Highest Priority */
                    background: rgba(0, 0, 0, 0.92);
                    backdrop-filter: blur(12px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.18);
                }
                .nav-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    align-items: center;
                    height: 80px;
                    padding: 0 4vw;
                }
                .nav-center { display: flex; justify-content: center; }
                .nav-right { 
                    display: flex; align-items: center; justify-content: flex-end;
                    gap: 2rem;
                    color: rgba(255, 255, 255, 0.9);
                }
                
                /* REMOVED .say-hi-link */
                
                .mobile-breadcrumbs-row {
                    display: none; padding: 0.5rem 4vw 0.5rem; width: 100%;
                    background: rgba(0, 0, 0, 0.95); color: rgba(255, 255, 255, 0.95);
                }

                .logo-image-link {
                    display: block;
                    position: relative; /* Ensure z-index works */
                    z-index: 1100;
                    width: fit-content;
                    opacity: 0.9;
                }
                
                .header-logo-img {
                    height: 50px; /* Adjust this value to change logo size */
                    width: auto;
                    display: block;
                    filter: brightness(1.2); /* Ensure white pops */
                }

                .nav-border { width: 100%; height: 1px; background: rgba(255,255,255, 0.15); }
                .menu-btn {
                    font-family: 'Space Mono', monospace; font-size: 0.9rem; text-transform: uppercase;
                    color: white; background: none; border: none; cursor: pointer;
                    letter-spacing: 0.05em; mix-blend-mode: difference; z-index: 1100; text-decoration: none;
                    display: block; /* Ensure it's block-level for visibility check */
                }

                /* BACKDROP */
                .menu-backdrop {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); 
                    z-index: 10000; /* Below Header + Menu */
                }

                /* DRAWER CONTAINER */
                .mega-menu {
                    position: fixed; top: 0; right: 0; 
                    width: 100%; height: auto; max-height: 90vh;
                    background-color: transparent; 
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5); overflow-y: auto;
                    z-index: 10001; /* Above Backdrop, Below Header (Header is 10005) */
                    top: 80px; /* Below header */
                }

                .menu-inner {
                    display: grid;
                    /* 2-PANEL LAYOUT: 40% Red | 60% White */
                    grid-template-columns: 40% 60%;
                    height: 100%;
                }

                /* --- PANEL COMMON STYLES --- */
                .menu-panel { padding: 80px 3vw 4rem; height: 100%; } /* Reduced top padding since it's below header now? Or stick with full overlay? */
                /* Let's keep it sticking to header */

                /* --- PANEL 1: RED (LEFT) --- */
                .left-panel {
                    background-color: #a30021;
                    color: white;
                    display: flex; flex-direction: column;
                    justify-content: flex-start;
                    padding-left: 8vw; 
                    padding-right: 2vw; 
                }

                /* DOMINANT LINKS */
                .dominant-links-wrapper {
                    display: flex; flex-direction: column; 
                    gap: 0.5rem;
                }

                .dominant-link {
                    display: block; text-decoration: none; line-height: 1.1; 
                }

                .dominant-link .menu-text {
                    font-family: 'Poppins', sans-serif;
                    font-weight: 600; 
                    font-size: 3.5rem; 
                    color: white; 
                    letter-spacing: -0.02em;
                }

                /* --- PANEL 2: WHITE (RIGHT) --- */
                .right-panel {
                    background-color: #f5f5f5;
                    display: block;
                    padding-left: 5vw;
                }

                .secondary-columns-container {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 3rem; 
                    width: 100%;
                }
                
                .secondary-col {
                    display: flex; flex-direction: column; 
                    gap: 3rem; /* Block Gap */
                }

                /* SECONDARY LINKS */
                .sidebar-block { 
                    display: flex; flex-direction: column; 
                    gap: 0.15rem; /* REDUCED line-to-line spacing (Verified Request) */
                }

                .mono-label {
                    font-family: 'Inconsolata', monospace; 
                    font-size: 1.1rem; 
                    font-weight: 800; 
                    color: #1a1a1a; 
                    letter-spacing: 0.05em; /* REDUCED letter-spacing (Verified Request) */
                    text-transform: uppercase; 
                    margin-bottom: 0.5rem; /* Reduced bottom margin */
                }

                .mono-link { text-decoration: none; display: block; width: fit-content; }

                .mono-link .menu-text, .mono-text-link {
                    font-family: 'Inconsolata', monospace; 
                    font-size: 0.9rem;
                    color: #444;
                    text-decoration: none;
                }
                
                .mono-link:hover .menu-text, .mono-text-link:hover {
                    opacity: 0.6; color: #a30021;
                }

                .country-label {
                    opacity: 0.5; font-size: 0.9em; margin-left: 0.5rem;
                }
                
                /* SOCIAL STACK (Vertical) */
                .social-stack {
                    display: flex; flex-direction: column; gap: 0.15rem; /* Reduced gap */
                }


                /* MOBILE */
                @media (max-width: 1024px) {
                    .mega-menu { height: 100vh; }
                    .menu-inner { display: flex; flex-direction: column; }

                    .left-panel {
                        padding: 120px 5vw 2rem;
                        flex: none;
                    }
                    
                    .right-panel {
                        padding: 2rem 5vw 4rem;
                        background: #f5f5f5;
                        flex: 1;
                    }

                    .secondary-columns-container {
                        grid-template-columns: 1fr;
                        gap: 2rem;
                    }
                    
                    .dominant-link .menu-text { font-size: 2.5rem; }
                }

                @media (max-width: 768px) {
                     .desktop-breadcrumbs { display: none !important; }
                     .mobile-breadcrumbs-row { display: block; }
                     .nav-grid { height: 70px; grid-template-columns: auto 1fr auto; display: flex; justify-content: space-between; }
                     
                     .nav-left { order: 1; }
                     .nav-center { order: 2; justify-content: flex-end; }
                     .nav-right { display: flex; order: 3; } 
                     .menu-btn { font-size: 1.1rem; font-weight: 700; }
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
                initial="closed"
                // FORCE INLINE-BLOCK FOR TRANSFORM TO WORK
                style={{ display: 'inline-block' }}
                // SNAPPY MOVEMENT (Not instant, but very fast)
                transition={{ duration: 0.05, ease: "easeOut" }}
                whileHover={{
                    x: 10,
                    // No Color Change requested
                }}
            >
                {children}
            </motion.span>
        </a>
    );
};

export default Header;
