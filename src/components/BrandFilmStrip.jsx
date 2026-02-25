import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';

const stripBlackMatte = (src) =>
    new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';

        image.onload = () => {
            try {
                const width = image.naturalWidth || image.width;
                const height = image.naturalHeight || image.height;
                if (!width || !height) {
                    resolve(src);
                    return;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const context = canvas.getContext('2d', { willReadFrequently: true });
                if (!context) {
                    resolve(src);
                    return;
                }

                context.drawImage(image, 0, 0, width, height);
                const imageData = context.getImageData(0, 0, width, height);
                const { data } = imageData;

                // Chroma-key style cleanup for logos exported on black JPEG mattes.
                const matteCutoff = 0.09; // remove near-black background + jpeg halos
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];
                    if (a === 0) continue;

                    const max = Math.max(r, g, b) / 255;
                    if (max <= matteCutoff) {
                        data[i + 3] = 0;
                        continue;
                    }

                    const alpha = Math.max(0, Math.min(1, (max - matteCutoff) / (1 - matteCutoff)));
                    const inv = max > 0 ? 1 / max : 1;

                    data[i] = Math.min(255, Math.round(r * inv));
                    data[i + 1] = Math.min(255, Math.round(g * inv));
                    data[i + 2] = Math.min(255, Math.round(b * inv));
                    data[i + 3] = Math.round(alpha * 255);
                }

                context.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (error) {
                console.warn('Failed to remove logo matte:', error);
                resolve(src);
            }
        };

        image.onerror = () => resolve(src);
        image.src = src;
    });

export default function BrandFilmStrip() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hoveredBrand, setHoveredBrand] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [logoSrcByUrl, setLogoSrcByUrl] = useState({});

    useEffect(() => {
        const fetchBrands = async () => {
            const { data, error } = await supabase
                .from('brands')
                .select('*')
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching brands:', error);
            } else {
                setBrands(data || []);
            }
            setLoading(false);
        };
        fetchBrands();
    }, []);

    useEffect(() => {
        if (!brands.length) return;

        let cancelled = false;
        const logoUrls = [...new Set(brands.map((brand) => brand.logo_url).filter(Boolean))];

        const processLogos = async () => {
            const processedEntries = await Promise.all(
                logoUrls.map(async (logoUrl) => [logoUrl, await stripBlackMatte(logoUrl)]),
            );

            if (cancelled) return;
            setLogoSrcByUrl((prev) => {
                const next = { ...prev };
                for (const [logoUrl, processedUrl] of processedEntries) {
                    next[logoUrl] = processedUrl;
                }
                return next;
            });
        };

        processLogos();
        return () => {
            cancelled = true;
        };
    }, [brands]);

    const handleMouseMove = (e) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    // Duplicate brands for seamless loop
    const duplicatedBrands = [...brands, ...brands];

    if (loading || brands.length === 0) return null;

    return (
        <div
            className="brand-filmstrip-wrapper"
            onMouseMove={handleMouseMove}
        >
            <div className="brand-filmstrip">
                <div className="filmstrip-track">
                    {duplicatedBrands.map((brand, index) => (
                        <div
                            key={`${brand.id}-${index}`}
                            className="filmstrip-item"
                            onMouseEnter={() => setHoveredBrand(brand)}
                            onMouseLeave={() => setHoveredBrand(null)}
                        >
                            <img
                                src={logoSrcByUrl[brand.logo_url] || brand.logo_url}
                                alt={brand.name}
                                loading="lazy"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Hover Popup Card */}
            {hoveredBrand && (
                <motion.div
                    className="brand-popup-card"
                    initial={{ opacity: 0, scale: 0.9, x: -10, y: 10 }} // Starts slightly bottom-left
                    animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: -5, y: 5 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    style={{
                        /* Position: Top-Right of pointer, extremely close */
                        top: mousePos.y - 10,
                        left: mousePos.x + 15,
                        /* Ensure it doesn't flip off screen if too close to edge (basic check logic could be added but stick to request first) */
                    }}
                >
                    <div className="popup-content">
                        <h3 className="popup-category">{hoveredBrand.category}</h3>
                        <span className="popup-role">{hoveredBrand.role}</span>
                    </div>
                </motion.div>
            )}

            <style>{`
                .brand-filmstrip-wrapper {
                    position: relative;
                    width: 100%;
                    /* Removed breakout hacks */
                    z-index: 10;
                    margin: 0;
                    pointer-events: none;
                }

                .brand-filmstrip {
                    width: 100%;
                    overflow: hidden;
                    position: relative;
                    padding: 4rem 0; 
                    
                    /* Let footer/site background pass through */
                    background: transparent;
                    mix-blend-mode: normal;
                    opacity: 1;
                    
                    /* Edge Fade Mask */
                    mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
                    -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
                    
                    pointer-events: auto; 
                }

                /* Light Mode Logo Inversion */
                [data-theme="light"] .brand-filmstrip {
                    background: transparent !important;
                    mix-blend-mode: normal !important;
                    opacity: 1 !important;
                }

                .filmstrip-track {
                    display: flex;
                    align-items: center;
                    gap: 6rem; /* Decent enough spacing between logos */
                    width: max-content;
                    animation: scrollFilm 120s linear infinite;
                    will-change: transform;
                }

                .filmstrip-track:hover {
                    animation-play-state: paused;
                }

                @keyframes scrollFilm {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }

                .filmstrip-item {
                    flex-shrink: 0;
                    width: auto;
                    height: 120px; 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: transform 0.3s ease;
                }

                .filmstrip-item:hover {
                    transform: scale(1.05);
                }

                .filmstrip-item img {
                    height: 100%;
                    width: auto;
                    max-width: 120px;
                    object-fit: contain;

                    mix-blend-mode: normal;
                    filter: brightness(1.03) contrast(1.08);
                    opacity: 0.94;
                }

                [data-theme="light"] .filmstrip-item img {
                    /*
                     * Light mode should not pop as pure white:
                     * keep marks darker so they blend into the footer tone.
                     */
                    mix-blend-mode: normal !important;
                    filter: invert(1) grayscale(1) brightness(0.32) contrast(1.18) !important;
                    opacity: 0.78 !important;
                }

                /* Popup Card */
                .brand-popup-card {
                    position: fixed;
                    z-index: 9999; 
                    background: rgba(10, 15, 22, 0.95);
                    backdrop-filter: blur(12px);
                    border: 1px solid var(--sci-fi-cyan, #00f3ff);
                    border-radius: 4px;
                    pointer-events: none;
                    box-shadow: 0 0 35px rgba(0, 243, 255, 0.35);
                    padding: 0.8rem 1.4rem;
                    min-width: 170px;
                    
                    /* Prevent text wrap generally */
                    white-space: nowrap;
                }

                .popup-category {
                    font-family: var(--font-display);
                    font-weight: 700;
                    font-size: 0.95rem;
                    color: var(--sci-fi-cyan, #00f3ff);
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                    margin: 0;
                }

                .popup-role {
                    font-family: var(--font-mono);
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.9);
                    margin-top: 0.4rem;
                    display: block;
                    border-top: 1px solid rgba(0, 243, 255, 0.25);
                    padding-top: 0.4rem;
                }

                @media (max-width: 768px) {
                    .brand-filmstrip {
                        padding: 4rem 0;
                        /* Reduce fade on mobile to maximize visible area */
                         mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
                        -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
                    }
                    .filmstrip-track {
                        gap: 4rem; 
                    }
                    .filmstrip-item { 
                        height: 70px;
                    }
                }
            `}</style>
        </div>
    );
}
