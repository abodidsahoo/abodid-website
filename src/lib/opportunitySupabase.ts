import { createBrowserSupabaseClient } from './createBrowserSupabaseClient';

export const OPPORTUNITY_AUTH_STORAGE_KEY = 'abodid-opportunities-auth';

export const opportunitySupabase = createBrowserSupabaseClient(OPPORTUNITY_AUTH_STORAGE_KEY);
