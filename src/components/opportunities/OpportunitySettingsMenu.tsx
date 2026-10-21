import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getOpportunityMenuPosition, type OpportunityMenuPosition } from '../../lib/opportunities/menuPosition';
import {
    OPPORTUNITY_CURATED_COLLECTION_PATH,
    OPPORTUNITY_PRIVACY_PATH,
} from '../../lib/opportunities/routes';

interface OpportunitySettingsMenuProps {
    accessToken: string | null;
    isPublic: boolean;
    username: string;
    onLogout: () => void;
    onEditProfile: () => void;
    onOpenSupport: () => void;
    onToast: (message: string) => void;
    onVisibilityChange: (isPublic: boolean) => void;
}

const INTERACTIVE_ITEM_SELECTOR = [
    '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)',
    '[role="menuitemradio"]:not([aria-disabled="true"]):not(:disabled)',
].join(',');

export const OpportunitySettingsMenu: React.FC<OpportunitySettingsMenuProps> = ({
    accessToken,
    isPublic,
    username,
    onLogout,
    onEditProfile,
    onOpenSupport,
    onToast,
    onVisibilityChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSavingVisibility, setIsSavingVisibility] = useState(false);
    const [telegramStatus, setTelegramStatus] = useState<'loading' | 'active' | 'pending' | 'disconnected' | 'unavailable'>('loading');
    const [telegramMissingConfiguration, setTelegramMissingConfiguration] = useState<string[]>([]);
    const [isUpdatingTelegram, setIsUpdatingTelegram] = useState(false);
    const [position, setPosition] = useState<OpportunityMenuPosition | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
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

    useEffect(() => {
        if (!isOpen || !accessToken) return;
        const controller = new AbortController();
        setTelegramStatus('loading');
        void fetch('/api/integrations/telegram/connection', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
        }).then(async (response) => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Telegram connection could not be loaded.');
            setTelegramMissingConfiguration(Array.isArray(payload.missing_configuration) ? payload.missing_configuration : []);
            setTelegramStatus(payload.enabled === false ? 'unavailable' : payload.status || 'disconnected');
            if (payload.status === 'active') {
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                void fetch('/api/integrations/telegram/connection', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({ timezone }),
                }).catch(() => undefined);
            }
        }).catch((error) => {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            setTelegramMissingConfiguration([
                error instanceof Error ? error.message : 'Telegram connection could not be loaded.',
            ]);
            setTelegramStatus('unavailable');
        });
        return () => controller.abort();
    }, [accessToken, isOpen]);

    const updateTelegramConnection = async () => {
        if (!accessToken || isUpdatingTelegram || telegramStatus === 'unavailable') return;
        setIsUpdatingTelegram(true);
        try {
            const disconnecting = telegramStatus === 'active';
            const response = await fetch('/api/integrations/telegram/connection', {
                method: disconnecting ? 'DELETE' : 'POST',
                cache: 'no-store',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    ...(disconnecting ? {} : { 'Content-Type': 'application/json' }),
                },
                ...(disconnecting ? {} : {
                    body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Telegram connection could not be updated.');
            if (disconnecting) {
                setTelegramStatus('disconnected');
                onToast('Telegram disconnected.');
                return;
            }
            if (payload.status === 'active') {
                setTelegramStatus('active');
                onToast('Telegram is already connected.');
                return;
            }
            if (!payload.connect_url) throw new Error('Telegram connection link is unavailable.');
            setTelegramStatus('pending');
            window.location.assign(payload.connect_url);
        } catch (error) {
            onToast(error instanceof Error ? error.message : 'Telegram connection could not be updated.');
        } finally {
            setIsUpdatingTelegram(false);
        }
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
        <div className="opp-user-menu">
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
                <span>Settings</span>
                <span aria-hidden="true">{isOpen ? '↑' : '↓'}</span>
            </button>

            {isOpen && (
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
                        <p id="opp-visibility-label" className="opp-user-menu-label">Collection Visibility</p>
                        <div className="opp-visibility-controls">
                            <div
                                className={`opp-visibility-switch ${isPublic ? 'is-public' : 'is-private'}`}
                                aria-busy={isSavingVisibility}
                            >
                                <span className="opp-visibility-indicator" aria-hidden="true" />
                                <button
                                    className="opp-visibility-option"
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={!isPublic}
                                    disabled={isSavingVisibility}
                                    onClick={() => void updateVisibility(false)}
                                >
                                    Private
                                </button>
                                <button
                                    className="opp-visibility-option"
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={isPublic}
                                    disabled={isSavingVisibility}
                                    onClick={() => void updateVisibility(true)}
                                >
                                    Public
                                </button>
                            </div>

                            {isPublic ? (
                                <button
                                    className="opp-copy-public-link"
                                    type="button"
                                    role="menuitem"
                                    onClick={() => void copyPublicLink()}
                                >
                                    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                                        <rect x="8" y="8" width="11" height="11" rx="1.5" />
                                        <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
                                    </svg>
                                    <span>Copy public link to share</span>
                                </button>
                            ) : (
                                <p className="opp-private-visibility-note">Only you can view it</p>
                            )}
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
                                                ? 'Checking connection'
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
                                    ? 'Please wait…'
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

                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            closeMenu();
                            onOpenSupport();
                        }}
                    >
                        <span>Support this project</span><span aria-hidden="true">↗</span>
                    </button>
                    <div className="opp-user-menu-disabled opp-user-menu-extension" aria-disabled="true">
                        <span>Install Chrome extension</span><small>(coming soon)</small>
                    </div>
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
                </div>
            )}
        </div>
    );
};

export default OpportunitySettingsMenu;
