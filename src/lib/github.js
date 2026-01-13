import { GITHUB_TOKEN } from "astro:env/server";

const GITHUB_API_BASE = "https://api.github.com";

// Configuration (defaults can be overridden by env vars if needed, but these are code-level config)
const REPO_OWNER = import.meta.env.GITHUB_OWNER || process.env.GITHUB_OWNER || "abodidsahoo";
const REPO_NAME = import.meta.env.GITHUB_REPO || process.env.GITHUB_REPO || "obsidian-vault";

// Folder mappings
const PATH_TAGS = "3 - Tags";
const PATH_NOTES = "6 - Main Notes";

function getAuthHeaders() {
    const token = GITHUB_TOKEN || import.meta.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
        console.error("GITHUB_TOKEN is missing from environment variables.");
        return {};
    }
    return {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Astro-Obsidian-Vault",
    };
}

/**
 * Fetch contents of a directory
 * @param {string} path 
 * @returns {Promise<Array>}
 */
export async function getRepoContents(path = "") {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}`;

    try {
        const response = await fetch(url, { headers: getAuthHeaders() });

        if (!response.ok) {
            console.error(`GitHub API Error: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            return [];
        }

        // Filter for files/dirs we care about
        return data.map(item => ({
            name: item.name,
            path: item.path,
            type: item.type, // 'file' or 'dir'
            download_url: item.download_url
        })).filter(item => item.name.endsWith('.md') || item.type === 'dir');

    } catch (error) {
        console.error("Failed to fetch repo contents:", error);
        return [];
    }
}

export async function getVaultTags() {
    return await getRepoContents(PATH_TAGS);
}

export async function getVaultNotes() {
    return await getRepoContents(PATH_NOTES);
}

/**
 * Fetch raw content of a markdown file
 * @param {string} filePath 
 * @returns {Promise<string|null>}
 */
export async function getFileContent(filePath) {
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}`;

    try {
        const response = await fetch(url, { headers: getAuthHeaders() });

        if (!response.ok) {
            // 404 is expected if file doesn't exist
            return null;
        }

        const data = await response.json();

        // Content is base64 encoded
        if (data.content && data.encoding === 'base64') {
            // Basic base64 decode (handles UTF-8 better than atob sometimes, but atob is standard in Node 18+)
            return Buffer.from(data.content, 'base64').toString('utf-8');
        }

        // Fallback for large files
        if (data.download_url) {
            const rawRes = await fetch(data.download_url);
            return await rawRes.text();
        }

        return "";
    } catch (error) {
        console.error("Error fetching file content:", error);
        return null;
    }
}

/**
 * Fetch raw binary content of a file (for images/assets)
 * @param {string} filePath 
 * @returns {Promise<ArrayBuffer|null>}
 */
export async function getFileRaw(filePath) {
    const encodedPath = filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}`;

    try {
        const response = await fetch(url, { headers: getAuthHeaders() });

        if (!response.ok) {
            console.error(`Failed to fetch raw file ${filePath}: ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        if (data.content && data.encoding === 'base64') {
            // Decode base64 to binary string
            const binaryString = atob(data.content.replace(/\n/g, ''));
            // Convert to ArrayBuffer
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        }

        // Fallback: If it's a large file, GitHub might provide download_url and no content
        if (data.download_url) {
            const rawRes = await fetch(data.download_url);
            return await rawRes.arrayBuffer();
        }

        return null;
    } catch (error) {
        console.error("Error fetching raw file:", error);
        return null;
    }
}

/**
 * Search the repository for specific content (used for backlinks/tags)
 * @param {string} query - The search term (e.g. "[[tag-name]]")
 * @returns {Promise<Array>} - Array of matching file objects
 */
export async function searchRepo(query) {
    // GitHub Code Search API
    // q=repo:owner/name+query
    const q = encodedQuery(query, REPO_OWNER, REPO_NAME);
    const url = `${GITHUB_API_BASE}/search/code?q=${q}`;

    try {
        const response = await fetch(url, { headers: getAuthHeaders() });
        if (!response.ok) {
            console.error(`Search failed: ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        return data.items || [];
    } catch (error) {
        console.error("Error searching repo:", error);
        return [];
    }
}

function encodedQuery(term, owner, repo) {
    // GitHub search syntax: term repo:owner/repo
    // We strictly search for the term.
    const repoScope = `repo:${owner}/${repo}`;
    return encodeURIComponent(`${term} ${repoScope}`);
}
