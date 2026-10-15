import { webext } from './browser';

export type OpportunityToastKind = 'working' | 'success' | 'error';

export type OpportunityToastPayload = {
    kind: OpportunityToastKind;
    requestId?: string;
    message: string;
    detail?: string;
};

export const showOpportunityToast = async (
    tabId: number | undefined,
    payload: OpportunityToastPayload,
) => {
    if (!tabId) return false;

    try {
        const [result] = await webext.scripting.executeScript({
            target: { tabId },
            func: (nextToast: OpportunityToastPayload) => {
                const hostId = 'abodid-opportunity-tracker-toast';
                let host = document.getElementById(hostId) as HTMLDivElement | null;

                if (!host) {
                    host = document.createElement('div');
                    host.id = hostId;
                    host.style.setProperty('all', 'initial', 'important');
                    host.style.setProperty('pointer-events', 'none', 'important');
                    document.documentElement.append(host);

                    const root = host.attachShadow({ mode: 'open' });
                    const style = document.createElement('style');
                    style.textContent = `
                        :host { color-scheme: light; }
                        [hidden] { display: none !important; }
                        .toast {
                            position: fixed;
                            z-index: 2147483647;
                            right: 18px;
                            bottom: 18px;
                            left: auto;
                            top: auto;
                            width: min(356px, calc(100vw - 36px));
                            margin: 0;
                            padding: 0;
                            border: 1.5px solid #15130f;
                            border-radius: 16px;
                            overflow: hidden;
                            background: #fff8e8;
                            color: #15130f;
                            box-shadow: 5px 5px 0 #15130f;
                            font-family: "Satoshi", "Segoe UI", Arial, sans-serif;
                            pointer-events: auto;
                        }
                        .toast::backdrop { display: none; }
                        .toast__bar { height: 8px; background: #ffe44f; }
                        .toast--success .toast__bar { background: #b8ef6a; }
                        .toast--error .toast__bar { background: #ff7eb5; }
                        .toast__body { display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; padding: 15px 16px 16px; }
                        .toast__kicker { margin: 0 0 7px; font-size: 11px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
                        .toast__message { margin: 0; font-size: 16px; font-weight: 800; line-height: 1.2; }
                        .toast__detail { margin: 7px 0 0; color: rgba(21, 19, 15, .7); font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
                        .toast__close { align-self: start; min-width: 28px; min-height: 28px; padding: 0; border: 1px solid #15130f; border-radius: 50%; background: transparent; color: #15130f; cursor: pointer; font: 800 16px/1 Arial, sans-serif; }
                        .toast__close:focus-visible { outline: 3px solid #2444ca; outline-offset: 2px; }
                        .toast__progress { position: relative; grid-column: 1 / -1; height: 4px; margin-top: 3px; overflow: hidden; border-radius: 99px; background: rgba(21, 19, 15, .12); }
                        .toast__progress::after { position: absolute; inset: 0 auto 0 -42%; width: 42%; background: #ffe44f; content: ""; animation: opportunity-toast-scan 1.05s ease-in-out infinite; }
                        @keyframes opportunity-toast-scan { to { transform: translateX(340%); } }
                        @media (prefers-reduced-motion: reduce) {
                            .toast__progress::after { inset-inline: 0; width: 100%; animation: none; }
                        }
                    `;

                    const toast = document.createElement('aside');
                    toast.className = 'toast';
                    toast.setAttribute('role', 'status');
                    toast.setAttribute('aria-live', 'polite');
                    toast.setAttribute('aria-atomic', 'true');
                    toast.setAttribute('popover', 'manual');

                    const bar = document.createElement('div');
                    bar.className = 'toast__bar';
                    bar.setAttribute('aria-hidden', 'true');

                    const body = document.createElement('div');
                    body.className = 'toast__body';
                    const copy = document.createElement('div');
                    const kicker = document.createElement('p');
                    kicker.className = 'toast__kicker';
                    kicker.textContent = 'Opportunity Tracker';
                    const message = document.createElement('p');
                    message.className = 'toast__message';
                    const detail = document.createElement('p');
                    detail.className = 'toast__detail';
                    copy.append(kicker, message, detail);

                    const close = document.createElement('button');
                    close.className = 'toast__close';
                    close.type = 'button';
                    close.setAttribute('aria-label', 'Close Opportunity Tracker notification');
                    close.textContent = '×';
                    close.addEventListener('click', () => {
                        if (typeof toast.hidePopover === 'function' && toast.matches(':popover-open')) {
                            toast.hidePopover();
                        }
                        host?.remove();
                    });

                    const progress = document.createElement('div');
                    progress.className = 'toast__progress';
                    progress.setAttribute('aria-hidden', 'true');
                    body.append(copy, close, progress);
                    toast.append(bar, body);
                    root.append(style, toast);
                }

                const root = host.shadowRoot;
                const toast = root?.querySelector<HTMLElement>('.toast');
                const message = root?.querySelector<HTMLElement>('.toast__message');
                const detail = root?.querySelector<HTMLElement>('.toast__detail');
                const progress = root?.querySelector<HTMLElement>('.toast__progress');
                if (!toast || !message || !detail || !progress) return false;

                // The isolated extension world survives individual script injections,
                // so this guard still works after a dismissed toast host is removed.
                const requestStateKey = '__opportunityTrackerLatestRequestId';
                const currentRequestId = String(Reflect.get(globalThis, requestStateKey) || '');
                if (
                    nextToast.kind !== 'working'
                    && nextToast.requestId
                    && currentRequestId
                    && currentRequestId !== nextToast.requestId
                ) {
                    return false;
                }
                if (nextToast.requestId) {
                    Reflect.set(globalThis, requestStateKey, nextToast.requestId);
                    host.dataset.requestId = nextToast.requestId;
                }

                toast.className = `toast toast--${nextToast.kind}`;
                message.textContent = nextToast.message;
                detail.textContent = nextToast.detail || '';
                detail.hidden = !nextToast.detail;
                progress.hidden = nextToast.kind !== 'working';

                const supportsPopover = 'popover' in HTMLElement.prototype
                    && typeof toast.showPopover === 'function';
                if (supportsPopover && !toast.matches(':popover-open')) toast.showPopover();

                const previousTimer = Number(host.dataset.dismissTimer || 0);
                if (previousTimer) window.clearTimeout(previousTimer);
                delete host.dataset.dismissTimer;

                if (nextToast.kind !== 'working') {
                    const timeout = nextToast.kind === 'success' ? 6500 : 9000;
                    const timer = window.setTimeout(() => {
                        if (supportsPopover && toast.matches(':popover-open')) toast.hidePopover();
                        host?.remove();
                    }, timeout);
                    host.dataset.dismissTimer = String(timer);
                }

                return true;
            },
            args: [payload],
        });
        return Boolean(result?.result);
    } catch {
        // Restricted browser pages cannot host injected UI; the toolbar badge
        // remains the fallback feedback for those pages.
        return false;
    }
};
