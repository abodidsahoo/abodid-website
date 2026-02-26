import type { APIRoute } from "astro";
import { Resend } from "resend";

export const prerender = false;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECENT_PAGES = 8;
const MAX_TOP_PAGES = 6;

interface TrackingRecentPage {
    path: string;
    title: string;
    enteredAt: string;
    sourcePage: string;
    cta: string;
}

interface TrackingTopPage {
    path: string;
    title: string;
    durationMs: number;
}

interface TrackingVisitPage {
    path: string;
    title: string;
    enteredAt: string;
}

interface TrackingSnapshot {
    sessionId: string;
    currentPath: string;
    landingPage: string;
    initialReferrer: string;
    lastSourcePage: string;
    lastSourceName: string;
    lastCta: string;
    totalTrackedMs: number;
    totalPageViews: number;
    uniquePagesVisited: number;
    immediatePreviousPage: string;
    recentPages: TrackingRecentPage[];
    visitSequence: TrackingVisitPage[];
    topPages: TrackingTopPage[];
}

function clean(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function cleanLimited(value: unknown, maxLength: number): string {
    return clean(value).slice(0, maxLength);
}

function safeJsonParse(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch (_error) {
        return null;
    }
}

function toPositiveInt(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDuration(durationMs: number): string {
    if (durationMs <= 0) return "0s";
    const totalSeconds = Math.round(durationMs / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) {
        return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
}

function parseTracking(rawTracking: unknown): TrackingSnapshot | null {
    if (!rawTracking || typeof rawTracking !== "object") {
        return null;
    }

    const source = rawTracking as Record<string, unknown>;

    const recentPages = (Array.isArray(source.recentPages)
        ? source.recentPages
        : []
    )
        .slice(-MAX_RECENT_PAGES)
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const page = item as Record<string, unknown>;
            const path = cleanLimited(page.path, 180);
            if (!path) return null;

            return {
                path,
                title: cleanLimited(page.title, 180),
                enteredAt: cleanLimited(page.enteredAt, 80),
                sourcePage: cleanLimited(page.sourcePage, 180),
                cta: cleanLimited(page.cta, 120),
            };
        })
        .filter((item): item is TrackingRecentPage => Boolean(item));

    const topPages = (Array.isArray(source.topPages)
        ? source.topPages
        : []
    )
        .slice(0, MAX_TOP_PAGES)
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const page = item as Record<string, unknown>;
            const path = cleanLimited(page.path, 180);
            if (!path) return null;

            return {
                path,
                title: cleanLimited(page.title, 180),
                durationMs: toPositiveInt(page.durationMs),
            };
        })
        .filter((item): item is TrackingTopPage => Boolean(item));

    const visitSequence = (Array.isArray(source.visitSequence)
        ? source.visitSequence
        : []
    )
        .slice(-30)
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const page = item as Record<string, unknown>;
            const path = cleanLimited(page.path, 180);
            if (!path) return null;

            return {
                path,
                title: cleanLimited(page.title, 180),
                enteredAt: cleanLimited(page.enteredAt, 80),
            };
        })
        .filter((item): item is TrackingVisitPage => Boolean(item));

    return {
        sessionId: cleanLimited(source.sessionId, 128),
        currentPath: cleanLimited(source.currentPath, 180),
        landingPage: cleanLimited(source.landingPage, 180),
        initialReferrer: cleanLimited(source.initialReferrer, 400),
        lastSourcePage: cleanLimited(source.lastSourcePage, 180),
        lastSourceName: cleanLimited(source.lastSourceName, 120),
        lastCta: cleanLimited(source.lastCta, 120),
        totalTrackedMs: toPositiveInt(source.totalTrackedMs),
        totalPageViews: toPositiveInt(source.totalPageViews),
        uniquePagesVisited: toPositiveInt(source.uniquePagesVisited),
        immediatePreviousPage: cleanLimited(source.immediatePreviousPage, 180),
        recentPages,
        visitSequence,
        topPages,
    };
}

function describeSource(tracking: TrackingSnapshot | null): string {
    if (!tracking) {
        return "No journey source data captured.";
    }

    const sourcePage =
        tracking.lastSourcePage || tracking.landingPage || "unknown page";
    const sourceName = tracking.lastSourceName
        ? `${tracking.lastSourceName} (${sourcePage})`
        : sourcePage;
    const cta = tracking.lastCta
        ? ` via CTA \"${tracking.lastCta}\"`
        : "";

    return `Visitor came from ${sourceName}${cta}.`;
}

function buildRecentPagesHtml(recentPages: TrackingRecentPage[]): string {
    if (!recentPages.length) {
        return "<li>No recent page trail captured.</li>";
    }

    const orderedPages = [...recentPages].reverse();

    return orderedPages
        .map((page) => {
            const titlePart = page.title ? ` - ${escapeHtml(page.title)}` : "";
            const sourcePart = page.sourcePage
                ? ` (from ${escapeHtml(page.sourcePage)})`
                : "";
            return `<li><strong>${escapeHtml(page.path)}</strong>${titlePart}${sourcePart}</li>`;
        })
        .join("");
}

function buildTopPagesHtml(topPages: TrackingTopPage[]): string {
    if (!topPages.length) {
        return "<li>No page-time data captured.</li>";
    }

    return topPages
        .map((page) => {
            const titlePart = page.title ? ` - ${escapeHtml(page.title)}` : "";
            const durationPart = formatDuration(page.durationMs);
            return `<li><strong>${escapeHtml(page.path)}</strong>${titlePart} - ${escapeHtml(durationPart)}</li>`;
        })
        .join("");
}

function buildRecentPagesText(recentPages: TrackingRecentPage[]): string[] {
    if (!recentPages.length) return ["- No recent page trail captured."];

    const orderedPages = [...recentPages].reverse();

    return orderedPages.map((page) => {
        const titlePart = page.title ? ` - ${page.title}` : "";
        const sourcePart = page.sourcePage ? ` (from ${page.sourcePage})` : "";
        return `- ${page.path}${titlePart}${sourcePart}`;
    });
}

function buildTopPagesText(topPages: TrackingTopPage[]): string[] {
    if (!topPages.length) return ["- No page-time data captured."];

    return topPages.map((page) => {
        const titlePart = page.title ? ` - ${page.title}` : "";
        return `- ${page.path}${titlePart} - ${formatDuration(page.durationMs)}`;
    });
}

function buildVisitSequenceText(visitSequence: TrackingVisitPage[]): string {
    if (!visitSequence.length) return "Not captured";

    const collapsed: string[] = [];
    visitSequence.forEach((page) => {
        if (!collapsed.length || collapsed[collapsed.length - 1] !== page.path) {
            collapsed.push(page.path);
        }
    });

    return collapsed.join(" -> ");
}

function buildBehaviorPattern(tracking: TrackingSnapshot | null): {
    sourceSummary: string;
    finalPage: string;
    previousBeforeFinal: string;
    totalTrackedMs: number;
    totalTrackedLabel: string;
    totalPageViews: number;
    uniquePagesVisited: number;
    topPageSummary: string;
    visitSequence: string;
} {
    const sourceSummary = describeSource(tracking);
    const finalPage = tracking?.currentPath || "Not captured";
    const previousBeforeFinal =
        tracking?.immediatePreviousPage ||
        (tracking?.visitSequence.length && tracking.visitSequence.length >= 2
            ? tracking.visitSequence[tracking.visitSequence.length - 2].path
            : "Not captured");
    const totalTrackedMs = tracking?.totalTrackedMs || 0;
    const totalTrackedLabel = formatDuration(totalTrackedMs);
    const totalPageViews = tracking?.totalPageViews || 0;
    const uniquePagesVisited = tracking?.uniquePagesVisited || 0;
    const topPage = tracking?.topPages[0];
    const topPageSummary = topPage
        ? `${topPage.path} (${formatDuration(topPage.durationMs)})`
        : "Not captured";
    const visitSequence = buildVisitSequenceText(tracking?.visitSequence || []);

    return {
        sourceSummary,
        finalPage,
        previousBeforeFinal,
        totalTrackedMs,
        totalTrackedLabel,
        totalPageViews,
        uniquePagesVisited,
        topPageSummary,
        visitSequence,
    };
}

async function parsePayload(request: Request): Promise<{
    name: string;
    email: string;
    message: string;
    tracking: TrackingSnapshot | null;
}> {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
        >;

        return {
            name: clean(body.name),
            email: clean(body.email),
            message: clean(body.message),
            tracking: parseTracking(body.tracking),
        };
    }

    if (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
    ) {
        const formData = await request.formData();
        const trackingRaw = formData.get("tracking");

        let trackingParsed: unknown = trackingRaw;
        if (typeof trackingRaw === "string") {
            trackingParsed = safeJsonParse(trackingRaw);
        }

        return {
            name: clean(formData.get("name")),
            email: clean(formData.get("email")),
            message: clean(formData.get("message")),
            tracking: parseTracking(trackingParsed),
        };
    }

    return { name: "", email: "", message: "", tracking: null };
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const resendKey =
            import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
        if (!resendKey) {
            return new Response(
                JSON.stringify({ error: "Missing RESEND_API_KEY on server." }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const { name, email, message, tracking } = await parsePayload(request);

        if (!name || name.length > 120) {
            return new Response(
                JSON.stringify({
                    error: "Please provide a valid name (1-120 characters).",
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
            return new Response(
                JSON.stringify({
                    error: "Please provide a valid email address.",
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        if (!message || message.length > 5000) {
            return new Response(
                JSON.stringify({
                    error: "Please provide a message (1-5000 characters).",
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const now = new Date();
        const timestampIso = now.toISOString();
        const timestampUtc = new Intl.DateTimeFormat("en-US", {
            dateStyle: "full",
            timeStyle: "long",
            timeZone: "UTC",
        }).format(now);
        const timestampServerLocal = new Intl.DateTimeFormat("en-US", {
            dateStyle: "full",
            timeStyle: "long",
        }).format(now);

        const safeName = escapeHtml(name);
        const safeEmail = escapeHtml(email);
        const safeMessage = escapeHtml(message);

        const behavior = buildBehaviorPattern(tracking);
        const sourceDescriptionHtml = escapeHtml(behavior.sourceSummary);
        const recentPagesHtml = buildRecentPagesHtml(tracking?.recentPages || []);
        const topPagesHtml = buildTopPagesHtml(tracking?.topPages || []);
        const structuredQuery = [
            "SELECT",
            "  session_id,",
            "  source_page,",
            "  cta_clicked,",
            "  previous_page_before_contact,",
            "  final_page,",
            "  total_page_views,",
            "  unique_pages_visited,",
            "  total_tracked_seconds,",
            "  top_time_spent_page,",
            "  visit_sequence",
            "FROM journey_tracking",
            `WHERE session_id = '${tracking?.sessionId || "not_captured"}';`,
        ].join("\n");

        const toAddress =
            import.meta.env.CONTACT_FORM_TO_EMAIL ||
            process.env.CONTACT_FORM_TO_EMAIL ||
            "hello@abodid.com";
        const fromAddress =
            import.meta.env.CONTACT_FORM_FROM_EMAIL ||
            process.env.CONTACT_FORM_FROM_EMAIL ||
            "Abodid Contact <newsletter@abodid.com>";

        const resend = new Resend(resendKey);
        const subjectSource = tracking?.lastSourcePage
            ? ` from ${tracking.lastSourcePage}`
            : "";
        const subject = `[Contact Form] ${name}${subjectSource} sent you a message`;

        const html = `
            <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6;">
                <p style="margin: 0 0 14px; font-size: 18px; font-weight: 700;">
                    ${safeName} (${safeEmail}) sent you an email. ${sourceDescriptionHtml}
                </p>
                <hr style="border: 0; border-top: 1px solid #ddd; margin: 16px 0;" />
                <p style="margin: 0 0 8px;"><strong>Name:</strong> ${safeName}</p>
                <p style="margin: 0 0 8px;"><strong>Email ID:</strong> ${safeEmail}</p>
                <p style="margin: 0 0 8px;"><strong>Date & Time (UTC):</strong> ${escapeHtml(timestampUtc)}</p>
                <p style="margin: 0 0 16px;"><strong>Date & Time (Server Local):</strong> ${escapeHtml(timestampServerLocal)}</p>
                <p style="margin: 0 0 8px;"><strong>ISO Timestamp:</strong> ${escapeHtml(timestampIso)}</p>

                <p style="margin: 16px 0 8px; font-weight: 700;">Journey Tracking:</p>
                <p style="margin: 0 0 8px;"><strong>Source Summary:</strong> ${sourceDescriptionHtml}</p>
                <p style="margin: 0 0 8px;"><strong>Session ID:</strong> ${escapeHtml(tracking?.sessionId || "Not captured")}</p>
                <p style="margin: 0 0 8px;"><strong>Current Page:</strong> ${escapeHtml(tracking?.currentPath || "Not captured")}</p>
                <p style="margin: 0 0 8px;"><strong>Landing Page:</strong> ${escapeHtml(tracking?.landingPage || "Not captured")}</p>
                <p style="margin: 0 0 8px;"><strong>Initial Referrer:</strong> ${escapeHtml(tracking?.initialReferrer || "Not captured")}</p>
                <p style="margin: 0 0 8px;"><strong>Source Page:</strong> ${escapeHtml(tracking?.lastSourcePage || "Not captured")}</p>
                <p style="margin: 0 0 8px;"><strong>Source Name:</strong> ${escapeHtml(tracking?.lastSourceName || "Not captured")}</p>
                <p style="margin: 0 0 12px;"><strong>CTA Clicked:</strong> ${escapeHtml(tracking?.lastCta || "Not captured")}</p>

                <p style="margin: 0 0 8px; font-weight: 700;">Recent Pages (latest first):</p>
                <ol style="margin: 0 0 12px 18px; padding: 0;">${recentPagesHtml}</ol>

                <p style="margin: 0 0 8px; font-weight: 700;">Most Time Spent Pages:</p>
                <ol style="margin: 0 0 12px 18px; padding: 0;">${topPagesHtml}</ol>

                <p style="margin: 16px 0 8px; font-weight: 700;">Message:</p>
                <div style="white-space: pre-wrap; border: 1px solid #ddd; border-radius: 8px; padding: 12px;">
                    ${safeMessage}
                </div>

                <p style="margin: 16px 0 8px; font-weight: 700;">Behavior Pattern (Rule-Based):</p>
                <p style="margin: 0 0 8px;"><strong>Total Time On Site:</strong> ${escapeHtml(behavior.totalTrackedLabel)}</p>
                <p style="margin: 0 0 8px;"><strong>Total Page Views:</strong> ${String(behavior.totalPageViews)}</p>
                <p style="margin: 0 0 8px;"><strong>Unique Pages Visited:</strong> ${String(behavior.uniquePagesVisited)}</p>
                <p style="margin: 0 0 8px;"><strong>Most Time Spent Page:</strong> ${escapeHtml(behavior.topPageSummary)}</p>
                <p style="margin: 0 0 8px;"><strong>Page Before Final Contact Page:</strong> ${escapeHtml(behavior.previousBeforeFinal)}</p>
                <p style="margin: 0 0 12px;"><strong>Visit Sequence:</strong> ${escapeHtml(behavior.visitSequence)}</p>

                <p style="margin: 0 0 8px; font-weight: 700;">Structured Query (No AI):</p>
                <pre style="white-space: pre-wrap; border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin: 0 0 8px; background: #fafafa;">${escapeHtml(structuredQuery)}</pre>
                <pre style="white-space: pre-wrap; border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin: 0; background: #fafafa;">session_id=${escapeHtml(tracking?.sessionId || "not_captured")}
source_page=${escapeHtml(tracking?.lastSourcePage || "not_captured")}
cta_clicked=${escapeHtml(tracking?.lastCta || "not_captured")}
previous_page_before_contact=${escapeHtml(behavior.previousBeforeFinal)}
final_page=${escapeHtml(behavior.finalPage)}
total_page_views=${String(behavior.totalPageViews)}
unique_pages_visited=${String(behavior.uniquePagesVisited)}
total_tracked_seconds=${String(Math.round(behavior.totalTrackedMs / 1000))}
top_time_spent_page=${escapeHtml(behavior.topPageSummary)}
visit_sequence=${escapeHtml(behavior.visitSequence)}</pre>
            </div>
        `;

        const text = [
            `${name} (${email}) sent you an email. ${behavior.sourceSummary}`,
            "",
            `Name: ${name}`,
            `Email ID: ${email}`,
            `Date & Time (UTC): ${timestampUtc}`,
            `Date & Time (Server Local): ${timestampServerLocal}`,
            `ISO Timestamp: ${timestampIso}`,
            "",
            "Journey Tracking:",
            `Source Summary: ${behavior.sourceSummary}`,
            `Session ID: ${tracking?.sessionId || "Not captured"}`,
            `Current Page: ${tracking?.currentPath || "Not captured"}`,
            `Landing Page: ${tracking?.landingPage || "Not captured"}`,
            `Initial Referrer: ${tracking?.initialReferrer || "Not captured"}`,
            `Source Page: ${tracking?.lastSourcePage || "Not captured"}`,
            `Source Name: ${tracking?.lastSourceName || "Not captured"}`,
            `CTA Clicked: ${tracking?.lastCta || "Not captured"}`,
            "",
            "Recent Pages (latest first):",
            ...buildRecentPagesText(tracking?.recentPages || []),
            "",
            "Most Time Spent Pages:",
            ...buildTopPagesText(tracking?.topPages || []),
            "",
            "Message:",
            message,
            "",
            "Behavior Pattern (Rule-Based):",
            `Total Time On Site: ${behavior.totalTrackedLabel}`,
            `Total Page Views: ${behavior.totalPageViews}`,
            `Unique Pages Visited: ${behavior.uniquePagesVisited}`,
            `Most Time Spent Page: ${behavior.topPageSummary}`,
            `Page Before Final Contact Page: ${behavior.previousBeforeFinal}`,
            `Visit Sequence: ${behavior.visitSequence}`,
            "",
            "Structured Query (No AI):",
            structuredQuery,
            "",
            "Structured Result:",
            `session_id=${tracking?.sessionId || "not_captured"}`,
            `source_page=${tracking?.lastSourcePage || "not_captured"}`,
            `cta_clicked=${tracking?.lastCta || "not_captured"}`,
            `previous_page_before_contact=${behavior.previousBeforeFinal}`,
            `final_page=${behavior.finalPage}`,
            `total_page_views=${behavior.totalPageViews}`,
            `unique_pages_visited=${behavior.uniquePagesVisited}`,
            `total_tracked_seconds=${Math.round(behavior.totalTrackedMs / 1000)}`,
            `top_time_spent_page=${behavior.topPageSummary}`,
            `visit_sequence=${behavior.visitSequence}`,
        ].join("\n");

        const { error } = await resend.emails.send({
            from: fromAddress,
            to: [toAddress],
            replyTo: email,
            subject,
            html,
            text,
        });

        if (error) {
            console.error("Resend error:", error);
            return new Response(
                JSON.stringify({ error: "Could not send email at this time." }),
                {
                    status: 502,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Contact form API error:", error);
        return new Response(
            JSON.stringify({
                error: "Unexpected server error while sending message.",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
};
