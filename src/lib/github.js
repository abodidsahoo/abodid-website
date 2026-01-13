export const GITHUB_API_BASE = "https://api.github.com";

// Load from environment variables
const getAuthHeaders = () => {
    const token = import.meta.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
        console.warn("Missing GITHUB_TOKEN environment variable. GitHub API requests may fail or be rate-limited.");
        return {};
    }
    return {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
    };
};

// Configuration - TO BE UPDATED BY USER
// You can also move these to environment variables if you prefer
const REPO_OWNER = import.meta.env.GITHUB_OWNER || "abodidsahoo"; // Defaulting to known user, update if needed
const REPO_NAME = import.meta.env.GITHUB_REPO || "obsidian-vault"; // Placeholder
const REPO_PATH = import.meta.env.GITHUB_PATH || ""; // Root or specific folder like "Notes"

/**
 * Fetch the list of files from the repository
 * @param {string} path - Optional subpath
 */
export async function getRepoContents(path = REPO_PATH) {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

    try {
        const response = await fetch(url, { headers: getAuthHeaders() });

        if (!response.ok) {
            console.error(`GitHub API Error: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();

        // Filter for Markdown files or directories
        // If it's an array, it's a directory listing. If object, it's a file (or submodule).
        if (Array.isArray(data)) {
            return data
                .filter(item => item.name.endsWith('.md') || item.type === 'dir')
                .map(item => ({
                    name: item.name,
                    path: item.path,
                    type: item.type,
                    sha: item.sha,
                    url: item.html_url,
                    download_url: item.download_url
                }));
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch repo contents:", error);
        return [];
    }
}

/**
 * Fetch raw content of a specific file
 * @param {string} filePath 
 */
export async function getFileContent(filePath) {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;

    try {
        const response = await fetch(url, { headers: getAuthHeaders() });

        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const data = await response.json();

        // Content is base64 encoded
        if (data.content && data.encoding === 'base64') {
            // Decode base64 to utf-8
            const decoded = atob(data.content.replace(/\n/g, ''));
            // Decode utf-8 specifically to handle special characters/emojis correctly
            return new TextDecoder('utf-8').decode(Uint8Array.from(decoded, c => c.charCodeAt(0)));
        }

        // Fallback for download_url if needed (usually raw fetch)
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
