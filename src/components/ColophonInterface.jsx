import React, { useState } from 'react';

const ColophonInterface = () => {
    const [mode, setMode] = useState('developer'); // Default: 'developer'

    return (
        <div className="colophon-wrapper">
            {/* Mode Switcher */}
            <div className="mode-switcher-container">
                <div className="mode-toggle">
                    <button
                        className={`toggle-btn ${mode === 'developer' ? 'active' : ''}`}
                        onClick={() => setMode('developer')}
                    >
                        DEVELOPER
                    </button>
                    <button
                        className={`toggle-btn ${mode === 'designer' ? 'active' : ''}`}
                        onClick={() => setMode('designer')}
                    >
                        DESIGNER
                    </button>
                    <div className={`toggle-slider ${mode}`} />
                </div>
            </div>

            {/* Content Area */}
            <div className={`content-area fade-in`}>
                {mode === 'developer' ? <DeveloperContent /> : <DesignerContent />}
            </div>

            {/* Workshop CTA */}
            <WorkshopCTA />

            <style>{`
                .colophon-wrapper {
                    font-family: 'Inconsolata', monospace;
                    max-width: 1000px; /* Wider for grid */
                    margin: 0 auto;
                    color: var(--text-secondary);
                }

                /* Switcher Styles */
                .mode-switcher-container {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 5rem;
                }

                .mode-toggle {
                    position: relative;
                    display: flex;
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 4px; /* Sharper corners for sci-fi */
                    padding: 4px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                }

                .toggle-btn {
                    position: relative;
                    z-index: 2;
                    background: transparent;
                    border: none;
                    padding: 12px 40px;
                    font-family: 'Inconsolata', monospace;
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--text-tertiary);
                    cursor: pointer;
                    transition: color 0.3s ease;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                .toggle-btn.active {
                    color: var(--bg-color);
                }

                .toggle-slider {
                    position: absolute;
                    top: 4px;
                    left: 4px;
                    bottom: 4px;
                    width: calc(50% - 4px);
                    background: var(--text-primary);
                    border-radius: 2px;
                    transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
                    z-index: 1;
                }

                .toggle-slider.designer {
                    transform: translateX(100%);
                }

               /* Shared Grid & Layout */
                .grid-2 {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 4rem;
                    margin-bottom: 5rem;
                }
                
                .sci-fi-block {
                    border-top: 2px solid var(--border-strong);
                    padding-top: 1.5rem;
                    position: relative;
                }
                
                .sci-fi-block::before {
                    content: '';
                    position: absolute;
                    top: -2px;
                    left: 0;
                    width: 40px;
                    height: 2px;
                    background: #00ff9d; /* Acccent */
                }

                .block-header {
                    font-family: 'Space Mono', monospace;
                    font-size: 1.5rem;
                    text-transform: uppercase;
                    color: var(--text-primary);
                    margin-bottom: 2rem;
                    letter-spacing: -0.05em;
                }
                
                /* Tables */
                .tech-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.9rem;
                }
                
                .tech-table td {
                    padding: 0.8rem 0;
                    border-bottom: 1px dashed var(--border-subtle);
                    vertical-align: top;
                }
                
                .tech-table td:first-child {
                    color: var(--text-tertiary);
                    font-weight: 600;
                    width: 140px;
                }
                
                .tech-table td:last-child {
                    color: var(--text-primary);
                }

                /* Bullet Lists (Clean) */
                .clean-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                
                .clean-list li {
                    position: relative;
                    padding-left: 1.5rem;
                    margin-bottom: 0.75rem;
                    line-height: 1.5;
                }
                
                .clean-list li::before {
                    content: '>';
                    position: absolute;
                    left: 0;
                    color: #00ff9d;
                    font-weight: bold;
                }

                @media (max-width: 768px) {
                    .grid-2 { grid-template-columns: 1fr; gap: 3rem; }
                }
                
                /* CTA Section */
                .workshop-cta {
                    margin-top: 6rem;
                    border: 1px solid var(--border-subtle);
                    padding: 3rem;
                    text-align: center;
                    background: rgba(255,255,255,0.03);
                    border-radius: 8px;
                }
                
                .cta-title {
                    font-family: 'Poppins', sans-serif;
                    font-size: 2rem;
                    color: var(--text-primary);
                    margin-bottom: 1rem;
                }
                
                .cta-text {
                    max-width: 600px;
                    margin: 0 auto 2rem auto;
                    line-height: 1.7;
                }
                
                .cta-btn {
                    display: inline-block;
                    background: var(--text-primary);
                    color: var(--bg-color);
                    padding: 1rem 2rem;
                    font-weight: 700;
                    text-decoration: none;
                    border-radius: 4px;
                    transition: opacity 0.2s;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }
                
                .cta-btn:hover {
                    opacity: 0.9;
                }
            `}</style>
        </div>
    );
};


/* --- Developer Content (Tabular & Sci-Fi) --- */
const DeveloperContent = () => (
    <div className="developer-view fade-in">
        <div className="grid-2">
            <div className="sci-fi-block">
                <h3 className="block-header">Core Ecology</h3>
                <table className="tech-table">
                    <tbody>
                        <tr><td>SHELL</td><td>Astro 5.0 (SSR)</td></tr>
                        <tr><td>ISLANDS</td><td>React 19</td></tr>
                        <tr><td>DATABASE</td><td>Supabase (PostgreSQL 15)</td></tr>
                        <tr><td>ADAPTER</td><td>@astrojs/vercel (Serverless)</td></tr>
                        <tr><td>MOTION</td><td>GSAP 3 + Three.js</td></tr>
                    </tbody>
                </table>
            </div>

            <div className="sci-fi-block">
                <h3 className="block-header">Data Security</h3>
                <table className="tech-table">
                    <tbody>
                        <tr><td>AUTH</td><td>Row Level Security (RLS)</td></tr>
                        <tr><td>READ</td><td>Public (Concurrent Select)</td></tr>
                        <tr><td>WRITE</td><td>Admin Only (Authenticated)</td></tr>
                        <tr><td>SYNC</td><td>Edge Function (GitHub Gateway)</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div className="grid-2">
            <div className="sci-fi-block">
                <h3 className="block-header">Deep Dives: Logic</h3>
                <ul className="clean-list">
                    <li><strong>Atomic Research Engine</strong>: Client-side consensus algorithm. Parses tag arrays from JSON to build weighted frequency clouds instantly.</li>
                    <li><strong>Obsidian Bridge</strong>: Private Edge Function. Fetches raw Markdown → Regex Parse (Wiki-links) → HTML Render.</li>
                    <li><strong>Lazy-Performance</strong>: <code>IntersectionObserver</code> keeps DOM light. 0-byte placeholders for 3D/Video until scroll.</li>
                </ul>
            </div>

            <div className="sci-fi-block">
                <h3 className="block-header">Living UI Layers</h3>
                <ul className="clean-list">
                    <li><strong>Layer 1 (Atmosphere)</strong>: CSS Keyframes. Infinite loops (glows, cursors). Low CPU cost.</li>
                    <li><strong>Layer 2 (State)</strong>: React. Interactive hovers, content revealing, micro-interactions.</li>
                    <li><strong>Layer 3 (Narrative)</strong>: GSAP Timelines. Complex page transitions and intro sequences.</li>
                </ul>
            </div>
        </div>
    </div>
);


/* --- Designer Content (Visual Decisions) --- */
const DesignerContent = () => (
    <div className="designer-view fade-in">
        <div className="grid-2">
            <div className="sci-fi-block">
                <h3 className="block-header">Typography System</h3>
                <table className="tech-table" style={{ tableLayout: 'fixed' }}>
                    <tbody>
                        <tr><td>PRIMARY</td><td style={{ fontFamily: 'Inter, sans-serif' }}>Inter (Clean, legible UI)</td></tr>
                        <tr><td>EDITORIAL</td><td style={{ fontFamily: 'Crimson Pro, serif' }}>Crimson Pro (Storytelling)</td></tr>
                        <tr><td>DATA/CODE</td><td style={{ fontFamily: 'Inconsolata, monospace' }}>Inconsolata (Technical data)</td></tr>
                    </tbody>
                </table>
            </div>

            <div className="sci-fi-block">
                <h3 className="block-header">Grid & Layouts</h3>
                <ul className="clean-list">
                    <li><strong>Asymmetric Grids</strong>: Breaking the 12-col standard. Content flows freely to encourage exploration.</li>
                    <li><strong>Button Blocks</strong>: Newsletter/Press keys interact like a control panel, not just links.</li>
                    <li><strong>Negative Space</strong>: Heavy use of padding to let content breathe. "Silence" is part of the design.</li>
                </ul>
            </div>
        </div>

        <div className="grid-2">
            <div className="sci-fi-block">
                <h3 className="block-header">Obsidian Visuals</h3>
                <ul className="clean-list">
                    <li><strong>Node View</strong>: Visualizing knowledge as a network, not a list.</li>
                    <li><strong>Tag Clouds</strong>: Dynamic, heat-map style sizing based on post frequency.</li>
                    <li><strong>Raw Authenticity</strong>: Styling meant to look "unfinished" and "growing", reflecting a digital garden.</li>
                </ul>
            </div>

            <div className="sci-fi-block">
                <h3 className="block-header">Motion & Kinetic</h3>
                <ul className="clean-list">
                    <li><strong>Kinetic Type</strong>: Headers that react to scroll velocity, giving weight to words.</li>
                    <li><strong>Scroll Reels</strong>: Portfolio images that flow horizontally, mimicking a film strip or gallery wall.</li>
                    <li><strong>The "Glue"</strong>: Subtle green accents (#00ff9d) indicating system life and active states.</li>
                </ul>
            </div>
        </div>
    </div>
);

const WorkshopCTA = () => (
    <div className="workshop-cta">
        <h2 className="cta-title">Build Your Own Digital Garden</h2>
        <p className="cta-text">
            Understanding the stack is just step one. <br />
            If you want to build a site like this—with your own content, ideas, and soul—but don't know where to start,
            I offer personalized guidance.
        </p>
        <a href="mailto:hello@abodid.com?subject=Workshop%20Inquiry" className="cta-btn">
            Book a 1-on-1 Workshop
        </a>
    </div>
);

export default ColophonInterface;
