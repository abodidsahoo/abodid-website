import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const CVListModal = ({ title, icon, cvs }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Clean filename for display (e.g. "Professional_CV_2024.pdf" -> "Professional CV 2024")
    const formatName = (name) => {
        return name
            .replace(/\.[^/.]+$/, "") // Remove extension
            .replace(/_/g, " ") // Replace underscores
            .replace(/-/g, " "); // Replace dashes
    };

    const openModal = (e) => {
        e.preventDefault();
        setIsOpen(true);
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        setIsOpen(false);
        document.body.style.overflow = '';
    };

    // Close on escape
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen]);

    return (
        <>
            <a href="#" className="hub-card" onClick={openModal}>
                <div className="card-content">
                    <div className="card-left">
                        <span style={{ fontSize: '1.25rem', display: 'flex' }}>↓</span>
                        <h3>{title}</h3>
                    </div>
                    <span className="icon">{icon}</span>
                </div>
            </a>

            {mounted && isOpen && createPortal(
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={closeModal}>×</button>
                        <h2>Download {title}</h2>
                        <div className="cv-list">
                            {cvs && cvs.length > 0 ? (
                                cvs.map((cv, index) => (
                                    <a key={index} href={cv.url} target="_blank" rel="noopener noreferrer" className="cv-item">
                                        <span className="file-icon">📄</span>
                                        <span className="file-name">{formatName(cv.name)}</span>
                                        <span className="download-arrow">↓</span>
                                    </a>
                                ))
                            ) : (
                                <p className="no-files">No documents found.</p>
                            )}
                        </div>
                    </div>
                    <style>{`
                        /* Hub Card Styles (Mirrored from about.astro for React scope) */
                        .hub-card {
                            display: block;
                            text-decoration: none;
                            color: inherit;
                            background: var(--bg-surface);
                            border: 1px solid var(--border-subtle);
                            padding: 2rem;
                            border-radius: 12px;
                            transition: all 0.2s ease;
                            cursor: pointer;
                        }
                        .hub-card:hover {
                            transform: translateY(-4px);
                            border-color: var(--text-secondary);
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                        }
                        .card-content {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        }
                        .card-left {
                            display: flex;
                            align-items: center;
                            gap: 1rem;
                        }
                        .hub-card h3 {
                            margin: 0;
                            font-size: 1.1rem;
                            font-weight: 500;
                            color: var(--text-primary);
                        }
                        .icon {
                            font-size: 1.25rem;
                            color: var(--text-tertiary);
                            transition: transform 0.2s ease;
                        }
                        .hub-card:hover .icon {
                            transform: translateX(4px);
                            color: var(--text-primary);
                        }

                        /* Modal Styles */
                        .modal-overlay {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: rgba(0, 0, 0, 0.7);
                            backdrop-filter: blur(5px);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 1000;
                            animation: fadeIn 0.2s ease;
                        }
                        .modal-content {
                            background: var(--bg-surface, #fff);
                            padding: 2.5rem;
                            border-radius: 12px;
                            width: 90%;
                            max-width: 450px;
                            position: relative;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                            border: 1px solid var(--border-subtle, #eee);
                            animation: slideUp 0.3s ease;
                        }
                        .modal-close {
                            position: absolute;
                            top: 15px;
                            right: 15px;
                            background: none;
                            border: none;
                            font-size: 1.5rem;
                            cursor: pointer;
                            color: var(--text-tertiary, #999);
                            line-height: 1;
                        }
                        .modal-close:hover {
                            color: var(--text-primary, #000);
                        }
                        h2 {
                            margin-top: 0;
                            margin-bottom: 1.5rem;
                            font-size: 1.5rem;
                            font-weight: 600;
                            font-family: "Poppins", sans-serif;
                            color: var(--text-primary, #000);
                        }
                        .cv-list {
                             display: flex;
                            flex-direction: column;
                            gap: 0.8rem;
                        }
                        .cv-item {
                            display: flex;
                            align-items: center;
                            gap: 1rem;
                            padding: 1rem;
                            background: var(--bg-color, #f9f9f9);
                            border: 1px solid var(--border-subtle, #eee);
                            border-radius: 8px;
                            text-decoration: none;
                            color: var(--text-primary, #333);
                            transition: all 0.2s ease;
                        }
                        .cv-item:hover {
                            border-color: var(--text-secondary, #666);
                            transform: translateY(-2px);
                            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                        }
                        .file-icon {
                            font-size: 1.2rem;
                            opacity: 0.7;
                        }
                        .file-name {
                            flex-grow: 1;
                            font-weight: 500;
                            font-size: 0.95rem;
                        }
                        .download-arrow {
                            opacity: 0.5;
                            font-size: 1.2rem;
                        }
                        .cv-item:hover .download-arrow {
                            opacity: 1;
                        }
                        .no-files {
                            color: var(--text-tertiary);
                            font-style: italic;
                        }
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes slideUp {
                            from { transform: translateY(20px); opacity: 0; }
                            to { transform: translateY(0); opacity: 1; }
                        }
                    `}</style>
                </div>,
                document.body
            )}
        </>
    );
};

export default CVListModal;
