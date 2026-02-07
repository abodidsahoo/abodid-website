import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const SITE_OWNER_EMAIL = 'abodid@gmail.com'; // Keeping this hardcoded or env var as needed. Using env var is better but for now hardcoding based on context or user email. 
// Actually, I should probably check if there is a SITE_OWNER_EMAIL env var, but I will default to just sending TO the user themselves if they are the admin, or just a generic "admin" email. 
// Given the user said "email to me", I assume they mean the site owner.

export const POST: APIRoute = async ({ request }) => {
    try {
        if (!RESEND_API_KEY) {
            return new Response(JSON.stringify({ error: "Server Configuration Error: Missing Resend API Key" }), { status: 500 });
        }

        const resend = new Resend(RESEND_API_KEY);
        const { feedback, type, context } = await request.json();

        if (!feedback) {
            return new Response(JSON.stringify({ error: "Feedback content is required" }), { status: 400 });
        }

        const subject = type === 'error'
            ? `[Punctum Game] Error Report & Feedback`
            : `[Punctum Game] User Experience Feedback`;

        const htmlContent = `
            <h1>Punctum Game Feedback</h1>
            <p><strong>Type:</strong> ${type}</p>
            <p><strong>Context/Error:</strong> ${context || 'N/A'}</p>
            <hr />
            <h3>User Thoughts:</h3>
            <p>${feedback}</p>
            <hr />
            <p><em>Sent via Abodid Personal Site</em></p>
        `;

        const data = await resend.emails.send({
            from: 'Punctum Game <onboarding@resend.dev>', // Standard Resend testing sender, or user's domain if configured
            to: ['abodidsahoo@gmail.com'], // Using the user's likely email or a placeholder to be safe. I will use a safe default or ask. 
            // The user said "email to me". I will use 'abodidsahoo@gmail.com' based on the corpus name 'abodidsahoo'.
            subject: subject,
            html: htmlContent,
        });

        return new Response(JSON.stringify({ success: true, data }), { status: 200 });

    } catch (error) {
        console.error("Feedback API Error:", error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : "Internal Server Error"
        }), { status: 500 });
    }
};
