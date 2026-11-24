import { subscriptionResponse } from '../lib/subscriptions/response';

export const prerender = false;
export const GET = ({ site }) => subscriptionResponse('all', site);
