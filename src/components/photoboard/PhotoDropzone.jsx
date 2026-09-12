import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MAX_IMAGES = 30;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function PhotoDropzone({ onPhotosAdded }) {
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef(null);
    const dragCounterRef = useRef(0);

    const handleFiles = (fileList) => {
        if (!fileList || !fileList.length) return;

        const files = Array.from(fileList);
        const validFiles = [];
        let skippedSizeCount = 0;

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            if (file.size > MAX_FILE_SIZE_BYTES) {
                skippedSizeCount++;
                continue;
            }
            validFiles.push(file);
        }

        if (skippedSizeCount > 0) {
            window.dispatchEvent(
                new CustomEvent('photoboard:toast', {
                    detail: {
                        message: `⚠️ Skipped ${skippedSizeCount} file(s) exceeding 10MB limit.`,
                        type: 'warning',
                    },
                })
            );
        }

        if (!validFiles.length) return;

        // Limit to MAX_IMAGES
        const acceptedFiles = validFiles.slice(0, MAX_IMAGES);
        if (validFiles.length > MAX_IMAGES) {
            window.dispatchEvent(
                new CustomEvent('photoboard:toast', {
                    detail: {
                        message: `ℹ️ Capped upload to ${MAX_IMAGES} photos maximum.`,
                        type: 'info',
                    },
                })
            );
        }

        const newItems = acceptedFiles.map((file, idx) => {
            const objectUrl = URL.createObjectURL(file);
            const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            return {
                id: `custom-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
                title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
                image: objectUrl,
                fileBlob: file,
                isCustom: true,
            };
        });

        if (typeof onPhotosAdded === 'function') {
            onPhotosAdded(newItems);
        }

        window.dispatchEvent(
            new CustomEvent('photoboard:load-custom-photos', {
                detail: { items: newItems },
            })
        );

        window.dispatchEvent(
            new CustomEvent('photoboard:toast', {
                detail: {
                    message: `✓ Added ${newItems.length} custom photograph(s)!`,
                    type: 'success',
                },
            })
        );
    };

    const handleFileInputChange = (e) => {
        handleFiles(e.target.files);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Global drag-and-drop listener across entire window
    useEffect(() => {
        const handleDragEnter = (e) => {
            e.preventDefault();
            dragCounterRef.current++;
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                setIsDraggingOver(true);
            }
        };

        const handleDragLeave = (e) => {
            e.preventDefault();
            dragCounterRef.current--;
            if (dragCounterRef.current <= 0) {
                setIsDraggingOver(false);
                dragCounterRef.current = 0;
            }
        };

        const handleDragOver = (e) => {
            e.preventDefault();
        };

        const handleDrop = (e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            dragCounterRef.current = 0;
            if (e.dataTransfer && e.dataTransfer.files) {
                handleFiles(e.dataTransfer.files);
            }
        };

        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, []);

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
            />

            <button
                type="button"
                className="pop-nav-btn pop-upload-btn"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                title="Add your own photos to scatter (up to 30 images, max 10MB each)"
                aria-label="Upload custom photos"
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
                >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add Photos</span>
            </button>

            {/* Full Canvas Drag-and-Drop Overlay */}
            <AnimatePresence>
                {isDraggingOver && (
                    <motion.div
                        className="pop-dropzone-overlay"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                    >
                        <div className="pop-dropzone-modal">
                            <div className="pop-dropzone-icon">📷</div>
                            <div className="pop-dropzone-title">DROP YOUR PHOTOS HERE</div>
                            <p className="pop-dropzone-desc">
                                Up to 30 images (max 10MB each). Your photos will instantly scatter into custom Polaroids.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .pop-upload-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    background: #ff7eb5;
                    color: #15130f;
                    border: 1.5px solid #15130f;
                    border-radius: 999px;
                    padding: 0.45rem 0.95rem;
                    font-family: var(--font-mono, "Satoshi-Variable", monospace);
                    font-size: 0.82rem;
                    font-weight: 800;
                    letter-spacing: 0.02em;
                    cursor: pointer;
                    box-shadow: 0 2.5px 0 rgba(21, 19, 15, 0.25), 0 4px 10px rgba(0, 0, 0, 0.05);
                    transition: transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1),
                                box-shadow 140ms cubic-bezier(0.34, 1.56, 0.64, 1),
                                background-color 140ms ease;
                }
                .pop-upload-btn:hover {
                    background: #ff60a4 !important;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 0 rgba(21, 19, 15, 0.3), 0 8px 16px rgba(0, 0, 0, 0.08);
                }
                .pop-upload-btn:active {
                    transform: translateY(1px);
                    box-shadow: 0 1px 0 rgba(21, 19, 15, 0.25);
                }

                .pop-dropzone-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 999999;
                    background: rgba(20, 34, 93, 0.85);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    padding: 2rem;
                    box-sizing: border-box;
                }

                .pop-dropzone-modal {
                    background: #fff8e8;
                    color: #15130f;
                    border: 2px dashed #15130f;
                    border-radius: 24px;
                    padding: 3rem 4rem;
                    text-align: center;
                    box-shadow: 0 16px 0 #15130f, 0 30px 60px rgba(0,0,0,0.4);
                    max-width: 32rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.8rem;
                }

                .pop-dropzone-icon {
                    font-size: 3rem;
                    line-height: 1;
                }

                .pop-dropzone-title {
                    font-family: var(--font-mono, "Satoshi-Variable", monospace);
                    font-size: 1.25rem;
                    font-weight: 850;
                    letter-spacing: 0.04em;
                    color: #15130f;
                }

                .pop-dropzone-desc {
                    margin: 0;
                    font-family: var(--font-body, "Satoshi-Variable", sans-serif);
                    font-size: 0.95rem;
                    line-height: 1.45;
                    color: rgba(21, 19, 15, 0.85);
                }
            `}</style>
        </>
    );
}
