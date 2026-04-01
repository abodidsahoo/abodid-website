import React from 'react';

const headerStyles = `
    .floating-addons-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 10005;
    }

    .floating-addons-container > * {
        pointer-events: auto;
    }

    .floating-logo-wrapper {
        position: absolute;
        top: 25px;
        right: 4vw;
        z-index: 1100;
        opacity: 0.9;
    }

    .logo-image-link {
        display: block;
        text-decoration: none;
    }

    .header-logo-img {
        height: 85px !important;
        width: auto;
        display: block;
        filter: brightness(1.2);
        object-fit: contain;
        transition: transform 0.2s ease;
    }

    .header-logo-img:hover {
        transform: scale(1.05);
    }

    .alt-text-logo {
        display: inline-block;
        padding: 0.45rem 0.95rem;
        border: 1px solid rgba(0, 0, 0, 0.75);
        color: rgba(0, 0, 0, 0.85);
        font-family: var(--font-ui, sans-serif);
        font-size: 0.72rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        border-radius: 4px;
        background: transparent;
        transition: all 0.2s ease;
    }

    .alt-text-logo:hover {
        background: rgba(0, 0, 0, 0.06);
        transform: scale(1.03);
        color: #000;
        border-color: #000;
    }

    @media (max-width: 768px) {
        .floating-logo-wrapper {
            top: 18px;
            right: 18px;
        }

        .header-logo-img {
            height: 60px !important;
        }
    }
`;

const Header = ({ hideThemeToggle = false, altTextLogo = null }) => {
    return (
        <React.Fragment>
            {/* FLOATING ELEMENTS (Add-on) */}
            <div className="floating-addons-container">
                {/* Top Right Logo */}
                <div className="floating-logo-wrapper">
                    <a href="/" className="logo-image-link" aria-label="Abodid Home">
                        {altTextLogo ? (
                            <span className="alt-text-logo">{altTextLogo}</span>
                        ) : (
                            <img src="/images/signature-white.png" alt="Signature" className="header-logo-img" />
                        )}
                    </a>
                </div>
            </div>

            <style>{headerStyles}</style>
        </React.Fragment>
    );
};

export default Header;
