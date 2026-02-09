import { supabase } from "../../lib/supabaseClient";
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY);

export const POST = async ({ request }) => {
    const data = await request.formData();
    const email = data.get("email");
    const name = data.get("name") || null; // Optional name

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
        .insert([{ email, name, source: "popup" }]);

    if (error) {
        // Handle unique constraint violation (already subscribed)
        if (error.code === '23505') {
            // Update the existing subscriber with the new name
            if (name) {
                await supabase
                    .from("subscribers")
                    .update({ name })
                    .eq("email", email);
            }

            // Send Welcome Email (Re-send for updates - keeping similar to new sub but acknowledging update)
            try {
                await resend.emails.send({
                    from: 'Abodid Sahoo <newsletter@abodid.com>',
                    to: email,
                    subject: 'Welcome back to the circle.',
                    html: `
                    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; border-radius: 8px;">
                        <h1 style="color: #a30021; margin-bottom: 24px; font-size: 24px;">Welcome back.</h1>
                        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Thank you for ensuring your details are up to date! You will continue to receive a weekly curated list of useful and interesting readings and resources I come across.</p>
                        
                        <div style="margin-top: 32px; margin-bottom: 32px; text-align: left;">
                            <a href="https://abodid.com/resources" style="background-color: #111111; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px; display: inline-block;">Explore Resources Hub</a>
                        </div>
                        
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 32px 0;">

                        <p style="font-size: 15px; line-height: 1.6; color: #555;">
                            <strong>Have an amazing resource in mind?</strong><br>
                            If you have a podcast, movie, website link, or YouTube channel that has been life-changing for you, I'd love for you to share it.
                        </p>
                        <p style="font-size: 15px; margin-top: 12px;">
                            <a href="https://abodid.com/login" style="color: #a30021; text-decoration: underline;">Log in as a curator</a> and add your favorite resource.
                        </p>
                    </div>
                    `
                });
            } catch (emailError) {
                console.error("Failed to send welcome email (update):", emailError);
            }

            return new Response(
                JSON.stringify({
                    message: "You're already on the list! We've updated your details.",
                    isUpdate: true
                }),
                { status: 200 }
            );
        }
        return new Response(
            JSON.stringify({
                message: error.message,
            }),
            { status: 500 }
        );
    }

    // Send Welcome Email
    try {
        await resend.emails.send({
            from: 'Abodid Sahoo <newsletter@abodid.com>',
            to: email,
            subject: 'Welcome to the tribe.',
            html: `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; border-radius: 8px;">
                <h1 style="color: #a30021; margin-bottom: 24px; font-size: 24px;">Welcome to the tribe.</h1>
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Thank you for subscribing! You are now part of a circle that values curated knowledge and creative inspiration.</p>
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Keep an eye on your inbox for the next email with a curated list of resources.</p>
                
                <div style="margin-top: 32px; margin-bottom: 32px; text-align: left;">
                    <a href="https://abodid.com/resources" style="background-color: #111111; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px; display: inline-block;">Explore Resources Hub</a>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 32px 0;">

                <p style="font-size: 15px; line-height: 1.6; color: #555;">
                    <strong>Have an amazing resource in mind?</strong><br>
                    If you have a podcast, movie, website link, or YouTube channel that has been life-changing for you, I'd love for you to share it.
                </p>
                <p style="font-size: 15px; margin-top: 12px;">
                    <a href="https://abodid.com/login" style="color: #a30021; text-decoration: underline;">Log in as a curator</a> and add your favorite resource.
                </p>
            </div>
            `
        });
    } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
        // We ensure the subscription still succeeds even if email fails
    }

    return new Response(
        JSON.stringify({
            message: "Successfully subscribed!",
        }),
        { status: 200 }
    );
};
