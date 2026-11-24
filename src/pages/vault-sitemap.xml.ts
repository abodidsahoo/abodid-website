import type { APIRoute } from 'astro';
import { subscriptionSitemap } from '../lib/subscriptions/sitemap';
export const prerender = false;
export const GET: APIRoute = ({ site }) => subscriptionSitemap('notes', site);
