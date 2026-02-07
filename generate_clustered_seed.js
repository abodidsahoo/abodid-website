
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const CLUSTERS = [
    // ANGRY
    { zone: 'ANGRY_A1', comments: ['Really annoyed', 'So frustrated', 'Pretty angry', 'Feels unfair'] },
    { zone: 'ANGRY_A2', comments: ['Stressed out', 'Mentally exhausted', 'At my limit', 'Too much pressure'] },
    { zone: 'ANGRY_A3', comments: ['Feels hurt', 'Bitter about it', 'Still resentful', 'Deeply offended'] },
    { zone: 'ANGRY_A4', comments: ['This is infuriating', 'Absolutely furious', 'So mad', 'Beyond angry'] },
    // SCARED
    { zone: 'SCARED_S1', comments: ['Really anxious', 'Feeling worried', 'On edge', 'Can’t relax'] },
    { zone: 'SCARED_S2', comments: ['Actually scared', 'Low-key panicking', 'Feeling threatened', 'Pretty shaken'] },
    { zone: 'SCARED_S3', comments: ['Feeling insecure', 'Not good enough', 'Feel small', 'Kinda worthless'] },
    { zone: 'SCARED_S4', comments: ['Very confused', 'Mentally lost', 'Don’t get it', 'Totally overwhelmed'] },
    // HAPPY
    { zone: 'HAPPY_H1', comments: ['Really happy', 'So excited', 'Feels amazing', 'Super joyful'] },
    { zone: 'HAPPY_H2', comments: ['Feeling content', 'Pretty satisfied', 'In a good mood', 'Quietly happy'] },
    { zone: 'HAPPY_H3', comments: ['This is fun', 'Feels playful', 'Light and happy', 'Just enjoying it'] },
    { zone: 'HAPPY_H4', comments: ['Feeling hopeful', 'Pretty optimistic', 'Good vibes', 'Looking forward'] },
    // STRONG
    { zone: 'STRONG_T1', comments: ['Feeling confident', 'Pretty proud', 'On my game', 'Feeling capable'] },
    { zone: 'STRONG_T2', comments: ['In control', 'Feeling powerful', 'Got this', 'Very focused'] },
    { zone: 'STRONG_T3', comments: ['Staying strong', 'Can handle this', 'Pushing through', 'Not giving up'] },
    { zone: 'STRONG_T4', comments: ['Feel respected', 'Feel valued', 'Feel important', 'Feel appreciated'] },
    // CALM
    { zone: 'CALM_C1', comments: ['Feeling calm', 'Very relaxed', 'At peace', 'Nice and quiet'] },
    { zone: 'CALM_C2', comments: ['Feel safe', 'Feeling secure', 'All good', 'No worries'] },
    { zone: 'CALM_C3', comments: ['Feel connected', 'Feeling loved', 'Warm inside', 'Sense of belonging'] },
    { zone: 'CALM_C4', comments: ['Feeling thoughtful', 'In my head', 'Just reflecting', 'Quietly thinking'] },
    // SAD
    { zone: 'SAD_D1', comments: ['Feeling sad', 'Pretty down', 'Low mood', 'Not okay'] },
    { zone: 'SAD_D2', comments: ['Feeling lonely', 'All by myself', 'Feel isolated', 'Nobody here'] },
    { zone: 'SAD_D3', comments: ['So tired', 'Completely drained', 'No energy', 'Worn out'] },
    { zone: 'SAD_D4', comments: ['Feeling hopeless', 'Really hurting', 'Heart feels heavy', 'Just grieving'] }
];

async function generateSQL() {
    const { data, error } = await supabase
        .from('photography')
        .select('cover_image, title')
        .not('cover_image', 'is', null);

    if (error) {
        console.error(error);
        return;
    }

    let sql = "-- Universal Clustered Emotion Seed\nTRUNCATE TABLE photo_feedback;\n\n";

    data.forEach((img, index) => {
        const url = img.cover_image;
        const cluster = CLUSTERS[index % CLUSTERS.length];

        sql += `-- Image: ${img.title} (Zone: ${cluster.zone})\n`;
        sql += `INSERT INTO photo_feedback (image_url, feeling_text) VALUES \n`;
        const values = cluster.comments.map(c => `('${url}', '${c.replace(/'/g, "''")}')`).join(',\n');
        sql += values + ";\n\n";
    });

    fs.writeFileSync('clustered_emotions_final.sql', sql);
    console.log("SQL generated successfully.");
}

generateSQL();
