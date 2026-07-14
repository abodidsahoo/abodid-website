import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "../supabaseServer";

export const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
        },
    });

type AuthorizedAdmin = {
    ok: true;
    supabase: SupabaseClient;
    user: User;
};

type RejectedAdmin = {
    ok: false;
    response: Response;
};

export type AdminAuthorization = AuthorizedAdmin | RejectedAdmin;

/**
 * Verifies the caller's Supabase access token and current admin role.
 * The service-role client stays on the server and is never returned to the browser.
 */
export const authorizeAdminRequest = async (request: Request): Promise<AdminAuthorization> => {
    const supabase = createSupabaseServiceClient();
    if (!supabase) {
        return {
            ok: false,
            response: jsonResponse({ error: "Server configuration is incomplete." }, 500),
        };
    }

    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length).trim()
        : "";

    if (!token) {
        return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
    }

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
        return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profileError || profile?.role !== "admin") {
        return {
            ok: false,
            response: jsonResponse({ error: "Admin access required." }, 403),
        };
    }

    return { ok: true, supabase, user };
};
