import { isValidOpportunityUsername } from './username';

export const RADAR_IMPORT_INTENT_STORAGE_KEY = 'opportunity-radar-import:v1';
export const RADAR_IMPORT_INTENT_TTL_MS = 30 * 60 * 1000;

export type RadarImportIntent = {
    sourceId: string;
    sourceUsername: string;
    nonce: string;
    createdAt: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isOpportunityId = (value: string) => UUID_PATTERN.test(value);

export const createRadarImportIntent = (
    sourceId: string,
    sourceUsername: string,
    nonce = globalThis.crypto.randomUUID(),
    createdAt = Date.now(),
): RadarImportIntent => {
    const username = sourceUsername.trim().toLowerCase();
    if (!isOpportunityId(sourceId) || !isValidOpportunityUsername(username) || !UUID_PATTERN.test(nonce)) {
        throw new TypeError('Invalid radar import intent');
    }

    return { sourceId, sourceUsername: username, nonce, createdAt };
};

export const getRadarImportNextPath = (intent: RadarImportIntent) => {
    const params = new URLSearchParams({ add: intent.sourceId, intent: intent.nonce });
    return `/opportunities/${encodeURIComponent(intent.sourceUsername)}?${params.toString()}`;
};

export const parseRadarImportIntent = (
    raw: string | null,
    expected: { sourceId: string; sourceUsername: string; nonce: string },
    now = Date.now(),
): RadarImportIntent | null => {
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<RadarImportIntent>;
        const username = String(parsed.sourceUsername || '').trim().toLowerCase();
        const createdAt = Number(parsed.createdAt);
        if (
            parsed.sourceId !== expected.sourceId
            || parsed.nonce !== expected.nonce
            || username !== expected.sourceUsername.trim().toLowerCase()
            || !isOpportunityId(String(parsed.sourceId || ''))
            || !UUID_PATTERN.test(String(parsed.nonce || ''))
            || !Number.isFinite(createdAt)
            || createdAt > now + 60_000
            || now - createdAt > RADAR_IMPORT_INTENT_TTL_MS
        ) {
            return null;
        }

        return {
            sourceId: parsed.sourceId,
            sourceUsername: username,
            nonce: parsed.nonce,
            createdAt,
        } as RadarImportIntent;
    } catch {
        return null;
    }
};
