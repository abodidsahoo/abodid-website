import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { OPPORTUNITY_TOUR_STEPS, opportunityTourStorageKey, positionOpportunityTour, readOpportunityTourStep } from '../../lib/opportunities/tour';

export function OpportunityQuickTour({ username, replayKey, suspended = false }: { username: string; replayKey: number; suspended?: boolean }) {
    const [compactViewport, setCompactViewport] = useState(false);
    const [step, setStep] = useState<number | null>(null);
    const [geometry, setGeometry] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const nextRef = useRef<HTMLButtonElement>(null);
    const previousFocus = useRef<HTMLElement | null>(null);
    const storageKey = opportunityTourStorageKey(username);

    useEffect(() => {
        previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        let nextStep: number | null = 0;
        try { nextStep = replayKey > 0 ? 0 : readOpportunityTourStep(localStorage.getItem(storageKey)); } catch { /* Tour still works when storage is blocked. */ }
        setStep(nextStep);
    }, [storageKey, replayKey]);

    useEffect(() => {
        const update = () => setCompactViewport((window.visualViewport?.height || innerHeight) < 500);
        update();
        window.addEventListener('resize', update);
        window.visualViewport?.addEventListener('resize', update);
        return () => { window.removeEventListener('resize', update); window.visualViewport?.removeEventListener('resize', update); };
    }, []);

    const remember = (nextStep: number | null) => {
        try { localStorage.setItem(storageKey, JSON.stringify({ step: nextStep ?? 0, complete: nextStep === null })); } catch { /* Optional local preference. */ }
        setStep(nextStep);
    };
    const finish = () => {
        remember(null);
        requestAnimationFrame(() => {
            const origin = previousFocus.current;
            if (origin?.isConnected && origin !== document.body) origin.focus({ preventScroll: true });
            else document.querySelector<HTMLTextAreaElement>('#opportunity-capture-input')?.focus();
        });
    };

    useLayoutEffect(() => {
        if (step === null || suspended) return;
        const shortViewport = compactViewport || (window.visualViewport?.height || innerHeight) < 500;
        const selector = shortViewport && step === 0 ? '#opportunity-save-form .opp-capture-input-shell'
            : shortViewport && step === 3 ? '#opportunity-integrations .opp-telegram-quick-menu > button'
                : OPPORTUNITY_TOUR_STEPS[step].target;
        const target = document.querySelector<HTMLElement>(selector);
        const card = cardRef.current;
        if (!target || !card) return;
        const nativePopover = 'popover' in HTMLElement.prototype;
        if (nativePopover) {
            card.setAttribute('popover', 'manual');
            if (!card.matches(':popover-open')) card.showPopover();
        }
        if (!nativePopover) card.removeAttribute('popover');
        const previousAnchor = target.style.getPropertyValue('anchor-name');
        target.style.setProperty('anchor-name', '--opportunity-tour-target');
        const update = () => {
            const rect = target.getBoundingClientRect();
            const size = card.getBoundingClientRect();
            const viewport = window.visualViewport;
            const position = positionOpportunityTour(rect, size, { width: viewport?.width || innerWidth, height: viewport?.height || innerHeight, top: viewport?.offsetTop || 0 });
            card.style.setProperty('--tour-top', `${position.top}px`);
            card.style.setProperty('--tour-left', `${position.left}px`);
            card.style.setProperty('--tour-height', `${size.height}px`);
            card.style.setProperty('--tour-arrow', `${position.arrow}px`);
            card.dataset.placement = position.placement;
            const anchoredTop = position.placement === 'below' ? rect.bottom + 18 : rect.top - size.height - 18;
            card.dataset.anchor = String(CSS.supports('top', 'anchor(bottom)') && Math.abs(anchoredTop - position.top) < 1);
            setGeometry({ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 });
        };
        const rect = target.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height || innerHeight;
        const groupHeight = rect.height + card.getBoundingClientRect().height + 18;
        const desiredTop = Math.max(88, (viewportHeight - groupHeight) / 2);
        window.scrollBy({ top: rect.top - desiredTop, behavior: 'instant' });
        update();
        nextRef.current?.focus({ preventScroll: true });
        const observer = new ResizeObserver(update);
        observer.observe(card);
        observer.observe(target);
        const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); finish(); } };
        window.addEventListener('keydown', keydown);
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        window.visualViewport?.addEventListener('resize', update);
        window.visualViewport?.addEventListener('scroll', update);
        return () => {
            observer.disconnect();
            window.removeEventListener('keydown', keydown);
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
            window.visualViewport?.removeEventListener('resize', update);
            window.visualViewport?.removeEventListener('scroll', update);
            if (previousAnchor) target.style.setProperty('anchor-name', previousAnchor); else target.style.removeProperty('anchor-name');
            if (nativePopover && card.matches(':popover-open')) card.hidePopover();
        };
    }, [step, suspended, compactViewport]);

    if (step === null || suspended || typeof document === 'undefined') return null;
    const content = OPPORTUNITY_TOUR_STEPS[step];
    return createPortal(<>
        {geometry && <div className="opp-tour-spotlight" style={geometry} aria-hidden="true" />}
        <div ref={cardRef} className="opp-quick-tour" role="dialog" aria-labelledby="opp-tour-title" aria-describedby="opp-tour-copy">
            <div className="opp-tour-heading"><span>{step + 1} / {OPPORTUNITY_TOUR_STEPS.length}</span><button type="button" onClick={finish} aria-label="Close quick tour"><X size={18} aria-hidden="true" /></button></div>
            <h2 id="opp-tour-title">{content.title}</h2>
            <p id="opp-tour-copy">{content.copy.replace(/ (\S+) (\S+)$/, ' $1\u00a0$2')}</p>

            <div className="opp-tour-actions">
                <button type="button" onClick={step === 0 ? finish : () => remember(step - 1)}>{step === 0 ? 'Skip tour' : 'Back'}</button>
                <button ref={nextRef} type="button" className="is-next" onClick={step === 3 ? finish : () => remember(step + 1)}>{step === 3 ? 'Done' : 'Next →'}</button>
            </div>
        </div>
    </>, document.body);
}
