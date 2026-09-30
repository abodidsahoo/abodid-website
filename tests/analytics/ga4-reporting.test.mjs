import assert from 'node:assert/strict';
import test from 'node:test';

import {
    GA4_PROPERTY_ID,
    GA4_SERVICE_ACCOUNT_EMAIL,
    classifyGa4Error,
    resolveGa4Configuration,
    runGa4DashboardReport,
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
    assert.equal(request.dimensionFilter.andGroup.expressions[0].filter.fieldName, 'hostName');
    assert.equal(request.property, 'properties/497735650');
    assert.equal(result.empty, true);
    assert.equal(result.totalSessions, 0);
});

test('classifies authentication and authorization failures', () => {
    assert.equal(classifyGa4Error({ code: 16 }), 'authentication');
    assert.equal(classifyGa4Error({ code: 7 }), 'authorization');
    assert.equal(classifyGa4Error({ category: 'configuration' }), 'configuration');
});

test('builds the dashboard from one batched GA4 request', async () => {
    let request;
    const metric = (...values) => ({ metricValues: values.map((value) => ({ value: String(value) })) });
    const dimensioned = (dimensions, metrics) => ({
        dimensionValues: dimensions.map((value) => ({ value })),
        metricValues: metrics.map((value) => ({ value: String(value) })),
    });
    const result = await runGa4DashboardReport({
        range: '30d',
        env: {
            GA4_PROPERTY_ID,
            GA4_CLIENT_EMAIL: GA4_SERVICE_ACCOUNT_EMAIL,
            GA4_PRIVATE_KEY: PRIVATE_KEY,
        },
        clientFactory: () => ({
            batchRunReports: async (input) => {
                request = input;
                return [{ reports: [
                    { rows: [metric(120, 90, 70, 60, 42, 3)] },
                    { rows: [dimensioned(['chatgpt.com', 'referral'], [12, 10, 8, 1])] },
                    { rows: [dimensioned(['India'], [50, 40, 2])] },
                    { rows: [dimensioned(['/obsidian-tutoring'], [30, 25, 75, 2])] },
                    { rows: [dimensioned(['/obsidian-vault'], [40, 600])] },
                ] }];
            },
            close: async () => {},
        }),
    });

    assert.equal(request.requests.length, 5);
    assert.deepEqual(request.requests[0].dateRanges, [{ startDate: '30daysAgo', endDate: 'today' }]);
    assert.equal(request.requests[0].dimensionFilter.andGroup.expressions[0].filter.fieldName, 'hostName');
    assert.equal(request.requests[3].dimensionFilter.andGroup.expressions[1].notExpression.filter.fieldName, 'landingPagePlusQueryString');
    assert.equal(result.summary.sessions, 120);
    assert.equal(result.channels[0].channel, 'LLMs');
    assert.equal(result.countries[0].country, 'India');
    assert.equal(result.landingPages[0].path, '/obsidian-tutoring');
});
