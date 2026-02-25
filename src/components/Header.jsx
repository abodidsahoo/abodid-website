import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Breadcrumbs from './Breadcrumbs';
import ThemeToggle from './ThemeToggle.jsx';

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

                    {/* CENTER: Breadcrumbs (restored) */}
                    <div className="nav-center">
                        <Breadcrumbs variant="header" />
                    </div>

                    {/* RIGHT: Menu Toggle & Breadcrumbs */}
                    <div className="nav-right">
                        <ThemeToggle />
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
                                                <MenuLink href="/moodboard" variants={itemVariants} className="mono-link">Visual Moodboard</MenuLink>
                                                <MenuLink href="/photography-portfolio" variants={itemVariants} className="mono-link">Photography Portfolio</MenuLink>
                                                <MenuLink href="/research/obsidian-vault" variants={itemVariants} className="mono-link">Personal Notes (Obsidian Vault)</MenuLink>
                                                <MenuLink href="/research/second-brain" variants={itemVariants} className="mono-link">Second Brain Club Membership</MenuLink>
                                            </div>

                                            {/* Work With Me */}
                                            <div className="sidebar-block">
                                                <div className="mono-label">Work With Me</div>
                                                <MenuLink href="/services" variants={itemVariants} className="mono-link">Services</MenuLink>
                                                <MenuLink href="/fundraising" variants={itemVariants} className="mono-link">Fundraising</MenuLink>
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
                    background: var(--nav-bg);
                    backdrop-filter: blur(12px);
                    border-bottom: 1px solid var(--nav-border);
                    transition: background 0.3s ease, border-color 0.3s ease;
                    color: var(--nav-text); /* Enforce text color from theme, override body */
                }
                .nav-grid {
                    display: flex; /* Switch to Flex for simpler Left/Right push */
                    justify-content: space-between;
                    align-items: center;
                    height: 80px;
                    padding: 0 4vw;
                    width: 100%;
                }
                /* Restored Grid/Flex Layout */
                .nav-center { 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    flex: 1; /* Take up remaining space */
                } 
                
                .nav-left {
                    display: flex; 
                    align-items: center; 
                    height: 100%;
                    flex: 0 0 auto; /* Do not shrink */
                }
                .nav-right { 
                    display: flex; 
                    align-items: center; 
                    gap: 1.5rem; 
                    height: 100%;
                    /* color: var(--nav-text);  Removed redundant */
                    flex: 0 0 auto; /* Do not shrink */
                }
                
                .mobile-breadcrumbs-row {
                    display: none; padding: 0.5rem 4vw 0.5rem; width: 100%;
                    background: var(--nav-bg);
                    color: var(--nav-text);
                    border-bottom: 1px solid var(--nav-border);
                }

                .logo-image-link {
                    display: flex; /* Flex here too */
                    align-items: center;
                    position: relative; 
                    z-index: 1100;
                    width: auto;
                    height: 100%; /* Match parent height */
                    opacity: 0.9;
                }
                
                .header-logo-img {
                    height: 62px !important; /* FIXED HEIGHT */
                    width: auto;
                    display: block;
                    filter: brightness(1.2); 
                    object-fit: contain;
                }

                .nav-border { width: 100%; height: 1px; background: rgba(255,255,255, 0.15); }
                .menu-btn {
                    font-family: var(--font-ui); font-size: 0.9rem; text-transform: uppercase;
                    color: var(--nav-text); 
                    background: none; border: none; cursor: pointer;
                    letter-spacing: 0.05em; 
                    z-index: 1100; text-decoration: none;
                    display: block; 
                    /* Removed mix-blend-mode difference to avoid color conflicts in light mode */
                }

                /* BACKDROP */
                .menu-backdrop {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); 
                    z-index: 10000; 
                }

                /* DRAWER CONTAINER */
                .mega-menu {
                    position: fixed; top: 0; right: 0; 
                    width: 100%; height: auto; max-height: 90vh;
                    background-color: transparent; 
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5); overflow-y: auto;
                    z-index: 10001; 
                    top: 80px; 
                }

                .menu-inner {
                    display: grid;
                    grid-template-columns: 60% 40%;
                    height: 100%;
                }

                /* --- PANEL COMMON STYLES --- */
                .menu-panel { padding: 80px 3vw 4rem; height: 100%; } 

                /* --- PANEL 1: RED (RIGHT ON DESKTOP) --- */
                .left-panel {
                    background-color: var(--color-brand-red);
                    color: white;
                    display: flex; flex-direction: column;
                    justify-content: flex-start;
                    padding-left: 4vw; 
                    padding-right: 6vw; 
                    order: 2;
                }

                /* DOMINANT LINKS */
                .dominant-links-wrapper {
                    display: flex; flex-direction: column; 
                    gap: 1.5rem; /* Increased spacing */
                }

                .dominant-link {
                    display: block; text-decoration: none; line-height: 1.1; 
                }

                .dominant-link .menu-text {
                    font-family: var(--font-display);
                    font-weight: 700; 
                    font-size: 3.5rem; /* Reduced from 5.5rem for better balance */
                    color: white; 
                    letter-spacing: -0.03em;
                    transition: all 0.2s ease;
                }

                /* --- PANEL 2: WHITE (LEFT ON DESKTOP) --- */
                .right-panel {
                    background-color: #f5f5f5;
                    display: block;
                    padding-left: clamp(2.5rem, 5.5vw, 6rem);
                    padding-right: clamp(1.5rem, 2.2vw, 2.75rem);
                    order: 1;
                }

                .secondary-columns-container {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: clamp(1.5rem, 2.4vw, 2.5rem); 
                    width: 100%;
                }
                
                .secondary-col {
                    display: flex; flex-direction: column; 
                    gap: 3rem; 
                }

                /* SECONDARY LINKS */
                .sidebar-block { 
                    display: flex; flex-direction: column; 
                    gap: 0.15rem; 
                }

                .mono-label {
                    font-family: var(--font-mono); 
                    font-size: 1.1rem; 
                    font-weight: 800; 
                    color: #1a1a1a; 
                    letter-spacing: 0.05em; 
                    text-transform: uppercase; 
                    margin-bottom: 0.5rem; 
                }

                .mono-link { text-decoration: none; display: block; width: fit-content; }

                .mono-link .menu-text, .mono-text-link {
                    font-family: var(--font-mono); 
                    font-size: 0.9rem;
                    color: #444;
                    text-decoration: none;
                }
                
                .mono-link:hover .menu-text, .mono-text-link:hover {
                    opacity: 0.6; color: var(--color-brand-red);
                }

                .country-label {
                    opacity: 0.5; font-size: 0.9em; margin-left: 0.5rem;
                }
                
                /* SOCIAL STACK (Vertical) */
                .social-stack {
                    display: flex; flex-direction: column; gap: 0.15rem; 
                }


                /* MOBILE */
                @media (max-width: 1024px) {
                    .mega-menu { height: 100vh; }
                    .menu-inner { display: flex; flex-direction: column; }

                    .left-panel {
                        padding: 120px 5vw 2rem;
                        flex: none;
                        order: 1;
                    }
                    
                    .right-panel {
                        padding: 2rem 5vw 4rem;
                        background: #f5f5f5;
                        flex: 1;
                        order: 2;
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
                     .nav-center { display: none; }
                     .nav-right { display: flex; order: 3; } 
                     .menu-btn { font-size: 1.1rem; font-weight: 700; }
                }

                /* LIGHT MODE LOGO INVERSION HANDLED IN GLOBAL.CSS */
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
