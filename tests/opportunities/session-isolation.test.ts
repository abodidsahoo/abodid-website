import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

describe('Opportunity authentication session isolation', () => {
    it('keeps opportunity search data scoped to exactly one collection owner', async () => {
        const [privateRoute, publicRoute, dashboard, search, migration] = await Promise.all([
            source('../../src/pages/api/opportunities/index.ts'),
            source('../../src/pages/api/opportunities/public/[username].ts'),
            source('../../src/components/opportunities/OpportunityDashboard.tsx'),
            source('../../src/lib/opportunities/search.ts'),
            source('../../supabase/migrations/20261009120000_opportunities_multi_user.sql'),
        ]);

        expect(privateRoute).toContain(".eq('user_id', authorization.user.id)");
        expect(publicRoute).toContain(".eq('user_id', profile.id)");
        expect(publicRoute).toContain(".not('source_url', 'like', 'https://direct.entry/%')");
        expect(dashboard).toContain('buildOpportunitySearchIndex(opportunities)');
        expect(search).not.toMatch(/fetch\(|supabase|saved_opportunities/i);
        expect(migration).toContain('alter table public.saved_opportunities force row level security');
        expect(migration).toContain('using ((select auth.uid()) = user_id)');
    });

    it('requests only the basic Google identity scopes in the website and extension', async () => {
        const [opportunityLanding, extensionAuth] = await Promise.all([
            source('../../src/components/opportunities/OpportunityLanding.tsx'),
            source('../../extension/src/auth.ts'),
        ]);

        for (const authSource of [opportunityLanding, extensionAuth]) {
            expect(authSource).toContain("GOOGLE_IDENTITY_SCOPES = 'openid email profile'");
            expect(authSource).toContain('scopes: GOOGLE_IDENTITY_SCOPES');
            expect(authSource).not.toMatch(/scopes:\s*['"][^'"]*(gmail|calendar|drive|contacts)/i);
        }
    });

    it('uses a dedicated storage namespace at every opportunity auth entry point', async () => {
        const clientSource = await source('../../src/lib/opportunitySupabase.ts');
        expect(clientSource).toContain("OPPORTUNITY_AUTH_STORAGE_KEY = 'abodid-opportunities-auth'");

        const entryPointSources = await Promise.all([
            source('../../src/components/opportunities/OpportunityLanding.tsx'),
            source('../../src/components/opportunities/OpportunityCollectionApp.tsx'),
            source('../../src/components/opportunities/OpportunityDashboard.tsx'),
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
