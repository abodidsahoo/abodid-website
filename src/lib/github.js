import fs from 'node:fs';
import path from 'node:path';

// Helper to get env vars safely
const getEnv = (key) => (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env[key] : undefined) || (typeof process !== 'undefined' ? process.env[key] : undefined);

// PERSISTENT CACHE (File System)
// Robust for local dev where server restarts wipe memory.
const CACHE_DIR = path.resolve('.astro'); // Store in .astro folder (usually ignored)
const CACHE_FILE = path.join(CACHE_DIR, 'github_cache.json');
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Ensure cache dir exists
try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
} catch (e) { /* Ignore permissions issues in Prod/Serverless */ }

function readCache(key) {
    try {
        if (!fs.existsSync(CACHE_FILE)) return null;
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const allCache = JSON.parse(raw);
        return allCache[key] || null;
    } catch (e) {
        return null;
    }
}

function writeCache(key, value) {
    try {
        let allCache = {};
        if (fs.existsSync(CACHE_FILE)) {
            try { allCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')); } catch (e) { }
        }
        allCache[key] = value;
        fs.writeFileSync(CACHE_FILE, JSON.stringify(allCache, null, 2));
    } catch (e) {
        console.warn("Failed to write to local cache file:", e.message);
    }
}

export const REPO_OWNER = getEnv("GITHUB_OWNER") || "abodidsahoo";
export const REPO_NAME = getEnv("GITHUB_REPO") || "obsidian-vault";
export const GITHUB_API_BASE = "https://api.github.com";

export function getAuthHeaders() {
    const token = getEnv("GITHUB_TOKEN");
    // Only throw if we strictly require auth, but for now we let it pass to allow public fallback if needed,
    // though the current logic expects a token.
    if (!token) {
        console.warn("GITHUB_TOKEN is missing. Requests will be rate-limited.");
    }
    return token ? {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Astro-Obsidian-Vault",
    } : {
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
    const cacheKey = `contents-${path}`;
    const now = Date.now();

    // 1. Try Cache (Persistent)
    let cached = readCache(cacheKey);

    // Short-circuit: Logic for "Zero Request" interval
    if (cached && (now - cached.timestamp < 60 * 1000)) {
        return cached.data;
    }

    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}`;

    const headers = getAuthHeaders();

    // 2. Smart Check: If we have an ETag
    if (cached && cached.etag) {
        headers['If-None-Match'] = cached.etag;
    }

    try {
        const response = await fetch(url, { headers });

        // 3. Handle "Not Modified" (304)
        if (response.status === 304) {
            if (cached) {
                cached.timestamp = now;
                writeCache(cacheKey, cached); // Renew timestamp on disk
                return cached.data;
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`GitHub API Error: ${response.status} ${response.statusText}`);

            // If rate limited, force return stale cache
            if (response.status === 403) {
                if (cached) {
                    console.warn("Rate limit hit. Returning stale cache from disk.");
                    return cached.data;
                }
                // EMERGENCY MOCK IF EMPTY (Avoid 0 notes crash loop)
                // If it's the tags folder, return empty to not break logic
                // If it's notes, return logic below
                console.warn("Rate limit hit and NO cache. Returning empty to prevent crash.");
                return [];
            }

            throw new Error(`GitHub API Error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}`);
        }

        const data = await response.json();
        const etag = response.headers.get('etag');

        if (!Array.isArray(data)) {
            return [];
        }

        const result = data.map(item => ({
            name: item.name,
            path: item.path,
            type: item.type,
            download_url: item.download_url
        })).filter(item => item.name.endsWith('.md') || item.type === 'dir');

        // Update Cache
        writeCache(cacheKey, {
            data: result,
            timestamp: now,
            etag: etag
        });

        return result;

    } catch (error) {
        console.error("Failed to fetch repo contents:", error);
        // Fallback to stale cache
        let fallback = readCache(cacheKey);
        if (fallback) {
            return fallback.data;
        }
        throw error;
    }
}

export async function getVaultTags() {

    const data = await getRepoContents("3 - Tags");
    return data || [];
}

export async function getVaultNotes() {

    // Hardcoded path to ensure no variable resolution issues
    const contents = await getRepoContents("6 - Main Notes");

    if (contents.length === 0) {
        console.warn("[GitHub] No contents found in '6 - Main Notes'");
        return [];
    }

    // STRICT FILTER: Only allow files (notes), no directories.
    // This prevents folders from appearing in the notes list.
    const files = contents.filter(item => item.type === 'file' && item.name.endsWith('.md'));

    return files;
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
