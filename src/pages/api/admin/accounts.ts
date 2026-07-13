import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { buildAccountDirectory } from "../../../lib/admin/accountDirectory.js";

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
        },
    });

const createAdminClient = () => {
    const supabaseUrl =
        import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) return null;

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
};

const authorizeAdmin = async (request: Request) => {
    const supabase = createAdminClient();
    if (!supabase) {
        return { error: json({ error: "Server configuration is incomplete." }, 500) };
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : "";

    if (!token) return { error: json({ error: "Unauthorized" }, 401) };

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return { error: json({ error: "Unauthorized" }, 401) };
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profileError || profile?.role !== "admin") {
        return { error: json({ error: "Admin access required." }, 403) };
    }

    return { supabase, user };
};

const listAllAuthUsers = async (supabase: any): Promise<any[]> => {
    const users: any[] = [];

    for (let page = 1; ; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({
            page,
            perPage: 1000,
        });

        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 1000) return users;
    }
};

export const GET: APIRoute = async ({ request }) => {
    try {
        const auth = await authorizeAdmin(request);
        if (auth.error || !auth.supabase) return auth.error;

        const { supabase } = auth;
        const [
            authUsers,
            profilesResult,
            subscribersResult,
            bookmarksResult,
            upvotesResult,
            resourcesResult,
        ] = await Promise.all([
            listAllAuthUsers(supabase),
            supabase
                .from("profiles")
                .select("id, email, username, full_name, avatar_url, role"),
            supabase
                .from("subscribers")
                .select("email")
                .eq("status", "active"),
            supabase.from("hub_resource_bookmarks").select("user_id"),
            supabase.from("hub_resource_upvotes").select("user_id"),
            supabase.from("hub_resources").select("submitted_by"),
        ]);

        const queryResults = [
            profilesResult,
            subscribersResult,
            bookmarksResult,
            upvotesResult,
            resourcesResult,
        ];
        const queryError = queryResults.find((result) => result.error)?.error;
        if (queryError) throw queryError;

        return json(
            buildAccountDirectory({
                authUsers,
                profiles: profilesResult.data || [],
                subscribers: subscribersResult.data || [],
                bookmarks: bookmarksResult.data || [],
                upvotes: upvotesResult.data || [],
                resources: resourcesResult.data || [],
            } as any),
        );
    } catch (error) {
        console.error("Failed to load account directory:", error);
        return json({ error: "Could not load accounts." }, 500);
    }
};

export const PATCH: APIRoute = async ({ request }) => {
    try {
        const auth = await authorizeAdmin(request);
        if (auth.error || !auth.supabase) return auth.error;

        const { supabase } = auth;
        const body = await request.json();
        const accountId = typeof body?.accountId === "string" ? body.accountId : "";
        const role = body?.role;

        if (!accountId || !["user", "curator"].includes(role)) {
            return json({ error: "A valid account and role are required." }, 400);
        }

        const [{ data: targetAuth, error: targetAuthError }, { data: profile, error: profileError }] =
            await Promise.all([
                supabase.auth.admin.getUserById(accountId),
                supabase.from("profiles").select("role").eq("id", accountId).single(),
            ]);

        if (targetAuthError || !targetAuth?.user || profileError || !profile) {
            return json({ error: "Account not found." }, 404);
        }

        if (targetAuth.user.is_anonymous) {
            return json({ error: "Anonymous visitors cannot receive community roles." }, 400);
        }

        if (profile.role === "admin") {
            return json({ error: "The admin role cannot be changed here." }, 400);
        }

        const { error: updateError } = await supabase
            .from("profiles")
            .update({ role })
            .eq("id", accountId);

        if (updateError) throw updateError;
        return json({ accountId, role });
    } catch (error) {
        console.error("Failed to update account role:", error);
        return json({ error: "Could not update the account role." }, 500);
    }
};
