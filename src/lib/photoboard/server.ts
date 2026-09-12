import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '../supabaseServer';

export const photoBoardJson = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    });

type AuthorizedUser = {
    ok: true;
    supabase: SupabaseClient;
    user: User;
};

type RejectedUser = {
    ok: false;
    response: Response;
};

export const authorizePhotoBoardUser = async (
    request: Request,
): Promise<AuthorizedUser | RejectedUser> => {
    const supabase = createSupabaseServiceClient();
    if (!supabase) {
        return {
            ok: false,
            response: photoBoardJson({ error: 'Photo Board storage is not configured.' }, 503),
        };
    }

    const authorization = request.headers.get('Authorization') || '';
    const token = authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : '';
    if (!token) {
        return { ok: false, response: photoBoardJson({ error: 'Sign in required.' }, 401) };
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        return { ok: false, response: photoBoardJson({ error: 'Your session has expired.' }, 401) };
    }

    return { ok: true, supabase, user };
};

export const assertOwnedBoard = async (
    supabase: SupabaseClient,
    userId: string,
    boardId: string,
) => {
    const { data, error } = await supabase
        .from('photo_boards')
        .select('id,user_id,logical_width,logical_height')
        .eq('id', boardId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return data;
};
