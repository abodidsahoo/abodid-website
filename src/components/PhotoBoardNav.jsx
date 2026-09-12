import React from 'react';
import PhotoDropzone from './photoboard/PhotoDropzone';

export default function PhotoBoardNav() {
    return (
        <div className="photoboard-nav-topleft">
            <a
                href="/lab"
                className="pop-topleft-btn pop-back-btn"
                title="Return to Media Lab"
                aria-label="Back to Media Lab"
            >
                <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pop-btn-icon"
                >
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span>Lab</span>
            </a>

            <div className="pop-topleft-dropzone-wrapper">
                <PhotoDropzone />
            </div>

            <style>{`
                .photoboard-nav-topleft {
                    position: fixed;
                    top: 1.5rem;
                    left: 1.5rem;
                    z-index: 1000;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 0.65rem;
                    font-family: var(--font-mono, "Satoshi-Variable", monospace);
                    user-select: none;
                }

                .pop-topleft-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    background: #fff8e8;
                    color: #15130f;
                    border: 1.5px solid #15130f;
                    border-radius: 999px;
                    padding: 0.45rem 0.95rem;
                    font-size: 0.82rem;
                    font-weight: 800;
                    letter-spacing: 0.02em;
                    text-decoration: none;
                    box-shadow: 0 2.5px 0 rgba(21, 19, 15, 0.25), 0 4px 10px rgba(0, 0, 0, 0.05);
                    transition: transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1),
                                box-shadow 140ms cubic-bezier(0.34, 1.56, 0.64, 1),
                                background-color 140ms ease;
                }

                .pop-topleft-btn:hover {
                    background: #ffffff;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 0 rgba(21, 19, 15, 0.3), 0 8px 16px rgba(0, 0, 0, 0.08);
                }

                .pop-topleft-btn:active {
                    transform: translateY(1px);
                    box-shadow: 0 1px 0 rgba(21, 19, 15, 0.25);
                }

                .pop-topleft-dropzone-wrapper {
                    display: flex;
                }

                @media (max-width: 640px) {
                    .photoboard-nav-topleft {
                        top: 1rem;
                        left: 1rem;
                        gap: 0.5rem;
                    }
                    .pop-topleft-btn {
                        padding: 0.4rem 0.75rem;
                        font-size: 0.75rem;
                    }
                }
            `}</style>
        </div>
    );
}
