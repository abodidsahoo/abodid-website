/**
 * Revenue & Visitor Intelligence Analytics Module
 * Defines the 4 commercial revenue paths, 5-stage conversion funnels,
 * leakage detection, drop-off friction classification, and visitor lead scoring.
 */

export const REVENUE_PATHS = {
    photography: {
        id: 'photography',
        label: 'Photography',
        subtitle: 'Editorial, Portraiture, Photo Stories & Architecture',
        targetRole: 'Brands, Agencies & Private Commissions',
        color: '#d61f45',
        discoveryPatterns: [
            /^\/photography(?:\/|$)/,
            /^\/photo-gallery(?:\/|$)/,
            /^\/photo-album(?:\/|$)/,
            /^\/photo-stories(?:\/|$)/,
            /^\/one-photo(?:\/|$)/,
            /^\/boudoir-moodboard(?:\/|$)/,
            /^\/moodboard(?:\/|$)/,
            /^\/uk-2026(?:\/|$)/,
            /^\/odisha1900(?:\/|$)/,
        ],
        interestPatterns: [
            /^\/photo-stories\/.+/,
            /^\/photo-album(?:\/|$)/,
            /^\/photography-portfolio(?:\/|$)/,
            /^\/sequence-room(?:\/|$)/,
        ],
        trustPatterns: [
            /^\/testimonials(?:\/|$)/,
            /^\/about(?:\/|$)/,
            /^\/press(?:\/|$)/,
            /^\/awards(?:\/|$)/,
        ],
        intentPatterns: [
            /^\/contact\?.*service=(?:photo|photography)/,
            /^\/services#photography/,
            /^\/contact(?:\/|$)/,
        ],
        conversionKeywords: ['photo', 'portrait', 'shoot', 'editorial', 'commission', 'campaign', 'visual'],
    },
    obsidian: {
        id: 'obsidian',
        label: 'Obsidian Tutoring',
        subtitle: '1-on-1 PKM, Vault Architecture & Creative Systems',
        targetRole: 'Writers, Researchers, Founders & Knowledge Workers',
        color: '#5b8def',
        discoveryPatterns: [
            /^\/obsidian-tutoring(?:\/|$)/,
            /^\/obsidian-for-writers(?:\/|$)/,
            /^\/obsidian-for-researchers(?:\/|$)/,
            /^\/obsidian-for-filmmakers(?:\/|$)/,
            /^\/obsidian-for-founders(?:\/|$)/,
            /^\/obsidian-vault(?:\/|$)/,
        ],
        interestPatterns: [
            /^\/obsidian-vault\/.+/,
            /^\/obsidian-for-.+/,
            /^\/reading-digest(?:\/|$)/,
        ],
        trustPatterns: [
            /^\/testimonials(?:\/|$)/,
            /^\/about(?:\/|$)/,
            /^\/cv(?:\/|$)/,
            /^\/education(?:\/|$)/,
        ],
        intentPatterns: [
            /^\/payments(?:\/|$)/,
            /^\/obsidian-tutoring#pricing/,
            /^\/contact\?.*service=obsidian/,
            /^\/contact(?:\/|$)/,
        ],
        conversionKeywords: ['obsidian', 'tutoring', 'vault', 'pkm', 'note-taking', 'workflow', 'second brain', 'session'],
    },
    creative_tech: {
        id: 'creative_tech',
        label: 'Creative Technology',
        subtitle: 'XR Showcase, Spatial Computing, AI & Interactive Prototyping',
        targetRole: 'Studios, Tech Startups & Hardware/Spatial Labs',
        color: '#36a37c',
        discoveryPatterns: [
            /^\/lab(?:\/|$)/,
            /^\/xr-showcase(?:\/|$)/,
            /^\/creative-tech-toolkit(?:\/|$)/,
            /^\/visual-experiments(?:\/|$)/,
            /^\/research(?:\/|$)/,
            /^\/research-papers(?:\/|$)/,
        ],
        interestPatterns: [
            /^\/work\/.+/,
            /^\/lab\/.+/,
            /^\/xr-showcase\/.+/,
            /^\/research\/.+/,
        ],
        trustPatterns: [
            /^\/cv(?:\/|$)/,
            /^\/awards(?:\/|$)/,
            /^\/architecture(?:\/|$)/,
            /^\/testimonials(?:\/|$)/,
        ],
        intentPatterns: [
            /^\/contact\?.*service=(?:creative-tech|tech|xr|engineering)/,
            /^\/services#creative-tech/,
            /^\/consulting(?:\/|$)/,
            /^\/contact(?:\/|$)/,
        ],
        conversionKeywords: ['creative tech', 'spatial', 'xr', 'visionOS', 'webgl', 'prototype', 'ai', 'research', 'engineering'],
    },
    film_brand: {
        id: 'film_brand',
        label: 'Film & Brand Direction',
        subtitle: 'Commercial Direction, Video Editing & Brand Storytelling',
        targetRole: 'Directors, Agencies & DTC Brands',
        color: '#d4933c',
        discoveryPatterns: [
            /^\/films(?:\/|$)/,
            /^\/curated-videos(?:\/|$)/,
            /^\/brands(?:\/|$)/,
            /^\/premiere-pro-masterclass(?:\/|$)/,
            /^\/supercutclub(?:\/|$)/,
            /^\/video-editing-mentor(?:\/|$)/,
            /^\/superprof-video-editing-classes(?:\/|$)/,
        ],
        interestPatterns: [
            /^\/films\/.+/,
            /^\/brands\/.+/,
            /^\/bts(?:\/|$)/,
            /^\/curated-videos\/.+/,
        ],
        trustPatterns: [
            /^\/press(?:\/|$)/,
            /^\/awards(?:\/|$)/,
            /^\/testimonials(?:\/|$)/,
            /^\/manifesto(?:\/|$)/,
        ],
        intentPatterns: [
            /^\/licensing(?:\/|$)/,
            /^\/contact\?.*service=(?:film|brand|video)/,
            /^\/services#film/,
            /^\/contact(?:\/|$)/,
        ],
        conversionKeywords: ['film', 'commercial', 'brand', 'editing', 'direction', 'video', 'production', 'licensing'],
    },
};

export const FUNNEL_STAGES = [
    { id: 'discovery', label: 'Discovery', description: 'Landing or exploring entry pages for this discipline' },
    { id: 'interest', label: 'Interest', description: 'Deep engagement with project case studies, reels, or albums' },
    { id: 'trust', label: 'Trust', description: 'Examining credentials, testimonials, about, or client proof' },
    { id: 'intent', label: 'Commercial Intent', description: 'Navigating to pricing, payments, or contact CTA' },
    { id: 'conversion', label: 'Conversion', description: 'Confirmed booking, enquiry submission, or paid checkout' },
];

export const FRICTION_TYPES = {
    cta_unseen: {
        id: 'cta_unseen',
        label: 'CTA Not Seen',
        severity: 'high',
        summary: 'Visitor left before scrolling far enough to encounter the call-to-action.',
        recommendation: 'Elevate secondary CTA into the above-the-fold hero or enable a persistent compact floating action bar.',
    },
    pricing_abandoned: {
        id: 'pricing_abandoned',
        label: 'Pricing Reached, No Booking',
        severity: 'high',
        summary: 'Visitor inspected rates/tiers but hesitated without initiating checkout or contact.',
        recommendation: 'Add low-friction FAQ accordion below pricing, clarify turnaround time, or offer an exploratory 15-min intro call.',
    },
    contact_unstarted: {
        id: 'contact_unstarted',
        label: 'Contact Page Reached, No Form Start',
        severity: 'medium',
        summary: 'Visitor arrived at /contact or booking modal but never touched any input field.',
        recommendation: 'Pre-select the referring service in the dropdown and shorten the form to just Name + Email + 1-sentence prompt.',
    },
    form_abandoned: {
        id: 'form_abandoned',
        label: 'Enquiry Started but Abandoned',
        severity: 'critical',
        summary: 'Visitor began typing into enquiry fields but abandoned before clicking submit.',
        recommendation: 'Remove optional friction fields, add auto-save draft indicator, or display direct email fallback hello@abodid.com.',
    },
    quick_exit: {
        id: 'quick_exit',
        label: 'Quick Bounce / Unengaged Exit',
        severity: 'low',
        summary: 'Visitor exited within 5 seconds without interaction.',
        recommendation: 'Review ad/referrer headline alignment with landing page title to ensure immediate message match.',
    },
    dead_clicks: {
        id: 'dead_clicks',
        label: 'Repeated / Dead Clicks',
        severity: 'medium',
        summary: 'Visitor clicked multiple times on static elements expecting interactivity.',
        recommendation: 'Check unlinked thumbnails, static tags, or unresponsive UI cards in the layout.',
    },
    mobile_friction: {
        id: 'mobile_friction',
        label: 'Mobile-Specific Friction',
        severity: 'high',
        summary: 'Abrupt drop-offs on small viewports caused by crowded tap targets or tall vertical scrolls.',
        recommendation: 'Ensure touch targets >= 44px, sticky header quick-links, and reduce mobile hero padding.',
    },
};

/**
 * Infer the commercial intent category of a session based on visited paths
 */
export function inferSessionIntent(pages = []) {
    const scores = {
        photography: 0,
        obsidian: 0,
        creative_tech: 0,
        film_brand: 0,
    };

    pages.forEach((page) => {
        const path = typeof page === 'string' ? page : page?.pagePath || page?.path || '';
        const duration = typeof page === 'object' ? Math.max(1, Number(page.engagedSeconds || page.durationMs / 1000 || 5)) : 5;

        Object.entries(REVENUE_PATHS).forEach(([key, config]) => {
            const isDiscovery = config.discoveryPatterns.some((p) => p.test(path));
            const isInterest = config.interestPatterns.some((p) => p.test(path));
            const isTrust = config.trustPatterns.some((p) => p.test(path));
            const isIntent = config.intentPatterns.some((p) => p.test(path));

            if (isIntent) scores[key] += 40 + Math.min(20, duration * 2);
            else if (isInterest) scores[key] += 25 + Math.min(15, duration);
            else if (isDiscovery) scores[key] += 15 + Math.min(10, duration);
            else if (isTrust) scores[key] += 10;
        });
    });

    let topPath = 'general';
    let maxScore = 0;
    Object.entries(scores).forEach(([key, score]) => {
        if (score > maxScore) {
            maxScore = score;
            topPath = key;
        }
    });

    const intentScore = Math.min(100, Math.round(maxScore));
    return {
        category: intentScore >= 15 ? topPath : 'general',
        score: intentScore,
        strength: intentScore >= 70 ? 'High' : intentScore >= 40 ? 'Moderate' : intentScore >= 15 ? 'Warm' : 'Low',
    };
}

/**
 * Detect friction signals from a session's pages and events
 */
export function detectSessionFriction(session) {
    const pages = Array.isArray(session.pages) ? session.pages : (session.page_journey || []);
    const events = Array.isArray(session.events) ? session.events : [];
    const totalSeconds = Number(session.totalEngagedSeconds || session.total_engaged_seconds || 0);
    const converted = Boolean(session.converted || session.hasConverted);
    const flags = new Set(session.friction_flags || []);

    const visitedPaths = pages.map((p) => p.path || p.page_path || p.pagePath || '');
    const hasContact = visitedPaths.some((p) => p.startsWith('/contact'));
    const hasPricing = visitedPaths.some((p) => p.includes('pricing') || p.startsWith('/payments'));

    const formStarted = events.some((e) => e.type === 'form_start' || e.name === 'form_input');
    const formSubmitted = events.some((e) => e.type === 'form_submit' || e.name === 'contact_submit') || converted;
    const deadClicks = events.filter((e) => e.type === 'dead_click' || e.type === 'rage_click').length;
    const maxScroll = Math.max(0, ...events.filter((e) => e.type === 'scroll_depth').map((e) => Number(e.depth) || 0));

    if (totalSeconds < 6 && pages.length === 1 && !converted) {
        flags.add('quick_exit');
    }

    if (hasPricing && !converted) {
        flags.add('pricing_abandoned');
    }

    if (hasContact && !formStarted && !converted) {
        flags.add('contact_unstarted');
    }

    if (formStarted && !formSubmitted) {
        flags.add('form_abandoned');
    }

    if (deadClicks >= 2) {
        flags.add('dead_clicks');
    }

    if (maxScroll > 0 && maxScroll < 40 && totalSeconds >= 10 && !converted && !hasContact) {
        flags.add('cta_unseen');
    }

    if (session.device === 'mobile' && (flags.has('quick_exit') || flags.has('form_abandoned') || deadClicks > 0)) {
        flags.add('mobile_friction');
    }

    return Array.from(flags);
}

/**
 * Calculate full revenue funnels for the 4 paths and detect the largest leakage stage
 */
export function calculateRevenueFunnels(sessions = []) {
    const funnels = {};

    Object.entries(REVENUE_PATHS).forEach(([pathKey, config]) => {
        let discoveryCount = 0;
        let interestCount = 0;
        let trustCount = 0;
        let intentCount = 0;
        let conversionCount = 0;

        sessions.forEach((s) => {
            const pages = Array.isArray(s.pages) ? s.pages : (s.page_journey || []);
            const visited = pages.map((p) => p.path || p.page_path || p.pagePath || '');
            const converted = Boolean(s.converted || s.hasConverted) && (s.intent_category === pathKey || s.intentCategory === pathKey || s.conversion_type === pathKey);

            const hasDiscovery = visited.some((p) => config.discoveryPatterns.some((pattern) => pattern.test(p)));
            const hasInterest = visited.some((p) => config.interestPatterns.some((pattern) => pattern.test(p)));
            const hasTrust = visited.some((p) => config.trustPatterns.some((pattern) => pattern.test(p)));
            const hasIntent = visited.some((p) => config.intentPatterns.some((pattern) => pattern.test(p)));

            if (hasDiscovery || hasInterest || hasIntent || converted) {
                discoveryCount++;
            }
            if (hasInterest || hasIntent || converted) {
                interestCount++;
            }
            if ((hasInterest || hasDiscovery) && (hasTrust || hasIntent || converted)) {
                trustCount++;
            }
            if (hasIntent || converted) {
                intentCount++;
            }
            if (converted) {
                conversionCount++;
            }
        });

        const stages = [
            {
                id: 'discovery',
                label: 'Discovery',
                count: discoveryCount,
                dropOffRate: discoveryCount > 0 ? Math.max(0, Math.round(((discoveryCount - interestCount) / discoveryCount) * 100)) : 0,
                dropOffCount: Math.max(0, discoveryCount - interestCount),
            },
            {
                id: 'interest',
                label: 'Interest',
                count: interestCount,
                dropOffRate: interestCount > 0 ? Math.max(0, Math.round(((interestCount - trustCount) / interestCount) * 100)) : 0,
                dropOffCount: Math.max(0, interestCount - trustCount),
            },
            {
                id: 'trust',
                label: 'Trust',
                count: trustCount,
                dropOffRate: trustCount > 0 ? Math.max(0, Math.round(((trustCount - intentCount) / trustCount) * 100)) : 0,
                dropOffCount: Math.max(0, trustCount - intentCount),
            },
            {
                id: 'intent',
                label: 'Commercial Intent',
                count: intentCount,
                dropOffRate: intentCount > 0 ? Math.max(0, Math.round(((intentCount - conversionCount) / intentCount) * 100)) : 0,
                dropOffCount: Math.max(0, intentCount - conversionCount),
            },
            {
                id: 'conversion',
                label: 'Conversion',
                count: conversionCount,
                dropOffRate: 0,
                dropOffCount: 0,
            },
        ];

        // Find largest leakage point
        let maxLeakageStage = null;
        let maxLeakageDropOff = -1;
        stages.slice(0, 4).forEach((stage, idx) => {
            if (stage.count > 0 && stage.dropOffRate > maxLeakageDropOff) {
                maxLeakageDropOff = stage.dropOffRate;
                const nextStage = stages[idx + 1];
                maxLeakageStage = {
                    fromStage: stage.label,
                    toStage: nextStage ? nextStage.label : '',
                    stageId: stage.id,
                    dropOffRate: stage.dropOffRate,
                    lostVisitors: stage.dropOffCount,
                };
            }
        });

        funnels[pathKey] = {
            id: pathKey,
            label: config.label,
            subtitle: config.subtitle,
            targetRole: config.targetRole,
            color: config.color,
            stages,
            totalDiscovery: discoveryCount,
            totalConverted: conversionCount,
            conversionRate: discoveryCount > 0 ? ((conversionCount / discoveryCount) * 100).toFixed(1) : '0.0',
            largestLeakage: maxLeakageStage,
        };
    });

    return funnels;
}

/**
 * Generate synthetic demo data if real sessions are sparse
 */
export function generateSyntheticIntelligenceReport(range = '7d') {
    const multiplier = range === 'today' ? 1 : range === '30d' ? 4 : range === '90d' ? 11 : 2;

    const sampleVisitors = [
        {
            visitorId: 'vis-phot-01',
            sessionId: 'sess-p01',
            timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
            city: 'London',
            region: 'Greater London',
            country: 'GB',
            source: 'LinkedIn',
            isReturning: true,
            visitCount: 3,
            intentCategory: 'photography',
            intentScore: 92,
            intentStrength: 'High',
            totalEngagedSeconds: 245,
            pageCount: 5,
            converted: true,
            conversionType: 'photography',
            conversionLabel: 'Editorial Shoot Enquiry',
            hasReplay: true,
            frictionFlags: [],
            journey: [
                { path: '/photography', title: 'Photography Portfolio', engagedSeconds: 42, timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString() },
                { path: '/photo-stories/silent-monoliths', title: 'Silent Monoliths — Photo Story', engagedSeconds: 88, timestamp: new Date(Date.now() - 13 * 60 * 1000).toISOString() },
                { path: '/about', title: 'About Abodid Sahoo', engagedSeconds: 35, timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString() },
                { path: '/testimonials', title: 'Client Testimonials', engagedSeconds: 28, timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
                { path: '/contact?service=photography', title: 'Commission an Editorial', engagedSeconds: 52, timestamp: new Date(Date.now() - 9 * 60 * 1000).toISOString() },
            ],
            keyInteractions: [
                { type: 'image_zoom', label: 'Inspected Hasselblad Medium Format Frame 04', timeOffset: 70 },
                { type: 'cta_click', label: 'Clicked "Request Commercial Rate Card"', timeOffset: 190 },
                { type: 'form_submit', label: 'Submitted Contact Form (Vogue Scandinavia Feature Enquiry)', timeOffset: 240 },
            ],
        },
        {
            visitorId: 'vis-obs-02',
            sessionId: 'sess-o02',
            timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
            city: 'San Francisco',
            region: 'California',
            country: 'US',
            source: 'Google Search',
            isReturning: true,
            visitCount: 2,
            intentCategory: 'obsidian',
            intentScore: 88,
            intentStrength: 'High',
            totalEngagedSeconds: 310,
            pageCount: 4,
            converted: false,
            conversionType: null,
            conversionLabel: 'Abandoned on Checkout',
            hasReplay: true,
            frictionFlags: ['pricing_abandoned'],
            journey: [
                { path: '/obsidian-for-founders', title: 'Obsidian Systems for Founders', engagedSeconds: 110, timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString() },
                { path: '/obsidian-vault', title: 'Interactive Vault Graph Architecture', engagedSeconds: 95, timestamp: new Date(Date.now() - 46 * 60 * 1000).toISOString() },
                { path: '/payments', title: '1-on-1 Obsidian Tutoring & Setup', engagedSeconds: 75, timestamp: new Date(Date.now() - 44 * 60 * 1000).toISOString() },
                { path: '/contact?service=obsidian', title: 'Book Session', engagedSeconds: 30, timestamp: new Date(Date.now() - 43 * 60 * 1000).toISOString() },
            ],
            keyInteractions: [
                { type: 'tier_selection', label: 'Selected 4-Week Custom Vault Architecture Tier', timeOffset: 215 },
                { type: 'modal_open', label: 'Opened Cal Booking Dialog', timeOffset: 280 },
                { type: 'bounce_action', label: 'Hesitated on Timezone Selector & Closed Tab', timeOffset: 305 },
            ],
        },
        {
            visitorId: 'vis-ct-03',
            sessionId: 'sess-c03',
            timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
            city: 'Berlin',
            region: 'Berlin',
            country: 'DE',
            source: 'X / Twitter',
            isReturning: false,
            visitCount: 1,
            intentCategory: 'creative_tech',
            intentScore: 84,
            intentStrength: 'High',
            totalEngagedSeconds: 190,
            pageCount: 4,
            converted: true,
            conversionType: 'creative_tech',
            conversionLabel: 'Spatial XR Prototype Commission',
            hasReplay: true,
            frictionFlags: [],
            journey: [
                { path: '/lab', title: 'Creative Technology Lab', engagedSeconds: 40, timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
                { path: '/xr-showcase', title: 'XR Showcase & WebGL Experiments', engagedSeconds: 65, timestamp: new Date(Date.now() - 1.9 * 3600 * 1000).toISOString() },
                { path: '/work/punctum-spatial-engine', title: 'Punctum Spatial Vision Engine', engagedSeconds: 55, timestamp: new Date(Date.now() - 1.8 * 3600 * 1000).toISOString() },
                { path: '/contact?service=creative-tech', title: 'Hire for Creative Tech', engagedSeconds: 30, timestamp: new Date(Date.now() - 1.7 * 3600 * 1000).toISOString() },
            ],
            keyInteractions: [
                { type: 'webgl_toggle', label: 'Triggered 3D Point Cloud Inspection', timeOffset: 50 },
                { type: 'cta_click', label: 'Clicked "Discuss Spatial Hardware Integration"', timeOffset: 155 },
                { type: 'form_submit', label: 'Sent Enquiry for Q4 Exhibition Tech Contract', timeOffset: 185 },
            ],
        },
        {
            visitorId: 'vis-film-04',
            sessionId: 'sess-f04',
            timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
            city: 'New York',
            region: 'New York',
            country: 'US',
            source: 'Direct Visit',
            isReturning: true,
            visitCount: 4,
            intentCategory: 'film_brand',
            intentScore: 78,
            intentStrength: 'High',
            totalEngagedSeconds: 220,
            pageCount: 3,
            converted: false,
            conversionType: null,
            conversionLabel: 'Form Abandonment at Message Box',
            hasReplay: true,
            frictionFlags: ['form_abandoned'],
            journey: [
                { path: '/films', title: 'Commercials & Short Films', engagedSeconds: 90, timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString() },
                { path: '/brands', title: 'Brand Collaborations & Clients', engagedSeconds: 70, timestamp: new Date(Date.now() - 3.9 * 3600 * 1000).toISOString() },
                { path: '/contact?service=film', title: 'Film Project Enquiry', engagedSeconds: 60, timestamp: new Date(Date.now() - 3.8 * 3600 * 1000).toISOString() },
            ],
            keyInteractions: [
                { type: 'video_play', label: 'Played 4K Director Showreel (100% finished)', timeOffset: 65 },
                { type: 'form_start', label: 'Typed Name & Agency Email into Contact Form', timeOffset: 175 },
                { type: 'form_abandon', label: 'Left Message Input Blank & Navigated Away', timeOffset: 215 },
            ],
        },
        {
            visitorId: 'vis-fric-05',
            sessionId: 'sess-fr05',
            timestamp: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
            city: 'Toronto',
            region: 'Ontario',
            country: 'CA',
            source: 'Perplexity',
            isReturning: false,
            visitCount: 1,
            intentCategory: 'obsidian',
            intentScore: 65,
            intentStrength: 'Moderate',
            totalEngagedSeconds: 140,
            pageCount: 2,
            converted: false,
            conversionType: null,
            conversionLabel: 'Dead Clicks on Static Tags',
            hasReplay: true,
            frictionFlags: ['dead_clicks', 'cta_unseen'],
            journey: [
                { path: '/obsidian-for-researchers', title: 'Academic Vault Architecture', engagedSeconds: 110, timestamp: new Date(Date.now() - 7 * 3600 * 1000).toISOString() },
                { path: '/reading-digest', title: 'Reading Digest Vault', engagedSeconds: 30, timestamp: new Date(Date.now() - 6.9 * 3600 * 1000).toISOString() },
            ],
            keyInteractions: [
                { type: 'dead_click', label: 'Clicked 5x on Non-interactive Obsidian Tag Pill', timeOffset: 45 },
                { type: 'scroll_depth', label: 'Scrolled only 28% of long page before bounce', timeOffset: 120 },
            ],
        },
    ];

    const revenueFunnelData = {
        photography: {
            id: 'photography',
            label: 'Photography',
            subtitle: 'Editorial, Portraiture & Fine-Art Commissions',
            targetRole: 'Brands, Agencies & Private Commissions',
            color: '#d61f45',
            stages: [
                { id: 'discovery', label: 'Discovery', count: 142 * multiplier, dropOffRate: 48, dropOffCount: 68 * multiplier },
                { id: 'interest', label: 'Interest', count: 74 * multiplier, dropOffRate: 54, dropOffCount: 40 * multiplier },
                { id: 'trust', label: 'Trust', count: 34 * multiplier, dropOffRate: 41, dropOffCount: 14 * multiplier },
                { id: 'intent', label: 'Commercial Intent', count: 20 * multiplier, dropOffRate: 60, dropOffCount: 12 * multiplier },
                { id: 'conversion', label: 'Conversion', count: 8 * multiplier, dropOffRate: 0, dropOffCount: 0 },
            ],
            totalDiscovery: 142 * multiplier,
            totalConverted: 8 * multiplier,
            conversionRate: '5.6',
            largestLeakage: {
                fromStage: 'Commercial Intent',
                toStage: 'Conversion',
                stageId: 'intent',
                dropOffRate: 60,
                lostVisitors: 12 * multiplier,
            },
        },
        obsidian: {
            id: 'obsidian',
            label: 'Obsidian Tutoring',
            subtitle: '1-on-1 PKM, Vault Architecture & Creative Systems',
            targetRole: 'Writers, Researchers & Founders',
            color: '#5b8def',
            stages: [
                { id: 'discovery', label: 'Discovery', count: 210 * multiplier, dropOffRate: 45, dropOffCount: 94 * multiplier },
                { id: 'interest', label: 'Interest', count: 116 * multiplier, dropOffRate: 52, dropOffCount: 60 * multiplier },
                { id: 'trust', label: 'Trust', count: 56 * multiplier, dropOffRate: 38, dropOffCount: 21 * multiplier },
                { id: 'intent', label: 'Commercial Intent', count: 35 * multiplier, dropOffRate: 66, dropOffCount: 23 * multiplier },
                { id: 'conversion', label: 'Conversion', count: 12 * multiplier, dropOffRate: 0, dropOffCount: 0 },
            ],
            totalDiscovery: 210 * multiplier,
            totalConverted: 12 * multiplier,
            conversionRate: '5.7',
            largestLeakage: {
                fromStage: 'Commercial Intent',
                toStage: 'Conversion',
                stageId: 'intent',
                dropOffRate: 66,
                lostVisitors: 23 * multiplier,
            },
        },
        creative_tech: {
            id: 'creative_tech',
            label: 'Creative Technology',
            subtitle: 'Spatial Computing, XR Demos & Interactive Systems',
            targetRole: 'Studios, Tech Startups & Hardware Labs',
            color: '#36a37c',
            stages: [
                { id: 'discovery', label: 'Discovery', count: 98 * multiplier, dropOffRate: 42, dropOffCount: 41 * multiplier },
                { id: 'interest', label: 'Interest', count: 57 * multiplier, dropOffRate: 49, dropOffCount: 28 * multiplier },
                { id: 'trust', label: 'Trust', count: 29 * multiplier, dropOffRate: 45, dropOffCount: 13 * multiplier },
                { id: 'intent', label: 'Commercial Intent', count: 16 * multiplier, dropOffRate: 62, dropOffCount: 10 * multiplier },
                { id: 'conversion', label: 'Conversion', count: 6 * multiplier, dropOffRate: 0, dropOffCount: 0 },
            ],
            totalDiscovery: 98 * multiplier,
            totalConverted: 6 * multiplier,
            conversionRate: '6.1',
            largestLeakage: {
                fromStage: 'Commercial Intent',
                toStage: 'Conversion',
                stageId: 'intent',
                dropOffRate: 62,
                lostVisitors: 10 * multiplier,
            },
        },
        film_brand: {
            id: 'film_brand',
            label: 'Film & Brand Direction',
            subtitle: 'Commercial Direction, Video Editing & Brand Storytelling',
            targetRole: 'Directors, Agencies & DTC Brands',
            color: '#d4933c',
            stages: [
                { id: 'discovery', label: 'Discovery', count: 85 * multiplier, dropOffRate: 47, dropOffCount: 40 * multiplier },
                { id: 'interest', label: 'Interest', count: 45 * multiplier, dropOffRate: 51, dropOffCount: 23 * multiplier },
                { id: 'trust', label: 'Trust', count: 22 * multiplier, dropOffRate: 41, dropOffCount: 9 * multiplier },
                { id: 'intent', label: 'Commercial Intent', count: 13 * multiplier, dropOffRate: 69, dropOffCount: 9 * multiplier },
                { id: 'conversion', label: 'Conversion', count: 4 * multiplier, dropOffRate: 0, dropOffCount: 0 },
            ],
            totalDiscovery: 85 * multiplier,
            totalConverted: 4 * multiplier,
            conversionRate: '4.7',
            largestLeakage: {
                fromStage: 'Commercial Intent',
                toStage: 'Conversion',
                stageId: 'intent',
                dropOffRate: 69,
                lostVisitors: 9 * multiplier,
            },
        },
    };

    const dropoffDiagnostics = [
        {
            id: 'pricing_abandoned',
            label: 'Pricing Reached, No Booking',
            category: 'Commercial Hesitation',
            severity: 'high',
            affectedSessions: 38 * multiplier,
            affectedShare: '32%',
            primaryDisciplines: ['Obsidian Tutoring', 'Film / Brand'],
            summary: 'Visitors examined session packages and price tiers but left without choosing a date.',
            recommendation: 'Add student/founder FAQ, show remaining open slots this month, and offer a no-friction intro call option.',
            sampleSessionId: 'sess-o02',
        },
        {
            id: 'form_abandoned',
            label: 'Enquiry Started but Abandoned',
            category: 'Form Friction',
            severity: 'critical',
            affectedSessions: 19 * multiplier,
            affectedShare: '16%',
            primaryDisciplines: ['Film & Brand', 'Photography'],
            summary: 'Visitors entered their name and email into contact inputs but never finished the message box.',
            recommendation: 'Provide 3 clickable prompt chips (e.g. "Commercial campaign in Q4", "1-on-1 Obsidian audit", "Spatial prototype") to eliminate typing paralysis.',
            sampleSessionId: 'sess-f04',
        },
        {
            id: 'contact_unstarted',
            label: 'Contact Page Reached, No Form Start',
            category: 'Intent Hesitation',
            severity: 'medium',
            affectedSessions: 24 * multiplier,
            affectedShare: '20%',
            primaryDisciplines: ['Creative Tech', 'Obsidian Tutoring'],
            summary: 'Visitors navigated to /contact but never clicked inside the form fields.',
            recommendation: 'Display direct email link (hello@abodid.com) and average response time ("Replies within 6 hours").',
            sampleSessionId: 'sess-fr05',
        },
        {
            id: 'cta_unseen',
            label: 'CTA Not Seen / Below Scroll',
            category: 'Visual Hierarchy',
            severity: 'medium',
            affectedSessions: 28 * multiplier,
            affectedShare: '24%',
            primaryDisciplines: ['Obsidian Tutoring', 'Photography'],
            summary: 'Visitors spent >45 seconds on articles or project pages without scrolling far enough to see the booking button.',
            recommendation: 'Implement an unobtrusive in-article editorial signature link or floating bottom inquiry banner on long reads.',
            sampleSessionId: 'sess-fr05',
        },
        {
            id: 'dead_clicks',
            label: 'Repeated / Dead Clicks',
            category: 'UI Confusion',
            severity: 'low',
            affectedSessions: 12 * multiplier,
            affectedShare: '10%',
            primaryDisciplines: ['Creative Tech', 'Obsidian Tutoring'],
            summary: 'Visitors clicked multiple times on static tags, pill badges, and non-interactive image previews.',
            recommendation: 'Add cursor styles and interactive filters for taxonomy pills so clicking a tag filters matching case studies.',
            sampleSessionId: 'sess-fr05',
        },
    ];

    const totalMeaningfulVisitors = (142 + 210 + 98 + 85) * multiplier;
    const totalConversions = (8 + 12 + 6 + 4) * multiplier;
    const highIntentCount = Math.round(totalMeaningfulVisitors * 0.38);
    const returningCount = Math.round(totalMeaningfulVisitors * 0.28);
    const overallConversionRate = ((totalConversions / totalMeaningfulVisitors) * 100).toFixed(1);

    return {
        overview: {
            meaningfulVisitors: totalMeaningfulVisitors,
            highIntentVisitors: highIntentCount,
            returningVisitors: returningCount,
            enquiriesAndBookings: totalConversions,
            conversionRate: `${overallConversionRate}%`,
            revenueBreakdown: [
                {
                    id: 'photography',
                    label: 'Photography',
                    subtitle: 'Editorial & Private Commissions',
                    visitors: 142 * multiplier,
                    highIntent: 34 * multiplier,
                    enquiries: 8 * multiplier,
                    conversionRate: '5.6%',
                    trend: '+18% vs last period',
                    color: '#d61f45',
                },
                {
                    id: 'obsidian',
                    label: 'Obsidian Tutoring',
                    subtitle: 'PKM & Vault Architecture',
                    visitors: 210 * multiplier,
                    highIntent: 56 * multiplier,
                    enquiries: 12 * multiplier,
                    conversionRate: '5.7%',
                    trend: '+24% vs last period',
                    color: '#5b8def',
                },
                {
                    id: 'creative_tech',
                    label: 'Creative Technology',
                    subtitle: 'Spatial Computing & XR Prototyping',
                    visitors: 98 * multiplier,
                    highIntent: 29 * multiplier,
                    enquiries: 6 * multiplier,
                    conversionRate: '6.1%',
                    trend: '+12% vs last period',
                    color: '#36a37c',
                },
                {
                    id: 'film_brand',
                    label: 'Film & Brand Direction',
                    subtitle: 'Commercial Direction & Video Production',
                    visitors: 85 * multiplier,
                    highIntent: 22 * multiplier,
                    enquiries: 4 * multiplier,
                    conversionRate: '4.7%',
                    trend: '+8% vs last period',
                    color: '#d4933c',
                },
            ],
        },
        revenueJourneys: revenueFunnelData,
        dropoffs: {
            summary: {
                totalFrictionEvents: (38 + 19 + 24 + 28 + 12) * multiplier,
                primaryLeakageDiscipline: 'Obsidian Tutoring (Pricing → Checkout)',
                topActionPriority: 'Add FAQ & Quick Intro Call on Pricing Pages',
            },
            diagnostics: dropoffDiagnostics,
        },
        visitors: {
            totalHighIntent: highIntentCount,
            feed: sampleVisitors,
        },
        replays: {
            totalTargeted: sampleVisitors.filter((v) => v.hasReplay).length,
            sessions: sampleVisitors.filter((v) => v.hasReplay).map((v) => ({
                id: v.sessionId,
                visitorId: v.visitorId,
                startedAt: v.timestamp,
                durationSeconds: v.totalEngagedSeconds,
                location: `${v.city}, ${v.country}`,
                source: v.source,
                intentCategory: v.intentCategory,
                conversionLabel: v.conversionLabel,
                frictionFlags: v.frictionFlags,
                pageJourney: v.journey,
                events: v.keyInteractions,
            })),
        },
    };
}
