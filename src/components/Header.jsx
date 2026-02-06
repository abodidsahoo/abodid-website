import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Breadcrumbs from './Breadcrumbs';

const Header = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [showSecondary, setShowSecondary] = useState(false); // Mobile: Toggle for Secondary links

    const toggleMenu = () => {
        setIsOpen(!isOpen);
        if (!isOpen) setShowSecondary(false); // Reset on open
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
            y: "-100%", // Drop from Top
            x: "0%",
            opacity: 1, // Keep opacity 1 so it's a solid block moving
            transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } // Fast enter, slow land
        },
        open: {
            y: "0%",
            x: "0%",
            opacity: 1,
            transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
        }
    };

    const containerVariants = {
        // No staggering - "Pre-loaded" feel
        open: { transition: { staggerChildren: 0 } },
        closed: { transition: { staggerChildren: 0 } }
    };

    const itemVariants = {
        // No internal animation for items - they just move with the container
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
                        <a href="/" className="logo-text">
                            <span className="desktop-logo">ABODID</span>
                            <span className="mobile-logo">Abodid</span>
                        </a>
                    </div>

                    {/* CENTER: Menu Toggle */}
                    <div className="nav-center">
                        <button onClick={toggleMenu} className="menu-btn">
                            {isOpen ? 'CLOSE' : 'MENU'}
                        </button>
                    </div>

                    {/* RIGHT: Say Hi & Breadcrumbs (Desktop Only) */}
                    <div className="nav-right desktop-only-breadcrumbs">
                        <a href="/contact" className="say-hi-link">SAY HI</a>
                        <Breadcrumbs />
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
                            onClick={toggleMenu} // Clean close
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
                                {/* LEFT PANEL: RED BLOCK (Hidden on Mobile) */}
                                <div className="menu-panel left-panel">
                                    <div className="credits-text">
                                        This website is designed and developed by me with a lot of love and care.
                                        <br /><br />
                                        Super thankful to everyone who shared their feedback. Special thanks to Bharat, Aswin, Mehenaz, Sabya Bhai, and my wife, Yashaswinee.
                                    </div>
                                </div>

                                {/* RIGHT PANEL: LINKS (3 Cols on Desktop) */}
                                <motion.div className="menu-panel right-panel" variants={containerVariants}>

                                    {/* MOBILE HEADER (Inside Drawer) */}
                                    <div className="mobile-menu-header">
                                        <span className="menu-title">Menu</span>
                                        <button onClick={toggleMenu} className="close-icon-btn">×</button>
                                    </div>

                                    {/* COL 1: EXPLORE (Primary) */}
                                    <div className={`menu-section primary-section ${showSecondary ? 'hidden-mobile' : ''}`}>
                                        <div className="col-label">Explore</div>
                                        <MenuLink href="/blog" variants={itemVariants}>Blog</MenuLink>
                                        <MenuLink href="/about" variants={itemVariants}>About</MenuLink>
                                        <MenuLink href="/photography" variants={itemVariants}>Photography</MenuLink>
                                        <MenuLink href="/films" variants={itemVariants}>Films</MenuLink>
                                        <MenuLink href="/research" variants={itemVariants} select>Research</MenuLink>

                                        {/* Contact in Primary for Mobile ONLY */}
                                        <div className="mobile-contact mobile-only">
                                            <div className="col-label" style={{ marginTop: '2rem' }}>Contact</div>
                                            <a href="mailto:hello@abodid.com" className="contact-link">hello@abodid.com</a>
                                            <a href="tel:+919439094370" className="contact-link">+91 94390 94370</a>
                                            <a href="tel:+447522258768" className="contact-link">+44 7522 258768</a>
                                        </div>

                                        {/* Mobile Toggle Button */}
                                        <div className="mobile-only toggle-wrapper">
                                            <button
                                                className="secondary-toggle-btn"
                                                onClick={() => setShowSecondary(true)}
                                            >
                                                More Resources →
                                            </button>
                                        </div>
                                    </div>

                                    {/* COL 2: RESOURCES (Desktop Col 2, Mobile Toggle) */}
                                    <div className={`menu-section mindhub-links ${showSecondary ? 'active-mobile' : 'desktop-only'} mobile-hidden-default`}>
                                        {/* Mobile Back Button */}
                                        <div className="mobile-only toggle-wrapper">
                                            <a href="/" className="secondary-toggle-btn back-btn" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                                                ← Back to Home
                                            </a>
                                        </div>

                                        <div className="col-label">Resources</div>
                                        <MenuLink href="https://read.cv/abodid" target="_blank" variants={itemVariants} small>Resume</MenuLink>
                                        <MenuLink href="/research/second-brain" variants={itemVariants} small>Second Brain Club</MenuLink>
                                        <MenuLink href="/fundraising" variants={itemVariants} small>Fundraising</MenuLink>
                                        <MenuLink href="/press" variants={itemVariants} small>Press Mentions</MenuLink>
                                        <MenuLink href="/testimonials" variants={itemVariants} small>Testimonials</MenuLink>
                                        <MenuLink href="/privacy" variants={itemVariants} small>Privacy Policy</MenuLink>
                                        <MenuLink href="/licensing" variants={itemVariants} small>Licensing</MenuLink>
                                    </div>

                                    {/* COL 3: CONTACT & SOCIALS (Desktop Col 3, Mobile Hidden) */}
                                    <div className="menu-section contact-links desktop-only">
                                        <div className="col-label">Contact</div>
                                        <div className="contact-details" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <a href="mailto:hello@abodid.com" className="menu-text small">hello@abodid.com</a>
                                            <a href="tel:+919439094370" className="menu-text small">+91 94390 94370</a>
                                            <a href="tel:+447522258768" className="menu-text small">+44 7522 258768</a>
                                        </div>

                                        <div className="col-label">Socials</div>
                                        <MenuLink href="https://www.instagram.com/abodid.sahoo" variants={itemVariants} small target="_blank">Instagram</MenuLink>
                                        <MenuLink href="https://uk.linkedin.com/in/abodidsahoo" variants={itemVariants} small target="_blank">LinkedIn</MenuLink>
                                        <MenuLink href="https://vimeo.com/abodidsahoo" variants={itemVariants} small target="_blank">Vimeo</MenuLink>
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
                    position: fixed; top: 0; left: 0; width: 100%;
                    z-index: 1000;
                    background: rgba(5, 5, 5, 0.85);
                    backdrop-filter: blur(12px);
                    /* border-bottom removed to avoid double lines on mobile */
                }
                .nav-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    align-items: center;
                    height: 80px; /* Reduced from 120px as requested ("too huge") */
                    padding: 0 4vw;
                }
                .nav-center { display: flex; justify-content: center; }
                .nav-right { 
                    display: flex; 
                    align-items: center;
                    justify-content: flex-end;
                    gap: 2rem;
                    color: rgba(255, 255, 255, 0.9); /* Force white text on dark header */
                }
                
                .say-hi-link {
                    font-family: 'Space Mono', monospace;
                    font-size: 0.75rem;
                    color: white;
                    letter-spacing: 0.1em;
                    text-decoration: none;
                    border-bottom: 1px solid transparent;
                    transition: border-color 0.3s ease;
                    mix-blend-mode: difference;
                }

                .say-hi-link:hover {
                    border-bottom-color: white;
                }
                
                .mobile-breadcrumbs-row {
                    display: none; /* Hidden by default */
                    padding: 0.5rem 4vw 0.5rem; /* Tight top/bottom padding */
                    width: 100%;
                    background: rgba(5, 5, 5, 0.95); /* Slight distinction or match bg */
                    color: rgba(255, 255, 255, 0.9); /* Force white text */
                }

                /* LOGO VARIANTS */
                .desktop-logo { display: inline-block; }
                .mobile-logo { display: none; }

                @media (max-width: 768px) {
                    .desktop-only-breadcrumbs { 
                        display: none !important; 
                    }
                    .mobile-breadcrumbs-row { 
                        display: block;
                        padding: 0.5rem 4vw 0.5rem; 
                        width: 100%;
                        background: rgba(5, 5, 5, 0.95); 
                        color: rgba(255, 255, 255, 0.9); /* Force white text for visibility */
                    }
                    .nav-grid { 
                        height: 70px; /* Reduced mobile height */
                        grid-template-columns: auto 1fr auto; 
                        display: flex;
                        justify-content: space-between;
                        /* SEPARATOR LINE REQUESTED: White thin line always visible */
                        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                    }

                    /* Swap logos */
                    .desktop-logo { display: none; }
                    .mobile-logo { display: inline-block; font-weight: 700; text-transform: capitalize; } /* "Abodid" style */

                    /* REVERTED POSITIONS: Logo Left (Default Order), Menu Right */
                    .nav-left { order: 1; } /* Logo Left */
                    .nav-center { order: 2; justify-content: flex-end; } /* Menu Right */
                    .nav-right { display: none; } 
                    
                    /* Prominent styling */
                    .logo-text, .menu-btn {
                        font-size: 1.1rem; 
                        font-weight: 700;
                    }
                }

                .nav-border { width: 100%; height: 1px; background: rgba(255,255,255, 0.15); }
                .logo-text, .menu-btn {
                    font-family: 'Space Mono', monospace;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    color: white;
                    background: none; border: none; cursor: pointer;
                    letter-spacing: 0.05em;
                    mix-blend-mode: difference;
                    z-index: 1100;
                    text-decoration: none;
                }

                /* BACKDROP */
                .menu-backdrop {
                    position: fixed; top: 0; left: 0;
                    width: 100vw; height: 100vh;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 850;
                }

                /* DRAWER CONTAINER */
                .mega-menu {
                    position: fixed;
                    top: 0; right: 0; 
                    width: 100%; max-width: 100%; 
                    height: auto; /* REDUCED HEIGHT: Not full page */
                    max-height: 90vh; /* Cap it so bottom is visible */
                    background-color: transparent;
                    z-index: 900;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5); /* Stronger shadow since it floats */
                    overflow-y: auto;
                    border-bottom-left-radius: 16px;
                    border-bottom-right-radius: 16px;
                }

                .menu-inner {
                    display: grid;
                    /* DESKTOP 3-COLUMN STRUCTURE: 
                       Col 1: Red (Left Panel) - 25% or fixed width
                       Col 2 & 3: White (Right Panel) - Auto
                    */
                    grid-template-columns: 25% 75%;
                    height: 100%;
                    min-height: auto; /* Remove 100vh enforcement */
                }

                .menu-panel { padding: 150px 4vw 4rem; height: 100%; } /* Increased top padding to clear header completely */

                /* LEFT PANEL: RED (Column 1) */
                .left-panel {
                    background-color: #D00000;
                    border-right: 1px solid rgba(0,0,0,0.1);
                    display: flex; flex-direction: column;
                }
                .credits-text {
                    font-family: 'Space Mono', monospace;
                    color: rgba(255,255,255,0.9);
                    font-size: 0.7rem; line-height: 1.6; max-width: 300px;
                }

                /* RIGHT PANEL: WHITE (Columns 2, 3, 4) */
                .right-panel {
                    background-color: #F5F5F7;
                    color: #1a1a1a;
                    display: grid; 
                    /* 3 Columns in Right Panel: Explore | Resources | Contact+Socials */
                    grid-template-columns: 1fr 1fr 1fr; 
                    gap: 2rem;
                    align-content: start; 
                }
                
                /* Column Wrappers */
                .menu-section { display: flex; flex-direction: column; gap: 0.5rem; }
                
                /* Resources Group (Col 2) */
                .mindhub-links { display: flex; flex-direction: column; gap: 0.5rem; }
                
                /* Contact Group (Col 3) */
                .contact-links { display: flex; flex-direction: column; gap: 0.5rem; }

                /* Mobile Elements Hidden by Default on Desktop */
                .mobile-menu-header, .mobile-only { display: none; }
                
                .col-label {
                    font-family: 'Space Mono', monospace;
                    font-size: 0.75rem; color: inherit; opacity: 0.5;
                    text-transform: uppercase; margin-bottom: 2rem;
                    border-bottom: 1px solid currentColor; padding-bottom: 0.5rem;
                    width: 80%;
                }
                
                .menu-link-item { display: block; text-decoration: none; margin-bottom: 0.5rem; width: fit-content; }
                .menu-text {
                    font-family: 'Poppins', sans-serif; font-weight: 500;
                    transition: all 0.3s ease; display: block; color: #1a1a1a;
                }
                .menu-text.major { font-size: 2rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; } /* Reduced size slightly for density */
                .menu-text.small { font-size: 1.0rem; font-weight: 400; color: #444; }
                /* REMOVED CSS HOVER: Handled by Framer Motion now */
                /* .menu-link-item:hover .menu-text { color: #000; transform: translateX(5px); } */

                /* TABLET / MOBILE STYLES */
                @media (max-width: 1024px) {
                    /* ... (rest of styles remain same) ... */
                    .mega-menu { max-width: 100%; }
                    
                    /* STACK LAYOUT: White (Links) on TOP, Red (Credits) on BOTTOM */
                    .menu-inner { 
                        display: flex;
                        flex-direction: column-reverse; 
                    }

                    /* Red Panel - Visible on Tablet/Mobile now, at bottom */
                    .left-panel {
                        display: flex;
                        width: 100%;
                        height: auto;
                        padding: 4rem 5vw;
                        border-right: none;
                        border-top: 1px solid rgba(0,0,0,0.1);
                    }
                    
                    .right-panel { 
                        display: flex; 
                        flex-direction: column; 
                        padding: 2rem 5vw 4rem; 
                        width: 100%;
                        height: auto; 
                        gap: 2rem;
                    }
                    
                    /* Reset Grid Items for Flex Layout on Mobile */
                    .mindhub-links, .contact-links, .menu-section {
                        width: 100%;
                    }
                    
                    /* Mobile Header within Drawer */
                    .mobile-menu-header {
                         display: flex; justify-content: space-between; align-items: center;
                         margin-bottom: 2rem; padding-bottom: 1rem;
                         border-bottom: 1px solid rgba(0,0,0,0.1);
                    }
                    .menu-title { font-size: 1.5rem; font-weight: 700; color: #1a1a1a; }
                    .close-icon-btn {
                        background: none; border: none; font-size: 2rem; color: #1a1a1a;
                    }

                    .mobile-only { display: block; }
                    .desktop-only { display: none; }

                    /* Button Styles */
                    .secondary-toggle-btn {
                        background: none; border: 1px solid #1a1a1a;
                        padding: 1rem 1.5rem; width: 100%;
                        text-align: left; font-family: 'Space Mono', monospace;
                        text-transform: uppercase; margin-top: 2rem; cursor: pointer;
                        display: flex; justify-content: space-between;
                        transition: all 0.2s ease;
                    }
                    .secondary-toggle-btn:hover { background: #1a1a1a; color: white; }

                    /* Mobile Toggling Logic */
                    .hidden-mobile { display: none; }
                    .active-mobile { display: block; animation: fadeIn 0.3s ease; }
                    
                    .desktop-grid-wrapper { display: flex; flex-direction: column; gap: 2rem; }
                    
                    .menu-text.major { font-size: 2rem; }
                    
                    /* Contact Links on Mobile */
                    .contact-link {
                        display: block; font-size: 1.1rem; color: #1a1a1a;
                        text-decoration: none; margin-bottom: 0.5rem;
                    }
                    
                    .mobile-hidden-default { display: none; }
                    .mobile-hidden-default.active-mobile { display: block; }
                }
                
                @media (min-width: 1025px) {
                   .primary-section, .secondary-section { 
                       display: flex; 
                       height: auto;
                   }
                   .mobile-hidden-default { display: flex; /* Show Resources col on Desktop */ }
                }

                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
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
                initial="closed" // Ensure base state
                // Force fast transition for ALL state changes, including return from hover
                transition={{ duration: 0.1, ease: "easeOut" }}
                whileHover={{
                    x: 15, // Fast X-axis shift right (Requested: "quick X-axis movement")
                    color: "#000000", // Highlight to pure black (or darker)
                }}
            >
                {children}
            </motion.span>
        </a>
    );
};

export default Header;
