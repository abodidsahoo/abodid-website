import React from 'react';
import { marked } from 'marked';

export default function BlogBlockRenderer({ blocks }) {
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
        return null;
    }

    return (
        <div className="prose block-based-prose">
            {blocks.map((block, index) => {
                const type = block.blockType || block.type;
                const content = block.content || block;
                const key = block.id || index;

                switch (type) {
                    case 'body_text':
                    case 'text':
                    case 'paragraph': {
                        const textVal = (content && typeof content === 'object' ? content.text : null)
                            || (typeof content === 'string' ? content : null)
                            || block.text
                            || (typeof block.content === 'string' ? block.content : null);
                        if (!textVal) return null;
                        return (
                            <div 
                                key={key} 
                                dangerouslySetInnerHTML={{ __html: marked.parse(textVal) }}
                            />
                        );
                    }

                    case 'heading': {
                        const level = content.level || block.level || 2;
                        const HeadingTag = level === 3 ? 'h3' : 'h2';
                        const headingText = content.text || block.text || (typeof content === 'string' ? content : '');
                        return <HeadingTag key={key}>{headingText}</HeadingTag>;
                    }

                    case 'quotation':
                    case 'quote': {
                        const quoteText = content.quote || content.text || block.quote || block.text || (typeof content === 'string' ? content : '');
                        const author = content.attribution || content.citation || content.author || block.author;
                        return (
                            <blockquote key={key}>
                                <p>{quoteText}</p>
                                {author && (
                                    <cite>— {author}</cite>
                                )}
                            </blockquote>
                        );
                    }

                    case 'highlight':
                        return (
                            <div key={key} className="block-highlight" style={{
                                borderLeft: '3px solid var(--text-primary)',
                                paddingLeft: '1.2rem',
                                margin: '1.8rem 0',
                                fontStyle: 'italic',
                                color: 'var(--text-secondary)'
                            }}>
                                <div dangerouslySetInnerHTML={{ __html: marked.parse(content.text || '') }} />
                            </div>
                        );

                    case 'single_image':
                    case 'image': {
                        const media = content.media || content;
                        const url = media.url || media.imageUrl;
                        if (!url) return null;

                        if (!media.caption) {
                            return (
                                <img 
                                    key={key} 
                                    src={url} 
                                    alt={media.alt || ''} 
                                    loading="lazy" 
                                    style={{ width: '100%', height: 'auto', borderRadius: '4px', margin: '2rem 0', display: 'block' }} 
                                />
                            );
                        }

                        return (
                            <figure key={key} className="block-image" style={{ margin: '2rem 0', padding: 0, width: '100%' }}>
                                <img src={url} alt={media.alt || media.caption || ''} loading="lazy" style={{ width: '100%', height: 'auto', borderRadius: '4px', margin: 0, display: 'block' }} />
                                <figcaption style={{ textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '0.75rem' }}>{media.caption}</figcaption>
                            </figure>
                        );
                    }

                    case 'video_embed':
                    case 'video': {
                        const url = content.url;
                        if (!url) return null;
                        let embedUrl = url;
                        if (url.includes('youtube.com') || url.includes('youtu.be')) {
                            const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{6,})/);
                            if (match && match[1]) {
                                embedUrl = `https://www.youtube.com/embed/${match[1]}`;
                            }
                        } else if (url.includes('vimeo')) {
                            const id = url.split('/').pop().split('?')[0];
                            embedUrl = `https://player.vimeo.com/video/${id}`;
                        }

                        return (
                            <figure key={key} className="block-video" style={{ margin: '2rem 0', padding: 0, width: '100%' }}>
                                <div className="video-wrapper" style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px' }}>
                                    <iframe 
                                        src={embedUrl} 
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                        allowFullScreen 
                                        title={content.caption || 'Embedded Video'}
                                    />
                                </div>
                                {content.caption && <figcaption style={{ textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '0.75rem' }}>{content.caption}</figcaption>}
                            </figure>
                        );
                    }

                    case 'divider':
                        return <hr key={key} className="block-divider" />;

                    case 'two_columns':
                    case 'columns':
                        return (
                            <div key={key} className="block-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', margin: '2rem 0' }}>
                                <div dangerouslySetInnerHTML={{ __html: marked.parse(content.leftText || '') }} />
                                <div dangerouslySetInnerHTML={{ __html: marked.parse(content.rightText || '') }} />
                            </div>
                        );

                    default:
                        return null;
                }
            })}
        </div>
    );
}
