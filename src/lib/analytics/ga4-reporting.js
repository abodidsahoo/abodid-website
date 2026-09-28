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
