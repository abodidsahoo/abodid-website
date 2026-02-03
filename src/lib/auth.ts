import { createClient } from "@supabase/supabase-js";

export async function isAuthenticated(context) {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    const accessToken = context.cookies.get("sb-access-token")?.value;
    //   const refreshToken = context.cookies.get("sb-refresh-token")?.value;

    if (!accessToken) {
        return null;
    }

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
