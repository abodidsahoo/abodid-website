export const prerender = false;

import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../lib/admin/serverAuth';
import {
    classifyGa4Error,
    runGa4SessionsReport,
} from '../../../lib/analytics/ga4-reporting.js';

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const report = await runGa4SessionsReport();
        return jsonResponse({ ok: true, report });
    } catch (error) {
        const category = classifyGa4Error(error);
        const status = category === 'configuration' ? 503 : 502;
        return jsonResponse({
            ok: false,
            error: 'Google Analytics reporting connection failed.',
            category,
        }, status);
    }
};
