import {
    ArrowLeft,
    Download,
    LoaderCircle,
    Sparkles
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { slugify, toReadableTitle } from '../../lib/research-workspace/name-utils';
import type {
    GenerateInsightsResponse,
    GetPaperResponse,
    InsightSection,
    UploadedPaper
} from './types';

type CompactInsightsPageProps = {
    paperId?: string | null;
};

const INSIGHT_LOADING_STEPS = [
    'Reading the paper title, author list, year, and publication details.',
    'Checking the abstract and opening sections for the clearest paper summary.',
    'Looking through methods, findings, and conclusion for supported evidence only.',
    'Skipping weak or unclear details so the insight blocks stay clean.',
    'Compacting the strongest points into a short, readable paper summary.',
    'Preparing the final insight sections for this paper.'
];

export default function CompactInsightsPage({
    paperId: initialPaperId = null
}: CompactInsightsPageProps) {
    const [paperId, setPaperId] = useState<string | null>(initialPaperId);
    const [paper, setPaper] = useState<UploadedPaper | null>(null);
    const [isLoadingPaper, setIsLoadingPaper] = useState(Boolean(initialPaperId));
    const [isGenerating, setIsGenerating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loadingStepIndex, setLoadingStepIndex] = useState(0);
    const [showLoadingNote, setShowLoadingNote] = useState(false);

    useEffect(() => {
        if (initialPaperId) {
            return;
        }

        const queryPaperId = new URLSearchParams(window.location.search).get('paper');
        setPaperId(queryPaperId);
        setIsLoadingPaper(Boolean(queryPaperId));
    }, [initialPaperId]);

    useEffect(() => {
        if (!paperId) {
            setPaper(null);
            setIsLoadingPaper(false);
            return;
        }

        let cancelled = false;

        const loadPaper = async () => {
            setErrorMessage(null);
            setIsLoadingPaper(true);

            try {
                const response = await fetch(`/api/paper-renamer/papers/${paperId}`);
                const data = (await response.json()) as GetPaperResponse & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(data.error || 'We could not load this paper.');
                }

                if (!cancelled) {
                    setPaper(data.paper);
                }
            } catch (error) {
                if (!cancelled) {
                    setPaper(null);
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : 'We could not load this paper.'
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingPaper(false);
                }
            }
        };

        void loadPaper();

        return () => {
            cancelled = true;
        };
    }, [paperId]);

    useEffect(() => {
        if (!paper) {
            return;
        }

        const nextPath = buildInsightsPath(paper);
        if (window.location.pathname !== nextPath) {
            window.history.replaceState({}, '', nextPath);
        }
    }, [paper]);

    useEffect(() => {
        if (!isGenerating) {
            setLoadingStepIndex(0);
            setShowLoadingNote(false);
            return;
        }

        const intervalId = window.setInterval(() => {
            setLoadingStepIndex((current) => (current + 1) % INSIGHT_LOADING_STEPS.length);
        }, 2200);
        const noteTimeoutId = window.setTimeout(() => {
            setShowLoadingNote(true);
        }, 5000);

        return () => {
            window.clearInterval(intervalId);
            window.clearTimeout(noteTimeoutId);
        };
    }, [isGenerating]);

    const pageTitle = paper
        ? (paper.displayTitle || '').trim() ||
            toReadableTitle(paper.preferredFileName || paper.cleanFileName)
        : 'Paper Insights';
    const cleanDownloadUrl = paper
        ? `${paper.downloadUrls.clean}&filename=${encodeURIComponent(
            paper.preferredFileName || paper.cleanFileName
        )}`
        : null;
    const summarySection = useMemo(() => buildSummarySection(paper), [paper]);
    const supportingSections = useMemo(
        () => buildSupportingSections(paper, summarySection?.id || null),
        [paper, summarySection]
    );
    const hasInsights = Boolean(summarySection) || supportingSections.length > 0;

    const authorYearLine = useMemo(() => {
        if (!paper) {
            return '';
        }

        return [
            paper.authors.length > 0 ? paper.authors.join(', ') : null,
            paper.year ? String(paper.year) : null
        ].filter(Boolean).join(' · ');
    }, [paper]);

    const publicationLine = useMemo(() => paper?.journal?.trim() || '', [paper]);

    const handleGenerateInsights = async () => {
        if (!paper) {
            return;
        }

        setIsGenerating(true);
        setErrorMessage(null);

        try {
            const response = await fetch(`/api/paper-renamer/papers/${paper.id}/insights`, {
                method: 'POST'
            });

            const data = (await response.json()) as GenerateInsightsResponse & {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(data.error || 'We could not generate insights.');
            }

            setPaper(data.paper);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'We could not generate insights.'
            );
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <section className="rw-page">
            <div className="rw-stage rw-stage--compact-insights">
                <div className="rw-compact-shell">
                    <div className="rw-mode-toolbar">
                        <a className="rw-button rw-button--ghost" href="/paper-renamer">
                            <ArrowLeft size={16} />
                            <span>Back To Renamer</span>
                        </a>
                    </div>

                    <header className="rw-compact-header">
                        <div className="rw-eyebrow">
                            <Sparkles size={14} />
                            <span>Paper Insights</span>
                        </div>
                        <h1>{pageTitle}</h1>
                        {authorYearLine ? (
                            <p className="rw-compact-header__meta">{authorYearLine}</p>
                        ) : null}
                        {publicationLine ? (
                            <p className="rw-compact-header__publication">{publicationLine}</p>
                        ) : null}
                        {cleanDownloadUrl ? (
                            <div className="rw-compact-header__actions">
                                <a
                                    className="rw-button rw-button--secondary"
                                    href={cleanDownloadUrl}
                                >
                                    <Download size={16} />
                                    <span>Download Renamed PDF</span>
                                </a>
                            </div>
                        ) : null}
                    </header>

                    {!paperId && !isLoadingPaper ? (
                        <section className="rw-workspace-card rw-compact-card">
                            <p className="rw-compact-empty">
                                Choose a paper from the renamer to open insights.
                            </p>
                        </section>
                    ) : null}

                    {errorMessage ? (
                        <div className="rw-mini-banner rw-mini-banner--error" role="alert">
                            <span>{errorMessage}</span>
                        </div>
                    ) : null}

                    {isLoadingPaper ? (
                        <section className="rw-workspace-card rw-compact-card rw-compact-card--loading">
                            <LoaderCircle size={18} className="rw-spin" />
                            <p>Loading paper...</p>
                        </section>
                    ) : null}

                    {paper ? (
                        <section className="rw-workspace-card rw-compact-card">
                            <div className="rw-compact-card__toolbar">
                                <div className="rw-inline-badge">
                                    <Sparkles size={14} />
                                    <span>
                                        {hasInsights
                                            ? 'Insights ready'
                                            : 'Insights not generated yet'}
                                    </span>
                                </div>

                                <button
                                    className="rw-button rw-button--primary"
                                    type="button"
                                    onClick={handleGenerateInsights}
                                    disabled={isGenerating}
                                >
                                    {isGenerating ? (
                                        <>
                                            <LoaderCircle size={16} className="rw-spin" />
                                            <span>Generating Insights</span>
                                        </>
                                    ) : (
                                        <span>
                                            {hasInsights
                                                ? 'Refresh Insights'
                                                : 'Generate Insights'}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {isGenerating ? (
                                <>
                                    <div
                                        className="rw-compact-status rw-compact-status--ticker"
                                        aria-live="polite"
                                    >
                                        <div className="rw-compact-status__eyebrow">
                                            <LoaderCircle size={12} className="rw-spin" />
                                            <span>Generating insights</span>
                                        </div>
                                        <div className="rw-compact-status__viewport">
                                            <p
                                                key={loadingStepIndex}
                                                className="rw-compact-status__message"
                                            >
                                                {INSIGHT_LOADING_STEPS[loadingStepIndex]}
                                            </p>
                                        </div>
                                    </div>
                                    {showLoadingNote ? (
                                        <div className="rw-compact-wait-note" aria-live="polite">
                                            <p>
                                                We are using advanced models through OpenRouter,
                                                including OpenAI, Gemini, DeepSeek, and other
                                                leading systems, to read the paper carefully and
                                                extract the most relevant points into a concise,
                                                dependable summary.
                                            </p>
                                            <p>
                                                This can take a little time. If results do not
                                                appear, refresh the insights and try again.
                                            </p>
                                        </div>
                                    ) : null}
                                </>
                            ) : null}

                            {hasInsights ? (
                                <div className="rw-compact-section-stack">
                                    {summarySection ? (
                                        <InsightSectionCard
                                            section={summarySection}
                                            variant="summary"
                                        />
                                    ) : null}

                                    {supportingSections.length > 0 ? (
                                        <div className="rw-core-stack">
                                            {supportingSections.map((section) => (
                                                <InsightSectionCard
                                                    key={section.id}
                                                    section={section}
                                                />
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <p className="rw-compact-empty">
                                    Generate insights to create a short paper summary.
                                </p>
                            )}
                        </section>
                    ) : null}
                </div>
            </div>
        </section>
    );
}

function InsightSectionCard({
    section,
    variant = 'default'
}: {
    section: InsightSection;
    variant?: 'default' | 'summary';
}) {
    const hasQuotes = Boolean(section.quotes && section.quotes.length > 0);
    const showDetail =
        variant !== 'summary' &&
        Boolean(
            section.detail &&
                !isPlaceholderText(section.detail) &&
                section.detail !== section.summary
        );

    return (
        <article
            className={`rw-core-card${variant === 'summary' ? ' rw-core-card--summary' : ''}${
                hasQuotes ? ' rw-core-card--quotes' : ''
            }`}
        >
            <div className="rw-core-card__header">
                <div className="rw-core-card__heading-group">
                    {variant === 'summary' ? (
                        <span className="rw-core-card__eyebrow">Short Summary</span>
                    ) : null}
                    <h2>{section.heading}</h2>
                </div>
                {section.provenance.length > 0 ? (
                    <span className="rw-core-card__pages">
                        p. {section.provenance.map((item) => item.pageNumber).join(', ')}
                    </span>
                ) : null}
            </div>

            <p className="rw-core-card__summary">{section.summary}</p>

            {hasQuotes ? (
                <div className="rw-core-quote-list">
                    {section.quotes?.slice(0, 2).map((quote) => (
                        <div key={quote.id} className="rw-core-quote">
                            <p>{quote.text}</p>
                            <span>p. {quote.provenance.pageNumber}</span>
                        </div>
                    ))}
                </div>
            ) : null}

            {showDetail ? (
                <p className="rw-core-card__detail">{section.detail}</p>
            ) : null}
        </article>
    );
}

function buildSummarySection(paper: UploadedPaper | null): InsightSection | null {
    if (!paper?.insights?.sections) {
        return null;
    }

    const aboutSection = paper.insights.sections.find((section) => section.id === 'about');
    if (aboutSection && isMeaningfulSection(aboutSection)) {
        return aboutSection;
    }

    return (
        paper.insights.sections.find(
            (section) => section.id !== 'quotes' && isMeaningfulSection(section)
        ) || null
    );
}

function buildSupportingSections(
    paper: UploadedPaper | null,
    summarySectionId: InsightSection['id'] | null
): InsightSection[] {
    if (!paper?.insights?.sections) {
        return [];
    }

    const desiredOrder: Array<InsightSection['id']> = [
        'objective',
        'methods',
        'findings',
        'conclusion',
        'quotes',
        'human-detail'
    ];

    return desiredOrder.flatMap((id) => {
        if (id === summarySectionId) {
            return [];
        }

        const section = paper.insights?.sections.find((item) => item.id === id);
        return section && isMeaningfulSection(section) ? [section] : [];
    });
}

function isMeaningfulSection(section: InsightSection): boolean {
    if (section.quotes && section.quotes.length > 0) {
        return true;
    }

    if (section.status === 'missing') {
        return false;
    }

    return !isPlaceholderText(section.summary);
}

function isPlaceholderText(value: string | null | undefined): boolean {
    if (!value) {
        return true;
    }

    return /not clearly found/i.test(value.trim());
}

function buildInsightsPath(paper: UploadedPaper): string {
    const slug =
        slugify((paper.preferredFileName || paper.cleanFileName).replace(/\.pdf$/i, '')) ||
        'paper-insights';

    return `/paper-renamer/insights/${paper.id}/${slug}`;
}
