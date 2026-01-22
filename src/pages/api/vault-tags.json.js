export const prerender = false;

import { vaultTags as fallbackTags } from '../../utils/tags';

const GITHUB_OWNER = "abodidsahoo";
const GITHUB_REPO = "obsidian-vault";
const TAGS_PATH = "3 - Tags"; // Path within the repo

export async function GET({ request }) {
    try {
        const token = import.meta.env.GITHUB_TOKEN;

        // If no token, return fallback (dev mode without secrets)
        if (!token) {
            console.warn("Missing GITHUB_TOKEN, using fallback tags.");
            return new Response(JSON.stringify(fallbackTags), {
                status: 200,
                headers: {
                    "Content-Type": "application/json"
                }
            });
        }

        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${TAGS_PATH}`;

        const response = await fetch(url, {
            headers: {
                "Accept": "application/vnd.github.v3+json",
                "Authorization": `token ${token}`,
                "User-Agent": "Astro-Site-Tags-Fetcher"
            }
        });

        if (!response.ok) {
            // If 404 or other error, fallback
            console.error(`GitHub API Error: ${response.status} ${response.statusText}`);
            return new Response(JSON.stringify(fallbackTags), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        const data = await response.json();

        // Filter and transform: take files ending in .md, remove extension
        const tags = data
            .filter(item => item.type === 'file' && item.name.endsWith('.md'))
            .map(item => item.name.replace(/\.md$/, ''));

        // If empty for some reason, fallback
        if (tags.length === 0) {
            return new Response(JSON.stringify(fallbackTags), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        // No Cache-Control header for real-time gamification
        return new Response(JSON.stringify(tags), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });

    } catch (e) {
        console.error("Failed to fetch vault tags:", e);
        // Absolute fallback
        return new Response(JSON.stringify(fallbackTags), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
}
