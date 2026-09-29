import { readFileSync } from 'node:fs';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

export const GA4_PROPERTY_ID = '497735650';
export const GA4_SERVICE_ACCOUNT_EMAIL = 'analytics@abodid-website.iam.gserviceaccount.com';

const getRuntimeEnv = () => ({
    ...process.env,
    ...(import.meta.env || {}),
});

const normalizePrivateKey = (value) => String(value || '').replace(/\\n/g, '\n').trim();

const configurationError = (message) => {
    const error = new Error(message);
    error.category = 'configuration';
    return error;
};

const parseServiceAccountJson = (rawValue, sourceLabel) => {
    let parsed;
    try {
        parsed = JSON.parse(rawValue);
    } catch (_error) {
        throw configurationError(`${sourceLabel} is not valid JSON.`);
    }

    if (parsed?.type !== 'service_account' || !parsed?.client_email || !parsed?.private_key) {
        throw configurationError(`${sourceLabel} is not a complete service-account credential.`);
    }

    return {
        client_email: String(parsed.client_email).trim(),
        private_key: normalizePrivateKey(parsed.private_key),
    };
};

const readServiceAccountFile = (filePath) => {
    try {
        return parseServiceAccountJson(readFileSync(filePath, 'utf8'), 'GOOGLE_APPLICATION_CREDENTIALS');
    } catch (error) {
        if (error?.category === 'configuration') throw error;
        throw configurationError('GOOGLE_APPLICATION_CREDENTIALS could not be read.');
    }
};

export const resolveGa4Configuration = (env = getRuntimeEnv()) => {
    const propertyId = String(
        env.GA4_PROPERTY_ID || env.GOOGLE_ANALYTICS_PROPERTY_ID || '',
    ).trim();

    if (!/^\d+$/.test(propertyId)) {
        throw configurationError('GA4_PROPERTY_ID must contain the numeric GA4 Property ID.');
    }
    if (propertyId !== GA4_PROPERTY_ID) {
        throw configurationError(`GA4_PROPERTY_ID must be ${GA4_PROPERTY_ID} for abodid.com.`);
    }

    const credentialJson = env.GA4_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let credentials;

    if (credentialJson) {
        credentials = parseServiceAccountJson(credentialJson, 'GA4_SERVICE_ACCOUNT_JSON');
    } else if (env.GA4_CLIENT_EMAIL || env.GOOGLE_CLIENT_EMAIL || env.GA4_PRIVATE_KEY || env.GOOGLE_PRIVATE_KEY) {
        const clientEmail = String(env.GA4_CLIENT_EMAIL || env.GOOGLE_CLIENT_EMAIL || '').trim();
        const privateKey = normalizePrivateKey(env.GA4_PRIVATE_KEY || env.GOOGLE_PRIVATE_KEY);
        if (!clientEmail || !privateKey) {
            throw configurationError('Both GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY are required.');
        }
        credentials = { client_email: clientEmail, private_key: privateKey };
    } else if (env.GOOGLE_APPLICATION_CREDENTIALS) {
        credentials = readServiceAccountFile(env.GOOGLE_APPLICATION_CREDENTIALS);
    } else {
        throw configurationError('GA4 service-account credentials are not configured.');
    }

    if (credentials.client_email !== GA4_SERVICE_ACCOUNT_EMAIL) {
        throw configurationError(`GA4 credentials must use ${GA4_SERVICE_ACCOUNT_EMAIL}.`);
    }
    if (!credentials.private_key.includes('-----BEGIN PRIVATE KEY-----') ||
        !credentials.private_key.includes('-----END PRIVATE KEY-----')) {
        throw configurationError('The GA4 service-account private key is not a valid PEM value.');
    }

    return { propertyId, credentials };
};

export const classifyGa4Error = (error) => {
    if (error?.category === 'configuration') return 'configuration';

    const code = Number(error?.code);
    if (code === 16 || code === 401) return 'authentication';
    if (code === 7 || code === 403) return 'authorization';
    if (code === 3 || code === 5 || code === 400 || code === 404) return 'request';
    return 'api';
};

const formatGaDate = (value) => {
    const raw = String(value || '');
    return /^\d{8}$/.test(raw)
        ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        : raw;
};

const numberValue = (row, index) => Number(row?.metricValues?.[index]?.value || 0);
const dimensionValue = (row, index) => String(row?.dimensionValues?.[index]?.value || '');

const classifyGa4Channel = (source, medium) => {
    const value = `${source} ${medium}`.toLowerCase();
    if (/chatgpt|openai|perplexity|claude|anthropic|gemini|bard|copilot|poe/.test(value)) return 'LLMs';
    if (/google/.test(value)) return 'Google';
    if (/linkedin|lnkd/.test(value)) return 'LinkedIn';
    if (/bing|duckduckgo|yahoo|ecosia|baidu/.test(value)) return 'Other search';
    if (/instagram|facebook|meta|twitter|t\.co|threads|reddit|youtube|pinterest/.test(value)) return 'Social';
    if (source === '(direct)' || medium === '(none)' || /direct/.test(value)) return 'Direct';
    return 'Other referrals';
};

const startDateForRange = (range) => ({
    today: 'today',
    '7d': '7daysAgo',
    '30d': '30daysAgo',
    '90d': '90daysAgo',
}[range] || '7daysAgo');

export const runGa4DashboardReport = async ({
    range = '7d',
    env = getRuntimeEnv(),
    clientFactory = (credentials) => new BetaAnalyticsDataClient({ credentials }),
} = {}) => {
    const { propertyId, credentials } = resolveGa4Configuration(env);
    const client = clientFactory(credentials);
    const dateRanges = [{ startDate: startDateForRange(range), endDate: 'today' }];

    try {
        const [response] = await client.batchRunReports({
            property: `properties/${propertyId}`,
            requests: [
                {
                    dateRanges,
                    metrics: [
                        { name: 'sessions' },
                        { name: 'totalUsers' },
                        { name: 'newUsers' },
                        { name: 'engagedSessions' },
                        { name: 'averageSessionDuration' },
                        { name: 'keyEvents' },
                    ],
                },
                {
                    dateRanges,
                    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
                    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'engagedSessions' }, { name: 'keyEvents' }],
                    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                    limit: 30,
                },
                {
                    dateRanges,
                    dimensions: [{ name: 'country' }],
                    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'keyEvents' }],
                    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                    limit: 30,
                },
                {
                    dateRanges,
                    dimensions: [{ name: 'landingPagePlusQueryString' }],
                    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'averageSessionDuration' }, { name: 'keyEvents' }],
                    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                    limit: 40,
                },
                {
                    dateRanges,
                    dimensions: [{ name: 'pagePath' }],
                    metrics: [{ name: 'screenPageViews' }, { name: 'userEngagementDuration' }],
                    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
                    limit: 40,
                },
            ],
        });

        const reports = response.reports || [];
        const summaryRow = reports[0]?.rows?.[0];
        const sources = (reports[1]?.rows || []).map((row) => {
            const source = dimensionValue(row, 0);
            const medium = dimensionValue(row, 1);
            return {
                source,
                medium,
                channel: classifyGa4Channel(source, medium),
                sessions: numberValue(row, 0),
                users: numberValue(row, 1),
                engagedSessions: numberValue(row, 2),
                keyEvents: numberValue(row, 3),
            };
        });

        const channelMap = new Map();
        for (const source of sources) {
            const current = channelMap.get(source.channel) || { channel: source.channel, sessions: 0, users: 0, engagedSessions: 0, keyEvents: 0 };
            current.sessions += source.sessions;
            current.users += source.users;
            current.engagedSessions += source.engagedSessions;
            current.keyEvents += source.keyEvents;
            channelMap.set(source.channel, current);
        }

        return {
            available: true,
            propertyId,
            range,
            summary: {
                sessions: numberValue(summaryRow, 0),
                users: numberValue(summaryRow, 1),
                newUsers: numberValue(summaryRow, 2),
                engagedSessions: numberValue(summaryRow, 3),
                averageSessionDuration: Math.round(numberValue(summaryRow, 4)),
                keyEvents: numberValue(summaryRow, 5),
            },
            channels: [...channelMap.values()].sort((a, b) => b.sessions - a.sessions),
            sources,
            countries: (reports[2]?.rows || []).map((row) => ({
                country: dimensionValue(row, 0) || 'Unknown',
                sessions: numberValue(row, 0),
                users: numberValue(row, 1),
                keyEvents: numberValue(row, 2),
            })),
            landingPages: (reports[3]?.rows || []).map((row) => ({
                path: dimensionValue(row, 0) || '/',
                sessions: numberValue(row, 0),
                users: numberValue(row, 1),
                averageSessionDuration: Math.round(numberValue(row, 2)),
                keyEvents: numberValue(row, 3),
            })),
            pages: (reports[4]?.rows || []).map((row) => ({
                path: dimensionValue(row, 0) || '/',
                views: numberValue(row, 0),
                engagementSeconds: Math.round(numberValue(row, 1)),
            })),
        };
    } catch (error) {
        error.category = classifyGa4Error(error);
        throw error;
    } finally {
        await client.close?.();
    }
};

export const runGa4SessionsReport = async ({
    env = getRuntimeEnv(),
    clientFactory = (credentials) => new BetaAnalyticsDataClient({ credentials }),
} = {}) => {
    const { propertyId, credentials } = resolveGa4Configuration(env);
    const client = clientFactory(credentials);

    try {
        const [response] = await client.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
            dimensions: [{ name: 'date' }],
            metrics: [{ name: 'sessions' }],
            orderBys: [{ dimension: { dimensionName: 'date' } }],
        });

        const rows = (response.rows || []).map((row) => ({
            date: formatGaDate(row.dimensionValues?.[0]?.value),
            sessions: Number(row.metricValues?.[0]?.value || 0),
        }));

        return {
            propertyId,
            serviceAccountEmail: credentials.client_email,
            requestedDateRange: { startDate: '7daysAgo', endDate: 'yesterday' },
            rows,
            totalSessions: rows.reduce((total, row) => total + row.sessions, 0),
            rowCount: rows.length,
            empty: rows.length === 0,
        };
    } catch (error) {
        error.category = classifyGa4Error(error);
        throw error;
    } finally {
        await client.close?.();
    }
};
