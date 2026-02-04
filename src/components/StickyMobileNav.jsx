import React, { useEffect, useState } from 'react';

const StickyMobileNav = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Show after scrolling down 300px
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (!isVisible) return null;

    return (
        <div className="sticky-mobile-nav">
            <a href="/" className="nav-btn">
                <span>Home</span>
            </a>
            <div className="divider"></div>
            <a href="mailto:hello@abodid.com" className="nav-btn">
                <span>Contact</span>
            </a>

            <style>{`
                .sticky-mobile-nav {
                    position: fixed;
                    bottom: 2rem;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 100;
                    display: flex;
                    align-items: center;
                    background: rgba(10, 10, 10, 0.8);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 0.8rem 1.5rem;
                    border-radius: 100px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    gap: 1.5rem;
                    opacity: 0;
                    animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translate(-50%, 20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }

                .nav-btn {
                    color: white;
                    text-decoration: none;
                    font-family: 'Space Mono', monospace;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    opacity: 0.8;
                    transition: opacity 0.2s;
                }

                .nav-btn:hover {
                    opacity: 1;
                }

                .divider {
                    width: 1px;
                    height: 12px;
                    background: rgba(255, 255, 255, 0.2);
                }

                @media (min-width: 769px) {
                    .sticky-mobile-nav {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default StickyMobileNav;
