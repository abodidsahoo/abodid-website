import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Check,
    ExternalLink,
    Radar,
    Trash2,
    X,
} from 'lucide-react';
import type { Opportunity, OpportunityStatus } from '../../lib/opportunities/types';
import { generateGoogleCalendarUrl } from '../../lib/opportunities/calendar';
import {
    extractEligibility,
    formatCategoryTitle,
    formatDaysRemaining,
    formatOpportunityTitle,
    getOpportunityCategoryIconUrl,
    getOpportunityNextAction,
} from '../../lib/opportunities/ui-helpers';
import { getRadarButtonLabel, type RadarSaveState } from './OpportunityCard';

interface OpportunityDetailModalProps {
    opportunity: Opportunity;
    isOpen: boolean;
    isAuthenticated?: boolean;
    onClose: () => void;
    onUpdateStatus: (id: string, status: OpportunityStatus) => Promise<void>;
    onUpdateHighPriority?: (id: string, isHighPriority: boolean) => Promise<void>;
    onUpdateChecklist?: (id: string, completedRequirements: string[]) => Promise<void>;
    onUpdateDeadline?: (id: string, deadline: string) => Promise<void>;
    onSelectCategory?: (category: string) => void;
    onEdit: (opp: Opportunity) => void;
    onReExtract: (id: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onNavigateNext?: () => void;
    onNavigatePrev?: () => void;
    currentIndex?: number;
    totalCount?: number;
    showRadarAction?: boolean;
    radarState?: RadarSaveState;
    onAddToRadar?: (opportunity: Opportunity) => void;
}

type SwipeGesture = {
    active: boolean;
    axis: 'pending' | 'horizontal' | 'vertical';
    pointerId: number | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startTime: number;
    lastTime: number;
    velocityX: number;
};

const cleanRequirement = (requirement: string) => requirement
    .replace(/^\s*(?:[-*•]\s*)?(?:\[[ xX]?\]\s*)?(?:(?:step\s*)?\d+[.)\-:]\s*)?/i, '')
    .trim();

export const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = ({
    opportunity: opp,
    isOpen,
    isAuthenticated = false,
    onClose,
    onUpdateStatus,
    onDelete,
    onNavigateNext,
    onNavigatePrev,
    currentIndex,
    totalCount,
    showRadarAction = false,
    radarState = 'idle',
    onAddToRadar,
}) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const swipeTimerRef = useRef<number | null>(null);
    const entranceFrameRef = useRef<number | null>(null);
    const pendingEntranceRef = useRef<'next' | 'previous' | null>(null);
    const gestureRef = useRef<SwipeGesture>({
        active: false,
        axis: 'pending',
        pointerId: null,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        startTime: 0,
        lastTime: 0,
        velocityX: 0,
    });
    const [dragX, setDragX] = useState(0);
    const [cardOpacity, setCardOpacity] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [motionPhase, setMotionPhase] = useState<'idle' | 'exiting' | 'positioning' | 'entering'>('idle');
    const [isMarkingDone, setIsMarkingDone] = useState(false);
    const [deleteStep, setDeleteStep] = useState<'idle' | 'confirming' | 'deleting'>('idle');

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (isOpen && !dialog.open) {
            dialog.showModal();
        }
        if (!isOpen && dialog.open) dialog.close();

        return () => {
            if (dialog.open) dialog.close();
        };
    }, [isOpen]);

    useEffect(() => {
        setIsDragging(false);
        setIsMarkingDone(false);
        setDeleteStep('idle');

        if (!pendingEntranceRef.current) {
            setMotionPhase('idle');
            setDragX(0);
            setCardOpacity(1);
            return;
        }

        const fromDirection = pendingEntranceRef.current;
        pendingEntranceRef.current = null;

        const initialOffset = fromDirection === 'next'
            ? Math.min(window.innerWidth * 0.45, 340)
            : -Math.min(window.innerWidth * 0.45, 340);
        setMotionPhase('positioning');
        setDragX(initialOffset);
        setCardOpacity(1);

        entranceFrameRef.current = window.requestAnimationFrame(() => {
            entranceFrameRef.current = window.requestAnimationFrame(() => {
                setMotionPhase('entering');
                setDragX(0);
                setCardOpacity(1);
                entranceFrameRef.current = null;
            });
        });
    }, [opp.id]);

    useEffect(() => () => {
        if (swipeTimerRef.current !== null) window.clearTimeout(swipeTimerRef.current);
        if (entranceFrameRef.current !== null) window.cancelAnimationFrame(entranceFrameRef.current);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            const target = event.composedPath()[0];
            if (target instanceof Element && target.matches(':read-write, select, input[type="range"], [role="slider"]')) return;

            if ((event.key === 'ArrowRight' || event.key === 'ArrowDown') && onNavigateNext) {
                event.preventDefault();
                onNavigateNext();
            } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowUp') && onNavigatePrev) {
                event.preventDefault();
                onNavigatePrev();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onNavigateNext, onNavigatePrev]);

    const eligibilityTags = useMemo(() => extractEligibility(opp), [opp]);
    const applicationEssentials = useMemo(() => {
        const unique = new Set<string>();
        for (const requirement of opp.requirements || []) {
            const cleaned = cleanRequirement(requirement);
            if (cleaned) unique.add(cleaned);
        }
        return [...unique].slice(0, 5);
    }, [opp.requirements]);
    const displayTitle = formatOpportunityTitle(opp.title);
    const categoryLabel = formatCategoryTitle(opp.category);
    const categoryIconUrl = getOpportunityCategoryIconUrl(opp.category);
    const nextAction = getOpportunityNextAction(opp);
    const urgency = formatDaysRemaining(opp.deadline_at, opp.deadline_confidence);
    const formattedDeadline = opp.deadline_at
        ? new Date(opp.deadline_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
        })
        : 'Not provided';
    const formattedEventDate = opp.event_date
        ? new Date(opp.event_date).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
        })
        : 'Not provided';
    const calendarUrl = opp.deadline_at
        ? generateGoogleCalendarUrl(opp, 'deadline')
        : null;
    const hasExactDeadline = Boolean(opp.deadline_at) && opp.deadline_confidence !== 'rolling';
    const canNavigate = Boolean(onNavigateNext || onNavigatePrev);

    const animateToOpportunity = (direction: 'next' | 'previous') => {
        const navigate = direction === 'next' ? onNavigateNext : onNavigatePrev;
        if (!navigate) {
            setDragX(0);
            setIsDragging(false);
            setMotionPhase('idle');
            return;
        }

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
            setMotionPhase('idle');
            setDragX(0);
            setCardOpacity(1);
            navigate();
            return;
        }

        setIsDragging(false);
        setMotionPhase('exiting');
        const exitOffset = direction === 'next'
            ? -Math.max(window.innerWidth * 0.85, 480)
            : Math.max(window.innerWidth * 0.85, 480);
        setDragX(exitOffset);
        setCardOpacity(0.9);

        swipeTimerRef.current = window.setTimeout(() => {
            swipeTimerRef.current = null;
            pendingEntranceRef.current = direction;
            navigate();
        }, 190);
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
        const target = event.target;
        if (
            !canNavigate
            || motionPhase !== 'idle'
            || swipeTimerRef.current !== null
            || event.button !== 0
            || (target instanceof Element && Boolean(target.closest('button, a, input, textarea, select')))
        ) return;

        const now = performance.now();
        gestureRef.current = {
            active: true,
            axis: 'pending',
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
            startTime: now,
            lastTime: now,
            velocityX: 0,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        if (event.pointerType === 'mouse') event.preventDefault();
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
        const gesture = gestureRef.current;
        if (!gesture.active || gesture.pointerId !== event.pointerId) return;

        const now = performance.now();
        const dt = now - gesture.lastTime;
        if (dt > 3) {
            const instantV = (event.clientX - gesture.lastX) / dt;
            gesture.velocityX = gesture.velocityX * 0.35 + instantV * 0.65;
        }
        gesture.lastX = event.clientX;
        gesture.lastY = event.clientY;
        gesture.lastTime = now;

        const deltaX = gesture.lastX - gesture.startX;
        const deltaY = gesture.lastY - gesture.startY;

        if (gesture.axis === 'pending') {
            if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return;
            gesture.axis = Math.abs(deltaX) > Math.abs(deltaY) * 1.08 ? 'horizontal' : 'vertical';
        }

        if (gesture.axis === 'vertical') {
            gesture.active = false;
            gesture.pointerId = null;
            setDragX(0);
            setCardOpacity(1);
            setIsDragging(false);
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
            return;
        }

        if (gesture.axis === 'horizontal') {
            if (event.cancelable) event.preventDefault();
            setIsDragging(true);
            setDragX(deltaX);
            setCardOpacity(1);
        }
    };

    const finishSwipe = (event: React.PointerEvent<HTMLElement>) => {
        const gesture = gestureRef.current;
        if (!gesture.active || gesture.pointerId !== event.pointerId) return;

        const deltaX = gesture.lastX - gesture.startX;
        const deltaY = gesture.lastY - gesture.startY;
        const wasHorizontal = gesture.axis === 'horizontal';
        const velocityX = gesture.velocityX;

        gesture.active = false;
        gesture.axis = 'pending';
        gesture.pointerId = null;

        if (wasHorizontal) {
            const isFlick = Math.abs(velocityX) > 0.32;
            const isDrag = Math.abs(deltaX) >= 70;
            const isDominant = Math.abs(deltaX) > Math.abs(deltaY);

            if ((isFlick || isDrag) && isDominant && canNavigate) {
                const direction = (isFlick ? velocityX : deltaX) < 0 ? 'next' : 'previous';
                animateToOpportunity(direction);
                return;
            }
        }

        setIsDragging(false);
        setMotionPhase('idle');
        setDragX(0);
        setCardOpacity(1);
    };

    const cancelSwipe = (event: React.PointerEvent<HTMLElement>) => {
        const gesture = gestureRef.current;
        if (gesture.pointerId !== event.pointerId) return;
        gesture.active = false;
        gesture.axis = 'pending';
        gesture.pointerId = null;
        setIsDragging(false);
        setDragX(0);
        setCardOpacity(1);
    };

    const handleLostPointerCapture = (event: React.PointerEvent<HTMLElement>) => {
        const gesture = gestureRef.current;
        if (gesture.pointerId !== event.pointerId) return;
        gesture.active = false;
        gesture.axis = 'pending';
        gesture.pointerId = null;
        setIsDragging(false);
        if (motionPhase === 'idle') {
            setDragX(0);
            setCardOpacity(1);
        }
    };

    const handleToggleDone = async () => {
        if (!isAuthenticated || isMarkingDone) return;
        setIsMarkingDone(true);
        try {
            await onUpdateStatus(opp.id, opp.status === 'applied' ? 'reviewing' : 'applied');
        } finally {
            setIsMarkingDone(false);
        }
    };

    const handleDelete = async () => {
        if (deleteStep !== 'confirming') return;
        setDeleteStep('deleting');
        try {
            await onDelete(opp.id);
            onClose();
        } catch {
            setDeleteStep('confirming');
        }
    };

    if (!isOpen) return null;

    return (
        <dialog
            ref={dialogRef}
            className="opp-detail-dialog"
            aria-labelledby="opp-detail-title"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="opp-focus-stage">
                <article
                    className={`opp-focus-card ${isDragging ? 'is-dragging' : ''} is-${motionPhase}`}
                    style={{
                        transform: `translate3d(${dragX}px, 0, 0) rotate(${Math.max(-8, Math.min(8, dragX / 42))}deg)`,
                        opacity: cardOpacity,
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={finishSwipe}
                    onPointerCancel={cancelSwipe}
                    onLostPointerCapture={handleLostPointerCapture}
                    onTransitionEnd={(event) => {
                        if (event.propertyName === 'transform' && motionPhase === 'entering') {
                            setMotionPhase('idle');
                        }
                    }}
                >
                    <div className="opp-focus-scroll">
                        <div className="opp-focus-topbar">
                            <p className="opp-focus-category">
                                <img
                                    src={categoryIconUrl}
                                    alt=""
                                    aria-hidden="true"
                                    className="opp-focus-category-icon"
                                    width="34"
                                    height="34"
                                />
                                <span>{categoryLabel}</span>
                            </p>
                            <button
                                ref={closeButtonRef}
                                type="button"
                                className="opp-focus-close"
                                onClick={onClose}
                                aria-label="Close opportunity details"
                            >
                                <X aria-hidden="true" />
                            </button>
                        </div>
                        <header className="opp-focus-hero">
                            <div className="opp-focus-identity">
                                <h2 id="opp-detail-title">{displayTitle}</h2>
                                <p className="opp-focus-organisation">{opp.organisation}</p>
                            </div>
                            <div className={`opp-focus-deadline ${hasExactDeadline ? '' : 'is-undated'}`}>
                                <p className={`opp-focus-urgency ${urgency.level}`}>
                                    <strong>{urgency.label}</strong>
                                </p>
                                {hasExactDeadline && (
                                    <p className="opp-focus-deadline-date">
                                        <span>Deadline</span>
                                        <time dateTime={opp.deadline_at || undefined}>{formattedDeadline}</time>
                                    </p>
                                )}
                            </div>
                        </header>

                        <section className="opp-focus-next" aria-labelledby="opp-next-action-heading">
                            <p id="opp-next-action-heading">Next action</p>
                            <h3>{nextAction}</h3>
                        </section>

                        <section className="opp-focus-section" aria-labelledby="opp-about-heading">
                            <div className="opp-focus-section-heading">
                                <span aria-hidden="true">01</span>
                                <h3 id="opp-about-heading">About the opportunity</h3>
                            </div>
                            <p className="opp-focus-summary">
                                {opp.summary || 'No summary was found. Review the original listing before applying.'}
                            </p>
                            <dl className="opp-focus-facts">
                                <div>
                                    <dt>Location</dt>
                                    <dd>{opp.location || 'Not provided'}</dd>
                                </div>
                                <div>
                                    <dt>Funding / award</dt>
                                    <dd>{opp.fee_or_funding || 'Not provided'}</dd>
                                </div>
                                <div>
                                    <dt>Application fee</dt>
                                    <dd>{opp.application_fee || 'Not provided'}</dd>
                                </div>
                                <div>
                                    <dt>Event date</dt>
                                    <dd>{formattedEventDate}</dd>
                                </div>
                            </dl>
                            {eligibilityTags.length > 0 && (
                                <div className="opp-focus-eligibility">
                                    <h4>Eligibility</h4>
                                    <ul role="list">
                                        {eligibilityTags.map((tag) => <li key={tag}>{tag}</li>)}
                                    </ul>
                                </div>
                            )}
                        </section>

                        <section className="opp-focus-section" aria-labelledby="opp-application-heading">
                            <div className="opp-focus-section-heading">
                                <span aria-hidden="true">02</span>
                                <h3 id="opp-application-heading">Application essentials</h3>
                            </div>
                            {applicationEssentials.length > 0 ? (
                                <ul className="opp-focus-bullets">
                                    {applicationEssentials.map((requirement) => (
                                        <li key={requirement}>{requirement}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="opp-focus-empty">No essential application points were found. Check the original listing before applying.</p>
                            )}
                        </section>

                        {opp.notes && (
                            <section className="opp-focus-section" aria-labelledby="opp-notes-heading">
                                <div className="opp-focus-section-heading">
                                    <span aria-hidden="true">03</span>
                                    <h3 id="opp-notes-heading">Your notes</h3>
                                </div>
                                <p className="opp-focus-summary">{opp.notes}</p>
                            </section>
                        )}

                        {isAuthenticated && (
                            <section className="opp-focus-remove" aria-labelledby="opp-remove-heading">
                                <div>
                                    <h3 id="opp-remove-heading">You do not need to see this opportunity anymore?</h3>
                                    <p>Remove it permanently from your radar and database.</p>
                                </div>
                                {deleteStep === 'idle' ? (
                                    <button type="button" onClick={() => setDeleteStep('confirming')}>
                                        <Trash2 aria-hidden="true" size={17} strokeWidth={1.8} />
                                        Delete
                                    </button>
                                ) : (
                                    <div className="opp-focus-delete-confirm" role="group" aria-label="Confirm deletion">
                                        <strong>Are you sure?</strong>
                                        <button type="button" onClick={() => setDeleteStep('idle')} disabled={deleteStep === 'deleting'}>
                                            Cancel
                                        </button>
                                        <button type="button" className="is-danger" onClick={() => void handleDelete()} disabled={deleteStep === 'deleting'}>
                                            {deleteStep === 'deleting' ? 'Deleting…' : 'Yes, delete'}
                                        </button>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>

                    <footer className="opp-focus-actions" aria-label="Opportunity actions">
                        {calendarUrl ? (
                            <a className="opp-focus-action" href={calendarUrl} target="_blank" rel="noopener noreferrer">
                                <span className="opp-focus-action-icon"><CalendarDays aria-hidden="true" /></span>
                                <span>Add to calendar</span>
                            </a>
                        ) : (
                            <span className="opp-focus-action is-disabled" aria-disabled="true">
                                <span className="opp-focus-action-icon"><CalendarDays aria-hidden="true" /></span>
                                <span>Add to calendar</span>
                            </span>
                        )}
                        {opp.source_url ? (
                            <a className="opp-focus-action" href={opp.source_url} target="_blank" rel="noopener noreferrer">
                                <span className="opp-focus-action-icon"><ExternalLink aria-hidden="true" /></span>
                                <span>View original listing</span>
                            </a>
                        ) : (
                            <span className="opp-focus-action is-disabled" aria-disabled="true">
                                <span className="opp-focus-action-icon"><ExternalLink aria-hidden="true" /></span>
                                <span>View original listing</span>
                            </span>
                        )}
                        {showRadarAction ? (
                            <button
                                type="button"
                                className={`opp-focus-action is-radar is-${radarState}`}
                                onClick={() => onAddToRadar?.(opp)}
                                disabled={radarState === 'adding' || radarState === 'added' || radarState === 'already'}
                            >
                                <span className="opp-focus-action-icon"><Radar aria-hidden="true" /></span>
                                <span>{getRadarButtonLabel(radarState).replace(/^[+✓]\s*/, '')}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                className={`opp-focus-action ${opp.status === 'applied' ? 'is-complete' : ''}`}
                                onClick={() => void handleToggleDone()}
                                disabled={!isAuthenticated || isMarkingDone}
                            >
                                <span className="opp-focus-action-icon"><Check aria-hidden="true" /></span>
                                <span>{isMarkingDone ? 'Saving…' : opp.status === 'applied' ? 'Undo done' : 'Mark as done'}</span>
                            </button>
                        )}
                    </footer>
                </article>

                {currentIndex && totalCount && totalCount > 1 && onNavigatePrev && onNavigateNext && (
                    <nav className="opp-focus-navigation" aria-label="Opportunity navigation">
                        <button
                            type="button"
                            onClick={onNavigatePrev}
                            aria-label="Previous opportunity"
                            aria-keyshortcuts="ArrowLeft ArrowUp"
                        >
                            <ArrowLeft aria-hidden="true" />
                        </button>
                        <span aria-live="polite">
                            <span aria-hidden="true">{currentIndex} / {totalCount}</span>
                            <span className="sr-only">Opportunity {currentIndex} of {totalCount}</span>
                        </span>
                        <button
                            type="button"
                            onClick={onNavigateNext}
                            aria-label="Next opportunity"
                            aria-keyshortcuts="ArrowRight ArrowDown"
                        >
                            <ArrowRight aria-hidden="true" />
                        </button>
                    </nav>
                )}
                {canNavigate && <p className="opp-focus-swipe-hint">Swipe to browse</p>}
            </div>
        </dialog>
    );
};
