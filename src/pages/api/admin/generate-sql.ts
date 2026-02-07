
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// Emotions & Themes
const THEMES = {
    melancholy: ["Quiet Decay", "Soft Grief", "Blue Silence", "Heavy Air", "Lost Time", "Fading Light", "Cold Warmth"],
    serenity: ["Liquid Peace", "Still Breath", "White Noise", "Gentle Flow", "Calm Void", "Soft Focus", "Silent Bloom"],
    chaos: ["Fractured Lines", "Visual Noise", "Sharp Static", "Broken Loop", "Hard Edge", "Neon Panic", "Red Dust"],
    nostalgia: ["Sepia Dream", "Old Memory", "Dusty Light", "Warm Echo", "Faded Print", "Slow Time", "Golden Hour"],
    isolation: ["Single Point", "Vast Empty", "Lonely Grid", "Solo Echo", "Blank Wall", "Dark Corner", "Zero Signal"],
    industrial: ["Cold Steel", "Concrete Sky", "Rust Vein", "Grey Smoke", "Hard Angle", "Metal Silence", "Urban Decay"],
    nature: ["Green Breath", "Wild Growth", "Deep Root", "Sun Spot", "Rain Shadow", "Earth Pulse", "Leaf Whisper"],
    dream: ["Lucid Haze", "Violent Sleep", "Soft Terror", "Pink Cloud", "Warm Drift", "Falling Up", "Quiet Scream"]
};

// Divergent / Weird comments
const DIVERGENT = [
    "Machine Error", "System Glitch", "Void Stare", "Data Leak", "Wrong File", "Ghost Input", "Null Reference", "Signal Loss"
];

const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

export const GET: APIRoute = async () => {
    // 1. Fetch all comments
    const { data: comments, error } = await supabase
        .from('photo_feedback')
        .select('id, image_url, feeling_text')
        .order('image_url');

    if (error) return new Response(JSON.stringify({ error }), { status: 500 });
    if (!comments || comments.length === 0) return new Response("No comments found.", { status: 200 });

    // 2. Group by Image
    const byImage: Record<string, typeof comments> = {};
    comments.forEach(c => {
        if (!byImage[c.image_url]) byImage[c.image_url] = [];
        byImage[c.image_url].push(c);
    });

    // 3. Generate SQL
    let sqlOutput = "-- AUTOMATICALLY GENERATED COMMENT UPDATES\n";
    sqlOutput += "-- Theme-based emotional refinement for Invisible Punctum\n\n";

    const themesList = Object.keys(THEMES) as (keyof typeof THEMES)[];

    for (const [url, imageComments] of Object.entries(byImage)) {
        // Assign a random theme to this image
        const themeName = themesList[Math.floor(Math.random() * themesList.length)];
        const themeWords = THEMES[themeName];

        sqlOutput += `-- Image: ${url.split('/').pop()} (Theme: ${themeName.toUpperCase()})\n`;

        // Shuffle comments to pick one divergent
        const shuffled = [...imageComments].sort(() => 0.5 - Math.random());
        const divergentIndex = Math.floor(Math.random() * shuffled.length);

        shuffled.forEach((comment, idx) => {
            let newText = "";

            if (idx === divergentIndex) {
                // 1 Random Divergent
                newText = DIVERGENT[Math.floor(Math.random() * DIVERGENT.length)];
                sqlOutput += `-- Divergent Entry\n`;
            } else {
                // Theme based
                newText = themeWords[Math.floor(Math.random() * themeWords.length)];
            }

            // Escape single quotes for SQL
            const safeText = newText.replace(/'/g, "''");

            sqlOutput += `UPDATE photo_feedback SET feeling_text = '${safeText}' WHERE id = '${comment.id}';\n`;
        });
        sqlOutput += "\n";
    }

    return new Response(sqlOutput, {
        status: 200,
        headers: { "Content-Type": "text/plain" }
    });
};
