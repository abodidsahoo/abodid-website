import { supabase } from "../../lib/supabaseClient";

export const POST = async ({ request }) => {
    const data = await request.formData();
    const email = data.get("email");

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return new Response(
            JSON.stringify({
                message: "Invalid email address",
            }),
            { status: 400 }
        );
    }

    const { error } = await supabase
        .from("subscribers")
        .insert([{ email, source: "footer" }]);

    if (error) {
        // Handle unique constraint violation (already subscribed)
        if (error.code === '23505') {
            return new Response(
                JSON.stringify({
                    message: "You are already subscribed.",
                }),
                { status: 200 } // Treat as success to user
            );
        }
        return new Response(
            JSON.stringify({
                message: error.message,
            }),
            { status: 500 }
        );
    }

    return new Response(
        JSON.stringify({
            message: "Successfully subscribed!",
        }),
        { status: 200 }
    );
};
