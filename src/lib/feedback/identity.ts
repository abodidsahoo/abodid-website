import type { SupabaseClient } from '@supabase/supabase-js';
import { createReceipt, readReceipt } from './receipt';
import { UUID_PATTERN } from './schema';

const COOKIE = 'feedback_participant';
const PURPOSE = 'feedback-participant';
export type ParticipantIdentity = { id: string; name: string; email: string };
export function cookieValue(request: Request, name: string) {
    return request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}
export function participantId(request: Request) {
    const receipt = readReceipt(cookieValue(request, COOKIE), PURPOSE);
    return receipt && UUID_PATTERN.test(receipt.id) ? receipt.id : null;
}
export async function loadIdentity(client: SupabaseClient, id: string): Promise<ParticipantIdentity | null> {
    const { data, error } = await client.from('feedback_responses').select('id,participant_name,participant_email,metadata').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const current = data.metadata?.private_identity || {};
    return { id, name: current.name ?? data.participant_name ?? '', email: current.email ?? data.participant_email ?? '' };
}
export async function requestIdentity(client: SupabaseClient, request: Request) {
    const id = participantId(request);
    return id ? loadIdentity(client, id) : null;
}
export function identityCookie(id: string, request: Request) {
    return `${COOKIE}=${createReceipt(PURPOSE, id)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
// Canonical contact details stay private even when the identity anchor is a public lecture response.
// The JSON equality condition prevents overwriting unrelated metadata changed concurrently.
export async function updateIdentity(client: SupabaseClient, id: string, name: string, email: string, submittedAt: string) {
    if (!name && !email) return;
    for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await client.from('feedback_responses').select('metadata').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Participant record not found.');
        const metadata = data.metadata || {};
        if (Date.parse(metadata.private_identity?.source_created_at || '') >= Date.parse(submittedAt)) return;
        const identity = { ...(metadata.private_identity || {}), ...(name ? { name } : {}), ...(email ? { email } : {}), source_created_at: submittedAt };
        const { data: saved, error: saveError } = await client.from('feedback_responses').update({ metadata: { ...metadata, private_identity: identity } })
            .eq('id', id).eq('metadata', JSON.stringify(metadata)).select('id').maybeSingle();
        if (saveError) throw saveError;
        if (saved) return;
    }
    throw new Error('Contact details changed in another request. Please retry.');
}
