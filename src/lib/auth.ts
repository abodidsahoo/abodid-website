import { createClient } from "@supabase/supabase-js";
import { supabase as supabaseSingleton } from "./supabase";

export async function isAuthenticated(context) {
    const accessToken = context.cookies.get("sb-access-token")?.value;

    if (!accessToken) {
        return null;
    }

    // For server-side auth check, we need a standard client or we need to set the session.
    // We can use the singleton if we assume stateless, but setting headers on a global singleton is bad for concurrency server-side.
    // However, the "GoTrueClient" warning is strictly a BROWSER warning.
    // Server-side creating multiple clients is standard (one per request).
    // So `auth.ts` is likely NOT the cause of the browser console warning.

    // I will leave `auth.ts` alone for now if I suspect it's server-side only.
    // But let's look at `src/lib/supabaseClient.js` which sounds like a client-side file.

    // REVERTING THIS CHANGE IN THOUGHT PROCESS.
    // Checking `src/lib/supabaseClient.js` first.

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    });

    const {
        data: { session },
        error,
    } = await supabase.auth.getSession();

    if (error || !session) {
        return null;
    }

    return session;
}

export async function isAdmin(context) {
    const session = await isAuthenticated(context);

    if (!session) {
        return false;
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    const accessToken = context.cookies.get("sb-access-token")?.value;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    });

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

    if (error || !profile) {
        return false;
    }

    return profile.role === "admin";
}
