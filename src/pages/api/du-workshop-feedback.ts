import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const TABLE_NAME = "du_workshop_feedback";
const NEWSLETTER_SOURCE = "du-workshop-feedback";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SHORT_TEXT_LENGTH = 180;
const MAX_LONG_TEXT_LENGTH = 8000;

function cleanText(value: FormDataEntryValue | null, maxLength: number): string {
    if (typeof value !== "string") return "";
    return value.trim().replace(/\r\n/g, "\n").slice(0, maxLength);
}

function nullableText(value: string): string | null {
    return value.length ? value : null;
}

export const POST: APIRoute = async ({ request }) => {
    const supabaseUrl =
        import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return new Response(
            JSON.stringify({ error: "Supabase server credentials are missing." }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    try {
        const formData = await request.formData();
        const honeypot = cleanText(formData.get("website"), MAX_SHORT_TEXT_LENGTH);

        if (honeypot) {
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        const name = cleanText(formData.get("name"), MAX_SHORT_TEXT_LENGTH);
        const email = cleanText(formData.get("email"), 254).toLowerCase();
        const bestPart = cleanText(formData.get("best_part"), MAX_LONG_TEXT_LENGTH);
        const improvements = cleanText(formData.get("improvements"), MAX_LONG_TEXT_LENGTH);
        const futureWorkshopTopics = cleanText(
            formData.get("future_workshop_topics"),
            MAX_LONG_TEXT_LENGTH,
        );
        const otherComments = cleanText(formData.get("other_comments"), MAX_LONG_TEXT_LENGTH);

        const hasFeedback = Boolean(
            bestPart || improvements || futureWorkshopTopics || otherComments,
        );

        if (!hasFeedback) {
            return new Response(
                JSON.stringify({ error: "Please add at least one feedback response." }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        if (email && !EMAIL_REGEX.test(email)) {
            return new Response(
                JSON.stringify({ error: "Please enter a valid email ID." }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        const newsletterConsent = Boolean(email);
        const { data, error } = await supabaseAdmin
            .from(TABLE_NAME)
            .insert({
                workshop_slug: "delhi-university-ethnographic-filmmaking",
                participant_name: nullableText(name),
                participant_email: nullableText(email),
                newsletter_consent: newsletterConsent,
                best_part: nullableText(bestPart),
                improvements: nullableText(improvements),
                future_workshop_topics: nullableText(futureWorkshopTopics),
                other_comments: nullableText(otherComments),
                metadata: {
                    form_version: "du-workshop-feedback-v1",
                    source_path: "/du-workshop-feedback",
                    referer: request.headers.get("referer"),
                    user_agent: request.headers.get("user-agent"),
                },
            })
            .select("id, created_at")
            .single();

        if (error) {
            throw new Error(error.message);
        }

        let newsletterStatus: "not_requested" | "subscribed" | "failed" =
            "not_requested";

        if (newsletterConsent) {
            const subscriberPayload: Record<string, string> = {
                email,
                source: NEWSLETTER_SOURCE,
                status: "active",
            };

            if (name) {
                subscriberPayload.name = name;
            }

            const { error: subscriberError } = await supabaseAdmin
                .from("subscribers")
                .upsert(subscriberPayload, { onConflict: "email" });

            if (subscriberError) {
                newsletterStatus = "failed";
                console.error(
                    "DU workshop feedback saved, but newsletter subscription failed:",
                    subscriberError,
                );
            } else {
                newsletterStatus = "subscribed";
            }
        }

        return new Response(
            JSON.stringify({
                ok: true,
                id: data.id,
                created_at: data.created_at,
                newsletter_status: newsletterStatus,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        );
    } catch (error) {
        console.error("DU workshop feedback API error:", error);

        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error
                        ? error.message
                        : "Something went wrong while saving your feedback.",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
};
