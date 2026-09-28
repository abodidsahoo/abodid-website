import assert from 'node:assert/strict';
import test from 'node:test';

import {
    GA4_PROPERTY_ID,
    GA4_SERVICE_ACCOUNT_EMAIL,
    classifyGa4Error,
    resolveGa4Configuration,
    runGa4SessionsReport,
} from '../../src/lib/analytics/ga4-reporting.js';

const PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nredacted-test-key\\n-----END PRIVATE KEY-----';

test('accepts the confirmed GA4 property and service account without exposing client credentials', () => {
    const config = resolveGa4Configuration({
        GA4_PROPERTY_ID,
        GA4_CLIENT_EMAIL: GA4_SERVICE_ACCOUNT_EMAIL,
        GA4_PRIVATE_KEY: PRIVATE_KEY,
    });

    assert.equal(config.propertyId, '497735650');
    assert.equal(config.credentials.client_email, GA4_SERVICE_ACCOUNT_EMAIL);
    assert.match(config.credentials.private_key, /BEGIN PRIVATE KEY-----\n/);
});

test('rejects measurement IDs and unexpected service accounts', () => {
    assert.throws(() => resolveGa4Configuration({
        GA4_PROPERTY_ID: 'G-V07Z22DSVH',
        GA4_CLIENT_EMAIL: GA4_SERVICE_ACCOUNT_EMAIL,
        GA4_PRIVATE_KEY: PRIVATE_KEY,
    }), /numeric GA4 Property ID/);

    assert.throws(() => resolveGa4Configuration({
        GA4_PROPERTY_ID,
        GA4_CLIENT_EMAIL: 'other@example.iam.gserviceaccount.com',
        GA4_PRIVATE_KEY: PRIVATE_KEY,
    }), /analytics@abodid-website\.iam\.gserviceaccount\.com/);
});

test('runs the required seven-day sessions report and distinguishes an empty success', async () => {
    let request;
    const result = await runGa4SessionsReport({
        env: {
            GA4_PROPERTY_ID,
            GA4_CLIENT_EMAIL: GA4_SERVICE_ACCOUNT_EMAIL,
            GA4_PRIVATE_KEY: PRIVATE_KEY,
        },
        clientFactory: () => ({
            runReport: async (input) => {
                request = input;
                return [{ rows: [] }];
            },
            close: async () => {},
        }),
    });

    assert.deepEqual(request.dateRanges, [{ startDate: '7daysAgo', endDate: 'yesterday' }]);
    assert.deepEqual(request.dimensions, [{ name: 'date' }]);
    assert.deepEqual(request.metrics, [{ name: 'sessions' }]);
    assert.equal(request.property, 'properties/497735650');
    assert.equal(result.empty, true);
    assert.equal(result.totalSessions, 0);
});

test('classifies authentication and authorization failures', () => {
    assert.equal(classifyGa4Error({ code: 16 }), 'authentication');
    assert.equal(classifyGa4Error({ code: 7 }), 'authorization');
    assert.equal(classifyGa4Error({ category: 'configuration' }), 'configuration');
});
