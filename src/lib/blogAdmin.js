import { supabase } from './supabaseClient';

// ─── Convert Legacy Markdown Content to Individual Block JSON ──────────────────
function convertMarkdownToBlocks(markdown) {
    if (!markdown || !markdown.trim()) return [];

    const blocks = [];
    const sections = markdown.split(/\n\s*\n/);

    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;

        // Image: ![alt](url)
        const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
        if (imgMatch) {
            blocks.push({
                id: crypto.randomUUID(),
                blockType: 'single_image',
                content: {
                    media: {
                        url: imgMatch[2],
                        alt: imgMatch[1] || '',
                        caption: ''
                    }
                },
                settings: { width: 'standard', spacing: 'default' }
            });
            continue;
        }

        // Heading: # Heading or ## Heading
        const headMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headMatch) {
            const level = Math.min(3, Math.max(2, headMatch[1].length));
            blocks.push({
                id: crypto.randomUUID(),
                blockType: 'heading',
                content: {
                    text: headMatch[2],
                    level
                },
                settings: { width: 'standard', spacing: 'default' }
            });
            continue;
        }

        // Divider: --- or ***
        if (trimmed.match(/^---+$/) || trimmed.match(/^\*\*\*+$/)) {
            blocks.push({
                id: crypto.randomUUID(),
                blockType: 'divider',
                content: {},
                settings: { width: 'standard', spacing: 'default' }
            });
            continue;
        }

        // Quote: > text
        if (trimmed.startsWith('> ')) {
            const quoteText = trimmed.split('\n').map(l => l.replace(/^>\s?/, '')).join('\n').trim();
            blocks.push({
                id: crypto.randomUUID(),
                blockType: 'quotation',
                content: {
                    quote: quoteText,
                    attribution: ''
                },
                settings: { width: 'standard', spacing: 'default' }
            });
            continue;
        }

        // Distinct body paragraph block
        blocks.push({
            id: crypto.randomUUID(),
            blockType: 'body_text',
            content: { text: trimmed },
            settings: { width: 'standard', spacing: 'default' }
        });
    }

    return blocks;
}

// ─── Compile Blocks back to Markdown for search & fallback sync ──────────────
function compileBlocksToMarkdown(blocks) {
    if (!Array.isArray(blocks)) return '';
    return blocks.map(block => {
        const c = block.content || {};
        switch (block.blockType) {
            case 'body_text': return c.text || '';
            case 'heading': return `${'#'.repeat(c.level || 2)} ${c.text || ''}`;
            case 'quotation': return `> ${c.quote || ''}${c.attribution ? `\n> — ${c.attribution}` : ''}`;
            case 'highlight': return `> ${c.text || ''}`;
            case 'divider': return '---';
            case 'single_image': return c.media?.url ? `![${c.media.alt || 'Image'}](${c.media.url})` : '';
            case 'video_embed': return c.url ? `[Video](${c.url})` : '';
            case 'two_columns': return `${c.leftText || ''}\n\n${c.rightText || ''}`;
            default: return '';
        }
    }).filter(Boolean).join('\n\n');
}

// ─── Blog Admin Service Layer ─────────────────────────────────────────────────

export async function listAdminBlogs() {
    const { data, error } = await supabase
        .from('blog')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('published_at', { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(post => {
        let status = 'draft';
        if (post.published) status = 'published';
        if (Array.isArray(post.category) && post.category.includes('archived')) status = 'archived';

        let blocks = Array.isArray(post.blocks) ? post.blocks : [];
        if (blocks.length === 0 && post.content && post.content.trim()) {
            blocks = convertMarkdownToBlocks(post.content);
        }

        return {
            ...post,
            status,
            cover_url: post.cover_image,
            category: Array.isArray(post.category) ? post.category : (post.category ? [post.category] : []),
            tags: Array.isArray(post.tags) ? post.tags : (post.tags ? [post.tags] : []),
            blocks
        };
    });
}

export async function getAdminBlog(id) {
    const { data, error } = await supabase
        .from('blog')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw new Error(error.message);

    let blocks = Array.isArray(data.blocks) ? data.blocks : [];
    if (blocks.length === 0 && data.content && data.content.trim()) {
        blocks = convertMarkdownToBlocks(data.content);
    }

    return {
        ...data,
        category: Array.isArray(data.category) ? data.category : (data.category ? [data.category] : []),
        tags: Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []),
        blocks
    };
}

export async function createAdminBlog(title = 'Untitled post') {
    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled-post';
    const slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data, error } = await supabase
        .from('blog')
        .insert([{
            title,
            slug,
            published: false,
            blocks: [],
            category: [],
            tags: []
        }])
        .select('id')
        .single();

    if (error) throw new Error(error.message);
    return data.id;
}

export async function saveBlogDraft(id, payload) {
    const { status, cover_url, ...cleanPayload } = payload;

    if ('category' in cleanPayload) {
        if (typeof cleanPayload.category === 'string') {
            cleanPayload.category = cleanPayload.category.split(',').map(s => s.trim()).filter(Boolean);
        } else if (!Array.isArray(cleanPayload.category)) {
            cleanPayload.category = [];
        }
    }

    if ('tags' in cleanPayload) {
        if (typeof cleanPayload.tags === 'string') {
            cleanPayload.tags = cleanPayload.tags.split(',').map(s => s.trim()).filter(Boolean);
        } else if (!Array.isArray(cleanPayload.tags)) {
            cleanPayload.tags = [];
        }
    }

    if ('blocks' in cleanPayload) {
        if (!Array.isArray(cleanPayload.blocks)) {
            cleanPayload.blocks = [];
        }
        cleanPayload.content = compileBlocksToMarkdown(cleanPayload.blocks);
    }

    const { error } = await supabase
        .from('blog')
        .update(cleanPayload)
        .eq('id', id);

    if (error) throw new Error(error.message);
}

export async function publishBlogPost(id) {
    const { error } = await supabase
        .from('blog')
        .update({ published: true, published_at: new Date().toISOString() })
        .eq('id', id);

    if (error) throw new Error(error.message);
}

export async function unpublishBlogPost(id) {
    const { error } = await supabase
        .from('blog')
        .update({ published: false })
        .eq('id', id);

    if (error) throw new Error(error.message);
}

export async function archiveAdminBlog(id) {
    const { data } = await supabase.from('blog').select('category').eq('id', id).single();
    let categories = Array.isArray(data?.category) ? data.category : [];
    if (!categories.includes('archived')) categories.push('archived');
    const { error } = await supabase
        .from('blog')
        .update({ published: false, category: categories })
        .eq('id', id);

    if (error) throw new Error(error.message);
}

export async function reorderAdminBlogs(ids) {
    for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase.from('blog').update({ sort_order: i }).eq('id', ids[i]);
        if (error) throw new Error(error.message);
    }
}

export async function updateBlogSlug(id, slug) {
    const { error } = await supabase.from('blog').update({ slug }).eq('id', id);
    if (error) throw new Error(error.message);
}

export async function uploadBlogImage(file) {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `content-assets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from('blog')
        .upload(path, file, { upsert: false });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from('blog').getPublicUrl(path);
    return { url: data.publicUrl, path };
}
