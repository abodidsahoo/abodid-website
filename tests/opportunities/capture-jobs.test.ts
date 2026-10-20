import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
    captureJobToPublic,
    type OpportunityCaptureJobRow,
} from '../../src/lib/opportunities/captureJobs';

const job = (updates: Partial<OpportunityCaptureJobRow> = {}): OpportunityCaptureJobRow => ({
    id: '10000000-0000-4000-8000-000000000001',
    user_id: '20000000-0000-4000-8000-000000000002',
    idempotency_key: '30000000-0000-4000-8000-000000000003',
    channel: 'extension',
    input_kind: 'url',
    status: 'pending',
    payload: {
        url: 'https://example.org/opportunity',
        title: 'Example opportunity',
        page_text: 'Private captured page snapshot that must never reach the client response.',
    },
    attempt_count: 0,
    max_attempts: 3,
    available_at: '2026-10-20T12:00:00.000Z',
    locked_at: null,
    started_at: null,
    completed_at: null,
    opportunity_id: null,
    is_duplicate: false,
    error_code: null,
    error_message: null,
    source_cleanup_at: null,
    source_cleaned_at: null,
    created_at: '2026-10-20T12:00:00.000Z',
    updated_at: '2026-10-20T12:00:00.000Z',
    ...updates,
});

describe('Durable opportunity capture jobs', () => {
    it('returns useful receipt metadata without exposing raw page text or user ids', () => {
        const publicJob = captureJobToPublic(job());
        expect(publicJob.source_url).toBe('https://example.org/opportunity');
        expect(publicJob.source_title).toBe('Example opportunity');
        expect(publicJob).not.toHaveProperty('payload');
        expect(publicJob).not.toHaveProperty('user_id');
        expect(JSON.stringify(publicJob)).not.toContain('Private captured page snapshot');
    });

    it('defines an owner-scoped, idempotent queue with recoverable leases', async () => {
        const storageMigration = await readFile(
            new URL('../../supabase/migrations/20261020220000_create_opportunity_capture_jobs.sql', import.meta.url),
            'utf8',
        );
        const schedulerMigration = await readFile(
            new URL('../../supabase/migrations/20261020221000_schedule_opportunity_capture_jobs.sql', import.meta.url),
            'utf8',
        );
        const inputMigration = await readFile(
            new URL('../../supabase/migrations/20261020230000_expand_opportunity_capture_jobs.sql', import.meta.url),
            'utf8',
        );
        expect(storageMigration).toContain('unique (user_id, idempotency_key)');
        expect(storageMigration).toContain('force row level security');
        expect(storageMigration).toContain('for update skip locked');
        expect(storageMigration).toContain("jobs.locked_at < now() - interval '15 minutes'");
        expect(schedulerMigration).toContain("payload = payload - 'page_text'");
        expect(schedulerMigration).toContain('opportunities_cron_secret must be configured');
        expect(inputMigration).toContain("input_kind in ('url', 'text', 'attachments', 'mixed')");
        expect(inputMigration).toContain("status in ('uploading', 'pending', 'processing', 'succeeded', 'failed')");
        expect(inputMigration).toContain("'opportunity-capture-files'");
        expect(inputMigration).toContain('public = false');
        expect(inputMigration).not.toContain('create policy');
    });

    it('does not expose pasted text or temporary attachment paths in a receipt', () => {
        const publicJob = captureJobToPublic(job({
            input_kind: 'mixed',
            status: 'uploading',
            payload: {
                text: 'Private pasted note',
                attachments: [{
                    name: 'brief.pdf',
                    type: 'application/pdf',
                    size: 1024,
                    path: 'private-user/private-job/private-object.pdf',
                }],
            },
        }));
        expect(publicJob.source_title).toBe('brief.pdf');
        expect(JSON.stringify(publicJob)).not.toContain('Private pasted note');
        expect(JSON.stringify(publicJob)).not.toContain('private-object.pdf');
    });
});
