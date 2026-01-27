
import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.PUBLIC_SUPABASE_ANON_KEY
);

async function inspect() {
    console.log("--- Inspecting Tables ---");

    // 1. Check 'photography' table (The presumed Source)
    const { count: photoCount, error: photoError } = await supabase
        .from('photography')
        .select('*', { count: 'exact', head: true });

    if (photoError) console.error("Error checking 'photography':", photoError);
    else console.log(`Total rows in 'photography' table: ${photoCount}`);

    // Peek at data in photography
    const { data: photoData } = await supabase.from('photography').select('cover_image').limit(3);
    console.log("Sample 'photography' cover_images:", photoData);


    // 2. Check 'photo_feedback' table (The assumed Screenshot target)
    const { count: feedbackCount, error: feedbackError } = await supabase
        .from('photo_feedback')
        .select('*', { count: 'exact', head: true });

    if (feedbackError) console.error("Error checking 'photo_feedback':", feedbackError);
    else console.log(`Total rows in 'photo_feedback' table: ${feedbackCount}`);

    // Check unique image_urls in feedback
    const { data: feedbackData } = await supabase.from('photo_feedback').select('image_url');
    const uniqueFeedbackImages = new Set(feedbackData?.map(r => r.image_url));
    console.log(`Unique image_urls in 'photo_feedback': ${uniqueFeedbackImages.size}`);

    // Check if cover folder is common
    const coverPathCount = feedbackData?.filter(r => r.image_url && r.image_url.includes('/covers/')).length;
    console.log(`Rows in 'photo_feedback' with '/covers/' path: ${coverPathCount}`);

}

inspect();
