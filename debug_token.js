import 'dotenv/config';

const token = process.env.GITHUB_TOKEN;
const owner = "abodidsahoo";
const repo = "obsidian-vault";

async function check() {
    if (!token) {
        console.error("❌ NO GITHUB_TOKEN FOUND in process.env");
        return;
    }
    console.log(`✅ Token found (starts with: ${token.substring(0, 4)}...)`);

    // Fetch TAGS contents
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/3%20-%20Tags`;
    console.log(`\nFetching TAGS from: ${url}`);

    try {
        const res = await fetch(url, {
            headers: {
                "Authorization": `token ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "Debug-Script"
            }
        });

        if (res.ok) {
            const data = await res.json();
            console.log("\n✅ CONTENTS found:");
            data.forEach(item => {
                console.log(`- [${item.type}] ${item.name}`);
            });
        } else {
            console.error(`❌ FAILED: ${res.status} ${res.statusText}`);
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

check();
