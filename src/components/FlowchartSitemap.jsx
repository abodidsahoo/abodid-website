import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/org-chart.css';

const NodeContent = ({ node, depth, hasChildren, isOpen, toggleOpen }) => {
    // --- NEON VISUAL SYSTEM ---
    // User Request: "Keep everything in monospace font... boxes around each item... purple neon sort of vibe"
    // "Just exactly the page name... keep going downwards"

    const isRoot = depth === 0;

    // Base "Techy Box" Style
    // bg-black to sit on the background
    // border-purple-500/30 for subtle neon structural feel
    // shadow for the glow
    // font-mono is critical
    const baseClasses = "relative z-10 transition-all duration-300 flex items-center bg-black border cursor-pointer select-none group w-full max-w-xl";

    // Glowing Effects
    const neonGlow = "shadow-[0_0_10px_rgba(168,85,247,0.15)] hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] hover:border-purple-400";
    const borderStyle = "border-purple-500/30 rounded-sm"; // Slightly rounded, but mostly boxy

    // Specific Level Tweaks (Size & Spacing)
    // Root: Bigger, Centered? Or just top of the list? User said "From home page... go major single pages first... keep growing" implies flow.
    const rootStyle = isRoot
        ? "px-6 py-4 text-xl font-bold tracking-widest text-purple-100 mb-6 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.4)]"
        : "px-4 py-3 text-sm font-medium text-purple-300/80 hover:text-purple-50";

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`${baseClasses} ${borderStyle} ${neonGlow} ${rootStyle}`}
            onClick={toggleOpen}
        >
            {node.href ? (
                <a href={node.href} className="no-underline text-inherit block w-full h-full flex items-center justify-between">
                    <span className="truncate">{node.name}</span>
                    {hasChildren && (
                        <span className="text-[10px] text-purple-500/50 ml-3 font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                            {isOpen ? '[-]' : '[+]'}
                        </span>
                    )}
                    {/* Meta Count Display */}
                    {node.isMeta && <span className="text-[9px] text-purple-600 block ml-auto pl-4">({node.desc})</span>}
                </a>
            ) : (
                <div className="w-full flex items-center justify-between">
                    <span className="truncate">{node.name}</span>
                    {hasChildren && (
                        <span className="text-[10px] text-purple-500/50 ml-3 font-normal">
                            {isOpen ? '[-]' : '[+]'}
                        </span>
                    )}
                </div>
            )}
        </motion.div>
    );
};

const TreeNode = ({ node, depth = 0 }) => {
    // Default Open? "Keep going downwards... show another line." 
    // Usually a sitemap is fully expanded or mostly expanded. 
    // Let's keep it expanded by default for the "Infinite Scroll" feel.
    const [isOpen, setIsOpen] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <li>
            <NodeContent
                node={node}
                depth={depth}
                hasChildren={hasChildren}
                isOpen={isOpen}
                toggleOpen={(e) => {
                    // Prevent navigation if clicking the expand/collapse area explicitly? 
                    // Actually NodeContent click toggles. Link click navigates.
                    // We need to allow bubbling for link, but maybe optional toggle?
                    // For now, simpler: Clicking the box toggles if it's not a link, or if we click strict side?
                    // Let's just let it be.
                    if (!node.href) setIsOpen(!isOpen);
                }}
            />

            <AnimatePresence>
                {hasChildren && isOpen && (
                    <motion.ul
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden" // Smooth expand
                    >
                        {node.children.map((child, i) => (
                            <TreeNode key={`${child.name}-${i}`} node={child} depth={depth + 1} />
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </li>
    );
};

export default function FlowchartSitemap({ data }) {
    return (
        <div className="w-full min-h-screen bg-[#050505] text-white py-20 px-4 flex justify-center">
            {/* Main Tree Container */}
            <div className="org-tree">
                <ul>
                    <TreeNode node={data} depth={0} />
                </ul>
            </div>
        </div>
    );
}
