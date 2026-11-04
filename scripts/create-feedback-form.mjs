import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { questionsSchema, contentSchema, formPath, responsesPath } from '../src/lib/feedback/schema.ts';

const file = process.argv[2];
if (!file) throw new Error('Usage: npm run feedback:create -- /absolute/path/to/form.json');
const definition = JSON.parse(await fs.readFile(file, 'utf8'));
for (const field of ['slug', 'institution_slug', 'event_slug']) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(definition[field] || '')) throw new Error(`${field} must be a lowercase URL slug.`);
}
for (const field of ['institution_name', 'event_title']) {
    if (typeof definition[field] !== 'string' || !definition[field].trim()) throw new Error(`${field} is required.`);
}
const payload = {
    slug: definition.slug, institution_slug: definition.institution_slug, institution_name: definition.institution_name,
    event_slug: definition.event_slug, event_title: definition.event_title, event_date: definition.event_date || null,
    questions: questionsSchema.parse(definition.questions), content: contentSchema.parse(definition.content),
    is_open: definition.is_open ?? true, responses_public: definition.responses_public ?? true,
};
if (process.argv.includes('--dry-run')) {
    console.log(`Valid feedback form: ${payload.slug}`);
} else {
    const url = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('Server-side Supabase credentials are required.');
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.from('feedback_forms').insert(payload);
    if (error) throw new Error(error.message);
    const site = process.env.PUBLIC_SITE_URL || 'https://abodid.com';
    console.log(`Form: ${site}${formPath(payload.slug)}\nResponses: ${site}${responsesPath(payload.slug)}`);
}
