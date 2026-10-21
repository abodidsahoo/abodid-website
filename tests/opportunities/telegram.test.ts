import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
    createTelegramLinkToken,
    hashTelegramLinkToken,
    parseTelegramUpdate,
    telegramUpdateIdempotencyKey,
    verifyTelegramWebhookSecret,
} from '../../src/lib/integrations/telegram';

describe('Telegram Opportunity integration', () => {
    it('creates URL-safe, non-persisted link tokens and stable hashes', () => {
        const token = createTelegramLinkToken();
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(hashTelegramLinkToken(token)).toMatch(/^[0-9a-f]{64}$/);
        expect(hashTelegramLinkToken(token)).toBe(hashTelegramLinkToken(token));
    });

    it('creates a deterministic UUID idempotency key for each update', () => {
        const first = telegramUpdateIdempotencyKey('12345');
        expect(first).toMatch(/^[0-9a-f-]{36}$/);
        expect(first).toBe(telegramUpdateIdempotencyKey('12345'));
        expect(first).not.toBe(telegramUpdateIdempotencyKey('12346'));
    });

    it('parses private voice notes without treating file ids as secrets', () => {
        const parsed = parseTelegramUpdate({
            update_id: 17,
            message: {
                message_id: 9,
                date: 1_800_000_000,
                chat: { id: 42, type: 'private' },
                from: { id: 42, username: 'artist', first_name: 'Artist' },
                caption: 'Possible residency',
                voice: {
                    file_id: 'downloadable-id',
                    file_unique_id: 'stable-id',
                    duration: 24,
                    mime_type: 'audio/ogg',
                    file_size: 4096,
                },
            },
        });
        expect(parsed).toMatchObject({
            updateId: '17',
            chatId: '42',
            userId: '42',
            text: 'Possible residency',
            command: null,
        });
        expect(parsed.files[0]).toMatchObject({ kind: 'voice', type: 'audio/ogg', size: 4096 });
    });

    it('does not include a raw start token in the parsed command name', () => {
        const parsed = parseTelegramUpdate({
            update_id: 18,
            message: {
                message_id: 10,
                date: 1_800_000_000,
                chat: { id: 43, type: 'private' },
                from: { id: 43, first_name: 'Artist' },
                text: '/start private-token',
            },
        });
        expect(parsed.command).toBe('start');
        expect(parsed.commandArgument).toBe('private-token');
    });

    it('compares webhook secrets without accepting a prefix', () => {
        vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'correct_secret');
        expect(verifyTelegramWebhookSecret('correct_secret')).toBe(true);
        expect(verifyTelegramWebhookSecret('correct')).toBe(false);
        expect(verifyTelegramWebhookSecret(null)).toBe(false);
        vi.unstubAllEnvs();
    });

    it('defines two server-only messaging tables and reuses capture jobs', async () => {
        const migration = await readFile(
            new URL('../../supabase/migrations/20261021120000_create_telegram_integration.sql', import.meta.url),
            'utf8',
        );
        expect(migration).toContain('create table if not exists public.messaging_connections');
        expect(migration).toContain('create table if not exists public.messaging_events');
        expect(migration).toContain('messaging_events_provider_update_unique');
        expect(migration).toContain('alter table public.opportunity_capture_jobs');
        expect(migration).toContain('force row level security');
        expect(migration).not.toContain('create table if not exists public.messaging_link_tokens');
        expect(migration).not.toContain('create table if not exists public.notification_deliveries');
    });
});
