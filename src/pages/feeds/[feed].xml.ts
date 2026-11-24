import type { APIRoute } from 'astro';
import { subscriptionResponse } from '../../lib/subscriptions/response';

export const prerender = false;
export const GET: APIRoute = ({ params, site }) => subscriptionResponse(params.feed || '', site);
