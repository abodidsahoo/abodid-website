import { supabase } from "../../lib/supabaseClient";
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

            // Send Welcome Email (Re-send for updates)
            try {
                await resend.emails.send({
                    from: 'Abodid Sahoo <newsletter@abodid.com>',
                    to: email,
                    subject: 'Welcome back to the circle.',
                    html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h1 style="color: #a30021;">Welcome back.</h1>
                        <p>Thank you for ensuring your details are up to date! Every week, you will continue to get an email with an amazing set of curated resources, hand curated and handpicked by me.</p>
                        <div style="margin-top: 30px;">
                            <a href="https://abodid.com/resources" style="background-color: #a30021; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Explore Resources</a>
                        </div>
                        <p style="margin-top: 30px; font-size: 0.9em; color: #666;">
                            If you have any resource in your mind which has really helped you in your life and has been life-changing for you, feel free to add it. 
                            <a href="https://abodid.com/login" style="color: #a30021;">Log in</a> to add your favorite resource.
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
            subject: 'Welcome to the circle.',
            html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h1 style="color: #a30021;">Welcome aboard.</h1>
                <p>Thank you for joining this! Every week, you would get an email with an amazing set of curated resources, hand curated and handpicked by me.</p>
                <div style="margin-top: 30px;">
                    <a href="https://abodid.com/resources" style="background-color: #a30021; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Explore Resources</a>
                </div>
                <p style="margin-top: 30px; font-size: 0.9em; color: #666;">
                    If you have any resource in your mind which has really helped you in your life and has been life-changing for you, feel free to add it. 
                    <a href="https://abodid.com/login" style="color: #a30021;">Log in</a> to add your favorite resource.
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
