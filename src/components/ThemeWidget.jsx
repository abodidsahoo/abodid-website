import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = [
    { name: 'Matte Black', value: '#080808' },
    { name: 'Soft Beige', value: '#e0d8cc' },
    { name: 'Brand Red', value: '#a30021' },
    { name: 'Deep Navy', value: '#1a2c36' },
];

const CONTROL_WIDTH = '16.25rem';

const ThemeWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeColor, setActiveColor] = useState('#080808');
    const containerRef = useRef(null);

    const applyTheme = (color) => {
        const hex = color.replace('#', '');
        const normalizedHex = hex.length === 3
            ? hex.split('').map((char) => char + char).join('')
            : hex;
        const r = parseInt(normalizedHex.slice(0, 2), 16);
        const g = parseInt(normalizedHex.slice(2, 4), 16);
        const b = parseInt(normalizedHex.slice(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const isDark = brightness < 150;

        document.documentElement.style.setProperty('--polaroid-hub-bg', color);
        document.documentElement.style.setProperty(
            '--polaroid-hub-control-text',
            isDark ? 'rgba(255, 255, 255, 0.92)' : 'rgba(17, 17, 17, 0.92)',
        );
        document.documentElement.style.setProperty(
            '--polaroid-hub-control-border',
            isDark ? 'rgba(255, 255, 255, 0.34)' : 'rgba(0, 0, 0, 0.2)',
        );
        document.documentElement.style.setProperty(
            '--polaroid-hub-control-bg',
            isDark ? 'rgba(10, 10, 10, 0.18)' : 'rgba(255, 255, 255, 0.5)',
        );
        document.documentElement.style.setProperty(
            '--polaroid-hub-control-shadow',
            isDark ? '0 4px 16px rgba(0, 0, 0, 0.16)' : '0 4px 16px rgba(0, 0, 0, 0.08)',
        );
        document.documentElement.style.setProperty(
            '--polaroid-hub-panel-bg',
            isDark ? 'rgba(12, 12, 12, 0.92)' : 'rgba(255, 255, 255, 0.94)',
        );
    };

    useEffect(() => {
        applyTheme(activeColor);
    }, []);

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
        applyTheme(color);
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                top: '2rem',
                right: '2rem',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '0.7rem',
                width: CONTROL_WIDTH,
            }}
        >

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.9 }}
                        style={{
                            order: 2,
                            background: 'var(--polaroid-hub-panel-bg, rgba(12, 12, 12, 0.92))',
                            backdropFilter: 'blur(12px)',
                            width: '100%',
                            padding: '0.9rem 1rem',
                            borderRadius: '12px',
                            border: '1px solid var(--polaroid-hub-control-border, rgba(255,255,255,0.2))',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gap: '0.7rem',
                            boxShadow: '0 12px 32px rgba(0,0,0,0.28)'
                        }}
                    >
                        {COLORS.map((c) => (
                            <button
                                key={c.value}
                                onClick={() => handleColorChange(c.value)}
                                title={c.name}
                                style={{
                                    width: '100%',
                                    aspectRatio: '1 / 1',
                                    minHeight: '2.9rem',
                                    borderRadius: '999px',
                                    background: c.value,
                                    border: activeColor === c.value ? '2px solid rgba(255,255,255,0.95)' : '1px solid rgba(255,255,255,0.26)',
                                    cursor: 'pointer',
                                    boxShadow: activeColor === c.value
                                        ? '0 0 0 2px rgba(255,255,255,0.18), 0 6px 16px rgba(0,0,0,0.3)'
                                        : '0 4px 12px rgba(0,0,0,0.22)',
                                    transition: 'transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease'
                                }}
                                whileHover={{ scale: 1.07 }}
                                whileTap={{ scale: 0.94 }}
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
                    order: 1,
                    width: '100%',
                    padding: '0.8rem 1.2rem',
                    borderRadius: '6px',
                    background: 'var(--polaroid-hub-control-bg, rgba(10, 10, 10, 0.18))',
                    color: 'var(--polaroid-hub-control-text, rgba(255, 255, 255, 0.92))',
                    border: '1px solid var(--polaroid-hub-control-border, rgba(255, 255, 255, 0.34))',
                    cursor: 'pointer',
                    boxShadow: 'var(--polaroid-hub-control-shadow, 0 4px 16px rgba(0,0,0,0.16))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.95rem',
                    fontWeight: 400,
                    lineHeight: 1.1,
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)'
                }}
            >
                Change background color
            </motion.button>
        </div>
    );
};

export default ThemeWidget;
