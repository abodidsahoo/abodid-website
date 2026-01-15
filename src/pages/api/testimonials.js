import { supabase } from "../../lib/supabaseClient";

export const POST = async ({ request }) => {
    const data = await request.formData();

    const name = data.get("name");
    const content = data.get("content");
    // Optional fields
    const role = data.get("role") || null;
    const company = data.get("company") || null;

    if (!name || !content) {
        return new Response(
            JSON.stringify({
                message: "Name and Testimony are required.",
            }),
            { status: 400 }
        );
    }

    const { data: inserted, error } = await supabase
        .from("testimonials")
        .insert([
            {
                name,
                content,
                role,
                company,
                is_approved: true // Auto-approve as requested
            }
        ])
        .select()
        .single();

    if (error) {
        return new Response(
            JSON.stringify({
                message: error.message,
            }),
            { status: 500 }
        );
    }

    return new Response(
        JSON.stringify({
            message: "Testimonial received.",
            testimonial: inserted
        }),
        { status: 200 }
    );
};
