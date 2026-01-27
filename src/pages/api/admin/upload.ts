
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

export const POST = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const bucket = formData.get("bucket") || "portfolio-assets";
        const path = formData.get("path") || "";

        if (!file) {
            return new Response(JSON.stringify({ error: "No file found" }), { status: 400 });
        }

        // Use Service Role to bypass RLS
        const supabaseAdmin = createClient(
            import.meta.env.PUBLIC_SUPABASE_URL,
            import.meta.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Convert file to ArrayBuffer for upload
        const arrayBuffer = await file.arrayBuffer();
        const fileBuffer = new Uint8Array(arrayBuffer);

        // Generate path
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = path ? `${path}/${fileName}` : fileName;

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(filePath, fileBuffer, {
                contentType: file.type,
                upsert: false
            });

        if (error) {
            console.error("Upload error:", error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        // Get Public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return new Response(
            JSON.stringify({
                url: publicUrl,
                name: file.name,
                path: filePath // Return internal path if needed
            }),
            { status: 200 }
        );

    } catch (err) {
        console.error("Server upload error:", err);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
};
