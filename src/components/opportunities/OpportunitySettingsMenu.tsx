import { createPortal } from 'react-dom';
import { Chrome, Send, Settings, ArrowUpRight, CheckCircle2, Copy, ChevronDown } from 'lucide-react';
import { OpportunityExtensionHelp } from './OpportunityExtensionHelp';
import { OpportunityBusy } from './OpportunityBusy';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getOpportunityMenuPosition, type OpportunityMenuPosition } from '../../lib/opportunities/menuPosition';
import {
    OPPORTUNITY_CURATED_COLLECTION_PATH,
    OPPORTUNITY_PRIVACY_PATH,
} from '../../lib/opportunities/routes';

interface TelegramConnectionPreparation {
    status?: string;
    connect_url?: string;
    expires_at?: string;
}

interface OpportunitySettingsMenuProps {
    showQuickAccess?: boolean;
    accessToken: string | null;
    isPublic: boolean;
    username: string;
    onLogout: () => void;
    onEditProfile: () => void;
    onStartTour?: () => void;
    onToast: (message: string) => void;
    onVisibilityChange: (isPublic: boolean) => void;
}

const INTERACTIVE_ITEM_SELECTOR = [
    '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)',
    '[role="menuitemcheckbox"]:not([aria-disabled="true"]):not(:disabled)',
].join(',');

export const OpportunitySettingsMenu: React.FC<OpportunitySettingsMenuProps> = ({
    showQuickAccess = false,
    accessToken,
    isPublic,
    username,
    onLogout,
    onEditProfile,
    onStartTour,
    onToast,
    onVisibilityChange,
}) => {
    const [isExtensionHelpOpen, setIsExtensionHelpOpen] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isSavingVisibility, setIsSavingVisibility] = useState(false);
    const [telegramStatus, setTelegramStatus] = useState<'loading' | 'active' | 'pending' | 'disconnected' | 'unavailable'>('loading');
    const [telegramMissingConfiguration, setTelegramMissingConfiguration] = useState<string[]>([]);
    const [isUpdatingTelegram, setIsUpdatingTelegram] = useState(false);
    const [position, setPosition] = useState<OpportunityMenuPosition | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [telegramMenuOpen, setTelegramMenuOpen] = useState(false);
    const telegramMenuRef = useRef<HTMLDivElement>(null);
    const telegramTriggerRef = useRef<HTMLButtonElement>(null);
    const preparedTelegramRef = useRef<{ connect_url: string; expires_at: string } | null>(null);
    const telegramRequestRef = useRef<Promise<TelegramConnectionPreparation> | null>(null);
    const initialFocusRef = useRef<'first' | 'last'>('first');

    const focusTrigger = useCallback(() => {
        window.requestAnimationFrame(() => triggerRef.current?.focus());
    }, []);

    const closeMenu = useCallback((restoreFocus = true) => {
        setIsOpen(false);
        if (restoreFocus) focusTrigger();
    }, [focusTrigger]);

    const updatePosition = useCallback(() => {
        const trigger = triggerRef.current;
        const menu = menuRef.current;
        if (!trigger || !menu) return;

        const viewport = window.visualViewport;
        const viewportWidth = viewport?.width ?? window.innerWidth;
        const viewportHeight = viewport?.height ?? window.innerHeight;
        const nextPosition = getOpportunityMenuPosition({
            triggerRect: trigger.getBoundingClientRect(),
            menuWidth: 340,
            menuHeight: menu.scrollHeight,
            viewportWidth,
            viewportHeight,
        });
        setPosition(nextPosition);
    }, []);

    const openMenu = (focus: 'first' | 'last' = 'first') => {
        initialFocusRef.current = focus;
        setPosition(null);
        setIsOpen(true);
    };

    useLayoutEffect(() => {
        if (!isOpen) return;
        updatePosition();
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(INTERACTIVE_ITEM_SELECTOR) || []);
        const item = initialFocusRef.current === 'last' ? items.at(-1) : items[0];
        item?.focus();
    }, [isOpen, updatePosition]);

    useEffect(() => {
        if (!isOpen) return;

        const handleOutsidePointer = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
                closeMenu();
            }
        };
        const handleViewportChange = () => updatePosition();

        document.addEventListener('pointerdown', handleOutsidePointer);
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);
        window.visualViewport?.addEventListener('resize', handleViewportChange);
        window.visualViewport?.addEventListener('scroll', handleViewportChange);

        return () => {
            document.removeEventListener('pointerdown', handleOutsidePointer);
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
            window.visualViewport?.removeEventListener('resize', handleViewportChange);
            window.visualViewport?.removeEventListener('scroll', handleViewportChange);
        };
    }, [closeMenu, isOpen, updatePosition]);

    // Prepare only a short-lived linking token; the user still confirms in Telegram.
    // Keep it in memory, never in local storage or a shared response cache.
    const prepareTelegramConnection = useCallback((): Promise<TelegramConnectionPreparation> => {
        const prepared = preparedTelegramRef.current;
        if (prepared && Date.parse(prepared.expires_at) > Date.now() + 30_000) return Promise.resolve(prepared);
        if (telegramRequestRef.current) return telegramRequestRef.current;
        const request: Promise<TelegramConnectionPreparation> = fetch('/api/integrations/telegram/connection', {
            method: 'POST', cache: 'no-store',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        }).then(async (response) => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Telegram connection could not be prepared.');
            if (telegramRequestRef.current === request && payload.connect_url && payload.expires_at) preparedTelegramRef.current = { connect_url: payload.connect_url, expires_at: payload.expires_at };
            return payload;
        }).finally(() => { if (telegramRequestRef.current === request) telegramRequestRef.current = null; });
        telegramRequestRef.current = request;
        return request;
    }, [accessToken]);

    useEffect(() => {
        if (!accessToken) return;
        let disposed = false;
        const controller = new AbortController();
        preparedTelegramRef.current = null;
        telegramRequestRef.current = null;
        const loadConnection = async () => {
            try {
                const response = await fetch('/api/integrations/telegram/connection', {
                    cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
                });
                const payload = await response.json().catch(() => ({}));
                if (disposed) return;
                if (!response.ok) throw new Error(payload.error || 'Telegram connection could not be loaded.');
                setTelegramMissingConfiguration(Array.isArray(payload.missing_configuration) ? payload.missing_configuration : []);
                const status = payload.enabled === false ? 'unavailable' : payload.status || 'disconnected';
                setTelegramStatus(status);
                if (status === 'active') {
                    preparedTelegramRef.current = null;
                    void fetch('/api/integrations/telegram/connection', {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                        body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                    }).catch(() => undefined);
                } else if (status !== 'unavailable') {
                    void prepareTelegramConnection().then((prepared) => { if (!disposed && prepared.status === 'active') setTelegramStatus('active'); }).catch(() => undefined);
                }
            } catch (error) {
                if (disposed || controller.signal.aborted) return;
                setTelegramMissingConfiguration([error instanceof Error ? error.message : 'Telegram connection could not be loaded.']);
                setTelegramStatus('unavailable');
            }
        };
        void loadConnection();
        const refresh = () => { if (document.visibilityState === 'visible') void loadConnection(); };
        window.addEventListener('focus', refresh);
        return () => { disposed = true; controller.abort(); window.removeEventListener('focus', refresh); telegramRequestRef.current = null; preparedTelegramRef.current = null; };
    }, [accessToken, prepareTelegramConnection]);

    useEffect(() => {
        if (!telegramMenuOpen) return;
        telegramMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
        const closeOutside = (event: PointerEvent) => { if (!telegramMenuRef.current?.contains(event.target as Node)) setTelegramMenuOpen(false); };
        document.addEventListener('pointerdown', closeOutside);
        return () => document.removeEventListener('pointerdown', closeOutside);
    }, [telegramMenuOpen]);

    const updateTelegramConnection = async () => {
        if (!accessToken || isUpdatingTelegram || telegramStatus === 'unavailable') return;
        setIsUpdatingTelegram(true);
        const disconnecting = telegramStatus === 'active';
        try {
            if (disconnecting) {
                const response = await fetch('/api/integrations/telegram/connection', {
                    method: 'DELETE', cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || 'Telegram could not be disconnected.');
                preparedTelegramRef.current = null;
                setTelegramStatus('disconnected');
                setTelegramMenuOpen(false);
                telegramTriggerRef.current?.focus();
                onToast('Telegram disconnected.');
                return;
            }
            const payload = await prepareTelegramConnection();
            if (payload.status === 'active') { setTelegramStatus('active'); return; }
            if (!payload.connect_url) throw new Error('Telegram connection link is unavailable.');
            setTelegramStatus('pending');
            window.location.assign(payload.connect_url);
        } catch (error) {
            onToast(error instanceof Error ? error.message : 'Telegram connection could not be updated.');
        } finally { setIsUpdatingTelegram(false); }
    };

    const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(INTERACTIVE_ITEM_SELECTOR));
        const currentIndex = items.indexOf(document.activeElement as HTMLElement);
        let nextIndex: number | null = null;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeMenu();
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            closeMenu();
            return;
        }
        if (event.key === 'ArrowDown') nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        if (event.key === 'ArrowUp') nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = items.length - 1;

        if (nextIndex !== null) {
            event.preventDefault();
            items[nextIndex]?.focus();
        }
    };

    const updateVisibility = async (nextIsPublic: boolean) => {
        if (nextIsPublic === isPublic || isSavingVisibility) return;

        const previousIsPublic = isPublic;
        onVisibilityChange(nextIsPublic);
        setIsSavingVisibility(true);
        try {
            const response = await fetch('/api/opportunities/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({ is_public: nextIsPublic }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Collection visibility could not be saved.');
            onVisibilityChange(Boolean(payload.profile?.is_public));
            onToast(`Collection is now ${nextIsPublic ? 'public' : 'private'}.`);
        } catch (error) {
            onVisibilityChange(previousIsPublic);
            onToast(error instanceof Error ? error.message : 'Collection visibility could not be saved.');
        } finally {
            setIsSavingVisibility(false);
        }
    };

    const copyPublicLink = async () => {
        const publicUrl = new URL(`/opportunities/${encodeURIComponent(username)}`, window.location.origin).toString();

        try {
            await navigator.clipboard.writeText(publicUrl);
            onToast('Public link copied.');
        } catch {
            onToast('The public link could not be copied.');
        }
    };

    return (
        <div id={showQuickAccess ? 'opportunity-quick-access' : undefined} className={`opp-user-menu ${showQuickAccess ? 'opp-quick-access' : ''}`}>
            <div className={showQuickAccess ? 'opp-quick-access-header' : undefined}>
            <button
                ref={triggerRef}
                id="opportunity-settings-trigger"
                type="button"
                className="opp-user-menu-trigger"
                onClick={() => {
                    if (isOpen) closeMenu(false);
                    else openMenu();
                }}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        openMenu(event.key === 'ArrowUp' ? 'last' : 'first');
                    }
                    if (event.key === 'Escape' && isOpen) {
                        event.preventDefault();
                        closeMenu();
                    }
                }}
                aria-controls="opportunity-settings-menu"
                aria-expanded={isOpen}
                aria-haspopup="menu"
            >
                <Settings size={16} aria-hidden="true" /><span>Settings</span>
                <span aria-hidden="true">{isOpen ? '↑' : '↓'}</span>
            </button>

            </div>
            {showQuickAccess && <div id="opportunity-integrations" className="opp-quick-integrations">
                <button type="button" className="opp-quick-integration" onClick={() => setIsExtensionHelpOpen(true)}>
                    <Chrome size={25} aria-hidden="true" />
                    <span><strong>Install Chrome Extension</strong><small>Save opportunities directly from your browser.</small></span>
                    <ArrowUpRight size={18} aria-hidden="true" />
                </button>
                <div className="opp-telegram-quick-menu" ref={telegramMenuRef}>
                <button ref={telegramTriggerRef} type="button" className="opp-quick-integration" aria-expanded={telegramStatus === 'active' ? telegramMenuOpen : undefined} aria-haspopup={telegramStatus === 'active' ? 'menu' : undefined} disabled={telegramStatus === 'loading' || isUpdatingTelegram} onClick={() => {
                    if (telegramStatus === 'active') setTelegramMenuOpen((open) => !open);
                    else if (telegramStatus === 'unavailable') openMenu();
                    else void updateTelegramConnection();
                }}>
                    {telegramStatus === 'active' ? <CheckCircle2 size={25} aria-hidden="true" /> : <Send size={25} aria-hidden="true" />}
                    <span><strong>{telegramStatus === 'active' ? 'Telegram connected' : 'Connect to Telegram'}</strong><small>{isUpdatingTelegram ? <OpportunityBusy>{telegramStatus === 'active' ? 'Disconnecting' : 'Connecting'}</OpportunityBusy> : telegramStatus === 'loading' ? <OpportunityBusy>Checking connection</OpportunityBusy> : telegramStatus === 'active' ? 'Send opportunities from Telegram.' : telegramStatus === 'unavailable' ? 'Check connection setup in Settings.' : 'Capture messages and voice notes.'}</small></span>
                    {telegramStatus === 'active' ? <ChevronDown size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}
                </button>
                {telegramMenuOpen && telegramStatus === 'active' && <div className="opp-telegram-quick-dropdown" role="menu" aria-label="Telegram connection" onKeyDown={(event) => {
                    if (event.key === 'Escape' || event.key === 'Tab') { setTelegramMenuOpen(false); if (event.key === 'Escape') { event.preventDefault(); telegramTriggerRef.current?.focus(); } }
                }}><button type="button" role="menuitem" disabled={isUpdatingTelegram} onClick={() => void updateTelegramConnection()}>{isUpdatingTelegram ? <OpportunityBusy>Disconnecting</OpportunityBusy> : 'Disconnect Telegram'}</button></div>}
                </div>
            </div>}
            <OpportunityExtensionHelp open={isExtensionHelpOpen} onClose={() => setIsExtensionHelpOpen(false)} />
            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    id="opportunity-settings-menu"
                    className="opp-user-menu-popover"
                    role="menu"
                    aria-label="Opportunity Tracker settings"
                    onKeyDown={handleMenuKeyDown}
                    style={position ? {
                        top: position.top,
                        left: position.left,
                        width: position.width,
                        maxHeight: position.maxHeight,
                    } : undefined}
                >
                    <div className="opp-user-menu-section" role="group" aria-labelledby="opp-visibility-label">
                        <div className="opp-public-access-row">
                            <button className="opp-public-access-toggle" type="button" role="menuitemcheckbox" aria-checked={isPublic} disabled={isSavingVisibility} aria-busy={isSavingVisibility} onClick={() => void updateVisibility(!isPublic)}>
                                <span id="opp-visibility-label">Public access</span><span className={`opp-access-track ${isPublic ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
                            </button>
                            <button className="opp-public-copy-icon" type="button" role="menuitem" aria-label="Copy public link" title="Copy public link" disabled={!isPublic || isSavingVisibility} onClick={() => void copyPublicLink()}><Copy size={19} aria-hidden="true" /></button>
                        </div>
                    </div>

                    <div className="opp-user-menu-section opp-telegram-connection" role="group" aria-labelledby="opp-telegram-label">
                        <p id="opp-telegram-label" className="opp-user-menu-label">Telegram Capture</p>
                        <div className="opp-telegram-connection-row">
                            <div>
                                <strong>
                                    {telegramStatus === 'active'
                                        ? 'Connected'
                                        : telegramStatus === 'pending'
                                            ? 'Waiting for Telegram'
                                            : telegramStatus === 'loading'
                                                ? <OpportunityBusy>Checking connection</OpportunityBusy>
                                                : telegramStatus === 'unavailable'
                                                    ? 'Not configured yet'
                                                    : 'Not connected'}
                                </strong>
                                <small>{telegramStatus === 'unavailable' && telegramMissingConfiguration.length
                                    ? `Setup issue: ${telegramMissingConfiguration.join(', ')}`
                                    : 'Send links, files, images and voice notes.'}</small>
                            </div>
                            <button
                                type="button"
                                role="menuitem"
                                disabled={isUpdatingTelegram || telegramStatus === 'loading' || telegramStatus === 'unavailable'}
                                aria-busy={isUpdatingTelegram}
                                onClick={() => void updateTelegramConnection()}
                            >
                                {isUpdatingTelegram
                                    ? <OpportunityBusy>{telegramStatus === 'active' ? 'Disconnecting' : 'Connecting'}</OpportunityBusy>
                                    : telegramStatus === 'active'
                                        ? 'Disconnect'
                                        : telegramStatus === 'pending'
                                            ? 'Open Telegram'
                                            : 'Connect'}
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            closeMenu();
                            onEditProfile();
                        }}
                    >
                        <span>Edit profile &amp; public URL</span><span aria-hidden="true">→</span>
                    </button>

                    {onStartTour && <button type="button" role="menuitem" onClick={() => { closeMenu(false); onStartTour(); }}><span>Quick tour</span><span aria-hidden="true">↗</span></button>}
                    <button type="button" role="menuitem" onClick={() => { closeMenu(false); setIsExtensionHelpOpen(true); }}><span>Install Chrome extension</span><span aria-hidden="true">↗</span></button>
                    <a role="menuitem" href={OPPORTUNITY_CURATED_COLLECTION_PATH} onClick={() => setIsOpen(false)}>
                        <span>View Abodid’s curated list</span><span aria-hidden="true">→</span>
                    </a>
                    <a role="menuitem" href={OPPORTUNITY_PRIVACY_PATH} onClick={() => setIsOpen(false)}>
                        <span>Privacy &amp; Data</span><span aria-hidden="true">→</span>
                    </a>
                    <div className="opp-user-menu-separator" role="separator" />
                    <button
                        type="button"
                        role="menuitem"
                        className="opp-user-menu-logout"
                        onClick={() => {
                            setIsOpen(false);
                            onLogout();
                        }}
                    >
                        <span>Log Out</span>
                    </button>
                </div>, document.body
            )}
        </div>
    );
};

export default OpportunitySettingsMenu;
