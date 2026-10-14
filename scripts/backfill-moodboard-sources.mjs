import { execFileSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const CHROME_EPOCH_OFFSET_SECONDS = 11_644_473_600;
const DEFAULT_HISTORY_ROOT = path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Google',
    'Chrome',
);
const MOODBOARD_EXTENSION_PATH_FRAGMENT = '/personal-site/moodboard-extension';
const TRACKING_PARAMETER_NAMES = new Set([
    'fbclid',
    'gclid',
    'igshid',
    'mc_cid',
    'mc_eid',
    'ref',
    'source',
    'tracking_source',
]);
const BLOCKED_SOURCE_HOSTS = new Set([
    '127.0.0.1',
    'accounts.google.com',
    'assets.abodid.com',
    'chatgpt.com',
    'claude.ai',
    'dash.cloudflare.com',
    'localhost',
    'mail.google.com',
    'jwipqbjxpmgyevfzpjjx.supabase.co',
    'welcome.developers.workers.dev',
]);
const GENERIC_PATH_SEGMENTS = new Set([
    'account',
    'accounts',
    'admin',
    'auth',
    'dashboard',
    'explore',
    'feed',
    'home',
    'login',
    'notifications',
    'search',
    'settings',
    'signin',
]);
const GENERIC_WORDS = new Set([
    'asset',
    'assets',
    'download',
    'file',
    'image',
    'images',
    'img',
    'large',
    'moodboard',
    'original',
    'photo',
    'photos',
    'project',
    'source',
    'untitled',
    'webp',
]);

const parseArguments = (argv) => {
    const options = {
        apply: false,
        historyRoot: process.env.CHROME_HISTORY_ROOT || DEFAULT_HISTORY_ROOT,
        minConfidence: 0.98,
        profiles: [],
        reportPath: '',
    };

    for (const argument of argv) {
        if (argument === '--apply') options.apply = true;
        else if (argument.startsWith('--history-root=')) options.historyRoot = argument.slice('--history-root='.length);
        else if (argument.startsWith('--min-confidence=')) options.minConfidence = Number(argument.slice('--min-confidence='.length));
        else if (argument.startsWith('--profile=')) options.profiles.push(argument.slice('--profile='.length));
        else if (argument.startsWith('--report=')) options.reportPath = argument.slice('--report='.length);
        else if (argument === '--help') options.help = true;
        else throw new Error(`Unknown argument: ${argument}`);
    }

    if (!Number.isFinite(options.minConfidence) || options.minConfidence < 0 || options.minConfidence > 1) {
        throw new Error('--min-confidence must be between 0 and 1.');
    }
    return options;
};

const printHelp = () => {
    console.log(`Usage: npm run backfill:moodboard-sources -- [options]

Reads Chrome history and matches unsourced moodboard rows without modifying Chrome.
The command is a dry run unless --apply is supplied.

Options:
  --apply                  Write high-confidence source_url matches to Supabase.
  --profile=Default        Scan a named Chrome profile. Repeat for more profiles.
  --history-root=PATH      Override the Chrome user-data directory.
  --min-confidence=0.98    Minimum confidence required for --apply.
  --report=PATH            Write the redacted JSON evidence report to PATH.
  --help                   Show this help.`);
};

const safeReadText = (filePath) => {
    try {
        return readFileSync(filePath, 'utf8');
    } catch {
        return '';
    }
};

export const discoverMoodboardProfiles = (historyRoot) => {
    if (!existsSync(historyRoot)) return [];
    const candidates = readdirSync(historyRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && (entry.name === 'Default' || /^Profile \d+$/.test(entry.name)))
        .map((entry) => entry.name);

    const installed = candidates.filter((profile) => {
        const directory = path.join(historyRoot, profile);
        const preferences = `${safeReadText(path.join(directory, 'Preferences'))}\n${safeReadText(path.join(directory, 'Secure Preferences'))}`;
        return preferences.includes(MOODBOARD_EXTENSION_PATH_FRAGMENT)
            || preferences.includes('Send to Moodboard');
    });

    if (installed.length > 0) return installed;
    return candidates.includes('Default') ? ['Default'] : candidates;
};

const snapshotHistory = (historyRoot, profile, snapshotRoot) => {
    const sourceDirectory = path.join(historyRoot, profile);
    const sourceHistory = path.join(sourceDirectory, 'History');
    if (!existsSync(sourceHistory)) return '';

    const destinationDirectory = path.join(snapshotRoot, profile.replaceAll(' ', '_'));
    mkdirSync(destinationDirectory, { recursive: true });
    for (const filename of ['History', 'History-wal', 'History-shm']) {
        const source = path.join(sourceDirectory, filename);
        if (existsSync(source)) copyFileSync(source, path.join(destinationDirectory, filename));
    }
    return path.join(destinationDirectory, 'History');
};

const queryHistory = (historyPath, profile) => {
    const profileLiteral = profile.replaceAll("'", "''");
    const sql = `
        select
            v.id as visit_id,
            v.from_visit as from_visit,
            cast(v.visit_time / 1000000 - ${CHROME_EPOCH_OFFSET_SECONDS} as integer) as visited_at,
            '${profileLiteral}' as profile,
            u.url as url,
            u.title as title
        from visits v
        join urls u on u.id = v.url
        where (u.url like 'https://%' or u.url like 'http://%')
          and length(u.url) <= 4096
        order by v.visit_time asc;
    `;
    const output = execFileSync('/usr/bin/sqlite3', ['-readonly', '-json', historyPath, sql], {
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
    });
    return output.trim() ? JSON.parse(output) : [];
};

const unwrapRedirect = (url) => {
    if (url.hostname === 'l.instagram.com') {
        const destination = url.searchParams.get('u');
        if (destination) {
            try {
                return new URL(destination);
            } catch {
                return url;
            }
        }
    }
    return url;
};

export const canonicalizeSourceUrl = (value) => {
    try {
        let url = unwrapRedirect(new URL(value));
        if (!['http:', 'https:'].includes(url.protocol)) return '';
        url.hash = '';
        url.hostname = url.hostname.toLowerCase();

        for (const key of [...url.searchParams.keys()]) {
            if (TRACKING_PARAMETER_NAMES.has(key) || key.startsWith('utm_')) {
                url.searchParams.delete(key);
            }
        }

        if (
            url.hostname.endsWith('behance.net')
            || url.hostname.endsWith('dribbble.com')
            || url.hostname.endsWith('instagram.com')
            || url.hostname.endsWith('pinterest.com')
        ) {
            url.search = '';
        }
        if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
        return url.href;
    } catch {
        return '';
    }
};

const isAssetUrl = (value) => {
    try {
        const url = new URL(value);
        return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(url.pathname)
            || /(?:^|\.)((?:cdn|images?|media|static)[-.])/i.test(url.hostname)
            || url.hostname.includes('mir-s3-cdn-cf.behance.net');
    } catch {
        return true;
    }
};

const isBlockedSource = (value) => {
    try {
        const url = new URL(value);
        const hostname = url.hostname.toLowerCase();
        if (BLOCKED_SOURCE_HOSTS.has(hostname)) return true;
        if (hostname === 'abodid.com' || hostname.endsWith('.abodid.com')) return true;
        if (hostname.endsWith('.supabase.co')) return true;
        if (hostname === 'google.com' || hostname.endsWith('.google.com')) {
            return url.pathname.startsWith('/search')
                || url.pathname.startsWith('/signin')
                || url.pathname.startsWith('/ServiceLogin');
        }
        return false;
    } catch {
        return true;
    }
};

export const isSpecificSourcePage = (value) => {
    if (!value || isBlockedSource(value) || isAssetUrl(value)) return false;
    try {
        const url = new URL(value);
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length === 0) return false;
        if (parts.some((part) => GENERIC_PATH_SEGMENTS.has(part.toLowerCase()))) return false;
        if (url.hostname.endsWith('behance.net')) return parts[0] === 'gallery' && /^\d+$/.test(parts[1] || '');
        if (url.hostname.endsWith('dribbble.com')) return parts[0] === 'shots' && /^\d+/.test(parts[1] || '');
        if (url.hostname.endsWith('instagram.com')) return ['p', 'reel', 'reels', 'stories'].includes(parts[0]) && parts.length >= 2;
        if (url.hostname.endsWith('pinterest.com')) return parts[0] === 'pin' && parts.length >= 2;
        return parts.some((part) => part.length >= 4 && !GENERIC_PATH_SEGMENTS.has(part.toLowerCase()));
    } catch {
        return false;
    }
};

const basenameFromUrl = (value) => {
    try {
        const url = new URL(value);
        return decodeURIComponent(url.pathname.split('/').pop() || '');
    } catch {
        return '';
    }
};

const normalizedFilename = (value) => String(value || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[^a-z0-9]+/g, '');

const filenameForItem = (item) => {
    const storagePath = String(item.storage_path || '');
    const fromStorage = storagePath.split('/').pop();
    if (fromStorage) return decodeURIComponent(fromStorage);
    return basenameFromUrl(item.image_url);
};

const numericTokens = (value) => String(value || '').match(/\d{7,}/g) || [];

const textTokens = (value) => [...new Set(
    String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 4)
        .filter((token) => !GENERIC_WORDS.has(token))
        .filter((token) => !/^\d+$/.test(token))
        .filter((token) => !/^[a-f0-9]{10,}$/.test(token)),
)];

const pageNumericTokens = (visit) => {
    try {
        return numericTokens(decodeURIComponent(new URL(visit.canonical_url).pathname));
    } catch {
        return [];
    }
};

const embeddedIdMatch = (itemTokens, visitTokens) => {
    let best = '';
    for (const itemToken of itemTokens) {
        for (const visitToken of visitTokens) {
            if (itemToken.includes(visitToken) || visitToken.includes(itemToken)) {
                const shorter = itemToken.length <= visitToken.length ? itemToken : visitToken;
                if (shorter.length > best.length) best = shorter;
            }
        }
    }
    return best;
};

const followReferrer = (visit, visitsById) => {
    let current = visit;
    const seen = new Set();
    for (let depth = 0; depth < 8 && current; depth += 1) {
        if (seen.has(current.visit_id)) break;
        seen.add(current.visit_id);
        if (isSpecificSourcePage(current.canonical_url)) return current;
        current = visitsById.get(Number(current.from_visit));
    }
    return null;
};

const appendIndexValue = (map, key, value) => {
    if (!key) return;
    const entries = map.get(key) || [];
    entries.push(value);
    map.set(key, entries);
};

export const buildHistoryIndex = (visits) => {
    const byFilename = new Map();
    const byPageNumber = new Map();
    const byWord = new Map();
    const specificVisits = [];
    const visitsById = new Map();

    for (const visit of visits) {
        visitsById.set(Number(visit.visit_id), visit);
        if (!isBlockedSource(visit.url)) {
            appendIndexValue(byFilename, normalizedFilename(basenameFromUrl(visit.url)), visit);
        }
        if (!isSpecificSourcePage(visit.canonical_url)) continue;
        specificVisits.push(visit);
        for (const token of pageNumericTokens(visit)) appendIndexValue(byPageNumber, token, visit);
        for (const token of textTokens(`${visit.title || ''} ${decodeURIComponent(visit.canonical_url)}`)) {
            appendIndexValue(byWord, token, visit);
        }
    }

    specificVisits.sort((left, right) => left.visited_at - right.visited_at);
    return { byFilename, byPageNumber, byWord, specificVisits, visitsById };
};

const lowerBoundVisitTime = (visits, timestamp) => {
    let low = 0;
    let high = visits.length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (visits[middle].visited_at < timestamp) low = middle + 1;
        else high = middle;
    }
    return low;
};

const visitsBetween = (visits, start, end) => {
    const matches = [];
    for (let index = lowerBoundVisitTime(visits, start); index < visits.length; index += 1) {
        const visit = visits[index];
        if (visit.visited_at > end) break;
        matches.push(visit);
    }
    return matches;
};

const nearestSpecificVisitBefore = (visits, timestamp, maxGapSeconds = 300) => {
    let index = lowerBoundVisitTime(visits, timestamp + 1) - 1;
    while (index >= 0) {
        const visit = visits[index];
        const gap = timestamp - visit.visited_at;
        if (gap > maxGapSeconds) break;
        if (gap >= 0 && isSpecificSourcePage(visit.canonical_url)) return visit;
        index -= 1;
    }
    return null;
};

const candidatePageIdTokens = (itemNumbers) => {
    const tokens = new Set();
    for (const number of itemNumbers) {
        for (let length = 8; length <= Math.min(12, number.length); length += 1) {
            for (let offset = 0; offset + length <= number.length; offset += 1) {
                tokens.add(number.slice(offset, offset + length));
            }
        }
    }
    return tokens;
};

const deduplicateCandidates = (candidates) => {
    const byUrl = new Map();
    for (const candidate of candidates) {
        const existing = byUrl.get(candidate.source_url);
        if (!existing || candidate.score > existing.score) byUrl.set(candidate.source_url, candidate);
    }
    return [...byUrl.values()].sort((left, right) => right.score - left.score);
};

export const matchMoodboardItem = (item, visits, suppliedIndex = null) => {
    const createdAt = Date.parse(item.created_at) / 1000;
    if (!Number.isFinite(createdAt)) return null;

    const filename = filenameForItem(item);
    const filenameKey = normalizedFilename(filename);
    const itemNumbers = numericTokens(filename);
    const itemWords = textTokens(`${filename} ${item.title || ''}`);
    const historyIndex = suppliedIndex || buildHistoryIndex(visits);
    const candidateVisits = new Set();
    for (const token of candidatePageIdTokens(itemNumbers)) {
        for (const visit of historyIndex.byPageNumber.get(token) || []) candidateVisits.add(visit);
    }
    for (const visit of historyIndex.byFilename.get(filenameKey) || []) candidateVisits.add(visit);
    for (const word of itemWords) {
        for (const visit of historyIndex.byWord.get(word) || []) candidateVisits.add(visit);
    }
    for (const visit of visitsBetween(historyIndex.specificVisits, createdAt - 20, createdAt + 10)) {
        candidateVisits.add(visit);
    }
    const candidates = [];

    for (const visit of candidateVisits) {
        const pageNumbers = pageNumericTokens(visit);
        const matchedId = embeddedIdMatch(itemNumbers, pageNumbers);
        const gapSeconds = Math.round(createdAt - visit.visited_at);
        if (matchedId.length >= 8 && isSpecificSourcePage(visit.canonical_url)) {
            candidates.push({
                confidence: 0.995,
                evidence: [`embedded page id ${matchedId}`],
                matched_visit_at: new Date(visit.visited_at * 1000).toISOString(),
                profile: visit.profile,
                score: 130 + Math.min(20, matchedId.length) + (Math.abs(gapSeconds) <= 600 ? 10 : 0),
                source_url: visit.canonical_url,
                time_gap_seconds: gapSeconds,
            });
        }

        const visitFilenameKey = normalizedFilename(basenameFromUrl(visit.url));
        if (
            filenameKey.length >= 10
            && filenameKey === visitFilenameKey
            && Math.abs(gapSeconds) <= 3_600
        ) {
            const recordedReferrer = followReferrer(visit, historyIndex.visitsById);
            const referrer = recordedReferrer
                || nearestSpecificVisitBefore(historyIndex.specificVisits, visit.visited_at, 300);
            if (referrer) {
                candidates.push({
                    confidence: recordedReferrer ? 0.99 : 0.985,
                    evidence: [recordedReferrer
                        ? 'exact image filename and Chrome referrer chain'
                        : 'exact image filename and immediately preceding Chrome page'],
                    matched_visit_at: new Date(referrer.visited_at * 1000).toISOString(),
                    profile: referrer.profile,
                    score: 125,
                    source_url: referrer.canonical_url,
                    time_gap_seconds: Math.round(createdAt - referrer.visited_at),
                });
            }
        }

        if (!isSpecificSourcePage(visit.canonical_url) || itemWords.length === 0) continue;
        const visitWords = new Set(textTokens(`${visit.title || ''} ${decodeURIComponent(visit.canonical_url)}`));
        const overlap = itemWords.filter((token) => visitWords.has(token));
        const coverage = overlap.length / itemWords.length;
        if (overlap.length >= 2 || (overlap.length === 1 && overlap[0].length >= 12 && coverage >= 0.5)) {
            const closeInTime = gapSeconds >= -20 && gapSeconds <= 3_600;
            candidates.push({
                confidence: closeInTime ? 0.985 : 0.94,
                evidence: [`title/path words: ${overlap.join(', ')}`],
                matched_visit_at: new Date(visit.visited_at * 1000).toISOString(),
                profile: visit.profile,
                score: 80 + overlap.length * 8 + (closeInTime ? 18 : 0),
                source_url: visit.canonical_url,
                time_gap_seconds: gapSeconds,
            });
        }
    }

    const nearby = visitsBetween(historyIndex.specificVisits, createdAt - 20, createdAt + 10);
    const nearbyUrls = new Set(nearby.map((visit) => visit.canonical_url));
    if (nearbyUrls.size === 1 && nearby.length > 0) {
        const visit = nearby.at(-1);
        candidates.push({
            confidence: 0.97,
            evidence: ['only specific Chrome page within the 30-second upload window'],
            matched_visit_at: new Date(visit.visited_at * 1000).toISOString(),
            profile: visit.profile,
            score: 75,
            source_url: visit.canonical_url,
            time_gap_seconds: Math.round(createdAt - visit.visited_at),
        });
    }

    const ranked = deduplicateCandidates(candidates);
    if (!ranked.length) return null;
    const best = ranked[0];
    const runnerUp = ranked.find((candidate) => candidate.source_url !== best.source_url);
    if (runnerUp && best.score - runnerUp.score < 8 && best.confidence < 0.99) return null;
    return { ...best, filename };
};

export const promoteTemporalMatches = (matches) => {
    const temporalEvidence = 'only specific Chrome page within the 30-second upload window';
    const sourceCounts = new Map();
    for (const match of matches) {
        if (match.evidence[0] !== temporalEvidence) continue;
        sourceCounts.set(match.source_url, (sourceCounts.get(match.source_url) || 0) + 1);
    }

    return matches.map((match) => {
        if (match.evidence[0] !== temporalEvidence) return match;
        let hostname = '';
        try {
            hostname = new URL(match.source_url).hostname;
        } catch {
            return match;
        }
        const isVisualPost = hostname === 'www.instagram.com'
            || hostname.endsWith('.instagram.com')
            || hostname === 'www.behance.net'
            || hostname.endsWith('.behance.net');
        if (isVisualPost) {
            return {
                ...match,
                confidence: 0.985,
                evidence: ['specific visual-platform post within the 30-second upload window'],
                score: match.score + 18,
            };
        }
        if ((sourceCounts.get(match.source_url) || 0) >= 2) {
            return {
                ...match,
                confidence: 0.98,
                evidence: ['multi-image Chrome timestamp cluster on the same source page'],
                score: match.score + 12,
            };
        }
        return match;
    });
};

const loadMoodboardItems = async (supabase) => {
    const rows = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
            .from('moodboard_items')
            .select('id,image_url,storage_path,title,source_url,created_at')
            .order('created_at', { ascending: true })
            .range(from, from + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if ((data || []).length < 1000) break;
    }
    return rows;
};

const updateSources = async (supabase, matches) => {
    let updated = 0;
    let skipped = 0;
    for (let index = 0; index < matches.length; index += 10) {
        const batch = matches.slice(index, index + 10);
        const results = await Promise.all(batch.map(async (match) => {
            const { data, error } = await supabase
                .from('moodboard_items')
                .update({ source_url: match.source_url })
                .eq('id', match.id)
                .is('source_url', null)
                .select('id')
                .maybeSingle();
            if (error) throw error;
            return Boolean(data?.id);
        }));
        updated += results.filter(Boolean).length;
        skipped += results.filter((value) => !value).length;
    }
    return { skipped, updated };
};

const reportSummary = (report) => ({
    applied: report.applied,
    eligible_matches: report.eligible_matches,
    history_profiles: report.history_profiles,
    history_visits_considered: report.history_visits_considered,
    matched_by_evidence: report.matches.reduce((counts, match) => {
        const raw = match.evidence[0];
        const key = raw.startsWith('embedded page id')
            ? 'embedded page id'
            : raw.startsWith('title/path words')
                ? 'title/path words plus timestamp'
                : raw;
        counts[key] = (counts[key] || 0) + 1;
        return counts;
    }, {}),
    source_rows_after: report.source_rows_after,
    source_rows_before: report.source_rows_before,
    total_rows: report.total_rows,
    unmatched_rows: report.unmatched_rows,
    updated_rows: report.updated_rows,
});

const main = async () => {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    }
    if (!existsSync(options.historyRoot) || !statSync(options.historyRoot).isDirectory()) {
        throw new Error(`Chrome history directory not found: ${options.historyRoot}`);
    }

    const profiles = options.profiles.length > 0
        ? options.profiles
        : discoverMoodboardProfiles(options.historyRoot);
    if (!profiles.length) throw new Error('No Chrome profile with readable history was found.');

    const snapshotRoot = mkdtempSync(path.join(os.tmpdir(), 'moodboard-history-'));
    const visits = [];
    for (const profile of profiles) {
        const historyPath = snapshotHistory(options.historyRoot, profile, snapshotRoot);
        if (!historyPath) continue;
        for (const visit of queryHistory(historyPath, profile)) visits.push(visit);
    }
    for (const visit of visits) visit.canonical_url = canonicalizeSourceUrl(visit.url);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const items = await loadMoodboardItems(supabase);
    const unsourced = items.filter((item) => !String(item.source_url || '').trim());
    const historyIndex = buildHistoryIndex(visits);
    const provisionalMatches = unsourced
        .map((item) => {
            const match = matchMoodboardItem(item, visits, historyIndex);
            return match ? { id: item.id, created_at: item.created_at, ...match } : null;
        })
        .filter(Boolean);
    const matches = promoteTemporalMatches(provisionalMatches)
        .filter((match) => match.confidence >= options.minConfidence);

    let updateResult = { skipped: 0, updated: 0 };
    if (options.apply && matches.length > 0) {
        updateResult = await updateSources(supabase, matches);
    }

    const report = {
        generated_at: new Date().toISOString(),
        applied: options.apply,
        history_profiles: profiles,
        history_visits_considered: visits.length,
        min_confidence: options.minConfidence,
        total_rows: items.length,
        source_rows_before: items.length - unsourced.length,
        eligible_matches: matches.length,
        updated_rows: updateResult.updated,
        skipped_rows: updateResult.skipped,
        source_rows_after: items.length - unsourced.length + updateResult.updated,
        unmatched_rows: unsourced.length - matches.length,
        matches,
    };

    if (options.reportPath) {
        writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
    console.log(JSON.stringify(reportSummary(report), null, 2));
    if (!options.apply) console.log('Dry run only. Add --apply after reviewing the JSON report.');
};

const isDirectRun = process.argv[1]
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}

