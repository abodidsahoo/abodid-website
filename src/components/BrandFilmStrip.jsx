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
            style={{ position: 'relative', width: '100%' }}
        >
            <div className="brand-filmstrip">
                <div className="filmstrip-track">
                    {duplicatedBrands.map((brand, index) => (
                        <div
                            key={`${brand.id}-${index}`}
                            className="filmstrip-item"
                            onMouseEnter={() => setHoveredBrand(brand)}
                            onMouseLeave={() => setHoveredBrand(null)}
                            style={{ pointerEvents: 'auto' }}
                        >
                            <img src={brand.logo_url} alt={brand.name} loading="lazy" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Hover Popup Card - Outside the screened container for clarity */}
            {hoveredBrand && (
                <motion.div
                    className="brand-popup-card"
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    transition={{ duration: 0.2, ease: "backOut" }}
                    style={{
                        top: mousePos.y + 20,
                        left: mousePos.x + 20,
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
                    z-index: 10;
                    isolation: isolate; /* Create new stacking context */
                }

                .brand-filmstrip {
                    width: 100%;
                    overflow: hidden;
                    position: relative;
                    padding: 4rem 0;
                    /* Screen the entire ribbon to vanish its black parts and reveal site grid */
                    mix-blend-mode: screen; 
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    background: transparent;
                }

                .filmstrip-track {
                    display: flex;
                    gap: 0; /* Pure back-to-back as requested */
                    animation: scrollFilm 60s linear infinite;
                    will-change: transform;
                    align-items: center;
                    background: #000; /* Unified black ribbon */
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
                    height: 220px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000; /* Attached black backgrounds */
                    padding: 0 4rem; /* Internal spacing for "back-to-back" look */
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    position: relative;
                    pointer-events: auto !important; /* Force hover capture */
                }

                .filmstrip-item:hover {
                    transform: scale(1.05);
                }

                .filmstrip-item img {
                    max-width: 100%;
                    max-height: 100%;
                    width: auto;
                    height: 100%;
                    object-fit: contain;
                    /* Clears logo backgrounds against the black ribbon */
                    mix-blend-mode: screen; 
                    filter: contrast(3) brightness(1.1) grayscale(1); 
                    transition: all 0.3s ease;
                }

                .filmstrip-item:hover img {
                    filter: contrast(3.5) brightness(1.4) grayscale(0);
                }

                /* Popup Card - Outside the screened area to remain opaque and readable */
                .brand-popup-card {
                    position: fixed;
                    z-index: 1000000; /* High z-index to stay on top */
                    background: rgba(10, 15, 22, 0.95);
                    backdrop-filter: blur(12px);
                    border: 1px solid var(--sci-fi-cyan, #00f3ff);
                    border-radius: 4px;
                    pointer-events: none;
                    box-shadow: 0 0 35px rgba(0, 243, 255, 0.35);
                    padding: 0.8rem 1.4rem;
                    min-width: 170px;
                }

                .popup-category {
                    font-family: 'Poppins', sans-serif;
                    font-weight: 700;
                    font-size: 0.95rem;
                    color: var(--sci-fi-cyan, #00f3ff);
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                    margin: 0;
                }

                .popup-role {
                    font-family: 'Inconsolata', monospace;
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.9);
                    margin-top: 0.4rem;
                    display: block;
                    border-top: 1px solid rgba(0, 243, 255, 0.25);
                    padding-top: 0.4rem;
                }

                @media (max-width: 768px) {
                    .filmstrip-item { 
                        height: 120px;
                        padding: 0 2rem;
                    }
                }
            `}</style>
        </div>
    );
}
