import React, { useEffect, useState } from 'react';

const ThemeToggle = () => {
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        // Initialize state from document or local storage
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        setTheme(currentTheme);

        // Observer to watch for attribute changes (if changed by other scripts)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    setTheme(document.documentElement.getAttribute('data-theme'));
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });

        return () => observer.disconnect();
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        setTheme(newTheme);
    };

    return (
        <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            <div className={`toggle-track ${theme}`}>
                <div className="toggle-thumb">
                    {/* Sun Icon (Visible in Light Mode) */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`icon sun-icon ${theme === 'light' ? 'visible' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                        <line x1="1" y1="12" x2="3" y2="12"></line>
                        <line x1="21" y1="12" x2="23" y2="12"></line>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>

                    {/* Moon Icon (Visible in Dark Mode) */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`icon moon-icon ${theme === 'dark' ? 'visible' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                </div>
            </div>
            <style jsx>{`
                .theme-toggle-btn {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    position: relative;
                    opacity: 0.9;
                    transition: opacity 0.2s ease;
                    z-index: 2000; /* FORCE CLICKABILITY */
                    pointer-events: auto;
                }
                .theme-toggle-btn:hover {
                    opacity: 1;
                }
                .toggle-track {
                    width: 44px;
                    height: 24px;
                    background-color: var(--border-subtle, #333);
                    border-radius: 12px;
                    position: relative;
                    transition: background-color 0.3s ease, border-color 0.3s ease;
                    border: 1px solid var(--border-strong, #555);
                }
                /* Light Mode Track Override based on props */
                .toggle-track.light {
                    background-color: #e0e0e0;
                    border-color: #ccc;
                }

                .toggle-thumb {
                    width: 20px;
                    height: 20px;
                    background-color: var(--text-primary, #fff);
                    border-radius: 50%;
                    position: absolute;
                    top: 1px;
                    left: 1px;
                    transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), background-color 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                    color: var(--bg-canvas, #000);
                }

                /* Move thumb in light mode */
                .toggle-track.light .toggle-thumb {
                    transform: translateX(20px);
                    background-color: #FDB813; /* Sun Yellow */
                    color: #fff;
                }
                
                .icon {
                    width: 12px;
                    height: 12px;
                    position: absolute;
                    opacity: 0;
                    transition: opacity 0.2s ease, transform 0.2s ease;
                }
                
                .icon.visible {
                    opacity: 1;
                }
                
                .sun-icon {
                    transform: rotate(-90deg) scale(0.5);
                }
                .sun-icon.visible {
                    transform: rotate(0) scale(1);
                }
                
                .moon-icon {
                    transform: rotate(90deg) scale(0.5);
                }
                .moon-icon.visible {
                    transform: rotate(0) scale(1);
                    fill: currentColor;
                }
            `}</style>
        </button>
    );
};

export default ThemeToggle;
