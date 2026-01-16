
import https from 'https';
import fs from 'fs';

const films = [
    {
        "title": "Hermosa Design Studio - English Version",
        "categories": ["Brand Film"],
        "roles": ["Director", "Editor", "Creative Producer"],
        "link": "https://vimeo.com/1081726500"
    },
    {
        "title": "Budweiser - Bud Banter Club",
        "categories": ["Brand Film", "Experimental"],
        "roles": ["Editor"],
        "link": "https://vimeo.com/1081716668"
    },
    {
        "title": "Neon Xypher",
        "categories": ["Experimental", "Visual Effects", "Dance Film"],
        "roles": ["Director", "Editor", "DOP", "VFX Artist", "Sound Designer"],
        "link": "https://vimeo.com/414243593"
    },
    {
        "title": "Bloombai",
        "categories": ["Fashion Film"],
        "roles": ["Director", "Editor", "Colorist"],
        "link": "https://vimeo.com/411314960"
    },
    {
        "title": "Odisha Tourism",
        "categories": ["Travel Film", "Advertising Campaign"],
        "roles": ["Director", "Creative Producer", "Editor", "Colorist"],
        "link": "https://vimeo.com/265220711"
    },
    {
        "title": "Guatemala Tourism",
        "categories": ["Travel Film"],
        "roles": ["Editor", "Colorist", "Sound Designer"],
        "link": "https://www.youtube.com/watch?v=M2qFEgO-qoc"
    },
    {
        "title": "Hermosa Design Studio - Hindi Version",
        "categories": ["Brand Film"],
        "roles": ["Director", "Editor", "Creative Producer"],
        "link": "https://www.youtube.com/watch?v=EMsZT9PCFms"
    },
    {
        "title": "Budweiser Streetwear",
        "categories": ["Brand Film"],
        "roles": ["DOP", "Editor", "Colorist", "Sound Designer"],
        "link": "https://vimeo.com/451507630?fl=pl&fe=vl"
    },
    {
        "title": "Show me the way (VH1 India)",
        "categories": ["Music Video"],
        "roles": ["Director", "DOP", "Editor", "Colorist", "VFX Artist"],
        "link": "https://www.youtube.com/watch?v=fooE0W_mFSY"
    },
    {
        "title": "Love Edition - The Living Room Tour",
        "categories": ["Non-Fiction Storytelling"],
        "roles": ["Editor", "Colorist", "Motion Designer"],
        "link": "https://www.youtube.com/watch?v=DcAOTVnof6I"
    },
    {
        "title": "Pride Edition - The Living Room Tour",
        "categories": ["Non-Fiction Storytelling"],
        "roles": ["Editor", "Motion Designer", "Colorist", "Sound Mix"],
        "link": "https://www.youtube.com/watch?v=tSVvI_nMZD8"
    },
    {
        "title": "The Living Room Tour - Sizzle",
        "categories": ["Promo Content"],
        "roles": ["Editor", "Sound Designer", "Creative Conceptualiser"],
        "link": "https://www.youtube.com/watch?v=ooxxgMCX-HY"
    },
    {
        "title": "Educate Girls - Sovni",
        "categories": ["Documentary", "Non-Fiction Storytelling"],
        "roles": ["Editor", "Colorist", "Sound Designer"],
        "link": "https://www.youtube.com/watch?v=rgi6gSZiWqE"
    },
    {
        "title": "Educate Girls - Monica",
        "categories": ["Documentary", "Non-Fiction Storytelling"],
        "roles": ["Editor", "Colorist", "Sound Designer"],
        "link": "https://www.youtube.com/watch?v=LwUfhr4hB5Y"
    },
    {
        "title": "Jawa Motorcycles - Ad Film BTS",
        "categories": ["Advertising Campaign"],
        "roles": ["Editor", "Sound Designer", "Colorist"],
        "link": "https://www.youtube.com/watch?v=CSmZHXpr13E"
    },
    {
        "title": "The Jawa Experience - Rajasthan",
        "categories": ["Advertising Campaign"],
        "roles": ["Editor", "Sound Designer", "Colorist"],
        "link": "https://www.youtube.com/watch?v=SYUQyPzpwhA"
    }
];

const fetchJson = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) { resolve(null); }
                } else {
                    resolve(null);
                }
            });
        }).on('error', (err) => resolve(null));
    });
};

const checkUrlExists = (url) => {
    return new Promise((resolve) => {
        const req = https.request(url, { method: 'HEAD' }, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.end();
    });
};

const getThumbnail = async (link) => {
    try {
        if (link.includes('vimeo')) {
            // Request 1920px width explicitly
            const data = await fetchJson(`https://vimeo.com/api/oembed.json?url=${link}&width=1920`);
            return data?.thumbnail_url || null;
        } else if (link.includes('youtube') || link.includes('youtu.be')) {
            const id = link.match(/(?:v=|youtu\.be\/)([\w-]+)/)?.[1];
            if (!id) return null;

            // Try Max Res first
            const maxRes = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
            if (await checkUrlExists(maxRes)) return maxRes;

            // Fallback to High Quality
            return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
        }
    } catch (e) {
        console.error(`Error fetching thumbnail for ${link}:`, e.message);
    }
    return 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80'; // Fallback
};

const generateSQL = async () => {
    let sql = `-- 1. Update Schema
ALTER TABLE public.films 
ADD COLUMN IF NOT EXISTS categories text[],
ADD COLUMN IF NOT EXISTS roles text[];

-- 2. Clean Slate (Removes old "sample" data)
TRUNCATE TABLE public.films;

-- 3. Insert Fresh Data
INSERT INTO public.films (title, categories, roles, video_url, thumbnail_url, description, year, published)
VALUES
`;

    const values = [];

    for (const film of films) {
        // Transformations: Merge categories as requested
        let processedCats = film.categories.map(c => {
            if (c === 'Promo Content') return 'Advertising Campaign';
            if (c === 'Brand Campaign') return 'Brand Film';
            return c;
        });

        // Deduplicate: Remove any resulting duplicates (e.g. if mapped value already existed)
        processedCats = [...new Set(processedCats)];

        const thumbnail = await getThumbnail(film.link);
        const title = film.title.replace(/'/g, "''");
        const cats = `ARRAY['${processedCats.join("','")}']`;
        const roles = `ARRAY['${film.roles.join("','")}']`;
        const url = film.link;
        // Use generic fallback ONLY if fetch failed completely
        const thumb = thumbnail || 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80';
        const year = 2024;

        values.push(`    ('${title}', ${cats}, ${roles}, '${url}', '${thumb}', 'Description for ${title}', ${year}, true)`);
        console.log(`Processed: ${title} -> ${thumbnail ? 'High-Res OK' : 'Fallback Used'}`);
    }

    sql += values.join(',\n') + ';';

    fs.writeFileSync('populate_films.sql', sql);
    console.log('SQL generated: populate_films.sql - Ready for Clean Import');
};

generateSQL();
