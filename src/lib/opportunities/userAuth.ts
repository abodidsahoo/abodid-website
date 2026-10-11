import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '../supabaseServer';
export {
    OPPORTUNITY_RESERVED_USERNAMES,
    normalizeOpportunityUsername,
    isValidOpportunityUsername,
} from './username';

export type OpportunityProfile = {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_public: boolean;
    role: string;
};

export type AuthorizedOpportunityUser = {
    ok: true;
    user: User;
    profile: OpportunityProfile;
    userClient: SupabaseClient;
    serviceClient: SupabaseClient;
    token: string;
};

export type RejectedOpportunityUser = {
    ok: false;
    response: Response;
};

export type OpportunityAuthorization = AuthorizedOpportunityUser | RejectedOpportunityUser;

export const opportunityJson = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
            'Vary': 'Authorization',
        },
    });

const getBearerToken = (request: Request) => {
    const authorization = request.headers.get('authorization') || '';
    return authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : '';
};

const createUserScopedClient = (token: string): SupabaseClient | null => {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) return null;

    return createClient(supabaseUrl, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
        global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    });
};

/**
 * Verifies a Supabase bearer token and returns a request-scoped database
 * client. Ordinary Opportunity queries must use userClient so RLS remains the
 * final ownership boundary. serviceClient is reserved for safe profile lookup
 * and trusted extraction/audit work.
 */
export const authorizeOpportunityRequest = async (request: Request): Promise<OpportunityAuthorization> => {
    const token = getBearerToken(request);
    if (!token) {
        return { ok: false, response: opportunityJson({ error: 'Sign in required' }, 401) };
    }

    const serviceClient = createSupabaseServiceClient();
    const userClient = createUserScopedClient(token);
    if (!serviceClient || !userClient) {
        return { ok: false, response: opportunityJson({ error: 'Authentication service unavailable' }, 500) };
    }

    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !user || user.is_anonymous) {
        return { ok: false, response: opportunityJson({ error: 'Invalid or expired session' }, 401) };
    }

    const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_public, role')
        .eq('id', user.id)
        .single();

    if (profileError || !profile?.username) {
        const isMissingSchema = profileError?.code === 'PGRST204'
            || profileError?.code === 'PGRST205'
            || profileError?.code === '42P01'
            || profileError?.code === '42703';
        return {
            ok: false,
            response: opportunityJson({
                error: isMissingSchema
                    ? 'Opportunities account storage is not configured'
                    : 'User profile is not ready',
                code: isMissingSchema ? 'OPPORTUNITIES_NOT_CONFIGURED' : 'PROFILE_NOT_READY',
            }, isMissingSchema ? 503 : 409),
        };
    }

    return {
        ok: true,
        user,
        token,
        userClient,
        serviceClient,
        profile: {
            id: profile.id,
            username: profile.username,
            display_name: profile.full_name || profile.username,
            avatar_url: profile.avatar_url || null,
            is_public: Boolean(profile.is_public),
            role: profile.role || 'user',
        },
    };
};
