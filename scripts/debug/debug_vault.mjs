import 'dotenv/config';

const OWNER = process.env.GITHUB_OWNER || "abodidsahoo";
const REPO = process.env.GITHUB_REPO || "obsidian-vault";

async function debugRepo() {
    // Explicitly NO TOKEN for public test
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/`;
    console.log(`Fetching (Public): ${url}`);

    try {
        const res = await fetch(url, {
            headers: {
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "Debug-Script"
            }
        });

        if (!res.ok) {
            console.error(`Error: ${res.status} ${res.statusText}`);
            if (res.status === 404) {
                console.error("Repo not found (or is private and requires token).");
            }
            return;
        }

        const data = await res.json();
        console.log("\n--- Repository Root Contents ---");
        data.forEach(item => {
            console.log(`[${item.type}] ${item.name}`);
        });

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

debugRepo();
