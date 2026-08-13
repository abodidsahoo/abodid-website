import React, { useEffect, useState } from 'react';
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
import {
    ArrowUpRight,
    BookOpen,
    ChartNoAxesCombined,
    Camera,
    Clapperboard,
    FileText,
    FlaskConical,
    FolderOpen,
    FolderKanban,
    Images,
    LayoutDashboard,
    Library,
    LogOut,
    Mail,
    Menu,
    PenLine,
    ScanSearch,
    Globe2,
    Glasses,
    Moon,
    Network,
    Sun,
    Sunrise,
    Sunset,
    Tags,
    UsersRound,
    X,
} from 'lucide-react';

const SECTIONS = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
    { id: 'reading_digest', label: "Reader's Digest", icon: BookOpen },
    { id: 'network_intelligence', label: 'Network Intelligence', icon: Network },
    { id: 'portfolio_projects', label: 'Portfolio Projects', icon: FolderKanban },
    { id: 'xr_showcase', label: 'XR Showcase', icon: Glasses },
    { id: 'hub_resources', label: 'Curator Dashboard', icon: Library },
    { id: 'media_library', label: 'Media Library', icon: FolderOpen },
    { id: 'users', label: 'Accounts', icon: UsersRound },
    { id: 'brands', label: 'Brands', icon: Tags },
    { id: 'photography', label: 'Photography', icon: Camera },
    { id: 'photo_stories', label: 'Photo Stories', icon: FileText },
    { id: 'moodboard_items', label: 'Moodboard', icon: Images },
    { id: 'films', label: 'Films', icon: Clapperboard },
    { id: 'blog', label: 'Blog', icon: PenLine },
    { id: 'research', label: 'Research', icon: FlaskConical },
    { id: 'newsletter', label: 'Newsletter', icon: Mail },
    { id: 'page_metadata', label: 'SEO Studio', icon: ScanSearch },
];
const VALID_SECTION_IDS = new Set(SECTIONS.map((section) => section.id));
const REQUEST_TIMEOUT_MS = 8000;
const QUICK_ACTIONS = [
    { label: 'Send a Newsletter', href: '/admin/dashboard?section=newsletter', icon: Mail },
    { label: 'Add a Link to Resource Hub', href: '/admin/dashboard?section=hub_resources&action=new', icon: Library },
    { label: 'Upload a Photo Series', href: '/admin/dashboard?section=photography&action=new', icon: Camera },
    { label: 'Publish an Article', href: '/admin/editor?table=blog&id=new', icon: PenLine },
    { label: 'Add an image to Moodboard', href: '/admin/dashboard?section=moodboard_items', icon: Images },
    { label: 'Check Site Analytics', href: '/admin/dashboard?section=analytics', icon: ChartNoAxesCombined },
];
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
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('dashboard');
    const [connectionError, setConnectionError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [newsletterExhibition, setNewsletterExhibition] = useState({
        sample: null,
        ready: false,
    });

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

    const handleNav = (id) => {
        setActiveSection(id);
        if (window.matchMedia('(max-width: 1024px)').matches) {
            setSidebarOpen(false);
        }
        const url = new URL(window.location);
        url.searchParams.set('section', id);
        url.searchParams.delete('action');
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
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
                        I'm sorry, we're facing some hiccups.
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
                            View Resources Instead
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
                    <h1 className="brand-title">Creator Studio</h1>
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

                <nav className="sidebar-nav">
                    {SECTIONS.map(section => (
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
                </nav>

                <div className="sidebar-footer">
                    <a href="/resources" target="_blank" rel="noreferrer" className="btn-curator-link" aria-label="View Resource Hub">
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
            <main className={`main-content ${activeSection === 'dashboard' ? 'dashboard-main' : ''} ${activeSection === 'analytics' || activeSection === 'reading_digest' || activeSection === 'network_intelligence' || activeSection === 'portfolio_projects' || activeSection === 'xr_showcase' || activeSection === 'hub_resources' || activeSection === 'media_library' || activeSection === 'users' || activeSection === 'brands' || activeSection === 'photography' || activeSection === 'photo_stories' || activeSection === 'moodboard_items' || activeSection === 'films' || activeSection === 'blog' || activeSection === 'research' || activeSection === 'newsletter' || activeSection === 'page_metadata' ? 'admin-page-main' : ''}`}>
                <div className="content-body">
                    {activeSection === 'dashboard' && (
                        <>
                            <div className="overview-grid">
                                <section className="dashboard-launch-section admin-page-intro" aria-labelledby="dashboard-greeting">
                                    <AdminPageHeader
                                        className="dashboard-greeting"
                                        headingId="dashboard-greeting"
                                        title="Hi Abodid,"
                                        description="Build, publish, and keep the ideas moving."
                                    />
                                    <div className="destination-actions">
                                        <a href="/" target="_blank" rel="noreferrer" className="destination-card destination-card-primary">
                                            <span className="destination-icon" aria-hidden="true">
                                                <Globe2 size={24} strokeWidth={1.7} />
                                            </span>
                                            <strong>View live site</strong>
                                            <ArrowUpRight size={21} strokeWidth={1.7} aria-hidden="true" />
                                        </a>
                                        <a href="/resources" target="_blank" rel="noreferrer" className="destination-card destination-card-secondary">
                                            <span className="destination-icon" aria-hidden="true">
                                                <Library size={24} strokeWidth={1.7} />
                                            </span>
                                            <strong>View Resources Hub</strong>
                                            <ArrowUpRight size={21} strokeWidth={1.7} aria-hidden="true" />
                                        </a>
                                    </div>
                                </section>

                                <section className="dashboard-panel quick-actions-panel" aria-labelledby="quick-actions-title">
                                    <div className="panel-heading">
                                        <h3 id="quick-actions-title">Start something</h3>
                                        <span>Direct actions</span>
                                    </div>
                                    <div className="quick-actions-grid">
                                        {QUICK_ACTIONS.map((action) => (
                                            <a
                                                key={action.href}
                                                href={action.href}
                                                className="quick-action-card"
                                                onClick={action.href === '/admin/dashboard?section=newsletter'
                                                    ? (event) => {
                                                        event.preventDefault();
                                                        handleNav('newsletter');
                                                    }
                                                    : undefined}
                                            >
                                                <span className="quick-action-icon" aria-hidden="true">
                                                    <LineIcon icon={action.icon} size={21} />
                                                </span>
                                                <span className="quick-action-copy">
                                                    <strong>{action.label}</strong>
                                                </span>
                                                <ArrowUpRight size={17} strokeWidth={1.7} aria-hidden="true" />
                                            </a>
                                        ))}
                                    </div>
                                </section>

                                <WorldClockPanel />
                            </div>
                        </>
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
                            <MoodboardManager />
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

                    {activeSection !== 'dashboard' && activeSection !== 'analytics' && activeSection !== 'reading_digest' && activeSection !== 'network_intelligence' && activeSection !== 'portfolio_projects' && activeSection !== 'xr_showcase' && activeSection !== 'hub_resources' && activeSection !== 'photography' && activeSection !== 'media_library' && activeSection !== 'users' && activeSection !== 'brands' && activeSection !== 'newsletter' && activeSection !== 'photo_stories' && activeSection !== 'moodboard_items' && activeSection !== 'films' && activeSection !== 'research' && activeSection !== 'page_metadata' && activeSection !== 'blog' && (
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
            `}</style>
        </div>
    );
}

function LineIcon({ icon: Icon, size = 18 }) {
    return <Icon size={size} strokeWidth={1.7} />;
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
