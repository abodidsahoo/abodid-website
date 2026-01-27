
import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.PUBLIC_SUPABASE_ANON_KEY
);

const EMOTIONAL_COMMENTS = [
    "It feels like a memory I never had.",
    "The silence in this image is deafening.",
    "Why does the light look so lonely?",
    "A ghost of a moment captured forever.",
    "It smells like rain and old paper.",
    "The texture here is overwhelming, almost violent.",
    "I feel a sudden urge to leave.",
    "Comforting, but in a sad way.",
    "The way the shadow falls is perfect.",
    "Is this the end or the beginning?",
    "It reminds me of waiting for a train that never comes.",
    "The blue hue is too cold for me.",
    "I see my childhood in that corner.",
    "Chaos disguised as order.",
    "It makes me miss someone I haven't met yet.",
    "There is a piercing clarity here that hurts.",
    "The emptiness is the subject.",
    "It looks like a dream fading away.",
    "I can hear the wind in this picture.",
    "Why is everything so still?",
    "A beautiful decay.",
    "The contrast creates a sense of anxiety.",
    "I want to step inside and hide.",
    "It feels like 4 AM.",
    "The geometry is satisfying but cold.",
    "I feel warmth, like a hug.",
    "It’s too perfect, it feels fake.",
    "The focal point is missing, and I love that.",
    "It looks like a scene from a movie I forgot.",
    "Nostalgia for a place I've never been.",
    "The grain makes it feel alive.",
    "I feel exposed looking at this.",
    "It’s hiding a secret.",
    "The colors are shouting at each other.",
    "Peaceful, yet disturbing.",
    "It reminds me of a Sunday afternoon.",
    "The darkness is swallowing the light.",
    "I feel a gentle breeze.",
    "It’s like a paused heartbeat.",
    "The perspective is disorienting.",
    "I feel small looking at this.",
    "It captures the feeling of being lost.",
    "The details are excruciatingly beautiful.",
    "It seems timeless.",
    "I feel a heavy weight in my chest.",
    "It’s like a whisper.",
    "The isolation is palpable.",
    "I see hope in the distance.",
    "It’s a visual poem.",
    "The chaotic energy is infectious.",
    "I feel a sense of impending doom.",
    "It’s delicately balanced.",
    "The reflection is more real than the object.",
    "I feel a connection to the unknown.",
    "It’s stark and honest.",
    "The blur adds to the mystery.",
    "I feel like an intruder.",
    "It’s a study in solitude.",
    "The vibrant colors mask the sadness.",
    "I feel a deep sense of calm.",
    "It looks like it was taken in a hurry.",
    "The subject is ignoring us.",
    "I feel a rush of adrenaline.",
    "It’s quietly aggressive.",
    "The stillness is vibrating.",
    "I want to know what happened next.",
    "It feels fragile.",
    "The composition is unsettling.",
    "I feel a sense of belonging.",
    "It’s effectively haunting.",
    "The light indicates morning, but the mood is midnight.",
    "I feel the cold surface.",
    "It’s a fragmented reality.",
    "The open space is inviting.",
    "I feel a weird tension.",
    "It looks like a mistake, but a beautiful one.",
    "The symmetry is unnerving.",
    "I feel joy radiating from it.",
    "It’s a moody masterpiece.",
    "The shadows are alive.",
    "I feel the passage of time.",
    "It’s uncomfortably intimate.",
    "The lack of color emphasizes the form.",
    "I feel a spark of curiosity.",
    "It looks like a forgotten promise.",
    "The texture invites touch.",
    "I feel a sudden chill.",
    "It’s delightfully ambiguous.",
    "The horizon brings hope.",
    "I feel the artist's presence.",
    "It looks like a secret code.",
    "The randomness is calculated.",
    "I feel a deep resonance.",
    "It’s visually loud.",
    "The softness is deceiving.",
    "I feel a pang of jealousy.",
    "It looks like the aftermath.",
    "The beauty is in the mundane.",
    "I feel completely absorbed.",
    "It’s a snapshot of a feeling."
];

async function seedComments() {
    console.log("🌱 Starting Seed Process...");

    // 1. Fetch available images
    const { data: images, error: imageError } = await supabase
        .from('photography')
        .select('cover_image')
        .not('cover_image', 'is', null);

    if (imageError || !images || images.length === 0) {
        console.error("❌ Failed to fetch images or no images found.", imageError);
        return;
    }

    console.log(`📸 Found ${images.length} images.`);

    // 2. Prepare Payload
    const payload = [];
    const usedComments = new Set();

    // Ensure we use all comments, looping through images
    for (const comment of EMOTIONAL_COMMENTS) {
        // Pick random image
        const randomImg = images[Math.floor(Math.random() * images.length)];

        payload.push({
            image_url: randomImg.cover_image,
            feeling_text: comment,
            project_id: 'invisible-punctum',
            audio_url: null, // text only
            created_at: new Date().toISOString()
        });
    }

    // 3. Insert in batches
    console.log(`💾 Inserting ${payload.length} comments...`);

    const { error: insertError } = await supabase
        .from('photo_feedback')
        .insert(payload);

    if (insertError) {
        console.error("❌ Insert failed:", insertError);
    } else {
        console.log("✅ Successfully seeded 100+ emotional comments!");
    }
}

seedComments();
