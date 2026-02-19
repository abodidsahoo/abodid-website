import { supabase } from "../../lib/supabaseClient";
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY);
const backersPageUrl = "https://abodid.com/fundraising/backers";

const sendBackersInfoEmail = async (recipientEmail) => {
    await resend.emails.send({
        from: 'Abodid Sahoo <newsletter@abodid.com>',
        to: recipientEmail,
        subject: 'Patron / Sponsor details for this journey',
        html: `
        <div style="font-family: Inter, 'Google Sans', 'Helvetica Neue', Arial, sans-serif; max-width: 660px; margin: 0 auto; color: #1f1f1f; background: #f7f7f7; padding: 24px;">
            <div style="background: linear-gradient(100deg, #dff3ff, #efe7ff, #ffeecf); border-radius: 14px; border: 1px solid #e5e1d7; padding: 20px 22px;">
                <p style="margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #555;">Backers Update</p>
                <h1 style="margin: 0; font-size: 24px; line-height: 1.25; color: #202124;">Patron / Sponsor support details</h1>
                <p style="margin: 12px 0 0; font-size: 14px; line-height: 1.6; color: #3c4043;">
                    If you are deciding your contribution amount or timing, you can transfer later.
                    I will continue sharing updates and support details so you can decide comfortably.
                </p>
            </div>

            <div style="background: #ffffff; border: 1px solid #e5e1d7; border-radius: 14px; padding: 18px 20px; margin-top: 14px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.65; color: #3c4043;">
                    For organizations: decision-making takes time. Staying in the loop helps you track the journey
                    and join when your internal approvals are ready.
                </p>
            </div>

            <div style="background: #ffffff; border: 1px solid #e5e1d7; border-radius: 14px; padding: 18px 20px; margin-top: 14px;">
                <div style="margin-bottom: 14px;">
                    <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #5f6368;">Axis Bank (India)</p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color: #202124;">
                        Account Holder: Abodid Sahoo<br/>
                        Account Number: 912010033704055<br/>
                        IFSC: UTIB0003179
                    </p>
                </div>

                <div style="margin-bottom: 14px;">
                    <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #5f6368;">Lloyds Bank (UK)</p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color: #202124;">
                        Name on Account: Abodid Sahoo<br/>
                        Sort Code: 30-90-89<br/>
                        Account Number: 43644963
                    </p>
                </div>

                <div>
                    <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #5f6368;">UPI (India)</p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color: #202124;">
                        UPI ID: abodidsahoo@axl
                    </p>
                </div>
            </div>

            <div style="margin-top: 14px; text-align: left;">
                <a href="${backersPageUrl}" style="display: inline-block; background: #f6e9d0; color: #3d2a16; border: 1px solid #dcc7a3; border-radius: 10px; padding: 10px 14px; font-size: 13px; text-decoration: none; font-weight: 600;">
                    Open Backers Page
                </a>
                <p style="margin: 10px 0 0; font-size: 12px; color: #5f6368; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
                    ${backersPageUrl}
                </p>
            </div>
        </div>
        `
    });
};

export const POST = async ({ request }) => {
    const data = await request.formData();
    const email = data.get("email");
    const name = data.get("name") || null; // Optional name
    const rawSource = data.get("source");
    const source =
        typeof rawSource === "string" && rawSource.trim().length > 0
            ? rawSource.trim().toLowerCase().slice(0, 40)
            : "popup";

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
        .insert([{ email, name, source }]);

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

            if (source === "backers") {
                try {
                    await sendBackersInfoEmail(email);
                } catch (emailError) {
                    console.error("Failed to send backers info email (existing subscriber):", emailError);
                    return new Response(
                        JSON.stringify({
                            message:
                                "You are already subscribed, but I could not send the support-details email. Please try again.",
                        }),
                        { status: 500 }
                    );
                }

                return new Response(
                    JSON.stringify({
                        message:
                            "You are already subscribed.\nI will continue sharing project and research updates.\nI have sent the patron/sponsor support details to your email.",
                        isUpdate: true
                    }),
                    { status: 200 }
                );
            }

            // Send Welcome Email (Re-send for updates - keeping similar to new sub but acknowledging update)
            try {
                await resend.emails.send({
                    from: 'Abodid Sahoo <newsletter@abodid.com>',
                    to: email,
                    subject: 'Welcome back to the circle.',
                    html: `
                <div style="font-family: Inter, 'Google Sans', 'Helvetica Neue', Arial, sans-serif; max-width: 660px; margin: 0 auto; color: #1f1f1f; background: #f7f7f7; padding: 24px;">
                    <div style="background: linear-gradient(100deg, #dff3ff, #efe7ff, #ffeecf); border-radius: 14px; border: 1px solid #e5e1d7; padding: 20px 22px;">
                        <p style="margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #555;">Newsletter Update</p>
                        <h1 style="margin: 0; font-size: 24px; line-height: 1.25; color: #202124;">Welcome back to the circle.</h1>
                        <p style="margin: 12px 0 0; font-size: 14px; line-height: 1.6; color: #3c4043;">
                            Thank you for ensuring your details are up to date! You will continue to receive a weekly curated list of useful and interesting readings and resources I come across.
                        </p>
                    </div>

                    <div style="background: #ffffff; border: 1px solid #e5e1d7; border-radius: 14px; padding: 18px 20px; margin-top: 14px;">
                        <div style="margin-bottom: 20px;">
                            <a href="https://abodid.com/resources" style="display: inline-block; background: #111111; color: #ffffff; border: 1px solid #000000; border-radius: 10px; padding: 10px 18px; font-size: 13px; text-decoration: none; font-weight: 600;">
                                Explore Resources Hub
                            </a>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #5f6368;">Share a Resource</p>
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #3c4043;">
                            <strong>Have an amazing resource in mind?</strong><br>
                            If you have a podcast, movie, website link, or YouTube channel that has been life-changing for you, I'd love for you to share it.
                        </p>
                        <p style="margin: 12px 0 0; font-size: 14px;">
                            <a href="https://abodid.com/login" style="color: #a30021; text-decoration: underline;">Log in as a curator</a> to add your favorite resource.
                        </p>
                    </div>
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

    if (source === "backers") {
        try {
            await sendBackersInfoEmail(email);
        } catch (emailError) {
            console.error("Failed to send backers info email (new subscriber):", emailError);
            return new Response(
                JSON.stringify({
                    message:
                        "Subscribed successfully, but I could not send the support-details email. Please submit once more to retry email delivery.",
                }),
                { status: 500 }
            );
        }

        return new Response(
            JSON.stringify({
                message:
                    "Subscribed. I have sent the patron/sponsor support details to your email.",
            }),
            { status: 200 }
        );
    }

    // Send Welcome Email
    try {
        await resend.emails.send({
            from: 'Abodid Sahoo <newsletter@abodid.com>',
            to: email,
            subject: 'Welcome to the tribe.',
            html: `
            <div style="font-family: Inter, 'Google Sans', 'Helvetica Neue', Arial, sans-serif; max-width: 660px; margin: 0 auto; color: #1f1f1f; background: #f7f7f7; padding: 24px;">
                <div style="background: linear-gradient(100deg, #dff3ff, #efe7ff, #ffeecf); border-radius: 14px; border: 1px solid #e5e1d7; padding: 20px 22px;">
                    <h1 style="margin: 0; font-size: 24px; line-height: 1.25; color: #202124;">Welcome to the tribe.</h1>
                    <p style="margin: 12px 0 0; font-size: 14px; line-height: 1.6; color: #3c4043;">
                        Thank you for subscribing! You are now part of a circle that values curated knowledge and creative inspiration.
                        Keep an eye on your inbox for the next email with a curated list of resources.
                    </p>
                </div>

                <div style="background: #ffffff; border: 1px solid #e5e1d7; border-radius: 14px; padding: 18px 20px; margin-top: 14px;">
                    <div style="margin-bottom: 20px;">
                        <a href="https://abodid.com/resources" style="display: inline-block; background: #111111; color: #ffffff; border: 1px solid #000000; border-radius: 10px; padding: 10px 18px; font-size: 13px; text-decoration: none; font-weight: 600;">
                            Explore Resources Hub
                        </a>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #5f6368;">Share a Resource</p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #3c4043;">
                        <strong>Have an amazing resource in mind?</strong><br>
                        If you have a podcast, movie, website link, or YouTube channel that has been life-changing for you, I'd love for you to share it.
                    </p>
                    <p style="margin: 12px 0 0; font-size: 14px;">
                        <a href="https://abodid.com/login" style="color: #a30021; text-decoration: underline;">Log in as a curator</a> to add your favorite resource.
                    </p>
                </div>
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
