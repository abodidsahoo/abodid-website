import type { APIRoute } from 'astro';
import { POST as submitFeedback } from './feedback/[slug]';

export const prerender = false;
// Keep old bookmarks, forms, and integrations working while storing new responses centrally.
export const POST: APIRoute = (context) => submitFeedback({
    ...context, params: { slug: 'delhi-university-ethnographic-filmmaking' },
});
