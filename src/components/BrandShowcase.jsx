import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

export default function BrandShowcase({ limit = null }) {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [categories, setCategories] = useState(['All']);

    // Hover State
    const [hoveredBrand, setHoveredBrand] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Dropdown state
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchBrands = async () => {
            let query = supabase
                .from('brands')
                .select('*')
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (limit) {
                query = query.limit(limit);
            }

            const { data, error } = await query;
            if (error) {
                console.error('Error fetching brands:', error);
            } else {
                setBrands(data || []);
                const cats = ['All', ...new Set(data.map(b => b.category).filter(Boolean))];
                setCategories(cats);
            }
            setLoading(false);
        };
        fetchBrands();
    }, [limit]);

    // Handle mouse move for the floating card
    const handleMouseMove = (e) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    const filteredBrands = filter === 'All'
        ? brands
        : brands.filter(b => b.category === filter);

    if (loading) return <div className="brands-loading">Loading...</div>;

    return (
        <div className="brand-showcase" onMouseMove={handleMouseMove}>
            {!limit && (
                <div className="filter-wrapper" ref={dropdownRef}>
                    <div
                        className={`glass-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                        <span className="selected-filter">{filter}</span>
                        <svg className="dropdown-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    <AnimatePresence>
                        {dropdownOpen && (
                            <motion.div
                                className="glass-dropdown-menu"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                {categories.map(cat => (
                                    <div
                                        key={cat}
                                        className={`dropdown-item ${filter === cat ? 'active' : ''}`}
                                        onClick={() => {
                                            setFilter(cat);
                                            setDropdownOpen(false);
                                        }}
                                    >
                                        {cat}
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <motion.div layout className="brands-grid">
                <AnimatePresence>
                    {filteredBrands.map((brand) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            key={brand.id}
                            className="brand-item"
                            onMouseEnter={() => setHoveredBrand(brand)}
                            onMouseLeave={() => setHoveredBrand(null)}
                        >
                            <img src={brand.logo_url} alt={brand.name} loading="lazy" />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>

            {/* Floating Info Card */}
            <AnimatePresence>
                {hoveredBrand && (
                    <motion.div
                        className="brand-info-card"
                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 5 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        style={{
                            top: mousePos.y + 15, // Offset from cursor
                            left: mousePos.x + 15,
                        }}
                    >
                        <div className="card-content">
                            <h3 className="brand-category">{hoveredBrand.category}</h3>
                            <span className="brand-role">{hoveredBrand.role}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .brand-showcase {
                    width: 100%;
                    padding: 1rem 0;
                    position: relative;
                }
                
                /* Glass Dropdown Styles */
                .filter-wrapper {
                    position: relative;
                    width: 200px;
                    margin: 0 auto 3rem auto;
                    z-index: 100;
                    font-family: var(--font-sans);
                }

                .glass-dropdown-trigger {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.6rem 1rem;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 8px;
                    cursor: pointer;
                    color: var(--text-primary);
                    font-size: 0.85rem;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }

                .glass-dropdown-trigger:hover, .glass-dropdown-trigger.open {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 255, 255, 0.2);
                }

                .dropdown-arrow {
                    transition: transform 0.3s ease;
                    opacity: 0.7;
                }

                .glass-dropdown-trigger.open .dropdown-arrow {
                    transform: rotate(180deg);
                }

                .glass-dropdown-menu {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    width: 100%;
                    margin-top: 0.5rem;
                    background: #111;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }

                .dropdown-item {
                    padding: 0.6rem 1rem;
                    cursor: pointer;
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }

                .dropdown-item:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--text-primary);
                }

                .dropdown-item.active {
                    color: var(--text-primary);
                    background: rgba(255, 255, 255, 0.1);
                }

                /* Grid Styles */
                .brands-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
                    gap: 0.5rem;
                    align-items: center;
                }
                
                .brand-item {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 16/10;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                }
                
                .brand-item:hover {
                    transform: scale(1.02);
                }

                .brand-item img {
                    max-width: 90%; 
                    max-height: 80%;
                    width: auto;
                    height: auto;
                    object-fit: contain;
                    opacity: 0.6;
                    transition: opacity 0.2s;
                    filter: grayscale(100%);
                }
                
                .brand-item:hover img {
                    opacity: 1;
                    filter: grayscale(0%);
                }

                /* Floating Hover Card - Tiny & Pastel */
                .brand-info-card {
                    position: fixed;
                    z-index: 9999;
                    background: #FFFDF5; 
                    border: 1px solid #E2E8F0;
                    color: #333;
                    border-radius: 6px;
                    pointer-events: none;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                    min-width: 100px;
                    max-width: 180px;
                }

                .card-content {
                    padding: 0.5rem 0.75rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.1rem;
                }

                .brand-category {
                    font-family: 'Poppins', sans-serif;
                    font-weight: 700;
                    font-size: 0.8rem;
                    color: #333;
                    line-height: 1.2;
                }

                .brand-role {
                    font-family: 'Inconsolata', monospace;
                    font-size: 0.7rem;
                    color: #666;
                    font-weight: 500;
                    line-height: 1.2;
                }

                /* Mobile Adjustment */
                @media (max-width: 768px) {
                    .brand-info-card { display: none; }
                    .brand-item img { opacity: 0.9; filter: none; }
                    .brands-grid { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.5rem; }
                    .glass-dropdown-menu { background: #111; }
                }
            `}</style>
        </div>
    );
}

