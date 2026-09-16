import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildLiveIntelligenceReport,
    calculateRevenueFunnels,
    detectSessionFriction,
    generateSyntheticIntelligenceReport,
    inferSessionIntent,
} from '../../src/lib/analytics/intelligence.js';

test('infers commercial intent from visited paths', () => {
    const photoPages = [
        { path: '/photography', engagedSeconds: 30 },
        { path: '/photo-stories/silent-monoliths', engagedSeconds: 60 },
        { path: '/contact?service=photography', engagedSeconds: 40 },
    ];
    const photoIntent = inferSessionIntent(photoPages);
    assert.equal(photoIntent.category, 'photography');
    assert.equal(photoIntent.strength, 'High');

    const obsidianPages = [
        { path: '/obsidian-tutoring', engagedSeconds: 45 },
        { path: '/payments', engagedSeconds: 60 },
    ];
    const obsidianIntent = inferSessionIntent(obsidianPages);
    assert.equal(obsidianIntent.category, 'obsidian');

    const techPages = [
        { path: '/lab', engagedSeconds: 20 },
        { path: '/xr-showcase', engagedSeconds: 50 },
        { path: '/contact?service=creative-tech', engagedSeconds: 30 },
    ];
    const techIntent = inferSessionIntent(techPages);
    assert.equal(techIntent.category, 'creative_tech');

    const filmPages = [
        { path: '/films', engagedSeconds: 40 },
        { path: '/brands', engagedSeconds: 30 },
    ];
    const filmIntent = inferSessionIntent(filmPages);
    assert.equal(filmIntent.category, 'film_brand');
});

test('detects friction signals in sessions', () => {
    const quickExitSession = {
        totalEngagedSeconds: 3,
        pages: [{ path: '/photography' }],
        events: [],
    };
    const friction = detectSessionFriction(quickExitSession);
    assert.ok(friction.includes('quick_exit'));

    const pricingAbandonSession = {
        totalEngagedSeconds: 60,
        pages: [{ path: '/obsidian-tutoring' }, { path: '/payments' }],
        events: [],
        converted: false,
    };
    const pricingFriction = detectSessionFriction(pricingAbandonSession);
    assert.ok(pricingFriction.includes('pricing_abandoned'));

    const formAbandonSession = {
        totalEngagedSeconds: 90,
        pages: [{ path: '/contact' }],
        events: [{ type: 'form_start' }],
        converted: false,
    };
    const formFriction = detectSessionFriction(formAbandonSession);
    assert.ok(formFriction.includes('form_abandoned'));
});

test('calculates funnels and finds largest leakage point', () => {
    const sampleSessions = [
        { id: '1', pages: [{ path: '/photography' }, { path: '/photo-stories/1' }, { path: '/testimonials' }, { path: '/contact?service=photography' }], converted: true, intent_category: 'photography' },
        { id: '2', pages: [{ path: '/photography' }, { path: '/photo-stories/1' }], converted: false, intent_category: 'photography' },
        { id: '3', pages: [{ path: '/photography' }], converted: false, intent_category: 'photography' },
    ];
    const funnels = calculateRevenueFunnels(sampleSessions);
    assert.ok(funnels.photography);
    assert.equal(funnels.photography.totalDiscovery, 3);
    assert.equal(funnels.photography.totalConverted, 1);
    assert.ok(funnels.photography.largestLeakage);
});

test('builds accurate live intelligence report from recorded sessions and handles empty state cleanly', () => {
    const emptyReport = buildLiveIntelligenceReport([]);
    assert.equal(emptyReport.overview.meaningfulVisitors, 0);
    assert.equal(emptyReport.overview.enquiriesAndBookings, 0);
    assert.equal(emptyReport.overview.conversionRate, '0.0%');
    assert.equal(emptyReport.visitors.feed.length, 0);
    assert.equal(emptyReport.replays.totalTargeted, 0);

    const liveSessions = [
        {
            id: 'sess-1',
            visitor_id: 'vis-real-01',
            city: 'Berlin',
            country: 'DE',
            source: 'LinkedIn',
            total_engaged_seconds: 45,
            intentCategory: 'photography',
            intentScore: 85,
            intentStrength: 'High',
            converted: true,
            conversion_type: 'photography',
            pages: [
                { path: '/photography', title: 'Photography', engagedSeconds: 20 },
                { path: '/contact?service=photography', title: 'Contact', engagedSeconds: 25 },
            ],
            events: [{ type: 'form_submit', label: 'Submitted form', timeOffset: 40 }],
        },
    ];
    const liveReport = buildLiveIntelligenceReport(liveSessions);
    assert.equal(liveReport.overview.meaningfulVisitors, 1);
    assert.equal(liveReport.overview.enquiriesAndBookings, 1);
    assert.equal(liveReport.overview.conversionRate, '100.0%');
    assert.equal(liveReport.visitors.feed.length, 1);
    assert.equal(liveReport.visitors.feed[0].city, 'Berlin');
    assert.equal(liveReport.replays.totalTargeted, 1);
});

test('calculates device breakdown and visitor entry, most-engaged, and exit pathways accurately', () => {
    const sessions = [
        {
            id: 'sess-mobile-1',
            visitor_id: 'vis-1',
            device_type: 'mobile',
            device_label: 'iPhone',
            landing_page: '/photography',
            exit_page: '/contact?service=photography',
            total_engaged_seconds: 95,
            pages: [
                { path: '/photography', title: 'Photography', engagedSeconds: 15 },
                { path: '/photo-stories/silent-monoliths', title: 'Silent Monoliths', engagedSeconds: 65 },
                { path: '/contact?service=photography', title: 'Contact', engagedSeconds: 15 },
            ],
        },
        {
            id: 'sess-desktop-1',
            visitor_id: 'vis-2',
            device_type: 'desktop',
            device_label: 'MacBook / macOS',
            landing_page: '/obsidian-tutoring',
            exit_page: '/payments',
            total_engaged_seconds: 140,
            pages: [
                { path: '/obsidian-tutoring', title: 'Obsidian Tutoring', engagedSeconds: 100 },
                { path: '/payments', title: 'Payments', engagedSeconds: 40 },
            ],
        },
    ];

    const report = buildLiveIntelligenceReport(sessions);
    assert.equal(report.overview.devices.total, 2);
    assert.equal(report.overview.devices.mobile.count, 1);
    assert.equal(report.overview.devices.mobile.percentage, 50);
    assert.equal(report.overview.devices.desktop.count, 1);
    assert.equal(report.overview.devices.desktop.percentage, 50);

    const firstVisitor = report.visitors.feed[0];
    assert.equal(firstVisitor.device.type, 'mobile');
    assert.equal(firstVisitor.device.label, 'iPhone');
    assert.equal(firstVisitor.entryPage.path, '/photography');
    assert.equal(firstVisitor.mostEngagedPage.path, '/photo-stories/silent-monoliths');
    assert.equal(firstVisitor.mostEngagedPage.engagedSeconds, 65);
    assert.equal(firstVisitor.exitPage.path, '/contact?service=photography');
});

test('calculates discovery sources, search keywords, and landing transition flows accurately', () => {
    const sessions = [
        {
            id: 'sess-google-1',
            visitor_id: 'vis-101',
            source: 'Google Search',
            utm_term: 'video editing mentor',
            landing_page: '/video-editing-mentor',
            exit_page: '/contact',
            total_engaged_seconds: 120,
            converted: true,
            pages: [
                { path: '/video-editing-mentor', title: 'Video Editing Mentor', engagedSeconds: 70 },
                { path: '/workshops', title: 'Workshops', engagedSeconds: 30 },
                { path: '/contact', title: 'Contact', engagedSeconds: 20 },
            ],
        },
        {
            id: 'sess-linkedin-1',
            visitor_id: 'vis-102',
            source: 'LinkedIn',
            utm_campaign: 'spring-obsidian-cohort',
            landing_page: '/obsidian-tutoring',
            exit_page: '/payments',
            total_engaged_seconds: 180,
            converted: true,
            pages: [
                { path: '/obsidian-tutoring', title: 'Obsidian Tutoring', engagedSeconds: 120 },
                { path: '/payments', title: 'Payments', engagedSeconds: 60 },
            ],
        },
        {
            id: 'sess-insta-1',
            visitor_id: 'vis-103',
            source: 'Instagram',
            landing_page: '/photography',
            exit_page: '/photography',
            total_engaged_seconds: 35,
            converted: false,
            pages: [
                { path: '/photography', title: 'Photography', engagedSeconds: 35 },
            ],
        },
    ];

    const report = buildLiveIntelligenceReport(sessions);

    // 1. Discovery Sources
    assert.equal(report.overview.discoverySources.length, 3);
    const googleSrc = report.overview.discoverySources.find((s) => s.name === 'Google Search');
    assert.ok(googleSrc);
    assert.equal(googleSrc.count, 1);
    assert.equal(googleSrc.conversionRate, '100.0%');

    // 2. Discovered Keywords
    assert.ok(report.overview.discoveredKeywords.some((k) => k.term === 'video editing mentor'));
    assert.ok(report.overview.discoveredKeywords.some((k) => k.term === 'spring-obsidian-cohort'));

    // 3. Landing Page Transitions
    const mentorLanding = report.overview.landingTransitions.find((l) => l.path === '/video-editing-mentor');
    assert.ok(mentorLanding);
    assert.equal(mentorLanding.topDestinations[0].destination, '/workshops');

    const instaVisitor = report.visitors.feed.find((v) => v.visitorId === 'vis-103');
    assert.equal(instaVisitor.nextDestination, 'Direct Exit');
    assert.equal(instaVisitor.source, 'Instagram');

    const googleVisitor = report.visitors.feed.find((v) => v.visitorId === 'vis-101');
    assert.equal(googleVisitor.searchKeyword, 'video editing mentor');
    assert.equal(googleVisitor.nextDestination, '/workshops');
});

test('calculates media lab and interactive experiments intelligence accurately', () => {
    const labSessions = [
        {
            id: 'sess-punctum-1',
            visitor_id: 'vis-lab-1',
            source: 'Direct',
            total_engaged_seconds: 90,
            converted: true,
            pages: [
                { path: '/lab', title: 'Media Lab Hub', engagedSeconds: 15 },
                { path: '/lab/punctum', title: 'Punctum', engagedSeconds: 45 },
                { path: '/contact', title: 'Contact', engagedSeconds: 30 },
            ],
        },
        {
            id: 'sess-flick-1',
            visitor_id: 'vis-lab-2',
            source: 'GitHub',
            total_engaged_seconds: 60,
            converted: false,
            pages: [
                { path: '/lab/image-flick', title: 'Image Flick', engagedSeconds: 40 },
                { path: '/lab/sequence-room', title: 'Sequence Room', engagedSeconds: 20 },
            ],
        },
        {
            id: 'sess-nonlab-1',
            visitor_id: 'vis-other-1',
            source: 'Google',
            total_engaged_seconds: 40,
            converted: false,
            pages: [
                { path: '/photography', title: 'Photography', engagedSeconds: 40 },
            ],
        },
    ];

    const report = buildLiveIntelligenceReport(labSessions);

    // Overview Lab Analytics
    assert.ok(report.overview.labExperiments);
    assert.equal(report.overview.labExperiments.totalVisitors, 2);
    assert.equal(report.overview.labExperiments.enquiries, 1);
    assert.equal(report.overview.labExperiments.conversionRate, '50.0%');

    // Experiments breakdown
    const experiments = report.overview.labExperiments.experiments;
    assert.ok(experiments.length >= 5);

    const punctumExp = experiments.find((e) => e.id === 'punctum');
    assert.ok(punctumExp);
    assert.equal(punctumExp.visitors, 1);
    assert.equal(punctumExp.enquiries, 1);

    const flickExp = experiments.find((e) => e.id === 'image_flick');
    assert.ok(flickExp);
    assert.equal(flickExp.visitors, 1);
    assert.equal(flickExp.enquiries, 0);

    // Visitor feed tagging
    const labVisitor1 = report.visitors.feed.find((v) => v.visitorId === 'vis-lab-1');
    assert.equal(labVisitor1.isLabVisitor, true);
    assert.ok(labVisitor1.labExperimentNames.includes('Punctum'));
    assert.ok(labVisitor1.labExperimentNames.includes('Media Lab Hub'));

    const nonLabVisitor = report.visitors.feed.find((v) => v.visitorId === 'vis-other-1');
    assert.equal(nonLabVisitor.isLabVisitor, false);
});



