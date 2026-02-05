import React, { useState, useMemo } from 'react';
import PdfIcon from './PdfIcon.astro'; // Note: cannot default import Astro component in React directly without build config support often.
// Instead we will render the icon as SVG directly or pass it as a slot/prop if needed. 
// For simplicity in React, I'll use an SVG icon directly.

const ResearchFilter = ({ papers }) => {
    const [activeTag, setActiveTag] = useState('All');
    const [expandedPaperIds, setExpandedPaperIds] = useState(new Set());

    // 1. Extract, count and sort unique tags
    const sortedTags = useMemo(() => {
        const counts = {};

        papers.forEach(paper => {
            const tags = Array.isArray(paper.tags) ? paper.tags : (paper.tags ? [paper.tags] : []);
            tags.forEach(t => {
                const tag = t.trim();
                counts[tag] = (counts[tag] || 0) + 1;
            });
        });

        // Sort by count desc
        let tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

        // Limit to 15 max
        if (tags.length > 20) {
            tags = tags.slice(0, 20);
        }

        return ['All', ...tags];
    }, [papers]);

    // 2. Filter papers based on active tag
    const filteredPapers = useMemo(() => {
        if (activeTag === 'All') return papers;
        return papers.filter(paper => {
            if (Array.isArray(paper.tags)) {
                return paper.tags.includes(activeTag);
            }
            return paper.tags === activeTag;
        });
    }, [papers, activeTag]);

    const toggleExpand = (id) => {
        setExpandedPaperIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const isExpanded = (id) => expandedPaperIds.has(id);

    return (
        <div className="research-filter-container">
            {/* Tag Cloud */}
            <div className="filter-bar">
                <div className="filter-scroll">
                    {sortedTags.map(tag => (
                        <button
                            key={tag}
                            className={`filter-btn ${activeTag === tag ? 'contrast-active' : ''}`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* Papers List */}
            <ul className="papers-list">
                {filteredPapers.map((paper, index) => (
                    <li key={paper.id || index} className="paper-card">
                        <div className="card-header">
                            <div className="header-left">
                                {/* Title */}
                                <h2
                                    className="paper-title"
                                    dangerouslySetInnerHTML={{ __html: paper.formatted_title || paper.title }}
                                />

                                {/* Tags */}
                                <div className="paper-tags">
                                    {paper.tags && paper.tags.map(tag => (
                                        <button
                                            key={tag}
                                            className={`paper-tag ${activeTag === tag ? 'contrast-active' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveTag(tag);
                                            }}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Download Action */}
                            {paper.pdf_url && (
                                <div className="header-right">
                                    <a
                                        href={paper.pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="download-btn"
                                        title="Download PDF"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                                            <path d="M12 16L7 11H10V4H14V11H17L12 16ZM4 18H20V20H4V18Z" />
                                        </svg>
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Expand Toggle */}
                        <button
                            className="expand-toggle"
                            onClick={() => toggleExpand(paper.id || index)}
                        >
                            {isExpanded(paper.id || index) ? 'Hide Abstract' : 'Read Abstract'}
                            <span className={`chevron ${isExpanded(paper.id || index) ? 'up' : ''}`}>▼</span>
                        </button>

                        {/* Collapsible Content */}
                        <div className={`expanded-content ${isExpanded(paper.id || index) ? 'open' : ''}`}>
                            <div className="content-inner">
                                {paper.description && <p className="description">{paper.description}</p>}
                                {paper.explanation && <p className="explanation">{paper.explanation}</p>}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            <style>{`
                .research-filter-container {
                    width: 100%;
                }

                /* Filter Bar */
                .filter-bar {
                    margin-bottom: 4rem;
                    padding: 0;
                    display: flex;
                    justify-content: flex-start;
                }

                .filter-scroll {
                    display: block;
                    text-align: left;
                    width: 100%;
                    max-width: 900px;
                }

                .filter-btn {
                    display: inline-block;
                    margin: 0.5rem 0.3rem 0.5rem 0;
                    background: transparent;
                    border: 1px solid var(--border-subtle);
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 8px 16px;
                    border-radius: 100px;
                    transition: all 0.2s ease;
                }

                .filter-btn:hover {
                    border-color: var(--text-primary);
                    color: var(--text-primary);
                }



                /* List Layout */
                .papers-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    border-top: 1px solid var(--border-subtle);
                }

                .paper-card {
                    padding: 3rem 0;
                    border-bottom: 1px solid var(--border-subtle);
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 2rem;
                }

                .header-left {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .paper-title {
                    font-family: "Poppins", sans-serif;
                    font-size: 2.2rem;
                    font-weight: 600;
                    margin: 0;
                    line-height: 1.1;
                    letter-spacing: -0.02em;
                    color: var(--text-primary);
                }
                
                /* Title HTML formatting support */
                .paper-title em { font-style: italic; font-weight: 400; color: var(--text-secondary); }
                .paper-title strong { color: var(--text-primary); }
                .paper-title span { color: var(--text-secondary); }

                .paper-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.6rem;
                }

                .paper-tag {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-tertiary);
                    border: 1px solid var(--border-subtle);
                    background: transparent;
                    padding: 4px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .paper-tag:hover, .paper-tag.contrast-active {
                    color: var(--text-inverse);
                    background-color: var(--text-primary);
                    border-color: var(--text-primary);
                }

                /* Download Button */
                .download-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: var(--bg-surface);
                    color: var(--text-primary);
                    transition: transform 0.2s ease, background 0.2s ease;
                    flex-shrink: 0;
                    border: 1px solid transparent;
                }

                .download-btn:hover {
                    background: var(--text-primary);
                    color: var(--bg-color);
                    transform: scale(1.05); 
                }

                /* Expand Toggle */
                .expand-toggle {
                    align-self: flex-start;
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    transition: color 0.2s ease;
                }

                .expand-toggle:hover {
                    color: var(--text-primary);
                }

                .chevron {
                    font-size: 0.7rem;
                    transition: transform 0.3s ease;
                }
                .chevron.up {
                    transform: rotate(180deg);
                }

                /* Expanded Content */
                .expanded-content {
                    overflow: hidden;
                    max-height: 0;
                    opacity: 0;
                    transition: max-height 0.5s ease, opacity 0.5s ease, margin-top 0.3s ease;
                }

                .expanded-content.open {
                    max-height: 1000px; /* Arbitrary large height for text */
                    opacity: 1;
                    margin-top: 0.5rem;
                }

                .content-inner {
                    max-width: 800px;
                    border-left: 2px solid var(--border-subtle);
                    padding-left: 1.5rem;
                }

                .description {
                    font-size: 1.15rem;
                    line-height: 1.6;
                    color: var(--text-primary);
                    margin: 0 0 1rem 0;
                    font-weight: 500;
                }

                .explanation {
                    font-family: var(--font-sans);
                    font-size: 1rem;
                    line-height: 1.7;
                    color: var(--text-secondary);
                    margin: 0;
                }

                @media (max-width: 768px) {
                    .paper-title {
                        font-size: 1.8rem;
                    }
                    .card-header {
                        gap: 1rem;
                    }
                }
                
                @media (max-width: 600px) {
                     .card-header {
                        flex-direction: column-reverse; /* Put title block below icon or adjust as needed. 
                                                          Actually let's keep title and icon top aligned but maybe icon smaller?
                                                          Let's keep row but allow wrapping if very tight */
                     }
                     
                     .header-right {
                        position: absolute;
                        right: 0;
                        top: 3rem; /* Adjust based on padding */
                     }
                     
                     .paper-card {
                        position: relative;
                     }
                     
                     /* Adjusting for mobile specific layout similar to blog */
                     .card-header {
                         padding-right: 4rem; /* Make space for download btn */
                     }
                }
            `}</style>
        </div>
    );
};

export default ResearchFilter;
