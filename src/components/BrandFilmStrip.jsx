import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';

export default function BrandFilmStrip() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hoveredBrand, setHoveredBrand] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
                            <img src={brand.logo_url} alt={brand.name} loading="lazy" />
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
                    
                    /* Theme Aware Background - User requested PURE BLACK to match image backgrounds */
                    background: #000000;
                    
                    /* Edge Fade Mask */
                    mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
                    -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
                    
                    pointer-events: auto; 
                }

                /* Light Mode Logo Inversion */
                [data-theme="light"] .brand-filmstrip {
                    background: #ffffff !important;
                }

                [data-theme="light"] .filmstrip-item img {
                    filter: invert(1) !important;
                    opacity: 0.85 !important; 
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

                    /* RAW IMAGE DISPLAY */
                    filter: none;
                    opacity: 1; 
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
