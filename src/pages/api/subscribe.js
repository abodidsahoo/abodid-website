import { supabase } from "../../lib/supabaseClient";
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY);
const backersPageUrl = "https://abodid.com/fundraising/backers";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECENT_PAGES = 8;
const MAX_TOP_PAGES = 6;
const OWNER_NOTIFICATION_EMAIL =
    import.meta.env.OWNER_NOTIFICATION_EMAIL ||
    process.env.OWNER_NOTIFICATION_EMAIL ||
    import.meta.env.CONTACT_FORM_TO_EMAIL ||
    process.env.CONTACT_FORM_TO_EMAIL ||
    "hello@abodid.com";

const clean = (value) => (typeof value === "string" ? value.trim() : "");
const cleanLimited = (value, maxLength) => clean(value).slice(0, maxLength);
const getOwnerBcc = (recipientEmail) => {
    const ownerEmail = clean(OWNER_NOTIFICATION_EMAIL).toLowerCase();
    const recipient = clean(recipientEmail).toLowerCase();
    if (!ownerEmail || ownerEmail === recipient) return undefined;
    return [ownerEmail];
};

const safeJsonParse = (value) => {
    try {
        return JSON.parse(value);
    } catch (_error) {
        return null;
    }
};

const toPositiveInt = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed);
};

const escapeHtml = (value) =>
    String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

const formatDuration = (durationMs) => {
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
};

const sendBackersInfoEmail = async (recipientEmail) => {
    await resend.emails.send({
        from: 'Abodid Sahoo <newsletter@abodid.com>',
        to: recipientEmail,
        bcc: getOwnerBcc(recipientEmail),
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

const parseTracking = (rawTracking) => {
    if (!rawTracking || typeof rawTracking !== "object") {
        return null;
    }

    const source = rawTracking;

    const recentPages = (Array.isArray(source.recentPages)
        ? source.recentPages
        : []
    )
        .slice(-MAX_RECENT_PAGES)
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const page = item;
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
        .filter(Boolean);

    const topPages = (Array.isArray(source.topPages) ? source.topPages : [])
        .slice(0, MAX_TOP_PAGES)
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const page = item;
            const path = cleanLimited(page.path, 180);
            if (!path) return null;

            return {
                path,
                title: cleanLimited(page.title, 180),
                durationMs: toPositiveInt(page.durationMs),
            };
        })
        .filter(Boolean);

    const visitSequence = (
        Array.isArray(source.visitSequence) ? source.visitSequence : []
    )
        .slice(-30)
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const page = item;
            const path = cleanLimited(page.path, 180);
            if (!path) return null;
            return {
                path,
                title: cleanLimited(page.title, 180),
                enteredAt: cleanLimited(page.enteredAt, 80),
            };
        })
        .filter(Boolean);

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
};

const buildFallbackTracking = (request, sourceName) => {
    const initialReferrer = cleanLimited(request.headers.get("referer"), 400);
    let referrerPath = "";
    if (initialReferrer) {
        try {
            referrerPath = cleanLimited(new URL(initialReferrer).pathname, 180);
        } catch (_error) {
            referrerPath = "";
        }
    }

    return {
        sessionId: "",
        currentPath: referrerPath,
        landingPage: referrerPath,
        initialReferrer,
        lastSourcePage: referrerPath,
        lastSourceName: cleanLimited(sourceName, 120),
        lastCta: "",
        totalTrackedMs: 0,
        totalPageViews: referrerPath ? 1 : 0,
        uniquePagesVisited: referrerPath ? 1 : 0,
        immediatePreviousPage: "",
        recentPages: [],
        visitSequence: [],
        topPages: [],
    };
};

const parseTrackingFromFormData = (formData, request, sourceName) => {
    const rawTracking = formData.get("tracking");
    let parsedTracking = null;

    if (typeof rawTracking === "string" && rawTracking.trim()) {
        parsedTracking = parseTracking(safeJsonParse(rawTracking));
    }

    return parsedTracking || buildFallbackTracking(request, sourceName);
};

const buildVisitSequenceText = (visitSequence) => {
    if (!visitSequence.length) return "Not captured";

    const collapsed = [];
    visitSequence.forEach((page) => {
        if (!collapsed.length || collapsed[collapsed.length - 1] !== page.path) {
            collapsed.push(page.path);
        }
    });

    return collapsed.join(" -> ");
};

const describeSource = (tracking, sourceName) => {
    if (!tracking) return "No journey source data captured.";

    const sourcePage =
        tracking.lastSourcePage ||
        tracking.landingPage ||
        tracking.currentPath ||
        "unknown page";
    const sourceDisplay = tracking.lastSourceName
        ? `${tracking.lastSourceName} (${sourcePage})`
        : sourceName || sourcePage;
    const cta = tracking.lastCta ? ` via CTA "${tracking.lastCta}"` : "";
    return `Visitor came from ${sourceDisplay}${cta}.`;
};

const buildBehaviorPattern = (tracking, sourceName) => {
    const sourceSummary = describeSource(tracking, sourceName);
    const finalPage = tracking?.currentPath || "Not captured";
    const previousBeforeFinal =
        tracking?.immediatePreviousPage ||
        (tracking?.visitSequence?.length >= 2
            ? tracking.visitSequence[tracking.visitSequence.length - 2].path
            : "Not captured");
    const totalTrackedMs = tracking?.totalTrackedMs || 0;
    const totalTrackedLabel = formatDuration(totalTrackedMs);
    const totalPageViews = tracking?.totalPageViews || 0;
    const uniquePagesVisited = tracking?.uniquePagesVisited || 0;
    const topPage = tracking?.topPages?.[0];
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
};

const buildRecentPagesHtml = (recentPages) => {
    if (!recentPages.length) {
        return "<li>No recent page trail captured.</li>";
    }

    return [...recentPages]
        .reverse()
        .map((page) => {
            const titlePart = page.title ? ` - ${escapeHtml(page.title)}` : "";
            const sourcePart = page.sourcePage
                ? ` (from ${escapeHtml(page.sourcePage)})`
                : "";
            return `<li><strong>${escapeHtml(page.path)}</strong>${titlePart}${sourcePart}</li>`;
        })
        .join("");
};

const buildTopPagesHtml = (topPages) => {
    if (!topPages.length) {
        return "<li>No page-time data captured.</li>";
    }

    return topPages
        .map((page) => {
            const titlePart = page.title ? ` - ${escapeHtml(page.title)}` : "";
            return `<li><strong>${escapeHtml(page.path)}</strong>${titlePart} - ${escapeHtml(formatDuration(page.durationMs))}</li>`;
        })
        .join("");
};

const buildRecentPagesText = (recentPages) => {
    if (!recentPages.length) {
        return ["- No recent page trail captured."];
    }

    return [...recentPages].reverse().map((page) => {
        const titlePart = page.title ? ` - ${page.title}` : "";
        const sourcePart = page.sourcePage ? ` (from ${page.sourcePage})` : "";
        return `- ${page.path}${titlePart}${sourcePart}`;
    });
};

const buildTopPagesText = (topPages) => {
    if (!topPages.length) {
        return ["- No page-time data captured."];
    }

    return topPages.map((page) => {
        const titlePart = page.title ? ` - ${page.title}` : "";
        return `- ${page.path}${titlePart} - ${formatDuration(page.durationMs)}`;
    });
};

const sendSubscriberJourneyEmail = async ({
    email,
    name,
    source,
    tracking,
    status,
}) => {
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

    const behavior = buildBehaviorPattern(tracking, source);
    const recentPagesHtml = buildRecentPagesHtml(tracking?.recentPages || []);
    const topPagesHtml = buildTopPagesHtml(tracking?.topPages || []);
    const structuredQuery = [
        "SELECT",
        "  session_id,",
        "  source_page,",
        "  cta_clicked,",
        "  previous_page_before_subscribe,",
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
        import.meta.env.SUBSCRIBE_ALERT_TO_EMAIL ||
        process.env.SUBSCRIBE_ALERT_TO_EMAIL ||
        OWNER_NOTIFICATION_EMAIL ||
        import.meta.env.CONTACT_FORM_TO_EMAIL ||
        process.env.CONTACT_FORM_TO_EMAIL ||
        "hello@abodid.com";
    const fromAddress =
        import.meta.env.SUBSCRIBE_ALERT_FROM_EMAIL ||
        process.env.SUBSCRIBE_ALERT_FROM_EMAIL ||
        import.meta.env.CONTACT_FORM_FROM_EMAIL ||
        process.env.CONTACT_FORM_FROM_EMAIL ||
        "Abodid Contact <newsletter@abodid.com>";

    const sourceForSubject =
        tracking?.lastSourcePage || tracking?.currentPath || source;
    const subject = `[Subscriber ${status}] ${email}${sourceForSubject ? ` from ${sourceForSubject}` : ""}`;

    const safeName = escapeHtml(name || "Not provided");
    const safeEmail = escapeHtml(email);
    const safeSource = escapeHtml(source);
    const safeStatus = escapeHtml(status);
    const sourceDescriptionHtml = escapeHtml(behavior.sourceSummary);

    const html = `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6;">
            <p style="margin: 0 0 14px; font-size: 18px; font-weight: 700;">
                ${safeEmail} submitted the newsletter form (${safeStatus}). ${sourceDescriptionHtml}
            </p>
            <hr style="border: 0; border-top: 1px solid #ddd; margin: 16px 0;" />
            <p style="margin: 0 0 8px;"><strong>Status:</strong> ${safeStatus}</p>
            <p style="margin: 0 0 8px;"><strong>Name:</strong> ${safeName}</p>
            <p style="margin: 0 0 8px;"><strong>Email ID:</strong> ${safeEmail}</p>
            <p style="margin: 0 0 8px;"><strong>Source Field:</strong> ${safeSource}</p>
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

            <p style="margin: 16px 0 8px; font-weight: 700;">Behavior Pattern (Rule-Based):</p>
            <p style="margin: 0 0 8px;"><strong>Total Time On Site:</strong> ${escapeHtml(behavior.totalTrackedLabel)}</p>
            <p style="margin: 0 0 8px;"><strong>Total Page Views:</strong> ${String(behavior.totalPageViews)}</p>
            <p style="margin: 0 0 8px;"><strong>Unique Pages Visited:</strong> ${String(behavior.uniquePagesVisited)}</p>
            <p style="margin: 0 0 8px;"><strong>Most Time Spent Page:</strong> ${escapeHtml(behavior.topPageSummary)}</p>
            <p style="margin: 0 0 8px;"><strong>Page Before Subscribe:</strong> ${escapeHtml(behavior.previousBeforeFinal)}</p>
            <p style="margin: 0 0 12px;"><strong>Visit Sequence:</strong> ${escapeHtml(behavior.visitSequence)}</p>

            <p style="margin: 0 0 8px; font-weight: 700;">Structured Query (No AI):</p>
            <pre style="white-space: pre-wrap; border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin: 0 0 8px; background: #fafafa;">${escapeHtml(structuredQuery)}</pre>
            <pre style="white-space: pre-wrap; border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin: 0; background: #fafafa;">session_id=${escapeHtml(tracking?.sessionId || "not_captured")}
source_page=${escapeHtml(tracking?.lastSourcePage || "not_captured")}
cta_clicked=${escapeHtml(tracking?.lastCta || "not_captured")}
previous_page_before_subscribe=${escapeHtml(behavior.previousBeforeFinal)}
final_page=${escapeHtml(behavior.finalPage)}
total_page_views=${String(behavior.totalPageViews)}
unique_pages_visited=${String(behavior.uniquePagesVisited)}
total_tracked_seconds=${String(Math.round(behavior.totalTrackedMs / 1000))}
top_time_spent_page=${escapeHtml(behavior.topPageSummary)}
visit_sequence=${escapeHtml(behavior.visitSequence)}</pre>
        </div>
    `;

    const text = [
        `${email} submitted the newsletter form (${status}). ${behavior.sourceSummary}`,
        "",
        `Status: ${status}`,
        `Name: ${name || "Not provided"}`,
        `Email ID: ${email}`,
        `Source Field: ${source}`,
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
        "Behavior Pattern (Rule-Based):",
        `Total Time On Site: ${behavior.totalTrackedLabel}`,
        `Total Page Views: ${behavior.totalPageViews}`,
        `Unique Pages Visited: ${behavior.uniquePagesVisited}`,
        `Most Time Spent Page: ${behavior.topPageSummary}`,
        `Page Before Subscribe: ${behavior.previousBeforeFinal}`,
        `Visit Sequence: ${behavior.visitSequence}`,
        "",
        "Structured Query (No AI):",
        structuredQuery,
        "",
        "Structured Result:",
        `session_id=${tracking?.sessionId || "not_captured"}`,
        `source_page=${tracking?.lastSourcePage || "not_captured"}`,
        `cta_clicked=${tracking?.lastCta || "not_captured"}`,
        `previous_page_before_subscribe=${behavior.previousBeforeFinal}`,
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
        throw error;
    }
};

export const POST = async ({ request }) => {
    const data = await request.formData();
    const email = clean(data.get("email")).toLowerCase();
    const nameValue = cleanLimited(data.get("name"), 120);
    const name = nameValue || null;
    const rawSource = data.get("source");
    const source =
        typeof rawSource === "string" && rawSource.trim().length > 0
            ? rawSource.trim().toLowerCase().slice(0, 40)
            : "popup";
    const tracking = parseTrackingFromFormData(data, request, source);

    if (!email || !EMAIL_REGEX.test(email)) {
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
            try {
                await sendSubscriberJourneyEmail({
                    email,
                    name,
                    source,
                    tracking,
                    status: "existing",
                });
            } catch (trackingEmailError) {
                console.error("Failed to send subscriber tracking email (existing):", trackingEmailError);
            }

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
                    bcc: getOwnerBcc(email),
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

    try {
        await sendSubscriberJourneyEmail({
            email,
            name,
            source,
            tracking,
            status: "new",
        });
    } catch (trackingEmailError) {
        console.error("Failed to send subscriber tracking email (new):", trackingEmailError);
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
            bcc: getOwnerBcc(email),
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
