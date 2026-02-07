
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Env Vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generatePrompt() {
    // Fetch recent comments
    const { data: comments, error } = await supabase
        .from('photo_feedback')
        .select('feeling_text')
        .not('feeling_text', 'is', null) // Avoid nulls
        .limit(20);

    if (error) {
        console.error("Error fetching comments:", error);
        return;
    }

    if (!comments || comments.length === 0) {
        console.log("No comments found.");
        return;
    }

    // Format like the API does
    const commentList = comments
        .map(c => c.feeling_text)
        .filter(Boolean)
        .map((c, i) => `${i + 1}. "${c}"`)
        .join('\n');

    const prompt = `Analyze these human responses:\n${commentList}\n\nReturn EXACTLY 3 evocative, texture-rich words capturing the collective mood (e.g., "Fractured, Solitude, Decay").\nAvoid generic terms.\nOutput ONLY the 3 words, comma-separated.`;

    console.log("----- FINAL PROMPT START -----");
    console.log(prompt);
    console.log("----- FINAL PROMPT END -----");
}

generatePrompt();
