// Configuration (defaults can be overridden by env vars if needed, but these are code-level config)
// Helper to get env vars safely in both Vite (Astro) and Node (Scripts) contexts
const getEnv = (key) => (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env[key] : undefined) || (typeof process !== 'undefined' ? process.env[key] : undefined);

export const REPO_OWNER = getEnv("GITHUB_OWNER") || "abodidsahoo";
export const REPO_NAME = getEnv("GITHUB_REPO") || "obsidian-vault";
export const GITHUB_API_BASE = "https://api.github.com";

// Folder mappings
const PATH_TAGS = "3 - Tags";
const PATH_NOTES = "6 - Main Notes";

export function getAuthHeaders() {
    const token = getEnv("GITHUB_TOKEN");
    if (!token) {
        console.error("GITHUB_TOKEN is missing from environment variables.");
        throw new Error("Configuration Error: GITHUB_TOKEN is missing. Please add it to your environment variables (Vercel Settings).");
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
    console.log(`[GitHub] Fetching contents for path: "${path}"`);
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}`;

    const fetchWithAuth = async (useToken = true) => {
        const headers = useToken ? getAuthHeaders() : {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Astro-Obsidian-Vault"
        };
        console.log(`[GitHub] Request URL: ${url} (Auth: ${useToken})`);
        if (useToken) {
            const token = getEnv("GITHUB_TOKEN");
            console.log(`[GitHub] Token status: ${token ? "Present (" + token.substring(0, 4) + "...)" : "Missing"}`);
        }
        return await fetch(url, { headers });
    };

    try {
        let response = await fetchWithAuth(true);

        // If Unauth (Bad Token) or Forbidden (Rate Limit potentially), try public if it was auth
        if (response.status === 401) {
            console.warn("[GitHub] Token invalid (401). Retrying with public access...");
            response = await fetchWithAuth(false);
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`GitHub API Error: ${response.status} ${response.statusText}`);
            console.error(errorText);

            const token = getEnv("GITHUB_TOKEN");
            const tokenPrefix = token ? token.substring(0, 4) + "..." : "NONE";

            // Throw specific error to be caught by the UI
            throw new Error(`GitHub API Error: ${response.status} ${response.statusText} 
            | Target: ${REPO_OWNER}/${REPO_NAME} 
            | Token: ${tokenPrefix} 
            | Msg: ${errorText.substring(0, 100)}`);
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
        throw error; // Rethrow to let the UI handle it and show the message
    }
}

export async function getVaultTags() {
    console.log("[GitHub] Fetching Tags from '3 - Tags'");
    const data = await getRepoContents("3 - Tags");
    return data || [];
}

export async function getVaultNotes() {
    console.log("[GitHub] Fetching Notes from '6 - Main Notes'");
    // Hardcoded path to ensure no variable resolution issues
    const contents = await getRepoContents("6 - Main Notes");

    if (contents.length === 0) {
        console.warn("[GitHub] No contents found in '6 - Main Notes'");
        return [];
    }

    // STRICT FILTER: Only allow files (notes), no directories.
    // This prevents folders from appearing in the notes list.
    const files = contents.filter(item => item.type === 'file' && item.name.endsWith('.md'));
    console.log(`[GitHub] Found ${files.length} notes (filtered from ${contents.length} items)`);
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
