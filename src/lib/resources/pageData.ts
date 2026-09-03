import { supabase } from '../supabaseClient';
import type { User } from '@supabase/supabase-js';
import type { HubResource } from './types';

export const RESOURCE_DATA_CHANGED = 'resources:data-changed';
export type ResourceViewer = { user: User; role: string };
export type DashboardResource = Omit<HubResource, 'status'> & {
    status: 'pending' | 'approved' | 'rejected' | 'deleted';
    rejection_reason: string | null;
};
export interface DashboardData {
    submissions: DashboardResource[];
    pending: DashboardResource[];
    deleted: DashboardResource[];
    resources: DashboardResource[];
}

// Private snapshots live only in browser memory, scoped to account and role.
const snapshots = new Map<string, { value: unknown; expires: number }>();
const requests = new Map<string, Promise<unknown>>();
let revision = 0;

function cached<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    const entry = snapshots.get(key);
    if (!entry || entry.expires <= Date.now()) {
        snapshots.delete(key);
        return null;
    }
    return entry.value as T;
}

export function clearResourcePageData() {
    revision += 1;
    snapshots.clear();
    requests.clear();
}

export function invalidateResourcePageData() {
    clearResourcePageData();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(RESOURCE_DATA_CHANGED));
}

// Retry reads only; writes must never be replayed automatically.
export async function retryResourceRead<T>(read: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                Promise.resolve().then(() => read(controller.signal)),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        controller.abort();
                        reject(new Error('Resource request timed out'));
                    }, 10_000);
                }),
            ]);
        } catch (error) {
            lastError = error;
        } finally {
            clearTimeout(timer);
        }
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
    }
    throw lastError;
}

async function request<T>(key: string, read: (signal: AbortSignal) => PromiseLike<T>, force = false, ttl = 300_000): Promise<T> {
    if (!force) {
        const previous = cached<T>(key);
        if (previous !== null) return previous;
    }
    const pending = requests.get(key);
    if (pending) return pending as Promise<T>;
    const startedAt = revision;
    const result = retryResourceRead(read).then(value => {
        // Do not restore an old snapshot after a mutation or sign-out.
        if (startedAt !== revision) throw new Error('Resource data changed during loading');
        if (typeof window !== 'undefined') snapshots.set(key, { value, expires: Date.now() + ttl });
        return value;
    }).finally(() => {
        if (requests.get(key) === result) requests.delete(key);
    });
    requests.set(key, result);
    return result;
}

export async function getResourceViewer(): Promise<ResourceViewer | null> {
    const session = await retryResourceRead(async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
    });
    if (!session?.user || session.user.is_anonymous) {
        clearResourcePageData();
        return null;
    }
    const role = await request(`profile:${session.user.id}`, async signal => {
        const { data, error } = await supabase.from('profiles')
            .select('role').eq('id', session.user.id).single().abortSignal(signal);
        if (error) throw error;
        if (!data?.role) throw new Error('Profile is not available yet');
        return data.role as string;
    }, false, 60_000);
    return { user: session.user, role };
}

const dashboardKey = (userId: string, role: string) => `dashboard:${userId}:${role}`;

export function getCachedDashboard(userId: string, role: string): DashboardData | null {
    return cached(dashboardKey(userId, role));
}

export async function loadDashboardData(userId: string, role: string, force = false): Promise<DashboardData> {
    if (role !== 'admin' && role !== 'curator') throw new Error('Staff access required');
    return request(dashboardKey(userId, role), async signal => {
        // UnifiedDashboard resolves the viewer first. RLS still authorizes
        // this query using the current Supabase session.
        const { data, error } = await supabase.from('hub_resources').select(`
            *, submitter_profile:submitted_by (username, full_name, avatar_url),
            tags:hub_resource_tags (tag_id, tag:hub_tags (id, name))
        `).order('created_at', { ascending: false }).abortSignal(signal);
        if (error) throw error;
        if (!data) throw new Error('Dashboard data is unavailable');
        const rows: DashboardResource[] = data.map((item: any) => ({
            ...item, tags: item.tags?.map((link: any) => link.tag).filter(Boolean) || [],
        }));
        return {
            submissions: rows.filter(row => row.submitted_by === userId),
            pending: rows.filter(row => row.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at)),
            deleted: rows.filter(row => row.status === 'deleted').sort((a, b) => (b.reviewed_at || '').localeCompare(a.reviewed_at || '')),
            resources: rows.filter(row => row.status !== 'deleted'),
        };
    }, force);
}

export async function loadResourceDetail(resourceId: string, userId: string | null): Promise<HubResource | null> {
    return request(`detail:${userId || 'public'}:${resourceId}`, async signal => {
        const { data, error } = await supabase.from('hub_resources').select(`
            *, submitter_profile:submitted_by (username, full_name, avatar_url),
            tags:hub_resource_tags (tag_id, tag:hub_tags (id, name))
        `).eq('id', resourceId).maybeSingle().abortSignal(signal);
        if (error) throw error;
        return data ? { ...data, tags: data.tags?.map((link: any) => link.tag).filter(Boolean) || [] } : null;
    }, true);
}
