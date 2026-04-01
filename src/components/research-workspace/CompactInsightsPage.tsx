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

export default function CompactInsightsPage({
    paperId: initialPaperId = null
}: CompactInsightsPageProps) {
    const [paperId, setPaperId] = useState<string | null>(initialPaperId);
    const [paper, setPaper] = useState<UploadedPaper | null>(null);
    const [isLoadingPaper, setIsLoadingPaper] = useState(Boolean(initialPaperId));
    const [isGenerating, setIsGenerating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
                const response = await fetch(`/api/research-workspace/papers/${paperId}`);
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

    const prettyFileTitle = paper
        ? toReadableTitle(paper.preferredFileName || paper.cleanFileName)
        : 'Paper Insights';
    const cleanDownloadUrl = paper
        ? `${paper.downloadUrls.clean}&filename=${encodeURIComponent(
            paper.preferredFileName || paper.cleanFileName
        )}`
        : null;
    const coreSections = useMemo(() => buildCoreSections(paper), [paper]);
    const hasInsights = coreSections.length > 0;

    const metaLine = useMemo(() => {
        if (!paper) {
            return '';
        }

        return [
            paper.authors.length > 0 ? paper.authors.join(', ') : null,
            paper.year ? String(paper.year) : null,
            paper.journal
        ].filter(Boolean).join(' · ');
    }, [paper]);

    const handleGenerateInsights = async () => {
        if (!paper) {
            return;
        }

        setIsGenerating(true);
        setErrorMessage(null);

        try {
            const response = await fetch(
                `/api/research-workspace/papers/${paper.id}/insights`,
                {
                    method: 'POST'
                }
            );

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
                        <a className="rw-button rw-button--ghost" href="/research-workspace">
                            <ArrowLeft size={16} />
                            <span>Back To Renamer</span>
                        </a>
                        {cleanDownloadUrl ? (
                            <a className="rw-button rw-button--secondary" href={cleanDownloadUrl}>
                                <Download size={16} />
                                <span>Download Renamed PDF</span>
                            </a>
                        ) : null}
                    </div>

                    <header className="rw-compact-header">
                        <div className="rw-eyebrow">
                            <Sparkles size={14} />
                            <span>Paper Insights</span>
                        </div>
                        <h1>{prettyFileTitle}</h1>
                        <p>
                            Small, paper-grounded insight boxes only. No added ideas, no extra
                            commentary.
                        </p>
                        {paper?.displayTitle && paper.displayTitle !== prettyFileTitle ? (
                            <p className="rw-compact-header__subtitle">{paper.displayTitle}</p>
                        ) : null}
                        {metaLine ? (
                            <p className="rw-compact-header__meta">{metaLine}</p>
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
                                <div className="rw-compact-status">
                                    <p>Reading the PDF and extracting only supported points.</p>
                                </div>
                            ) : null}

                            {hasInsights ? (
                                <div className="rw-compact-section-stack">
                                    <div className="rw-core-grid">
                                        {coreSections.map((section) =>
                                            section.id === 'quotes' ? (
                                                <QuotesInsightCard
                                                    key={section.id}
                                                    section={section}
                                                />
                                            ) : (
                                                <CoreInsightCard
                                                    key={section.id}
                                                    section={section}
                                                />
                                            )
                                        )}
                                    </div>

                                    {paper.insights?.extractionNotes &&
                                    paper.insights.extractionNotes.length > 0 ? (
                                        <div className="rw-compact-notes">
                                            {paper.insights.extractionNotes
                                                .slice(0, 3)
                                                .map((note, index) => (
                                                    <p key={`${note}-${index}`}>{note}</p>
                                                ))}
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <p className="rw-compact-empty">
                                    Generate insights to open the compact research summary.
                                </p>
                            )}
                        </section>
                    ) : null}
                </div>
            </div>
        </section>
    );
}

function CoreInsightCard({ section }: { section: InsightSection }) {
    return (
        <article className="rw-core-card">
            <div className="rw-core-card__header">
                <h2>{section.heading}</h2>
                {section.provenance.length > 0 ? (
                    <span className="rw-core-card__pages">
                        p. {section.provenance.map((item) => item.pageNumber).join(', ')}
                    </span>
                ) : null}
            </div>
            <p className="rw-core-card__summary">{section.summary}</p>
            {section.detail && section.detail !== section.summary ? (
                <p className="rw-core-card__detail">{section.detail}</p>
            ) : null}
        </article>
    );
}

function QuotesInsightCard({ section }: { section: InsightSection }) {
    return (
        <article className="rw-core-card rw-core-card--quotes">
            <div className="rw-core-card__header">
                <h2>{section.heading}</h2>
            </div>
            {section.quotes && section.quotes.length > 0 ? (
                <div className="rw-core-quote-list">
                    {section.quotes.slice(0, 3).map((quote) => (
                        <div key={quote.id} className="rw-core-quote">
                            <p>{quote.text}</p>
                            <span>p. {quote.provenance.pageNumber}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="rw-core-card__summary">{section.summary}</p>
            )}
            {section.detail && section.detail !== section.summary ? (
                <p className="rw-core-card__detail">{section.detail}</p>
            ) : null}
        </article>
    );
}

function buildCoreSections(paper: UploadedPaper | null): InsightSection[] {
    if (!paper?.insights?.sections) {
        return [];
    }

    const desiredOrder: Array<InsightSection['id']> = [
        'about',
        'objective',
        'methods',
        'findings',
        'conclusion',
        'quotes'
    ];

    return desiredOrder.flatMap((id) => {
        const section = paper.insights?.sections.find((item) => item.id === id);
        return section ? [section] : [];
    });
}

function buildInsightsPath(paper: UploadedPaper): string {
    const slug =
        slugify((paper.preferredFileName || paper.cleanFileName).replace(/\.pdf$/i, '')) ||
        'paper-insights';

    return `/research-workspace/insights/${paper.id}/${slug}`;
}
