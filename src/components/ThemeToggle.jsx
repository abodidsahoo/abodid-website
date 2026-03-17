import React, { useEffect, useState } from 'react';

const ThemeToggle = () => {
    const [theme, setTheme] = useState('dark');

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
                className={`elegant-theme-toggle ${theme}`}
                aria-label={`Current mode: ${theme}`}
                title="Toggle Website Theme"
                onClick={toggleTheme}
            >
                <div className="toggle-slider"></div>
                <span className="toggle-label light-label">
                    LIGHT
                </span>
                <span className="toggle-label dark-label">
                    DARK
                </span>
            </button>
            <style>{`
                .elegant-theme-toggle {
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    cursor: pointer;
                    padding: 4px;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    position: relative;
                    width: 110px;
                    height: 36px;
                    border-radius: 40px;
                    transition: all 0.4s cubic-bezier(0.85, 0, 0.15, 1);
                    z-index: 2000;
                    pointer-events: auto;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                }

                .elegant-theme-toggle.light {
                    background: rgba(255, 255, 255, 0.7);
                    border: 1px solid rgba(0, 0, 0, 0.1);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                }

                .toggle-slider {
                    position: absolute;
                    top: 4px;
                    left: 4px;
                    width: calc(50% - 4px);
                    height: 26px;
                    background: #ffffff;
                    border-radius: 40px;
                    transition: transform 0.4s cubic-bezier(0.85, 0, 0.15, 1), background 0.4s ease;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    z-index: 1;
                }

                /* In DARK mode, the slider should be on the DARK label (right side) */
                .elegant-theme-toggle.dark .toggle-slider {
                    transform: translateX(100%);
                    background: #222222;
                }
                
                /* In LIGHT mode, the slider should be on the LIGHT label (left side) */
                .elegant-theme-toggle.light .toggle-slider {
                    transform: translateX(0);
                    background: #ffffff;
                }

                .toggle-label {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    font-family: var(--font-ui, 'Inter', sans-serif);
                    font-size: 0.65rem;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    z-index: 2;
                    transition: color 0.4s ease;
                    user-select: none;
                    background: none;
                    border: none;
                    cursor: pointer;
                    height: 100%;
                    outline: none;
                    padding: 0;
                    margin: 0;
                }

                /* In DARK mode */
                .elegant-theme-toggle.dark .light-label {
                    color: rgba(255, 255, 255, 0.6); /* Inactive */
                }
                .elegant-theme-toggle.dark .dark-label {
                    color: #ffffff; /* Active - slider is underneath */
                }

                /* In LIGHT mode */
                .elegant-theme-toggle.light .light-label {
                    color: #111111; /* Active - slider is underneath */
                }
                .elegant-theme-toggle.light .dark-label {
                    color: rgba(0, 0, 0, 0.5); /* Inactive */
                }

                .elegant-theme-toggle:hover {
                    transform: scale(1.03);
                }
            `}</style>
        </>
    );
};

export default ThemeToggle;
