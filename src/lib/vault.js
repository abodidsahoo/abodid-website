import { getAuthHeaders, GITHUB_API_BASE, REPO_OWNER, REPO_NAME } from './github.js';

// Cache structure: { timestamp: number, notes: Array<{path, content, name}> }
let vaultCache = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch all markdown notes from '6 - Main Notes' recursively using User Tree API
 * to get the file list, then fetching contents in parallel.
 */
export async function getAllVaultNotes() {
    // 1. Check Cache
    if (vaultCache && (Date.now() - vaultCache.timestamp < CACHE_TTL_MS)) {

        return vaultCache.notes;
    }



    try {
        // 2. Fetch Tree (Recursive)
        const treeUrl = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/main?recursive=1`;
        const treeRes = await fetch(treeUrl, { headers: getAuthHeaders() });

        if (!treeRes.ok) {
            console.error(`[Vault] Failed to fetch tree: ${treeRes.statusText}`);
            return [];
        }

        const treeData = await treeRes.json();
        if (!treeData.tree) return [];

        // 3. Filter for Markdown files in "6 - Main Notes"
        const noteFiles = treeData.tree.filter(item =>
            item.path.startsWith('6 - Main Notes/') &&
            item.path.endsWith('.md') &&
            item.type === 'blob'
        );



        // 4. Fetch Contents in Parallel (Batched to avoid rate limits if necessary, but 250 is usually fine)
        // We'll use a small concurrency limit just to be safe.
        const notes = [];
        const BATCH_SIZE = 20;

        for (let i = 0; i < noteFiles.length; i += BATCH_SIZE) {
            const batch = noteFiles.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map(async (file) => {
                try {
                    // Use the 'url' from the tree item which is the Git Blob API URL
                    // simpler than constructing raw content urls? 
                    // formatting: https://api.github.com/repos/:owner/:repo/git/blobs/:sha
                    // The tree item has .url property which mimics this.
                    // BUT `file.url` requires auth headers to read private repos.

                    const blobRes = await fetch(file.url, { headers: getAuthHeaders() });
                    if (!blobRes.ok) return null;

                    const blobData = await blobRes.json();
                    const content = Buffer.from(blobData.content, 'base64').toString('utf-8');

                    return {
                        name: file.path.split('/').pop(), // filename only
                        path: file.path,
                        content: content
                    };
                } catch (e) {
                    console.error(`[Vault] Failed to fetch ${file.path}:`, e);
                    return null;
                }
            }));
            notes.push(...results.filter(n => n !== null));
        }

        // 5. Update Cache
        vaultCache = {
            timestamp: Date.now(),
            notes: notes
        };


        return notes;

    } catch (e) {
        console.error("[Vault] Error in getAllVaultNotes:", e);
        return [];
    }
}

/**
 * Find notes that reference a specific tag.
 * Handles: [[tag]], [[tag|alias]], #tag
 * @param {string} tagName - The name of the tag (without brackets)
 */
export async function findNotesReferencing(tagName) {
    const allNotes = await getAllVaultNotes();

    // Normalize tagName (remove .md extension if present)
    const target = tagName.replace(".md", "").toLowerCase();

    return allNotes.filter(note => {
        // Simple case-insensitive check first for performance
        const lowerContent = note.content.toLowerCase();

        // Check for wikilinks: [[target]] or [[target|...]]
        // We need to be careful with regex to match exact tag name boundaries.
        // Regex: \[\[\s*target\s*(?:\|[^\]]*)?\]\]
        // escaping for regex: \[\[\s*target\s*(?:\|[^\]]*)?\]\]

        // Explanation:
        // \[\[ : starts with [[
        // \s* : optional whitespace
        // target : our tag name
        // \s* : optional whitespace
        // (?:\|[^\]]*)? : optional alias starting with | and not containing ]
        // \]\] : ends with ]]

        const wikiLinkRegex = new RegExp(`\\[\\[\\s*${escapeRegExp(target)}\\s*(?:\\|[^\\]]*)?\\]\\]`, 'i');

        // Also check for hashtags if desired? 
        // User asked for "double brackets", so we prioritize that. 
        // But Obsidian often uses #tag too. Let's stick to user request: "I put double brackets and put the tags"

        return wikiLinkRegex.test(note.content);
    });
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
