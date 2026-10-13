import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

describe('Opportunity authentication session isolation', () => {
    it('uses a dedicated storage namespace at every opportunity auth entry point', async () => {
        const clientSource = await source('../../src/lib/opportunitySupabase.ts');
        expect(clientSource).toContain("OPPORTUNITY_AUTH_STORAGE_KEY = 'abodid-opportunities-auth'");

        const entryPointSources = await Promise.all([
            source('../../src/components/opportunities/OpportunityLanding.tsx'),
            source('../../src/components/opportunities/OpportunityCollectionApp.tsx'),
            source('../../src/components/opportunities/OpportunityDashboard.tsx'),
            source('../../src/components/opportunities/OpportunitySettings.tsx'),
            source('../../src/pages/opportunities/auth/callback.astro'),
        ]);

        for (const entryPointSource of entryPointSources) {
            expect(entryPointSource).toContain('opportunitySupabase');
            expect(entryPointSource).not.toMatch(/from ['"].*\/lib\/supabase['"]/);
        }
    });

    it('logs out locally without revoking the other application session', async () => {
        const [opportunityDashboard, adminDashboard, adminLogin] = await Promise.all([
            source('../../src/components/opportunities/OpportunityDashboard.tsx'),
            source('../../src/components/admin/AdminDashboard.jsx'),
            source('../../src/components/admin/LoginForm.jsx'),
        ]);

        expect(opportunityDashboard).toContain("signOut({ scope: 'local' })");
        expect(adminDashboard).toContain("signOut({ scope: 'local' })");
        expect(adminLogin).toContain("signOut({ scope: 'local' })");
    });
});
