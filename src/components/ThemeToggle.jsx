import React, { useEffect, useState } from 'react';

const ThemeToggle = ({ variant = 'rail' }) => {
    const [theme, setTheme] = useState('dark');
    const toggleClassName =
        variant === 'compact'
            ? `rail-theme-toggle rail-theme-toggle-compact ${theme}`
            : `rail-theme-toggle ${theme}`;

    useEffect(() => {
        // Initialize state from document or local storage
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        setTheme(currentTheme);
        document.documentElement.style.colorScheme = currentTheme;

        // Observer to watch for attribute changes (if changed by other scripts)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    const updatedTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                    setTheme(updatedTheme);
                    document.documentElement.style.colorScheme = updatedTheme;
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });

        return () => observer.disconnect();
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        document.documentElement.style.colorScheme = newTheme;
        localStorage.setItem('theme', newTheme);
        setTheme(newTheme);
    };

    return (
        <>
            <button
                className={toggleClassName}
                aria-label={`Current mode: ${theme}`}
                title="Toggle Website Theme"
                onClick={toggleTheme}
            >
                <div className="rail-toggle-slider"></div>
                <div className="rail-toggle-icons">
                    {/* Sun Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="rail-icon rail-sun-icon">
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
                    {/* Moon Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="rail-icon rail-moon-icon">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                </div>
            </button>
            <style>{`
                .rail-theme-toggle {
                    box-sizing: border-box;
                    background: transparent;
                    border: 2.5px solid rgba(255, 255, 255, 0.6);
                    cursor: pointer;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    position: relative;
                    width: 34px; /* Matches hamburger-line 34px */
                    height: 64px;
                    border-radius: 34px;
                    transition: all 0.4s cubic-bezier(0.85, 0, 0.15, 1);
                    z-index: 2000;
                    pointer-events: auto;
                }

                .rail-theme-toggle.light {
                    border: 3px solid rgba(0, 0, 0, 0.3);
                }

                .rail-toggle-slider {
                    position: absolute;
                    top: 2px;
                    left: 50%;
                    width: 24px;
                    height: 24px;
                    background: #ffffff;
                    border-radius: 50%;
                    transition: transform 0.4s cubic-bezier(0.85, 0, 0.15, 1), background 0.4s ease;
                    z-index: 1;
                }

                .rail-theme-toggle.dark .rail-toggle-slider {
                    transform: translateX(-50%) translateY(30px);
                    background: #ffffff;
                }

                .rail-theme-toggle.light .rail-toggle-slider {
                    transform: translateX(-50%) translateY(0);
                    background: #111111;
                }

                .rail-toggle-icons {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    padding: 7px 0;
                    z-index: 0;
                    pointer-events: none;
                }

                .rail-icon {
                    width: 14px;
                    height: 14px;
                    transition: opacity 0.4s ease, color 0.4s ease;
                }

                .rail-theme-toggle.dark .rail-sun-icon {
                    opacity: 1;
                    color: rgba(255, 255, 255, 0.6);
                }
                .rail-theme-toggle.dark .rail-moon-icon {
                    opacity: 0;
                }

                .rail-theme-toggle.light .rail-sun-icon {
                    opacity: 0;
                }
                .rail-theme-toggle.light .rail-moon-icon {
                    opacity: 1;
                    color: rgba(0, 0, 0, 0.6);
                }

                .rail-theme-toggle:hover {
                    opacity: 0.8;
                }

                .rail-theme-toggle-compact {
                    width: 54px;
                    height: 30px;
                    border-width: 1.5px;
                    border-radius: 999px;
                }

                .rail-theme-toggle-compact .rail-toggle-slider {
                    top: 50%;
                    left: 3px;
                    width: 20px;
                    height: 20px;
                    transform: translateY(-50%);
                }

                .rail-theme-toggle-compact.dark .rail-toggle-slider {
                    transform: translate(27px, -50%);
                }

                .rail-theme-toggle-compact.light .rail-toggle-slider {
                    transform: translate(0, -50%);
                }

                .rail-theme-toggle-compact .rail-toggle-icons {
                    flex-direction: row;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 7px;
                }

                .rail-theme-toggle-compact .rail-icon {
                    width: 11px;
                    height: 11px;
                }

                .rail-theme-toggle-compact.dark .rail-sun-icon,
                .rail-theme-toggle-compact.light .rail-moon-icon {
                    opacity: 1;
                }

                .rail-theme-toggle-compact.dark .rail-moon-icon,
                .rail-theme-toggle-compact.light .rail-sun-icon {
                    opacity: 0.35;
                }

                @media (max-width: 768px) {
                    .rail-theme-toggle {
                        width: 28px; /* Matches hamburger-line 28px on mobile */
                        height: 52px;
                    }
                    .rail-toggle-slider {
                        top: 1.5px;
                        width: 19px;
                        height: 19px;
                    }
                    .rail-theme-toggle.dark .rail-toggle-slider {
                        transform: translateX(-50%) translateY(24px);
                    }
                    .rail-toggle-icons {
                        padding: 5px 0;
                    }
                    .rail-icon {
                        width: 12px;
                        height: 12px;
                    }

                    .rail-theme-toggle-compact {
                        width: 50px;
                        height: 28px;
                    }

                    .rail-theme-toggle-compact .rail-toggle-slider {
                        width: 18px;
                        height: 18px;
                    }

                    .rail-theme-toggle-compact.dark .rail-toggle-slider {
                        transform: translate(25px, -50%);
                    }
                }
            `}</style>
        </>
    );
};

export default ThemeToggle;
