import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = [
    { name: 'Matte Black', value: '#080808' },
    { name: 'Dark Gray', value: '#1a1a1a' },
    { name: 'Studio Green', value: '#2e4c36' },
    { name: 'Navy Blue', value: '#1a2c36' },
    { name: 'Deep Red', value: '#2c1a1a' },
    { name: 'Soft Beige', value: '#e0d8cc' },
    /* --- NEW POP COLORS --- */
    { name: 'Pop Yellow', value: '#ffc800' },
    { name: 'Warm Orange', value: '#ff5e00' },
    { name: 'LinkedIn Blue', value: '#0077b5' },
    { name: 'Vibrant Purple', value: '#8a2be2' },
];

const ThemeWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeColor, setActiveColor] = useState('#080808');
    const containerRef = useRef(null);

    // Click Outside Handling
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleColorChange = (color) => {
        setActiveColor(color);
        // Update the CSS variable globally
        document.documentElement.style.setProperty('--darkroom-bg', color);
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                /* Moved to Top Right, below Home button (which is usually top: 2rem) */
                top: '5.5rem',
                right: '2rem',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '1rem'
            }}
        >

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.9 }}
                        style={{
                            /* Darker backdrop to make colors pop */
                            background: 'rgba(20,20,20,0.85)',
                            backdropFilter: 'blur(12px)',
                            padding: '1rem',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '12px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
                        }}
                    >
                        {COLORS.map((c) => (
                            <button
                                key={c.value}
                                onClick={() => handleColorChange(c.value)}
                                title={c.name}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: c.value,
                                    border: activeColor === c.value ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                    transition: 'transform 0.1s'
                                }}
                                whileHover={{ scale: 1.15 }}
                                whileTap={{ scale: 0.9 }}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: activeColor,
                    border: '2px solid rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem'
                }}
            >
                🎨
            </motion.button>
        </div>
    );
};

export default ThemeWidget;
