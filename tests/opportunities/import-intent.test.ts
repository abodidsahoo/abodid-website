import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
    RADAR_IMPORT_INTENT_TTL_MS,
    createRadarImportIntent,
    getRadarImportNextPath,
    parseRadarImportIntent,
} from '../../src/lib/opportunities/importIntent';

const sourceId = '123e4567-e89b-42d3-a456-426614174000';
const nonce = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';

describe('Opportunity radar import intent', () => {
    it('builds a same-origin opportunity return path', () => {
        const intent = createRadarImportIntent(sourceId, 'Abodid', nonce, 1_000);
        expect(getRadarImportNextPath(intent)).toBe(
            `/opportunities/abodid?add=${sourceId}&intent=${nonce}`,
        );
    });

    it('requires the stored source, username, nonce, and age to match', () => {
        const intent = createRadarImportIntent(sourceId, 'abodid', nonce, 1_000);
        const raw = JSON.stringify(intent);
        const expected = { sourceId, sourceUsername: 'abodid', nonce };

        expect(parseRadarImportIntent(raw, expected, 2_000)).toEqual(intent);
        expect(parseRadarImportIntent(raw, { ...expected, nonce: crypto.randomUUID() }, 2_000)).toBeNull();
        expect(parseRadarImportIntent(raw, expected, 1_000 + RADAR_IMPORT_INTENT_TTL_MS + 1)).toBeNull();
    });

    it('rejects malformed and non-UUID intent input', () => {
        expect(() => createRadarImportIntent('not-an-id', 'abodid', nonce)).toThrow();
        expect(parseRadarImportIntent('{broken', {
            sourceId,
            sourceUsername: 'abodid',
            nonce,
        })).toBeNull();
    });
});

describe('Opportunity public copy SQL contract', () => {
    it('keeps personal fields private and uses the authenticated user as destination', async () => {
        const sql = await readFile(new URL(
            '../../supabase/migrations/20261015120000_opportunities_public_import.sql',
            import.meta.url,
        ), 'utf8');

        expect(sql).toContain('destination_user_id uuid := (select auth.uid())');
        expect(sql).toContain('profile.is_public = true');
        expect(sql).toContain("'inbox'");
        expect(sql).toMatch(/\n\s+1,\n\s+null,\n\s+jsonb_strip_nulls/);
        expect(sql).not.toContain("source_row.content->'meeting_url'");
        expect(sql).not.toContain("source_row.content->'next_action'");
        expect(sql).toContain('on conflict (user_id, canonical_url) do nothing');
        expect(sql).toContain('grant execute on function public.copy_public_opportunity(uuid) to authenticated');
    });
});
