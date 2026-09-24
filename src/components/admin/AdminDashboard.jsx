import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    loadNewsletterExhibitionMedia,
    pickNewsletterMedia,
} from '../../lib/newsletter/media.js';
import { prefetchNetworkIntelligence } from '../../lib/network/prefetch.js';
import UserList from './UserList';
import BrandManager from './BrandManager';
import NewsletterSender from './NewsletterSender';
import PhotoStoryManager from './PhotoStoryManager';
import MoodboardManager from './MoodboardManager';
import ListView from './ListView';
import SeoStudio from './SeoStudio';
import AnalyticsDashboard from './AnalyticsDashboard';
import AdminPageHeader from './AdminPageHeader';
import MediaLibrary from './MediaLibrary';
import XRShowcaseManager from './XRShowcaseManager';
import AdminResourceManager from './AdminResourceManager';
import PhotographyManager from './PhotographyManager';
import FilmManager from './FilmManager';
import ResearchManager from './ResearchManager';
import NetworkIntelligence from './NetworkIntelligence';
import PortfolioAdminList from '../portfolio/admin/PortfolioAdminList';
import ReadingDigestManager from './ReadingDigestManager';
import BlogAdminList from './BlogAdminList';
import HomeCardsManager from './HomeCardsManager';
import LabExperimentsManager from './LabExperimentsManager';
import DesignStudio from './DesignStudio';
import { OpportunityDetailModal } from '../opportunities/OpportunityDetailModal';
import { getOpportunityActionAt, selectAttentionOpportunities } from '../../lib/opportunities/attention';
import { formatDaysRemaining, formatOpportunityTitle } from '../../lib/opportunities/ui-helpers';
import {
    describeRecentVisitor,
    getRecentVisitorCount,
    selectRecentHumanVisitors,
} from '../../lib/analytics/recent-visitors';
import '../../styles/opportunities-editorial.css';
import {
    ArrowUpRight,
    BookOpen,
    CalendarClock,
    ChartNoAxesCombined,
    Camera,
    Clapperboard,
    FileText,
    FlaskConical,
    FolderOpen,
    FolderKanban,
    Images,
    LayoutTemplate,
    Library,
    LogOut,
    Mail,
    Menu,
    PenLine,
    Palette,
    ScanSearch,
    Globe2,
    Glasses,
    Home,
    Moon,
    Network,
    Sun,
    Sunrise,
    Sunset,
    Tags,
    UsersRound,
    X,
} from 'lucide-react';

const NAV_GROUPS = [
    {
        id: 'home',
        label: 'Home',
        sections: [
            { id: 'dashboard', label: 'Studio Home', icon: Home },
        ],
    },
    {
        id: 'publish',
        label: 'Publish',
        sections: [
            { id: 'portfolio_projects', label: 'Projects', icon: FolderKanban },
            { id: 'photography', label: 'Photography', icon: Camera },
            { id: 'photo_stories', label: 'Photo Stories', icon: FileText },
            { id: 'films', label: 'Films', icon: Clapperboard },
            { id: 'blog', label: 'Blog / Writing', icon: PenLine },
            { id: 'research', label: 'Research', icon: FlaskConical },
            { id: 'lab_experiments', label: 'Lab', icon: FlaskConical },
        ],
    },
    {
        id: 'discover',
        label: 'Discover & Research',
        sections: [
            { id: 'hub_resources', label: 'Resources', icon: Library },
            { id: 'xr_showcase', label: 'XR References', icon: Glasses },
            { id: 'moodboard_items', label: 'Moodboard', icon: Images },
            { id: 'reading_digest', label: 'Reading Digest', icon: BookOpen },
        ],
    },
    {
        id: 'connect',
        label: 'Connect',
        sections: [
            { id: 'network_intelligence', label: 'Contacts', icon: Network },
            { id: 'newsletter', label: 'Newsletters', icon: Mail },
            { id: 'users', label: 'Members & Access', icon: UsersRound },
        ],
    },
    {
        id: 'website',
        label: 'Website',
        sections: [
            { id: 'home_cards', label: 'Homepage Cards', icon: LayoutTemplate },
            { id: 'brands', label: 'Clients & Collaborators', icon: Tags },
            { id: 'media_library', label: 'Media Library', icon: FolderOpen },
            { id: 'page_metadata', label: 'Search & Social', icon: ScanSearch },
            { id: 'design_system', label: 'Site Design', icon: Palette },
        ],
    },
    {
        id: 'understand',
        label: 'Understand',
        sections: [
            { id: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
        ],
    },
];
const SECTIONS = NAV_GROUPS.flatMap((group) => (
    group.sections.map((section) => ({ ...section, groupId: group.id, groupLabel: group.label }))
));
const VALID_SECTION_IDS = new Set(SECTIONS.map((section) => section.id));
const REQUEST_TIMEOUT_MS = 8000;
const WORLD_CLOCKS = [
    { city: 'New York', timeZone: 'America/New_York' },
    { city: 'London', timeZone: 'Europe/London' },
    { city: 'Dubai', timeZone: 'Asia/Dubai' },
    { city: 'Delhi', timeZone: 'Asia/Kolkata' },
    { city: 'Tokyo', timeZone: 'Asia/Tokyo' },
    { city: 'Melbourne', timeZone: 'Australia/Melbourne', adaptive: true },
];

const withTimeout = (promise, label, timeoutMs = REQUEST_TIMEOUT_MS) => {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
};

const preloadImage = (url) => new Promise((resolve) => {
    if (!url || typeof Image === 'undefined') {
        resolve();
        return;
    }

    const image = new Image();
    const finish = () => {
        image.onload = null;
        image.onerror = null;
        resolve();
    };
    image.onload = finish;
    image.onerror = finish;
    image.src = url;
    if (image.complete) finish();
});

class SectionErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error) {
        console.error('Admin section failed to render:', error);
    }

    render() {
        if (this.state.error) {
            return (
                <div className="section-error">
                    <h3>Could not load this section.</h3>
                    <p>{this.state.error.message}</p>
                    <button type="button" onClick={() => window.location.reload()}>
                        Reload
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default function AdminDashboard() {
    const moodboardFileInputRef = useRef(null);
    const opportunityDragRef = useRef({
        active: false,
        pointerId: null,
        startX: 0,
        scrollLeft: 0,
        pendingScrollLeft: 0,
        frameId: null,
        moved: false,
    });
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('dashboard');
    const [connectionError, setConnectionError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [newsletterExhibition, setNewsletterExhibition] = useState({
        sample: null,
        ready: false,
    });
    const [moodboardInitialFiles, setMoodboardInitialFiles] = useState([]);
    const [opportunityFocus, setOpportunityFocus] = useState({
        items: [],
        total: 0,
        loading: true,
        error: '',
    });
    const [selectedOpportunity, setSelectedOpportunity] = useState(null);
    const [analyticsSnapshot, setAnalyticsSnapshot] = useState({
        visitorCount: 0,
        visitors: [],
        loading: true,
        error: '',
    });
    const activeDestination = SECTIONS.find((section) => section.id === activeSection) || SECTIONS[0];
    const activeNavGroup = NAV_GROUPS.find((group) => group.id === activeDestination.groupId) || NAV_GROUPS[0];

    useEffect(() => {
        console.log("AdminDashboard: Mounted");
        // URL State Sync
        const params = new URLSearchParams(window.location.search);
        const sectionFromUrl = params.get('section');
        if (sectionFromUrl && VALID_SECTION_IDS.has(sectionFromUrl)) {
            setActiveSection(sectionFromUrl);
        }

        // Simple, robust auth check
        const checkAuth = async () => {
            try {
                // 1. Get Session
                const { data: { session }, error: sessionError } = await withTimeout(
                    supabase.auth.getSession(),
                    'Admin session check'
                );

                if (sessionError) throw sessionError;

                if (!session) {
                    console.warn("AdminDashboard: No session found, redirecting.");
                    window.location.href = '/admin/login?reason=no_session';
                    return;
                }

                // 2. Check Admin Role
                const { data: profile, error: profileError } = await withTimeout(
                    supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', session.user.id)
                        .single(),
                    'Admin profile check'
                );

                if (profileError) {
                    console.error("AdminDashboard: Profile fetch error", profileError);
                    // Decide if you want to block or just warn. Blocking is safer for admin.
                    throw new Error("Could not verify admin profile.");
                }

                if (profile?.role !== 'admin') {
                    console.warn("AdminDashboard: User is not admin. Role:", profile?.role);
                    setConnectionError("Access Denied: You do not have admin privileges.");
                    setLoading(false);
                    return;
                }

                // 3. Success: render the admin shell before non-critical metrics finish.
                document.cookie = `abodid_analytics_exclude=1; Max-Age=31536000; Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
                setSession(session);
                setLoading(false);

            } catch (err) {
                console.error("AdminDashboard: Auth check failed:", err);
                setConnectionError(err.message || "Authentication check failed.");
            } finally {
                setLoading(false);
            }
        };

        if (supabase) {
            checkAuth();

            // Listen for auth changes
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
                if (event === 'SIGNED_OUT') {
                    setSession(null);
                    window.location.href = '/admin/login';
                } else if (nextSession) {
                    // Keep API consumers in sync when Supabase rotates the JWT.
                    // Without this, the admin shell remains signed in while child
                    // sections continue sending an expired access token.
                    setSession(nextSession);
                }
            });

            return () => subscription.unsubscribe();
        } else {
            setConnectionError("Supabase client not initialized.");
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const handleHistoryChange = () => {
            const section = new URLSearchParams(window.location.search).get('section');
            setActiveSection(section && VALID_SECTION_IDS.has(section) ? section : 'dashboard');
        };

        window.addEventListener('popstate', handleHistoryChange);
        return () => window.removeEventListener('popstate', handleHistoryChange);
    }, []);

    useEffect(() => {
        if (!sidebarOpen || !window.matchMedia('(max-width: 899px)').matches) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [sidebarOpen]);

    useEffect(() => {
        const accessToken = session?.access_token;
        if (!accessToken) return undefined;

        let cancelled = false;
        setNewsletterExhibition((current) => ({ ...current, ready: false }));

        const prepareNewsletterExhibition = async () => {
            try {
                const media = await withTimeout(
                    loadNewsletterExhibitionMedia(accessToken),
                    'Newsletter exhibition images'
                );
                const sample = pickNewsletterMedia(media, 'image');

                if (sample?.publicUrl) {
                    await withTimeout(
                        preloadImage(sample.publicUrl),
                        'Newsletter exhibition photo preload'
                    ).catch(() => {});
                }

                if (!cancelled) setNewsletterExhibition({ sample, ready: true });
            } catch (error) {
                console.warn('Could not preload a newsletter exhibition photo:', error);
                if (!cancelled) setNewsletterExhibition({ sample: null, ready: true });
            }
        };

        void prepareNewsletterExhibition();
        return () => {
            cancelled = true;
        };
    }, [session?.access_token]);

    useEffect(() => {
        if (!session || activeSection !== 'dashboard') return undefined;

        const controller = new AbortController();
        setOpportunityFocus((current) => ({ ...current, loading: true, error: '' }));

        fetch(`/api/opportunities?refresh=${Date.now()}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || 'Could not load opportunities.');
                const attentionItems = selectAttentionOpportunities(payload.opportunities || [], Date.now());
                setOpportunityFocus({
                    items: attentionItems.slice(0, 8),
                    total: attentionItems.length,
                    loading: false,
                    error: '',
                });
            })
            .catch((error) => {
                if (error.name === 'AbortError') return;
                setOpportunityFocus({ items: [], total: 0, loading: false, error: error.message });
            });

        return () => controller.abort();
    }, [activeSection, session]);

    useEffect(() => {
        const accessToken = session?.access_token;
        if (!accessToken || activeSection !== 'dashboard') return undefined;

        const controller = new AbortController();
        setAnalyticsSnapshot((current) => ({ ...current, loading: true, error: '' }));

        const loadSnapshot = async () => {
            const timezoneOffset = new Date().getTimezoneOffset();
            const requestUrl = `/api/admin/analytics?range=7d&traffic=human&timezoneOffset=${timezoneOffset}`;
            const requestReport = (token) => fetch(requestUrl, {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
            });

            try {
                let response = await requestReport(accessToken);
                if (response.status === 401) {
                    const { data, error: refreshError } = await supabase.auth.refreshSession();
                    const refreshedToken = data?.session?.access_token;
                    if (!refreshError && refreshedToken) response = await requestReport(refreshedToken);
                }

                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || 'Could not load recent visitors.');

                const report = payload.report || {};
                setAnalyticsSnapshot({
                    visitorCount: getRecentVisitorCount(report),
                    visitors: selectRecentHumanVisitors(report, 7),
                    loading: false,
                    error: '',
                });
            } catch (error) {
                if (error.name === 'AbortError') return;
                setAnalyticsSnapshot({ visitorCount: 0, visitors: [], loading: false, error: error.message });
            }
        };

        void loadSnapshot();
        return () => controller.abort();
    }, [activeSection, session?.access_token]);

    const handleOpportunityStripPointerDown = (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('a')) return;
        const strip = event.currentTarget;
        if (opportunityDragRef.current.frameId) {
            window.cancelAnimationFrame(opportunityDragRef.current.frameId);
        }
        opportunityDragRef.current = {
            active: true,
            pointerId: event.pointerId,
            startX: event.clientX,
            scrollLeft: strip.scrollLeft,
            pendingScrollLeft: strip.scrollLeft,
            frameId: null,
            moved: false,
        };
        strip.setPointerCapture(event.pointerId);
        strip.classList.add('is-dragging');
    };

    const handleOpportunityStripPointerMove = (event) => {
        const drag = opportunityDragRef.current;
        if (!drag.active || drag.pointerId !== event.pointerId) return;
        const distance = event.clientX - drag.startX;
        if (Math.abs(distance) > 3 && !drag.moved) {
            drag.moved = true;
        }
        if (drag.moved) {
            event.preventDefault();
            drag.pendingScrollLeft = drag.scrollLeft - distance;
            if (!drag.frameId) {
                const strip = event.currentTarget;
                drag.frameId = window.requestAnimationFrame(() => {
                    strip.scrollLeft = drag.pendingScrollLeft;
                    drag.frameId = null;
                });
            }
        }
    };

    const handleOpportunityStripPointerEnd = (event) => {
        const drag = opportunityDragRef.current;
        if (!drag.active || drag.pointerId !== event.pointerId) return;
        drag.active = false;
        if (drag.frameId) {
            window.cancelAnimationFrame(drag.frameId);
            drag.frameId = null;
            event.currentTarget.scrollLeft = drag.pendingScrollLeft;
        }
        event.currentTarget.classList.remove('is-dragging');
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (drag.moved) {
            window.setTimeout(() => {
                opportunityDragRef.current.moved = false;
            }, 0);
        }
    };

    useEffect(() => {
        const accessToken = session?.access_token;
        if (!accessToken) return undefined;

        let cancelled = false;
        const prepareNetworkIntelligence = () => {
            if (cancelled) return;
            void prefetchNetworkIntelligence(accessToken).catch((error) => {
                console.warn('Could not prefetch Network Intelligence:', error);
            });
        };

        if (typeof window.requestIdleCallback === 'function') {
            const idleId = window.requestIdleCallback(prepareNetworkIntelligence, { timeout: 500 });
            return () => {
                cancelled = true;
                window.cancelIdleCallback(idleId);
            };
        }

        const timerId = window.setTimeout(prepareNetworkIntelligence, 0);
        return () => {
            cancelled = true;
            window.clearTimeout(timerId);
        };
    }, [session?.access_token]);

    useEffect(() => {
        const standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;

        const maximizeTimer = window.setTimeout(() => {
            if (!standalone) return;

            const { availWidth, availHeight } = window.screen;
            if (availWidth !== window.outerWidth || availHeight !== window.outerHeight) {
                try {
                    window.moveTo(window.screen.availLeft ?? 0, window.screen.availTop ?? 0);
                    window.resizeTo(availWidth, availHeight);
                } catch (_error) {
                    // Chrome can deny window management; it will retain the last PWA window size.
                }
            }
        }, 0);

        const handleKey = (event) => {
            if (event.key === 'Escape') {
                setSidebarOpen(false);
                return;
            }

            if (!event.repeat && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                if (!document.fullscreenElement) {
                    const request = document.documentElement.requestFullscreen?.();
                    request?.catch(() => {});
                } else {
                    const exit = document.exitFullscreen?.();
                    exit?.catch(() => {});
                }
            }
        };

        const desktopQuery = window.matchMedia('(min-width: 1025px)');
        const handleDesktopChange = (event) => {
            if (event.matches) setSidebarOpen(false);
        };

        document.addEventListener('keydown', handleKey);
        desktopQuery.addEventListener('change', handleDesktopChange);

        return () => {
            window.clearTimeout(maximizeTimer);
            document.removeEventListener('keydown', handleKey);
            desktopQuery.removeEventListener('change', handleDesktopChange);
        };
    }, []);

    const handleNav = (id, action = null) => {
        setActiveSection(id);
        if (window.matchMedia('(max-width: 1024px)').matches) {
            setSidebarOpen(false);
        }
        const url = new URL(window.location);
        url.searchParams.set('section', id);
        if (action) {
            url.searchParams.set('action', action);
        } else {
            url.searchParams.delete('action');
        }
        window.history.pushState({}, '', url);
    };

    const handleLogout = async () => { await supabase.auth.signOut(); };

    // Blocking Loading State (Clean, no glitchy skeletons)
    if (loading) return (
        <div className="loading-screen">
            <LoadingState message="Loading Dashboard..." />
        </div>
    );

    if (!session && !connectionError) return (
        <div className="loading-screen">
            <LoadingState message="Redirecting to login..." />
        </div>
    );

    if (connectionError) {
        return (
            <div className="loading-screen" style={{ flexDirection: 'column', gap: '1rem', fontFamily: 'var(--font-sans)' }}>
                <div style={{ textAlign: 'center', maxWidth: '320px' }}>
                    <h1 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: '0 0 0.55rem 0' }}>
                        Creator Studio could not open
                    </h1>
                    <p role="alert" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
                        {connectionError}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                        <a
                            href="/resources"
                            style={{
                                fontSize: '0.875rem',
                                padding: '0.5rem 1.25rem',
                                textDecoration: 'none',
                                background: 'var(--text-primary)',
                                color: 'var(--bg-color)',
                                borderRadius: '6px',
                                fontWeight: 500
                            }}
                        >
                            Open Resources Hub
                        </a>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-tertiary)',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            Try reloading
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`admin-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
            <button
                type="button"
                className="sidebar-backdrop"
                aria-label="Close admin navigation"
                tabIndex={sidebarOpen ? 0 : -1}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar Navigation */}
            <aside id="admin-sidebar" className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
                <div className="sidebar-header">
                    <button type="button" className="brand-title" onClick={() => handleNav('dashboard')}>
                        <span className="brand-mark" aria-hidden="true">A</span>
                        <span className="brand-copy">
                            <strong>Creator Studio</strong>
                            <small>Abodid Sahoo</small>
                        </span>
                    </button>
                    <button
                        type="button"
                        className="sidebar-toggle"
                        aria-controls="admin-sidebar"
                        aria-expanded={sidebarOpen}
                        aria-label={sidebarOpen ? 'Collapse admin navigation' : 'Expand admin navigation'}
                        title={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'}
                        onClick={() => setSidebarOpen((open) => !open)}
                    >
                        {sidebarOpen
                            ? <X size={19} strokeWidth={1.8} aria-hidden="true" />
                            : <Menu size={19} strokeWidth={1.8} aria-hidden="true" />}
                    </button>
                </div>

                <nav className="sidebar-nav" aria-label="Creator Studio">
                    {NAV_GROUPS.map((group) => {
                        const groupIsActive = group.id === activeDestination.groupId;
                        return (
                            <section
                                key={group.id}
                                className={`nav-group ${groupIsActive ? 'is-current' : ''}`}
                                aria-labelledby={`nav-group-${group.id}`}
                            >
                                <h2 id={`nav-group-${group.id}`} className="nav-group-label">
                                    {group.label}
                                    {groupIsActive && <span className="sr-only">, current group</span>}
                                </h2>
                                <div className="nav-group-items">
                                    {group.sections.map((section) => (
                                        <button
                                            key={section.id}
                                            type="button"
                                            onClick={() => handleNav(section.id)}
                                            className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
                                            aria-current={activeSection === section.id ? 'page' : undefined}
                                            aria-label={section.label}
                                            title={section.label}
                                        >
                                            <span className="nav-icon" aria-hidden="true"><LineIcon icon={section.icon} /></span>
                                            <span className="nav-label">{section.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <a href="/resources" target="_blank" rel="noreferrer" className="btn-curator-link" aria-label="View Curation by Abodid">
                        <Library size={15} strokeWidth={1.7} aria-hidden="true" />
                        <span>View Resource Hub</span>
                    </a>
                    <button onClick={handleLogout} className="btn-logout-sidebar" aria-label="Sign out">
                        <LogOut size={15} strokeWidth={1.7} aria-hidden="true" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className={`main-content ${activeSection === 'dashboard' ? 'dashboard-main' : ''} ${activeSection === 'analytics' || activeSection === 'reading_digest' || activeSection === 'network_intelligence' || activeSection === 'portfolio_projects' || activeSection === 'lab_experiments' || activeSection === 'home_cards' || activeSection === 'design_system' || activeSection === 'xr_showcase' || activeSection === 'hub_resources' || activeSection === 'media_library' || activeSection === 'users' || activeSection === 'brands' || activeSection === 'photography' || activeSection === 'photo_stories' || activeSection === 'moodboard_items' || activeSection === 'films' || activeSection === 'blog' || activeSection === 'research' || activeSection === 'newsletter' || activeSection === 'page_metadata' ? 'admin-page-main' : ''}`}>
                <div className="mobile-studio-bar">
                    <button
                        type="button"
                        className="mobile-menu-button"
                        aria-controls="admin-sidebar"
                        aria-expanded={sidebarOpen}
                        aria-label="Open Creator Studio navigation"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu size={19} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                    <span className="mobile-location">
                        <small>{activeNavGroup.label}</small>
                        <strong>{activeDestination.label}</strong>
                    </span>
                </div>
                <div className="content-body">
                    {activeSection === 'dashboard' && (
                        <div className="studio-home">
                            <section className="studio-home-hero admin-page-intro" aria-labelledby="dashboard-greeting">
                                <AdminPageHeader
                                    className="dashboard-greeting"
                                    headingId="dashboard-greeting"
                                    title="Abodid's Creator Studio"
                                    description="This is where the magic happens."
                                />
                            </section>

                            <section className="studio-home-grid" aria-label="Studio shortcuts">
                                <article className="studio-frame-card opportunity-focus-card">
                                    <header className="studio-card-heading">
                                        <span className="studio-card-icon" aria-hidden="true"><CalendarClock size={20} strokeWidth={1.7} /></span>
                                        <div>
                                            <h2>Needs attention</h2>
                                        </div>
                                    </header>
                                    <div
                                        className="opportunity-focus-list"
                                        aria-live="polite"
                                        aria-label="Priority opportunities. Scroll horizontally for more."
                                        tabIndex={0}
                                        onPointerDown={handleOpportunityStripPointerDown}
                                        onPointerMove={handleOpportunityStripPointerMove}
                                        onPointerUp={handleOpportunityStripPointerEnd}
                                        onPointerCancel={handleOpportunityStripPointerEnd}
                                        onDragStart={(event) => event.preventDefault()}
                                    >
                                        {opportunityFocus.loading && [0, 1, 2].map((index) => (
                                            <article key={index} className="opportunity-focus-row is-loading" aria-hidden="true">
                                                <span className="opportunity-loading-line is-deadline" />
                                                <span className="opportunity-loading-line is-title" />
                                                <span className="opportunity-loading-line is-copy" />
                                                <span className="opportunity-loading-line is-link" />
                                            </article>
                                        ))}
                                        {!opportunityFocus.loading && opportunityFocus.error && (
                                            <p className="studio-card-state is-error">Opportunities could not be loaded. Open the dashboard to review them.</p>
                                        )}
                                        {!opportunityFocus.loading && !opportunityFocus.error && opportunityFocus.items.length === 0 && (
                                            <p className="studio-card-state">Nothing needs attention in the next seven days.</p>
                                        )}
                                        {opportunityFocus.items.map((opportunity) => (
                                            <OpportunityFocusRow
                                                key={opportunity.id}
                                                opportunity={opportunity}
                                                onOpen={() => {
                                                    if (opportunityDragRef.current.moved) {
                                                        opportunityDragRef.current.moved = false;
                                                        return;
                                                    }
                                                    setSelectedOpportunity(opportunity);
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <a className="studio-card-link" href="/opportunities" target="_blank" rel="noreferrer">
                                        Check all Opportunities.
                                        <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
                                    </a>
                                </article>

                                <article className="studio-frame-card studio-media-card admin-accent-surface">
                                    <span className="studio-card-icon is-inverted" aria-hidden="true"><FolderOpen size={22} strokeWidth={1.7} /></span>
                                    <div className="studio-card-copy">
                                        <h2>Media Library</h2>
                                        <span>Find, upload and reuse your visual assets.</span>
                                    </div>
                                    <button type="button" className="studio-card-button is-on-cobalt" onClick={() => handleNav('media_library')}>
                                        Open Media Library
                                        <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
                                    </button>
                                </article>

                                <article className="studio-frame-card studio-moodboard-card">
                                    <span className="studio-card-icon" aria-hidden="true"><Images size={22} strokeWidth={1.7} /></span>
                                    <div className="studio-card-copy">
                                        <h2>Add to moodboard</h2>
                                        <span>Upload a JPEG/PNG/WebP/GIF to your moodboard.</span>
                                    </div>
                                    <div className="studio-card-actions">
                                        <input
                                            ref={moodboardFileInputRef}
                                            className="sr-only"
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            aria-hidden="true"
                                            tabIndex={-1}
                                            onChange={(event) => {
                                                const files = Array.from(event.target.files || []);
                                                event.target.value = '';
                                                if (!files.length) return;
                                                setMoodboardInitialFiles(files);
                                                handleNav('moodboard_items', 'upload');
                                            }}
                                        />
                                        <button type="button" className="studio-card-button" onClick={() => moodboardFileInputRef.current?.click()}>
                                            Add images
                                        </button>
                                    </div>
                                </article>

                                <article className="studio-frame-card studio-analytics-card">
                                    <div className="studio-analytics-summary">
                                        <span className="studio-card-icon" aria-hidden="true"><ChartNoAxesCombined size={22} strokeWidth={1.7} /></span>
                                        <div className="studio-card-copy">
                                            <h2>Analytics</h2>
                                            <span className="studio-visitor-count" aria-live="polite">
                                                {analyticsSnapshot.loading
                                                    ? 'Loading recent visitors…'
                                                    : `${analyticsSnapshot.visitorCount.toLocaleString('en-GB')} ${analyticsSnapshot.visitorCount === 1 ? 'visitor' : 'visitors'} in the last 7 days`}
                                            </span>
                                        </div>
                                        <button type="button" className="studio-card-button" onClick={() => handleNav('analytics')}>
                                            View Analytics
                                            <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
                                        </button>
                                    </div>
                                    <RecentVisitorCarousel
                                        snapshot={analyticsSnapshot}
                                        onOpenAnalytics={() => handleNav('analytics')}
                                    />
                                </article>

                                <article className="studio-frame-card studio-curator-card">
                                    <span className="studio-card-icon" aria-hidden="true"><Library size={22} strokeWidth={1.7} /></span>
                                    <div className="studio-card-copy">
                                        <h2>Curator Dashboard</h2>
                                        <span>Manage the resources collected for your public hub.</span>
                                    </div>
                                    <div className="studio-card-actions">
                                        <button type="button" className="studio-card-button" onClick={() => handleNav('hub_resources')}>
                                            Open Dashboard
                                        </button>
                                        <a className="studio-card-text-button" href="/resources" target="_blank" rel="noreferrer">
                                            View public hub
                                        </a>
                                    </div>
                                </article>
                            </section>

                            <WorldClockPanel />
                        </div>
                    )}

                    {activeSection === 'users' && (
                        <SectionErrorBoundary>
                            <UserList />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'analytics' && (
                        <SectionErrorBoundary>
                            <AnalyticsDashboard accessToken={session?.access_token} />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'reading_digest' && (
                        <SectionErrorBoundary>
                            <ReadingDigestManager />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'network_intelligence' && (
                        <SectionErrorBoundary>
                            <NetworkIntelligence accessToken={session?.access_token} />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'portfolio_projects' && (
                        <SectionErrorBoundary>
                            <PortfolioAdminList embedded />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'lab_experiments' && (
                        <SectionErrorBoundary>
                            <LabExperimentsManager />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'home_cards' && (
                        <SectionErrorBoundary>
                            <HomeCardsManager />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'design_system' && (
                        <SectionErrorBoundary>
                            <DesignStudio />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'xr_showcase' && (
                        <SectionErrorBoundary>
                            <XRShowcaseManager accessToken={session?.access_token} />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'hub_resources' && (
                        <SectionErrorBoundary>
                            <AdminResourceManager />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'photography' && (
                        <SectionErrorBoundary>
                            <PhotographyManager />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'media_library' && (
                        <SectionErrorBoundary>
                            <MediaLibrary accessToken={session?.access_token} />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'brands' && (
                        <SectionErrorBoundary>
                            <BrandManager />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'newsletter' && (
                        <div className="newsletter-section">
                            <NewsletterSender
                                accessToken={session?.access_token}
                                exhibitionSample={newsletterExhibition.sample}
                                exhibitionMediaReady={newsletterExhibition.ready}
                            />
                        </div>
                    )}

                    {activeSection === 'photo_stories' && (
                        <SectionErrorBoundary>
                            <PhotoStoryManager />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'moodboard_items' && (
                        <SectionErrorBoundary>
                            <MoodboardManager
                                accessToken={session?.access_token}
                                initialFiles={moodboardInitialFiles}
                                onInitialFilesConsumed={() => setMoodboardInitialFiles([])}
                            />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'films' && (
                        <SectionErrorBoundary>
                            <FilmManager />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'research' && (
                        <SectionErrorBoundary>
                            <ResearchManager />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'page_metadata' && (
                        <SectionErrorBoundary>
                            <SeoStudio />
                        </SectionErrorBoundary>
                    )}

                    {activeSection === 'blog' && (
                        <SectionErrorBoundary>
                            <BlogAdminList />
                        </SectionErrorBoundary>
                    )}

                    {activeSection !== 'dashboard' && activeSection !== 'analytics' && activeSection !== 'reading_digest' && activeSection !== 'network_intelligence' && activeSection !== 'portfolio_projects' && activeSection !== 'lab_experiments' && activeSection !== 'home_cards' && activeSection !== 'design_system' && activeSection !== 'xr_showcase' && activeSection !== 'hub_resources' && activeSection !== 'photography' && activeSection !== 'media_library' && activeSection !== 'users' && activeSection !== 'brands' && activeSection !== 'newsletter' && activeSection !== 'photo_stories' && activeSection !== 'moodboard_items' && activeSection !== 'films' && activeSection !== 'research' && activeSection !== 'page_metadata' && activeSection !== 'blog' && (
                        <SectionErrorBoundary key={activeSection}>
                            <ListView
                                table={activeSection}
                                title={SECTIONS.find(s => s.id === activeSection)?.label}
                                onCreate={null}
                            />
                        </SectionErrorBoundary>
                    )}
                </div>
            </main>

            {selectedOpportunity && (
                <div className="opportunity-modal-host">
                    <OpportunityDetailModal
                        opportunity={selectedOpportunity}
                        isOpen={true}
                        isAuthenticated={false}
                        onClose={() => setSelectedOpportunity(null)}
                        onUpdateStatus={async () => {}}
                        onEdit={() => {}}
                        onReExtract={async () => {}}
                        onDelete={async () => {}}
                        onNavigateNext={() => {
                            const currentIndex = opportunityFocus.items.findIndex((item) => item.id === selectedOpportunity.id);
                            const nextIndex = (currentIndex + 1) % opportunityFocus.items.length;
                            setSelectedOpportunity(opportunityFocus.items[nextIndex]);
                        }}
                        onNavigatePrev={() => {
                            const currentIndex = opportunityFocus.items.findIndex((item) => item.id === selectedOpportunity.id);
                            const previousIndex = (currentIndex - 1 + opportunityFocus.items.length) % opportunityFocus.items.length;
                            setSelectedOpportunity(opportunityFocus.items[previousIndex]);
                        }}
                        currentIndex={opportunityFocus.items.findIndex((item) => item.id === selectedOpportunity.id) + 1}
                        totalCount={opportunityFocus.items.length}
                    />
                </div>
            )}

            <style>{`
                :root {
                    --sidebar-width: 248px;
                    --header-height: 56px;
                }

                .loading-screen { 
                    height: 100vh; display: flex; align-items: center; justify-content: center; 
                    color: var(--text-secondary); font-family: var(--font-sans);
                }

                .admin-layout {
                    display: flex;
                    width: 100%;
                    min-width: 0;
                    min-height: 100vh;
                    background-color: var(--bg-color);
                    color: var(--text-primary);
                    font-family: var(--font-sans);
                }

                .section-error {
                    border: 1px solid rgba(239, 68, 68, 0.35);
                    border-radius: 8px;
                    background: rgba(239, 68, 68, 0.08);
                    color: var(--text-primary);
                    padding: 1rem;
                }

                .section-error h3 {
                    margin: 0 0 0.5rem 0;
                    font-size: 1rem;
                }

                .section-error p {
                    margin: 0 0 1rem 0;
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                    line-height: 1.5;
                }

                .section-error button {
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    background: var(--text-primary);
                    color: var(--bg-color);
                    cursor: pointer;
                    font-size: 0.85rem;
                    padding: 0.55rem 0.9rem;
                }

                /* Sidebar Styles */
                .sidebar {
                    width: var(--sidebar-width);
                    background: var(--bg-surface);
                    border-right: 1px solid var(--border-subtle);
                    display: flex;
                    flex-direction: column;
                    padding: 0; /* Padding handled by children for alignment */
                    position: fixed;
                    height: 100vh;
                    left: 0; top: 0;
                    box-sizing: border-box;
                    z-index: 50;
                    transition: width 0.22s ease, box-shadow 0.22s ease;
                }

                .sidebar-backdrop,
                .sidebar-toggle { display: none; }

                .sidebar-header { 
                    height: auto;
                    min-height: 0;
                    margin-top: 0;
                    padding: calc(3.3rem + var(--admin-page-title-line-size)) 1.5rem 1.75rem;
                    display: flex; align-items: flex-start;
                }

                .brand-title { 
                    font-size: var(--admin-page-subtitle-size); font-weight: 600; line-height: 1.35; margin: 0;
                    letter-spacing: -0.03em; color: var(--text-primary); white-space: nowrap;
                }
                
                .sidebar-nav {
                    display: flex; flex-direction: column; gap: 0.08rem; flex: 1;
                    min-height: 0; overflow-y: auto; padding: 0 1.25rem;
                }
                .nav-item {
                    display: flex; align-items: center; gap: 0.7rem; padding: 0.43rem 0.75rem;
                    border: 1px solid transparent; background: transparent; color: var(--text-secondary);
                    border-radius: 7px; cursor: pointer; transition: background 0.15s ease, color 0.15s ease;
                    text-align: left; text-decoration: none; font: inherit; font-size: 0.84rem; font-weight: 500;
                }
                .nav-item:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
                .nav-item.active { background: var(--bg-surface-hover); color: var(--text-primary); border-color: var(--border-subtle); font-weight: 600; }
                .nav-item:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
                .nav-icon { display: flex; align-items: center; justify-content: center; width: 20px; color: var(--text-tertiary); }
                .nav-item.active .nav-icon,
                .nav-item:hover .nav-icon { color: currentColor; }

                .sidebar-footer {
                    flex-shrink: 0; margin-top: auto; padding: 0.75rem 1.25rem 1.25rem;
                    border-top: 1px solid var(--border-subtle); background: var(--bg-surface);
                }
                .btn-curator-link {
                    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
                    padding: 0.6rem; margin-bottom: 0.5rem; background: var(--bg-surface-hover);
                    border-radius: 7px; text-decoration: none; color: var(--text-secondary);
                    font-size: 0.78rem; font-weight: 500;
                }
                .btn-logout-sidebar {
                    width: 100%; padding: 0.65rem; background: transparent; border: 1px solid var(--border-strong);
                    color: var(--text-primary); border-radius: 7px; cursor: pointer; font-weight: 600;
                    text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.68rem; transition: all 0.2s;
                    display: flex; align-items: center; justify-content: center; gap: 0.45rem;
                }
                .btn-logout-sidebar:hover { background: var(--text-primary); color: var(--bg-color); }

                /* Main Content Styles */
                .main-content {
                    flex: 0 0 calc(100vw - var(--sidebar-width));
                    width: calc(100vw - var(--sidebar-width));
                    max-width: none;
                    min-width: 0;
                    margin-left: var(--sidebar-width);
                    padding: 2rem 3rem;
                }
                .content-body,
                .main-content .newsletter-section { width: 100%; min-width: 0; }
                .main-content.dashboard-main {
                    height: 100vh;
                    min-height: 0;
                    overflow: hidden;
                    padding: 1.25rem 2rem;
                    box-sizing: border-box;
                }
                .dashboard-main .content-body {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    min-height: 0;
                    overflow: hidden;
                }
                .content-header {
                    height: var(--header-height); display: flex; align-items: center;
                    justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid var(--border-subtle);
                }
                .section-title { font-size: 1.6rem; font-weight: 550; margin: 0; letter-spacing: -0.02em; }
                .btn-create-primary {
                    background: var(--text-primary); color: var(--bg-color); border: none; padding: 0.8rem 1.5rem;
                    border-radius: 8px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; font-size: 0.9rem;
                }
                .btn-create-primary:hover { opacity: 0.9; }

                /* Overview Grid */
                .overview-grid {
                    display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 1.35rem;
                    grid-template-rows: auto auto auto; height: 100%;
                    align-content: start; align-items: stretch; min-height: 0; animation: fadeIn 0.3s ease;
                }
                .dashboard-panel {
                    min-width: 0; background: var(--bg-surface); border: var(--admin-panel-border);
                    border-radius: var(--admin-panel-radius); overflow: hidden;
                }
                .quick-actions-panel { grid-column: 1 / -1; }
                .panel-heading {
                    min-height: 46px; padding: 0.72rem 1rem; border-bottom: 1px solid var(--border-subtle);
                    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
                }
                .panel-heading h3 { margin: 0; font-size: 0.88rem; font-weight: 620; color: var(--text-primary); }
                .panel-heading > span {
                    font-size: 0.6rem; font-weight: 550; color: var(--text-tertiary);
                    text-transform: uppercase; letter-spacing: 0.07em; white-space: nowrap;
                }

                .quick-actions-grid {
                    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem;
                    padding: 1rem;
                }
                .quick-action-card {
                    min-width: 0; min-height: 104px; padding: 1.1rem 1.2rem;
                    display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; align-items: center; gap: 0.9rem;
                    border: 1px solid var(--border-subtle); border-radius: 12px;
                    background: var(--bg-color); color: var(--text-primary); text-decoration: none;
                    transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
                }
                .quick-action-card:hover {
                    border-color: var(--border-strong); background: var(--bg-surface-hover); transform: translateY(-1px);
                }
                .quick-action-card:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
                .quick-action-icon {
                    width: 42px; height: 42px; display: grid; place-items: center; border-radius: 11px;
                    border: 1px solid var(--border-subtle); color: var(--text-secondary);
                    background: var(--bg-surface);
                }
                .quick-action-copy { min-width: 0; display: flex; flex-direction: column; gap: 0.22rem; }
                .quick-action-copy strong { font-size: clamp(1.08rem, 1.25vw, 1.28rem); font-weight: 640; line-height: 1.22; }
                .quick-action-card > svg { color: var(--text-tertiary); }

                .world-clock-section {
                    grid-column: 1 / -1; min-height: 0; display: flex; flex-direction: column;
                }
                .world-clock-heading h3 { display: inline-flex; align-items: center; gap: 0.45rem; }
                .world-clock-grid {
                    min-height: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); align-items: start; gap: 0.9rem;
                    padding: 1rem; background: var(--bg-surface);
                }
                .world-clock-item {
                    min-width: 0; min-height: 0; aspect-ratio: 1 / 1; padding: 1.35rem;
                    display: flex; flex-direction: column; justify-content: space-between; gap: 1.5rem;
                    border-radius: 13px; overflow: hidden; color: #22170f;
                }
                .world-clock-item.is-adaptive-clock { display: none; }
                .world-clock-item.is-sunrise {
                    background: linear-gradient(145deg, #fff1d7 0%, #ffd7c8 52%, #f4c7df 100%);
                }
                .world-clock-item.is-day {
                    background: linear-gradient(145deg, #fff8d9 0%, #ffe7ad 48%, #d9efff 100%);
                }
                .world-clock-item.is-sunset {
                    background: linear-gradient(145deg, #f7b788 0%, #b46b8d 52%, #51416f 100%);
                    color: #fff8f3;
                }
                .world-clock-item.is-night {
                    background: linear-gradient(145deg, #111321 0%, #080911 55%, #020204 100%);
                    color: #f7f4ff;
                }
                .world-clock-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.7rem; }
                .world-clock-top > span:first-child { min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
                .world-clock-city { min-width: 0; font-size: clamp(1.05rem, 1.35vw, 1.35rem); font-weight: 680; letter-spacing: -0.025em; white-space: nowrap; }
                .world-clock-day { color: currentColor; opacity: 0.62; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.09em; }
                .world-clock-icon {
                    width: 32px; height: 32px; flex: 0 0 32px; display: grid; place-items: center;
                    border: 1px solid color-mix(in srgb, currentColor 24%, transparent); border-radius: 50%;
                }
                .is-sunrise .world-clock-icon { color: #c65d3b; background: rgba(255, 255, 255, 0.32); }
                .is-day .world-clock-icon { color: #b26d00; background: rgba(255, 255, 255, 0.34); }
                .is-sunset .world-clock-icon,
                .is-night .world-clock-icon { color: currentColor; background: rgba(255, 255, 255, 0.08); }
                .world-clock-time {
                    font-size: clamp(1.75rem, 2.45vw, 2.65rem); font-weight: 300; line-height: 0.95;
                    letter-spacing: -0.055em; font-variant-numeric: tabular-nums; font-family: var(--font-sans);
                }

                .dashboard-launch-section {
                    grid-column: 1 / -1; display: flex; flex-direction: column; align-items: flex-start;
                    gap: 0.8rem;
                }
                .dashboard-greeting {
                    min-width: 0; padding: 0;
                    display: flex; flex-direction: column; justify-content: center;
                }
                .destination-actions { min-width: 0; display: flex; align-items: center; justify-content: flex-start; flex-wrap: wrap; gap: 0.65rem; }
                .destination-card {
                    width: auto; min-width: 0; min-height: 42px; padding: 0.55rem 0.75rem;
                    display: grid; grid-template-columns: 30px max-content auto; align-items: center; gap: 0.6rem;
                    border: 1px solid transparent; border-radius: 10px; text-decoration: none;
                    transition: background-color 0.16s ease, border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
                }
                .destination-card strong { font-size: 0.82rem; font-weight: 680; line-height: 1.2; }
                .destination-icon {
                    width: 30px; height: 30px; display: grid; place-items: center;
                    border: 1px solid currentColor; border-radius: 8px; opacity: 0.92;
                }
                .destination-icon svg { width: 16px; height: 16px; }
                .destination-card > svg { width: 15px; height: 15px; }
                .destination-card-primary { background: #a30021; border-color: #a30021; color: #fff; }
                .destination-card-primary:hover {
                    background: #760018; border-color: #760018; color: #fff;
                    box-shadow: 0 10px 26px rgba(118, 0, 24, 0.24); transform: translateY(-2px);
                }
                .destination-card-secondary { background: #f7f3ed; border-color: #d9d1c7; color: #171512; }
                .destination-card-secondary:hover {
                    background: #fff; border-color: #8b8176; color: #090807;
                    box-shadow: 0 10px 26px rgba(23, 21, 18, 0.12); transform: translateY(-2px);
                }
                .destination-card:focus-visible { outline: 3px solid var(--border-focus); outline-offset: 3px; }

                /* List View Styles - Card Rows */
                .list-container { 
                    animation: fadeIn 0.3s ease; 
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .list-row-card {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    padding: 1.25rem 1.5rem;
                    transition: all 0.2s ease;
                }
                
                .list-row-card:hover {
                    transform: translateY(-1px);
                    border-color: var(--text-secondary);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                }

                .row-main-info {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    min-width: 0; /* ellipsis fix */
                }

                .row-title {
                    font-weight: 600;
                    font-size: 1rem;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .status-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 0.4rem 0.85rem;
                    border-radius: 100px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                }
                .status-pill.published { background: #dcfce7; color: #166534; }
                .status-pill.draft { background: var(--bg-surface-hover); color: var(--text-secondary); border: 1px solid var(--border-subtle); }
                
                .status-dot-inner { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

                .row-actions { 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    margin-left: 2rem;
                }
                
                .btn-action-box { 
                    background: transparent;
                    border: 1px solid var(--border-subtle); 
                    cursor: pointer; 
                    color: var(--text-primary); 
                    font-size: 0.85rem; 
                    font-weight: 500; 
                    text-decoration: none; 
                    padding: 0.5rem 1rem;
                    border-radius: 6px; 
                    transition: all 0.2s;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
                
                .btn-action-box:hover { 
                    background: var(--text-primary); 
                    color: var(--bg-color);
                    border-color: var(--text-primary);
                }
                
                .btn-action-box.delete:hover { 
                    background: #fee2e2; 
                    color: #ef4444; 
                    border-color: #ef4444;
                }
                
                .btn-action-box.toggle-live {
                    border-color: #10B981;
                    color: #10B981;
                }
                .btn-action-box.toggle-live:hover {
                    background: #10B981;
                    color: white;
                }
                
                .btn-action-box.toggle-draft {
                    border-color: var(--text-tertiary);
                    color: var(--text-secondary);
                }

                /* Skeletons */
                .skeleton { background: var(--bg-surface-hover); animation: pulse 1.5s infinite; border-radius: 4px; }
                .skeleton.text { height: 1em; width: 60%; }
                .skeleton.circle { width: 32px; height: 32px; border-radius: 50%; }
                .skeleton.rect { height: 100%; width: 100%; }
                @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 0.3; } 100% { opacity: 0.5; } }

                @media (max-height: 650px) and (min-width: 1025px) {
                    .main-content.dashboard-main { padding-top: 0.9rem; padding-bottom: 0.9rem; }
                    .sidebar-header { padding-top: 4.25rem; }
                    .overview-grid { gap: 0.7rem; }
                    .quick-action-card { min-height: 84px; }
                    .world-clock-grid { padding: 0.7rem; }
                    .world-clock-item { padding: 1rem; }
                }
                @media (min-width: 1800px) {
                    .world-clock-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
                    .world-clock-item.is-adaptive-clock { display: flex; }
                }
                @media (min-width: 1181px) and (max-width: 1540px) {
                    .world-clock-grid { gap: 0.65rem; padding: 0.75rem; }
                    .world-clock-item { padding: 0.8rem; gap: 0.75rem; }
                    .world-clock-city { font-size: 0.88rem; }
                    .world-clock-icon { width: 26px; height: 26px; flex-basis: 26px; }
                    .world-clock-icon svg { width: 14px; height: 14px; }
                    .world-clock-time { font-size: clamp(1.3rem, 2.25vw, 2.1rem); }
                }
                @media (max-width: 1180px) {
                    .main-content.dashboard-main {
                        height: auto; min-height: 100vh; overflow: visible; padding: 1.5rem;
                    }
                    .dashboard-main .content-body { height: auto; overflow: visible; }
                    .overview-grid { height: auto; }
                    .quick-actions-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
                    .quick-action-card {
                        min-height: 64px; padding: 1rem 1.1rem;
                        display: flex; align-items: center;
                        border-radius: 10px; transform: none;
                    }
                    .quick-action-card:hover { transform: none; }
                    .quick-action-icon,
                    .quick-action-card > svg { display: none; }
                    .quick-action-copy strong {
                        font-size: 0.98rem; font-weight: 620; line-height: 1.3;
                    }
                    .world-clock-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                    .world-clock-item.is-adaptive-clock { display: flex; }
                }
                @media (max-width: 899px) {
                    :root { --sidebar-width: 72px; }
                    .sidebar {
                        width: var(--sidebar-width); overflow: hidden;
                        box-shadow: none;
                    }
                    .sidebar.is-open {
                        width: min(286px, calc(100vw - 1rem));
                        box-shadow: 20px 0 45px rgba(0, 0, 0, 0.3);
                    }
                    .sidebar-backdrop {
                        display: block; position: fixed; inset: 0; z-index: 45;
                        border: 0; background: rgba(0, 0, 0, 0.5); opacity: 0;
                        pointer-events: none; transition: opacity 0.22s ease;
                    }
                    .admin-layout.sidebar-open .sidebar-backdrop { opacity: 1; pointer-events: auto; }
                    .sidebar-header {
                        min-height: 72px; padding: 1rem; align-items: center; justify-content: center;
                    }
                    .brand-title,
                    .nav-label,
                    .btn-curator-link span,
                    .btn-logout-sidebar span { display: none; }
                    .sidebar.is-open .brand-title,
                    .sidebar.is-open .nav-label,
                    .sidebar.is-open .btn-curator-link span,
                    .sidebar.is-open .btn-logout-sidebar span { display: inline; }
                    .sidebar.is-open .sidebar-header { justify-content: space-between; padding: 1rem 1.25rem; }
                    .sidebar-toggle {
                        display: grid; width: 38px; height: 38px; flex: 0 0 38px; place-items: center;
                        padding: 0; border: 1px solid var(--border-subtle); border-radius: 9px;
                        background: var(--bg-color); color: var(--text-primary); cursor: pointer;
                    }
                    .sidebar-toggle:hover { background: var(--bg-surface-hover); }
                    .sidebar-toggle:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }
                    .sidebar-nav { gap: 0.3rem; padding: 0 0.75rem; overflow-x: hidden; }
                    .nav-item { width: 100%; min-height: 44px; justify-content: center; gap: 0.7rem; padding: 0.6rem; }
                    .sidebar.is-open .nav-item { justify-content: flex-start; padding-inline: 0.75rem; }
                    .nav-icon { width: 22px; flex: 0 0 22px; }
                    .sidebar-footer { padding: 0.75rem; }
                    .btn-curator-link,
                    .btn-logout-sidebar { min-height: 42px; padding: 0.6rem; }
                    .main-content { padding: 1.5rem; }
                    .world-clock-section { grid-column: 1 / -1; }
                    .quick-actions-panel { grid-column: 1 / -1; }
                    .overview-grid { flex: none; }
                    .dashboard-launch-section { align-items: flex-start; }
                }
                @media (max-width: 899px) {
                    :root { --sidebar-width: 60px; }
                    .sidebar-header { min-height: 64px; padding: 0.7rem; }
                    .sidebar.is-open { width: min(292px, calc(100vw - 0.75rem)); }
                    .sidebar-nav { padding-inline: 0.5rem; }
                    .sidebar-footer { padding: 0.5rem; }
                    .main-content { padding: 1rem; }
                    .main-content.dashboard-main { padding: 1rem; }
                }
                @media (max-width: 640px) {
                    .quick-actions-grid { grid-template-columns: 1fr; }
                    .world-clock-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .destination-actions { align-items: stretch; }
                    .destination-card { flex: 1 1 100%; min-height: 48px; }
                }
                @media (max-width: 560px) {
                    .world-clock-grid { gap: 0.65rem; padding: 0.75rem; }
                    .world-clock-item { min-height: 0; aspect-ratio: 1 / 1; padding: 0.8rem; gap: 0.75rem; }
                    .world-clock-city { font-size: 0.88rem; }
                    .world-clock-icon { width: 26px; height: 26px; flex-basis: 26px; }
                    .world-clock-icon svg { width: 14px; height: 14px; }
                    .world-clock-time { font-size: clamp(1.3rem, 7vw, 1.8rem); }
                    .list-row-card { align-items: flex-start; gap: 1rem; padding: 1rem; }
                    .row-main-info { align-items: flex-start; flex-direction: column; gap: 0.6rem; }
                    .row-actions { margin-left: 0; }
                }

                /* Creator Studio shell refresh */
                :root { --sidebar-width: 276px; }

                .admin-layout { background: var(--bg-color); }
                .sidebar {
                    width: var(--sidebar-width);
                    background: var(--bg-surface);
                    border-color: var(--border-subtle);
                }
                .sidebar-header {
                    min-height: 82px;
                    padding: 1.1rem 1rem 0.8rem;
                    align-items: center;
                }
                .brand-title {
                    width: 100%; min-width: 0; display: flex; align-items: center; gap: 0.75rem;
                    padding: 0.45rem; border: 0; border-radius: 11px; background: transparent;
                    color: var(--text-primary); cursor: pointer; text-align: left;
                }
                .brand-title:hover { background: var(--bg-surface-hover); }
                .brand-mark {
                    width: 38px; height: 38px; flex: 0 0 38px; display: grid; place-items: center;
                    border-radius: 10px; background: var(--admin-cobalt); color: #fff;
                    font-size: 1rem; font-weight: 750; letter-spacing: -0.04em;
                    box-shadow: 0 7px 18px rgba(36, 68, 202, 0.2);
                }
                .brand-copy { min-width: 0; display: grid; gap: 0.05rem; }
                .brand-copy strong { font-size: 0.92rem; font-weight: 700; letter-spacing: -0.025em; }
                .brand-copy small { color: var(--text-tertiary); font-size: 0.66rem; font-weight: 550; letter-spacing: 0.025em; }

                .sidebar-nav {
                    gap: 1.05rem; padding: 0.65rem 0.8rem 1.4rem; scrollbar-gutter: stable;
                }
                .nav-group { display: grid; gap: 0.35rem; }
                .nav-group-label {
                    margin: 0; padding: 0 0.65rem; color: var(--text-tertiary);
                    font-size: 0.61rem; font-weight: 750; line-height: 1.4;
                    letter-spacing: 0.105em; text-transform: uppercase;
                }
                .nav-group.is-current .nav-group-label { color: var(--admin-cobalt); }
                .nav-group-items { display: grid; gap: 0.16rem; }
                .nav-item {
                    position: relative; width: 100%; min-height: 36px; gap: 0.66rem; padding: 0.48rem 0.62rem;
                    border-radius: 9px; color: var(--text-secondary); font-size: 0.79rem; font-weight: 520;
                }
                .nav-item:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
                .nav-item.active {
                    border-color: color-mix(in srgb, var(--admin-cobalt) 28%, var(--border-subtle));
                    background: var(--admin-cobalt-soft); color: var(--admin-cobalt); font-weight: 690;
                }
                [data-theme="dark"] .nav-item.active {
                    background: color-mix(in srgb, var(--admin-cobalt) 24%, var(--bg-surface));
                    color: #aebcff;
                }
                .nav-item.active::before {
                    content: ""; position: absolute; left: -0.8rem; top: 8px; bottom: 8px; width: 3px;
                    border-radius: 0 3px 3px 0; background: var(--admin-cobalt);
                }
                .nav-icon { width: 18px; flex: 0 0 18px; color: var(--text-tertiary); }
                .nav-item.active .nav-icon { color: currentColor; }

                .sidebar-footer {
                    display: grid; grid-template-columns: 1fr auto; gap: 0.45rem; padding: 0.8rem;
                    background: var(--bg-surface); border-color: var(--border-subtle);
                }
                .btn-curator-link, .btn-logout-sidebar {
                    min-height: 38px; margin: 0; border: 1px solid var(--border-subtle); border-radius: 9px;
                    background: transparent; color: var(--text-secondary); font-size: 0.71rem;
                    font-weight: 620; letter-spacing: 0; text-transform: none;
                }
                .btn-curator-link:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
                .btn-logout-sidebar { width: 38px; padding: 0; }
                .btn-logout-sidebar span { display: none; }
                .btn-logout-sidebar:hover { border-color: #d7a7a1; background: #fff0ee; color: var(--admin-danger); }

                .main-content {
                    flex-basis: calc(100vw - var(--sidebar-width)); width: calc(100vw - var(--sidebar-width));
                    margin-left: var(--sidebar-width); padding: 1.5rem clamp(1.25rem, 3vw, 3rem) 3rem;
                    background: var(--bg-color);
                }
                .main-content.dashboard-main {
                    height: auto; min-height: 100vh; overflow: visible;
                    padding: 0 clamp(1.25rem, 3vw, 3rem) 4rem;
                }
                .dashboard-main .content-body { height: auto; overflow: visible; }
                .mobile-studio-bar { display: none; }

                .studio-home { width: min(100%, 1480px); margin: 0 auto; }
                .studio-home-hero {
                    min-height: 0; display: block;
                    padding: clamp(3.1rem, 6vh, 4.5rem) 0 1.8rem;
                    border-bottom: 1px solid var(--border-subtle);
                }
                .dashboard-greeting .admin-page-header__title { max-width: 18ch; }
                .dashboard-greeting .admin-page-header__description { max-width: 32rem; }

                .studio-home-grid {
                    display: grid; grid-template-columns: repeat(12, minmax(0, 1fr));
                    grid-auto-flow: dense; gap: 0.85rem; padding-top: 1.25rem;
                }
                .studio-frame-card {
                    min-width: 0; min-height: 210px; display: flex; flex-direction: column; gap: 1rem;
                    padding: clamp(1.1rem, 1.6vw, 1.45rem); border: 1px solid var(--border-subtle);
                    border-radius: 16px; background: var(--bg-surface); color: var(--text-primary);
                    box-shadow: 0 1px 0 rgba(21, 21, 21, 0.035);
                }
                .opportunity-focus-card { grid-column: span 8; grid-row: span 2; min-height: 436px; box-shadow: none; }
                .studio-media-card, .studio-moodboard-card { grid-column: span 4; }
                .studio-analytics-card, .studio-curator-card { grid-column: span 6; }
                .studio-analytics-card {
                    display: grid; grid-template-columns: minmax(0, 0.82fr) minmax(220px, 1.18fr);
                    align-items: stretch; gap: 1.15rem;
                }
                .studio-analytics-summary { min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
                .studio-visitor-count { font-variant-numeric: tabular-nums; }
                .recent-visitor-carousel { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
                .recent-visitor-track {
                    display: grid; grid-auto-flow: column; grid-auto-columns: 100%; overflow-x: auto; overflow-y: hidden;
                    border-radius: 12px; scroll-snap-type: inline mandatory; scrollbar-width: none; overscroll-behavior-inline: contain;
                }
                .recent-visitor-track::-webkit-scrollbar { display: none; }
                .recent-visitor-card {
                    min-width: 0; min-height: 132px; display: flex; flex-direction: column; justify-content: space-between;
                    padding: 1rem; border: 1px solid var(--border-subtle); border-radius: 12px;
                    background: var(--bg-color); color: var(--text-primary); text-align: left; cursor: pointer;
                    scroll-snap-align: start; scroll-snap-stop: always;
                }
                .recent-visitor-card:hover { border-color: var(--border-strong); }
                .recent-visitor-card:focus-visible, .recent-visitor-dot:focus-visible {
                    outline: 2px solid var(--border-focus); outline-offset: 3px;
                }
                .recent-visitor-card p {
                    margin: 0; font-size: var(--admin-card-body-size); font-weight: var(--admin-card-title-weight);
                    line-height: var(--admin-card-copy-line-height);
                }
                .recent-visitor-card span {
                    display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.8rem;
                    color: var(--admin-cobalt); font-size: var(--admin-card-action-size);
                    font-weight: var(--admin-card-action-weight);
                }
                .recent-visitor-dots { display: flex; justify-content: center; gap: 0.38rem; min-height: 22px; padding-top: 0.65rem; }
                .recent-visitor-dot {
                    width: 22px; height: 22px; display: grid; place-items: center; padding: 0; border: 0;
                    background: transparent; cursor: pointer;
                }
                .recent-visitor-dot::before {
                    content: ""; width: 6px; height: 6px; border-radius: 999px; background: var(--border-strong);
                    transition: width 0.16s ease, background 0.16s ease;
                }
                .recent-visitor-dot.is-active::before { width: 16px; background: var(--admin-cobalt); }
                .recent-visitor-empty {
                    min-height: 132px; margin: 0; display: flex; align-items: center; padding: 1rem;
                    border: 1px solid var(--border-subtle); border-radius: 12px; color: var(--text-secondary);
                    font-size: var(--admin-card-meta-size); line-height: var(--admin-card-copy-line-height);
                }
                .recent-visitor-empty.is-loading { color: transparent; }
                .recent-visitor-empty.is-loading::after {
                    content: ""; width: 78%; height: 0.8rem; border-radius: 999px;
                    background: color-mix(in srgb, var(--text-tertiary) 13%, transparent);
                }
                .studio-media-card {
                    border-color: var(--admin-cobalt); background: var(--admin-cobalt); color: #fff;
                    box-shadow: 0 14px 36px rgba(36, 68, 202, 0.18);
                }
                .studio-card-heading { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.8rem; }
                .studio-card-heading h2, .studio-card-copy h2 {
                    margin: 0; font-size: var(--admin-card-heading-size); font-weight: var(--admin-card-heading-weight);
                    line-height: var(--admin-card-heading-line-height); letter-spacing: var(--admin-card-heading-tracking);
                }
                .studio-card-icon {
                    width: 42px; height: 42px; flex: 0 0 42px; display: grid; place-items: center;
                    border-radius: 11px; background: var(--admin-cobalt-soft); color: var(--admin-cobalt);
                }
                .studio-card-icon.is-inverted { background: rgba(255,255,255,0.14); color: #fff; }
                [data-theme="dark"] .studio-card-icon:not(.is-inverted) {
                    background: color-mix(in srgb, var(--admin-cobalt) 24%, var(--bg-surface)); color: #aebcff;
                }
                .studio-card-copy { display: grid; gap: 0.42rem; margin-top: 0.1rem; }
                .studio-card-copy > span {
                    max-width: 36ch; margin-top: 0; color: var(--text-secondary);
                    font-size: var(--admin-card-body-size); line-height: var(--admin-card-copy-line-height);
                }
                .studio-media-card .studio-card-copy > span { color: rgba(255,255,255,0.72); }
                .studio-media-card .studio-card-copy { margin-top: 0.1rem; }
                .studio-card-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 0.55rem; margin-top: auto; }
                .studio-card-button, .studio-card-text-button, .studio-card-link {
                    min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
                    border-radius: 9px; font: inherit; font-size: var(--admin-card-action-size);
                    font-weight: var(--admin-card-action-weight); cursor: pointer;
                    text-decoration: none;
                }
                .studio-card-button {
                    width: fit-content; margin-top: auto; padding: 0.65rem 0.82rem;
                    border: 1px solid var(--border-strong); background: var(--text-primary); color: var(--bg-surface);
                }
                .studio-card-button:hover { opacity: 0.86; }
                .studio-card-button.is-on-cobalt { border-color: #fff; background: #fff; color: var(--admin-cobalt-deep); }
                .studio-card-text-button {
                    padding: 0.65rem 0.45rem; border: 0; background: transparent; color: var(--admin-cobalt);
                }
                .studio-card-text-button:hover { text-decoration: underline; text-underline-offset: 0.2em; }
                .studio-card-actions .studio-card-button { margin-top: 0; }
                .studio-card-button:focus-visible, .studio-card-text-button:focus-visible, .studio-card-link:focus-visible,
                .opportunity-focus-row:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 3px; }

                .opportunity-focus-list {
                    display: grid; grid-auto-flow: column;
                    grid-auto-columns: calc((100% - 1.3rem) / 3);
                    align-items: stretch; min-height: 220px; flex: 1; gap: 0.65rem; margin-top: 0.3rem;
                    overflow-x: auto; overflow-y: hidden; overscroll-behavior-inline: contain;
                    scroll-snap-type: inline proximity; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent;
                    cursor: grab; touch-action: pan-x pan-y; user-select: none;
                }
                .opportunity-focus-list:active { cursor: grabbing; }
                .opportunity-focus-list.is-dragging { scroll-snap-type: none; cursor: grabbing; }
                .opportunity-focus-list:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 4px; }
                .opportunity-focus-list::-webkit-scrollbar { height: 5px; }
                .opportunity-focus-list::-webkit-scrollbar-track { background: transparent; }
                .opportunity-focus-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 999px; }
                .opportunity-focus-row {
                    min-width: 0; min-height: 220px; display: flex; flex-direction: column; align-items: flex-start;
                    padding: 1.05rem; border: 1px solid var(--border-subtle); border-radius: 12px;
                    background: var(--bg-color); color: var(--text-primary); scroll-snap-align: start;
                }
                .opportunity-focus-row:not(.is-loading) { cursor: pointer; }
                .opportunity-focus-row:not(.is-loading):hover { border-color: var(--border-strong); }
                .opportunity-focus-time { margin: 0; }
                .opportunity-focus-time strong {
                    font-size: var(--admin-card-emphasis-size); font-weight: var(--admin-card-heading-weight);
                    line-height: var(--admin-card-heading-line-height); letter-spacing: var(--admin-card-heading-tracking);
                    font-variant-numeric: tabular-nums;
                }
                .opportunity-focus-title {
                    margin: 1rem 0 0.38rem; font-size: var(--admin-card-title-size);
                    font-weight: var(--admin-card-title-weight); line-height: var(--admin-card-title-line-height);
                    letter-spacing: var(--admin-card-title-tracking); display: -webkit-box; overflow: hidden;
                    -webkit-box-orient: vertical; -webkit-line-clamp: 2;
                }
                .opportunity-focus-context {
                    display: -webkit-box; overflow: hidden; margin: 0; color: var(--text-secondary);
                    font-size: var(--admin-card-meta-size); line-height: var(--admin-card-copy-line-height);
                    -webkit-box-orient: vertical; -webkit-line-clamp: 3;
                }
                .opportunity-source-link {
                    display: inline-flex; align-items: center; gap: 0.28rem; margin-top: auto; padding-top: 1rem;
                    color: var(--admin-cobalt); font-size: var(--admin-card-action-size);
                    font-weight: var(--admin-card-action-weight); text-decoration: none;
                }
                .opportunity-source-link:hover { text-decoration: underline; text-underline-offset: 0.2em; }
                .opportunity-source-link:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 3px; }
                .opportunity-focus-row.is-loading { pointer-events: none; }
                .opportunity-loading-line {
                    display: block; height: 0.72rem; border-radius: 999px;
                    background: color-mix(in srgb, var(--text-tertiary) 13%, transparent);
                }
                .opportunity-loading-line.is-deadline { width: 58%; height: 1.35rem; }
                .opportunity-loading-line.is-title { width: 82%; margin-top: 1rem; }
                .opportunity-loading-line.is-copy { width: 94%; margin-top: 0.55rem; }
                .opportunity-loading-line.is-link { width: 34%; margin-top: auto; }
                .studio-card-state {
                    grid-column: 1 / -1; min-height: 220px; margin: 0; display: flex; align-items: center;
                    color: var(--text-secondary); font-size: 0.78rem; line-height: 1.5;
                }
                .studio-card-state.is-error { color: var(--admin-danger); }
                .studio-card-link {
                    width: fit-content; margin-top: auto; padding: 0.25rem 0; color: var(--admin-cobalt);
                }
                .studio-card-link:hover { text-decoration: underline; text-underline-offset: 0.22em; }

                .world-clock-section {
                    margin-top: 2.25rem; border: 0; border-top: 1px solid var(--border-subtle);
                    border-radius: 0; background: transparent;
                }
                .world-clock-section .panel-heading { padding: 1.4rem 0 0.8rem; border: 0; }
                .world-clock-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.7rem; padding: 0; background: transparent; }
                .world-clock-item, .world-clock-item.is-adaptive-clock {
                    display: flex; min-height: 150px; aspect-ratio: 1 / 0.92; gap: 0.85rem; padding: 1rem;
                    border-radius: 14px; transition: transform 0.16s ease, box-shadow 0.16s ease;
                }
                .world-clock-item:hover { transform: translateY(-2px) rotate(-0.2deg); box-shadow: 0 10px 24px rgba(21,21,21,0.08); }
                .world-clock-city { font-size: 0.88rem; }
                .world-clock-time { font-size: clamp(1.35rem, 1.8vw, 1.95rem); }
                .world-clock-icon { width: 29px; height: 29px; flex-basis: 29px; }
                .world-clock-icon svg { width: 14px; height: 14px; }

                .section-error { border-left: 4px solid var(--admin-danger); }

                @media (max-width: 1280px) {
                    .opportunity-focus-card { grid-column: span 7; }
                    .studio-media-card, .studio-moodboard-card { grid-column: span 5; }
                    .world-clock-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                    .world-clock-item, .world-clock-item.is-adaptive-clock { aspect-ratio: 1.35 / 1; }
                }

                @media (max-width: 1024px) {
                    :root { --sidebar-width: 0px; }
                    .sidebar {
                        width: min(304px, calc(100vw - 1rem)); transform: translateX(-103%);
                        transition: transform 0.22s ease, box-shadow 0.22s ease;
                    }
                    .sidebar.is-open { width: min(304px, calc(100vw - 1rem)); transform: translateX(0); box-shadow: 20px 0 55px rgba(0,0,0,0.28); }
                    .sidebar-backdrop {
                        display: block; position: fixed; inset: 0; z-index: 45; border: 0;
                        background: var(--bg-overlay); opacity: 0; pointer-events: none; transition: opacity 0.22s ease;
                    }
                    .admin-layout.sidebar-open .sidebar-backdrop { opacity: 1; pointer-events: auto; }
                    .sidebar-header, .sidebar.is-open .sidebar-header { min-height: 64px; justify-content: space-between; padding: 0.65rem 0.75rem; }
                    .sidebar-toggle {
                        display: grid; width: 38px; height: 38px; flex: 0 0 38px; place-items: center;
                        padding: 0; border: 1px solid var(--border-subtle); border-radius: 9px;
                        background: var(--bg-color); color: var(--text-primary); cursor: pointer;
                    }
                    .brand-title, .sidebar.is-open .brand-title { display: flex; width: auto; }
                    .brand-copy, .sidebar.is-open .brand-copy { display: grid; }
                    .nav-group-label, .nav-label, .sidebar.is-open .nav-label { display: initial; }
                    .nav-item, .sidebar.is-open .nav-item { justify-content: flex-start; padding: 0.48rem 0.62rem; }
                    .sidebar-nav { gap: 1rem; padding: 0.65rem 0.8rem 1.4rem; }
                    .sidebar-footer { padding: 0.8rem; }
                    .btn-curator-link span { display: inline; }
                    .sidebar.is-open .btn-logout-sidebar span { display: none; }
                    .main-content, .main-content.dashboard-main {
                        flex-basis: 100%; width: 100%; margin-left: 0; padding: 0 1.25rem 3rem;
                    }
                    .main-content.admin-page-main { padding: 0 1.25rem 3rem; }
                    .mobile-studio-bar {
                        position: sticky; top: 0; z-index: 35; display: flex; align-items: center; gap: 0.75rem;
                        min-height: 62px; margin: 0 -1.25rem 0; padding: 0.65rem 5rem 0.65rem 1rem;
                        border-bottom: 1px solid var(--border-subtle);
                        background: color-mix(in srgb, var(--bg-color) 91%, transparent); backdrop-filter: blur(14px);
                    }
                    .mobile-menu-button {
                        width: 40px; height: 40px; flex: 0 0 40px; display: grid; place-items: center;
                        border: 1px solid var(--border-subtle); border-radius: 9px;
                        background: var(--bg-surface); color: var(--text-primary); cursor: pointer;
                    }
                    .mobile-location { min-width: 0; display: grid; gap: 0.05rem; }
                    .mobile-location small {
                        color: var(--admin-cobalt); font-size: 0.58rem; font-weight: 760;
                        letter-spacing: 0.08em; text-transform: uppercase;
                    }
                    .mobile-location strong { overflow: hidden; font-size: 0.82rem; text-overflow: ellipsis; white-space: nowrap; }
                    .studio-home-hero { min-height: 0; padding-top: 1.8rem; }
                    .opportunity-focus-card { grid-column: 1 / -1; grid-row: auto; min-height: 410px; }
                    .studio-media-card, .studio-moodboard-card,
                    .studio-analytics-card, .studio-curator-card { grid-column: span 6; }
                }

                @media (max-width: 720px) {
                    .studio-home-hero { padding: 1.65rem 0 1.5rem; }
                    .studio-home-grid { grid-template-columns: 1fr; }
                    .opportunity-focus-card, .studio-media-card, .studio-moodboard-card,
                    .studio-analytics-card, .studio-curator-card { grid-column: 1; min-height: 220px; }
                    .studio-analytics-card { grid-template-columns: 1fr; }
                    .opportunity-focus-card { min-height: 390px; }
                    .opportunity-focus-list { grid-auto-columns: minmax(82%, 82%); }
                    .opportunity-focus-row,
                    .opportunity-focus-row:first-child,
                    .opportunity-focus-row:last-child {
                        min-height: 170px; padding: 1rem; border: 1px solid var(--border-subtle);
                    }
                    .world-clock-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .world-clock-item, .world-clock-item.is-adaptive-clock { aspect-ratio: 1 / 1; min-height: 138px; }
                }

                @media (max-width: 440px) {
                    .main-content, .main-content.dashboard-main, .main-content.admin-page-main { padding-inline: 0.85rem; }
                    .mobile-studio-bar { margin-inline: -0.85rem; }
                    .studio-frame-card { padding: 1rem; }
                }
            `}</style>
        </div>
    );
}

function LineIcon({ icon: Icon, size = 18 }) {
    return <Icon size={size} strokeWidth={1.7} />;
}

function RecentVisitorCarousel({ snapshot, onOpenAnalytics }) {
    const trackRef = useRef(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const visitors = snapshot.visitors || [];

    useEffect(() => {
        setActiveIndex(0);
        trackRef.current?.scrollTo({ left: 0 });
    }, [visitors.length]);

    const handleScroll = (event) => {
        const track = event.currentTarget;
        if (!track.clientWidth) return;
        const nextIndex = Math.max(0, Math.min(visitors.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
        setActiveIndex(nextIndex);
    };

    const showVisitor = (index) => {
        setActiveIndex(index);
        trackRef.current?.scrollTo({ left: index * trackRef.current.clientWidth, behavior: 'smooth' });
    };

    if (snapshot.loading) {
        return <div className="recent-visitor-empty is-loading" aria-hidden="true" />;
    }

    if (snapshot.error) {
        return <p className="recent-visitor-empty" role="status">Recent visitor details could not be loaded.</p>;
    }

    if (visitors.length === 0) {
        return <p className="recent-visitor-empty">No human visitor sessions are available for the last 7 days.</p>;
    }

    return (
        <div className="recent-visitor-carousel">
            <div
                ref={trackRef}
                className="recent-visitor-track"
                aria-label="Recent human visitors"
                onScroll={handleScroll}
            >
                {visitors.map((visitor, index) => (
                    <button
                        key={visitor.visitorId || visitor.sessionId || visitor.id || index}
                        type="button"
                        className="recent-visitor-card"
                        onClick={onOpenAnalytics}
                        aria-label={`${describeRecentVisitor(visitor)} Open Analytics.`}
                    >
                        <p>{describeRecentVisitor(visitor)}</p>
                        <span>
                            See visitor details
                            <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                    </button>
                ))}
            </div>
            {visitors.length > 1 && (
                <div className="recent-visitor-dots" aria-label="Choose a recent visitor">
                    {visitors.map((visitor, index) => (
                        <button
                            key={visitor.visitorId || visitor.sessionId || visitor.id || index}
                            type="button"
                            className={`recent-visitor-dot ${index === activeIndex ? 'is-active' : ''}`}
                            aria-label={`Show recent visitor ${index + 1}`}
                            aria-current={index === activeIndex ? 'true' : undefined}
                            onClick={() => showVisitor(index)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function OpportunityFocusRow({ opportunity, onOpen }) {
    const actionAt = getOpportunityActionAt(opportunity);
    const remaining = formatDaysRemaining(actionAt, opportunity.deadline_confidence);
    const sourceUrl = getOpportunitySourceUrl(opportunity);
    const context = opportunity.summary || opportunity.organisation || opportunity.organization || '';

    return (
        <article
            className="opportunity-focus-row"
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen();
                }
            }}
            aria-label={`Open details for ${formatOpportunityTitle(opportunity.title)}`}
        >
            <p className="opportunity-focus-time"><strong>{remaining.label}</strong></p>
            <strong className="opportunity-focus-title">{formatOpportunityTitle(opportunity.title)}</strong>
            {context && <p className="opportunity-focus-context">{context}</p>}
            {sourceUrl && (
                <a
                    className="opportunity-source-link"
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                >
                    View source
                    <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
                </a>
            )}
        </article>
    );
}

function getOpportunitySourceUrl(opportunity) {
    const candidate = opportunity.source_url || opportunity.canonical_url;
    if (!candidate) return '';
    try {
        const parsed = new URL(candidate);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
        return '';
    }
}

function getWorldClockPhase(hour) {
    if (hour >= 5 && hour < 8) {
        return { label: 'Morning light', className: 'is-sunrise', icon: Sunrise };
    }
    if (hour >= 8 && hour < 17) {
        return { label: 'Daylight', className: 'is-day', icon: Sun };
    }
    if (hour >= 17 && hour < 20) {
        return { label: 'Evening light', className: 'is-sunset', icon: Sunset };
    }
    return { label: 'Night', className: 'is-night', icon: Moon };
}

function WorldClockPanel() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(timer);
    }, []);

    return (
        <section className="dashboard-panel world-clock-section" aria-labelledby="world-clock-title">
            <div className="panel-heading world-clock-heading">
                <h3 id="world-clock-title">
                    <Globe2 size={16} strokeWidth={1.7} aria-hidden="true" />
                    World time
                </h3>
                <span>Live</span>
            </div>
            <div className="world-clock-grid">
                {WORLD_CLOCKS.map(({ city, timeZone, adaptive = false }) => {
                    const time = new Intl.DateTimeFormat('en-GB', {
                        timeZone,
                        hour: '2-digit',
                        minute: '2-digit',
                        hourCycle: 'h23',
                    }).format(now);
                    const localHour = Number(new Intl.DateTimeFormat('en-GB', {
                        timeZone,
                        hour: '2-digit',
                        hourCycle: 'h23',
                    }).format(now));
                    const day = new Intl.DateTimeFormat('en-US', {
                        timeZone,
                        weekday: 'short',
                    }).format(now);
                    const phase = getWorldClockPhase(localHour);
                    const PhaseIcon = phase.icon;

                    return (
                        <div
                            key={timeZone}
                            className={`world-clock-item ${phase.className}${adaptive ? ' is-adaptive-clock' : ''}`}
                            aria-label={`${city}: ${time}, ${phase.label}`}
                        >
                            <div className="world-clock-top">
                                <span>
                                    <strong className="world-clock-city">{city}</strong>
                                    <span className="world-clock-day">{day}</span>
                                </span>
                                <span className="world-clock-icon" title={phase.label}>
                                    <PhaseIcon size={17} strokeWidth={1.7} aria-hidden="true" />
                                </span>
                            </div>
                            <strong className="world-clock-time">{time}</strong>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}



function LoadingState({ message = "Loading..." }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '400px', width: '100%', color: 'var(--text-secondary)', gap: '1rem'
        }}>
            <div className="spinner"></div>
            <div style={{ fontSize: '1rem', fontWeight: 500, letterSpacing: '0.02em' }}>{message}</div>
            <style>{`
                .spinner {
                    width: 40px; height: 40px;
                    border: 3px solid var(--bg-surface-hover);
                    border-top-color: var(--text-primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
