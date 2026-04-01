import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Compass, FolderKanban, Sparkles } from 'lucide-react';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import GenerateInsightsButton from './GenerateInsightsButton';
import InsightCard from './InsightCard';
import InsightSummaryView from './InsightSummaryView';
import PaperBatchList from './PaperBatchList';
import RenamePanel from './RenamePanel';
import RenamerFocusPanel from './RenamerFocusPanel';
import UploadPanel from './UploadPanel';
import UploadProgress from './UploadProgress';
import type {
    GenerateInsightsResponse,
    PaperInsightSummary,
    RenameMode,
    RenamePaperResponse,
    UploadedPaper,
    UploadPaperResponse,
    UploadState
} from './types';

type WorkspaceToolMode = 'renamer' | 'insights';

type PaperListResponse = {
    papers: UploadedPaper[];
    error?: string;
};

const INSIGHT_STATUS_STAGES = [
    'Reading document structure',
    'Extracting page text',
    'Running OCR on image pages',
    'Finding abstract and conclusion',
    'Identifying methods and sample',
    'Locating key findings',
    'Checking notable quotes',
    'Writing simplified insights'
] as const;

const toolMeta: Record<WorkspaceToolMode, {
    title: string;
    subtitle: string;
    uploadHeading: string;
    uploadHint: string;
}> = {
    renamer: {
        title: 'Research Paper Renamer',
        subtitle:
            'Upload a PDF or paste a paper link, clean filenames instantly, and download organized copies.',
        uploadHeading: 'Upload papers to rename',
        uploadHint:
            'Bring in one PDF, a full batch, or a paper link. Each paper gets a clean research-paper filename and stays ready for download.'
    },
    insights: {
        title: 'Insights Generator',
        subtitle:
            'Upload a paper or paste a paper link, keep the clean filename, and turn the document into a readable structured summary.',
        uploadHeading: 'Upload a paper for insights',
        uploadHint:
            'Upload a paper or paste a paper link here, keep the clean renamed file, and generate grounded insights from the actual PDF.'
    }
};

export default function ResearchWorkspaceToolPage({
    mode
}: {
    mode: WorkspaceToolMode;
}) {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [sourceUrl, setSourceUrl] = useState('');
    const [papers, setPapers] = useState<UploadedPaper[]>([]);
    const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
    const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

    const [uploadState, setUploadState] = useState<UploadState>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatusText, setUploadStatusText] = useState('');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [batchStatusMessage, setBatchStatusMessage] = useState<string | null>(null);

    const [renameDraft, setRenameDraft] = useState('');
    const [renameMode, setRenameMode] = useState<RenameMode>('idle');
    const [renameStatusMessage, setRenameStatusMessage] = useState<string | null>(null);

    const [processingInsightPaperId, setProcessingInsightPaperId] = useState<string | null>(null);
    const [insightProgress, setInsightProgress] = useState(0);
    const [insightStatusText, setInsightStatusText] = useState('');
    const [insightErrorPaperId, setInsightErrorPaperId] = useState<string | null>(null);
    const [insightError, setInsightError] = useState<string | null>(null);

    const requestedPaperIdRef = useRef<string | null>(null);
    const insightIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        requestedPaperIdRef.current = new URLSearchParams(window.location.search).get('paper');
    }, []);

    useEffect(() => {
        void loadPapers();

        return () => {
            if (insightIntervalRef.current) {
                window.clearInterval(insightIntervalRef.current);
            }
        };
    }, []);

    const selectedLabel = useMemo(() => {
        if (selectedFiles.length === 0) {
            return '';
        }

        if (selectedFiles.length === 1) {
            return selectedFiles[0]?.name || '';
        }

        return `${selectedFiles.length} PDFs selected`;
    }, [selectedFiles]);

    const selectedPaper = useMemo(
        () => papers.find((paper) => paper.id === selectedPaperId) || null,
        [papers, selectedPaperId]
    );

    const selectedInsights: PaperInsightSummary | null = selectedPaper?.insights || null;
    const isGeneratingInsights = Boolean(
        selectedPaper && processingInsightPaperId === selectedPaper.id
    );
    const selectedInsightError =
        selectedPaper && insightErrorPaperId === selectedPaper.id ? insightError : null;

    useEffect(() => {
        if (!selectedPaper) {
            setRenameDraft('');
            setRenameMode('idle');
            setRenameStatusMessage(null);
            return;
        }

        setRenameDraft(selectedPaper.preferredFileName || selectedPaper.cleanFileName);
        setRenameMode(deriveRenameMode(selectedPaper));
        setRenameStatusMessage(null);
    }, [
        selectedPaperId,
        selectedPaper?.preferredFileName,
        selectedPaper?.cleanFileName,
        selectedPaper?.originalFileName
    ]);

    const queueLayoutMode = papers.length > 0 ? 'split-ready' : 'centered';
    const meta = toolMeta[mode];

    const cleanDownloadUrl = selectedPaper
        ? `${selectedPaper.downloadUrls.clean}&filename=${encodeURIComponent(
            renameMode === 'original'
                ? selectedPaper.cleanFileName
                : renameDraft.trim() || selectedPaper.preferredFileName || selectedPaper.cleanFileName
        )}`
        : null;

    const originalDownloadUrl = selectedPaper?.downloadUrls.original || null;

    const upsertPaper = (paper: UploadedPaper) => {
        setPapers((currentPapers) => {
            const existingIndex = currentPapers.findIndex((item) => item.id === paper.id);
            if (existingIndex === -1) {
                return [paper, ...currentPapers];
            }

            const nextPapers = [...currentPapers];
            nextPapers[existingIndex] = paper;
            return nextPapers;
        });
    };

    async function loadPapers() {
        try {
            const response = await fetch('/api/research-workspace/papers');
            const data = (await response.json()) as PaperListResponse;

            if (!response.ok) {
                throw new Error(data.error || 'We could not load saved papers.');
            }

            setPapers(data.papers);

            const requestedPaperId = requestedPaperIdRef.current;
            if (requestedPaperId && data.papers.some((paper) => paper.id === requestedPaperId)) {
                setSelectedPaperId(requestedPaperId);
                requestedPaperIdRef.current = null;
            } else if (data.papers.length > 0) {
                setSelectedPaperId((currentId) => currentId || data.papers[0].id);
            }
        } catch (error) {
            setInitialLoadError(
                error instanceof Error
                    ? error.message
                    : 'We could not load saved papers.'
            );
        }
    }

    const handleFilesSelected = (files: File[]) => {
        const pdfFiles = files.filter((file) => {
            return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        });

        setSelectedFiles(pdfFiles);
        setSourceUrl('');
        setUploadState('idle');
        setUploadProgress(0);
        setUploadStatusText('');
        setUploadError(null);
        setBatchStatusMessage(null);

        if (files.length > 0 && pdfFiles.length === 0) {
            setUploadError('This file is not a supported PDF.');
        }
    };

    const resetUploadUi = () => {
        setUploadState('idle');
        setUploadProgress(0);
        setUploadStatusText('');
        setUploadError(null);
        setBatchStatusMessage(null);
    };

    const handleLinkChange = (value: string) => {
        setSourceUrl(value);
        setSelectedFiles([]);
        resetUploadUi();
    };

    const beginUploadBatch = async () => {
        if (selectedFiles.length === 0) {
            setUploadState('error');
            setUploadError('Choose one or more PDFs first.');
            return;
        }

        setUploadState('uploading');
        setUploadProgress(8);
        setUploadError(null);
        setBatchStatusMessage(null);

        const failures: string[] = [];
        let firstUploadedPaperId: string | null = null;

        for (let index = 0; index < selectedFiles.length; index += 1) {
            const file = selectedFiles[index];
            const baseProgress = Math.round((index / selectedFiles.length) * 100);

            setUploadProgress(Math.max(8, baseProgress));
            setUploadStatusText(`Uploading ${index + 1} of ${selectedFiles.length}: ${file.name}`);

            try {
                const formData = new FormData();
                formData.append('sourceType', 'file');
                formData.append('file', file);

                const response = await fetch('/api/research-workspace/papers', {
                    method: 'POST',
                    body: formData
                });

                const data = (await response.json()) as UploadPaperResponse & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(data.error || 'Upload failed.');
                }

                if (!firstUploadedPaperId) {
                    firstUploadedPaperId = data.paper.id;
                }

                startTransition(() => {
                    upsertPaper(data.paper);
                });

                setUploadProgress(
                    Math.round(((index + 1) / selectedFiles.length) * 100)
                );
                setUploadStatusText(`Paper ${index + 1} of ${selectedFiles.length} is ready`);
            } catch (error) {
                failures.push(
                    error instanceof Error
                        ? `${file.name}: ${error.message}`
                        : `${file.name}: upload failed`
                );
            }
        }

        if (firstUploadedPaperId) {
            setSelectedPaperId(firstUploadedPaperId);
        }

        setSelectedFiles([]);
        setUploadStatusText('Paper upload complete');

        if (failures.length > 0) {
            setUploadError(failures.join(' | '));
        }

        setUploadState('ready');
        setUploadProgress(100);
        setBatchStatusMessage(
            failures.length > 0
                ? `${selectedFiles.length - failures.length} papers are ready. ${failures.length} could not be processed.`
                : `${selectedFiles.length} paper${selectedFiles.length === 1 ? '' : 's'} uploaded and renamed.`
        );
    };

    const beginLinkImport = async () => {
        if (!sourceUrl.trim()) {
            setUploadState('error');
            setUploadError('Paste a paper PDF link first.');
            return;
        }

        setUploadState('uploading');
        setUploadProgress(14);
        setUploadError(null);
        setBatchStatusMessage(null);
        setUploadStatusText('Fetching PDF link and preparing extraction');

        try {
            const formData = new FormData();
            formData.append('sourceType', 'link');
            formData.append('sourceUrl', sourceUrl.trim());

            const response = await fetch('/api/research-workspace/papers', {
                method: 'POST',
                body: formData
            });

            const data = (await response.json()) as UploadPaperResponse & {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(data.error || 'Link import failed.');
            }

            startTransition(() => {
                upsertPaper(data.paper);
                setSelectedPaperId(data.paper.id);
            });

            setSourceUrl('');
            setUploadState('ready');
            setUploadProgress(100);
            setUploadStatusText('Paper link imported successfully');
            setBatchStatusMessage('Paper imported, extracted, and ready for rename.');
        } catch (error) {
            setUploadState('error');
            setUploadProgress(0);
            setUploadStatusText('');
            setUploadError(
                error instanceof Error
                    ? error.message
                    : 'We could not import that paper link.'
            );
        }
    };

    const persistRenamePreference = async (
        selection: Exclude<RenameMode, 'idle'>,
        fileNameOverride?: string
    ) => {
        if (!selectedPaper) {
            return;
        }

        const nextFileName = (fileNameOverride || renameDraft || selectedPaper.cleanFileName).trim();

        if (!nextFileName) {
            setRenameStatusMessage('Add a filename before saving it.');
            return;
        }

        setRenameStatusMessage('Saving filename preference...');

        try {
            const response = await fetch(
                `/api/research-workspace/papers/${selectedPaper.id}/rename`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        preferredFileName: nextFileName,
                        selection
                    })
                }
            );

            const data = (await response.json()) as RenamePaperResponse & {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(data.error || 'Rename failed.');
            }

            upsertPaper(data.paper);
            setRenameDraft(data.paper.preferredFileName);
            setRenameMode(selection);
            setRenameStatusMessage(
                selection === 'original'
                    ? 'Original filename selected and saved.'
                    : selection === 'custom'
                        ? 'Custom filename saved.'
                        : 'Clean filename selected and saved.'
            );
        } catch (error) {
            setRenameStatusMessage(
                error instanceof Error
                    ? error.message
                    : 'We could not update the filename.'
            );
        }
    };

    const beginInsightTicker = () => {
        if (insightIntervalRef.current) {
            window.clearInterval(insightIntervalRef.current);
        }

        let index = 0;
        setInsightProgress(12);
        setInsightStatusText(INSIGHT_STATUS_STAGES[index] || '');

        insightIntervalRef.current = window.setInterval(() => {
            index = Math.min(index + 1, INSIGHT_STATUS_STAGES.length - 1);
            setInsightStatusText(INSIGHT_STATUS_STAGES[index] || '');
            setInsightProgress((currentProgress) => Math.min(currentProgress + 12, 88));
        }, 520);
    };

    const stopInsightTicker = () => {
        if (insightIntervalRef.current) {
            window.clearInterval(insightIntervalRef.current);
            insightIntervalRef.current = null;
        }
    };

    const handleGenerateInsights = async () => {
        if (!selectedPaper) {
            setInsightError('Upload a paper before generating insights.');
            setInsightErrorPaperId(null);
            return;
        }

        if (
            renameDraft.trim() &&
            renameDraft.trim() !== selectedPaper.preferredFileName &&
            renameMode === 'custom'
        ) {
            await persistRenamePreference('custom', renameDraft.trim());
        }

        setInsightError(null);
        setInsightErrorPaperId(null);
        setProcessingInsightPaperId(selectedPaper.id);
        beginInsightTicker();

        try {
            const response = await fetch(
                `/api/research-workspace/papers/${selectedPaper.id}/insights`,
                {
                    method: 'POST'
                }
            );

            const data = (await response.json()) as GenerateInsightsResponse & {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(data.error || 'Insight generation failed.');
            }

            stopInsightTicker();
            setInsightProgress(100);
            setInsightStatusText('Insight summary ready');

            startTransition(() => {
                upsertPaper(data.paper);
                setSelectedPaperId(data.paper.id);
                setProcessingInsightPaperId(null);
            });
        } catch (error) {
            stopInsightTicker();
            setProcessingInsightPaperId(null);
            setInsightProgress(0);
            setInsightStatusText('');
            setInsightError(
                error instanceof Error
                    ? error.message
                    : 'We could not generate insights for this paper.'
            );
            setInsightErrorPaperId(selectedPaper.id);
        }
    };

    const downloadBlob = async (url: string, fileName: string) => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Could not download ${fileName}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        window.setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
        }, 1000);
    };

    const handleDownloadAll = async () => {
        if (papers.length === 0) {
            return;
        }

        setBatchStatusMessage('Downloading clean PDFs one by one...');
        const failures: string[] = [];

        for (const paper of papers) {
            const fileName = paper.preferredFileName || paper.cleanFileName;
            const url = `${paper.downloadUrls.clean}&filename=${encodeURIComponent(fileName)}`;

            try {
                await downloadBlob(url, fileName);
                await delay(180);
            } catch (_error) {
                failures.push(paper.displayTitle);
            }
        }

        setBatchStatusMessage(
            failures.length > 0
                ? `Download finished with ${failures.length} issue${failures.length === 1 ? '' : 's'}: ${failures.join(', ')}.`
                : `All ${papers.length} clean PDFs started downloading.`
        );
    };

    return (
        <section className="rw-page">
            <div className="rw-stage">
                <header className="rw-hero rw-hero--tool">
                    <div className="rw-eyebrow">
                        <Compass size={14} />
                        <span>Abodid Research Workspace</span>
                    </div>
                    <h1>{meta.title}</h1>
                    <p>{meta.subtitle}</p>
                </header>

                <div className="rw-workspace-card">
                    <section
                        className="rw-rename-shell"
                        data-layout-mode={queueLayoutMode}
                    >
                        <div className="rw-mode-toolbar">
                            <a className="rw-button rw-button--ghost" href="/research-workspace">
                                <ArrowLeft size={16} />
                                <span>Back</span>
                            </a>
                            {mode === 'renamer' ? (
                                <a
                                    className="rw-chip rw-chip--link"
                                    href={
                                        selectedPaper
                                            ? `/research-workspace/insights?paper=${encodeURIComponent(selectedPaper.id)}`
                                            : '/research-workspace/insights'
                                    }
                                >
                                    Open Insights Generator
                                </a>
                            ) : (
                                <a className="rw-chip rw-chip--link" href="/research-workspace/renamer">
                                    Open Research Paper Renamer
                                </a>
                            )}
                        </div>

                        <div className="rw-rename-shell__sidebar">
                            <UploadPanel
                                selectedLabel={selectedLabel}
                                queuedCount={papers.length}
                                uploadState={uploadState}
                                uploadProgress={uploadProgress}
                                uploadStatusText={uploadStatusText}
                                errorMessage={uploadError}
                                linkValue={sourceUrl}
                                heading={meta.uploadHeading}
                                hint={meta.uploadHint}
                                onFilesSelected={handleFilesSelected}
                                onLinkChange={handleLinkChange}
                                onUploadLink={beginLinkImport}
                                onUploadFiles={beginUploadBatch}
                            />

                            {initialLoadError ? (
                                <ErrorState
                                    title="Saved papers unavailable"
                                    message={initialLoadError}
                                />
                            ) : null}

                            <PaperBatchList
                                papers={papers}
                                selectedPaperId={selectedPaperId}
                                processingInsightPaperId={processingInsightPaperId}
                                onSelectPaper={setSelectedPaperId}
                                onDownloadAll={handleDownloadAll}
                            />

                            {batchStatusMessage ? (
                                <div className="rw-inline-status">
                                    <FolderKanban size={14} />
                                    <span>{batchStatusMessage}</span>
                                </div>
                            ) : null}

                            <RenamePanel
                                paper={selectedPaper}
                                fileName={renameDraft}
                                nameMode={renameMode}
                                statusMessage={renameStatusMessage}
                                cleanDownloadUrl={cleanDownloadUrl}
                                originalDownloadUrl={originalDownloadUrl}
                                onFileNameChange={(value) => {
                                    setRenameDraft(value);
                                    setRenameMode('custom');
                                    setRenameStatusMessage('Custom filename draft ready to save.');
                                }}
                                onFileNameBlur={() => {
                                    if (
                                        selectedPaper &&
                                        renameDraft.trim() &&
                                        renameDraft.trim() !== selectedPaper.preferredFileName
                                    ) {
                                        void persistRenamePreference('custom', renameDraft.trim());
                                    }
                                }}
                                onApplyCleanName={() => {
                                    if (!selectedPaper) {
                                        return;
                                    }

                                    setRenameDraft(selectedPaper.cleanFileName);
                                    void persistRenamePreference('clean', selectedPaper.cleanFileName);
                                }}
                                onUseOriginalName={() => {
                                    if (!selectedPaper) {
                                        return;
                                    }

                                    setRenameDraft(selectedPaper.originalFileName);
                                    void persistRenamePreference('original', selectedPaper.originalFileName);
                                }}
                            />
                        </div>

                        <div className="rw-rename-shell__content">
                            {mode === 'insights' ? (
                                <section className="rw-section">
                                    <div className="rw-section-heading rw-section-heading--spread">
                                        <div>
                                            <p className="rw-section-heading__eyebrow">Insights</p>
                                            <h2>Read the selected paper faster</h2>
                                        </div>
                                        <GenerateInsightsButton
                                            disabled={!selectedPaper || isGeneratingInsights}
                                            isLoading={isGeneratingInsights}
                                            onClick={handleGenerateInsights}
                                        />
                                    </div>

                                    {!selectedPaper ? (
                                        <EmptyState
                                            icon={<Sparkles size={20} />}
                                            title="Upload a paper to start generating insights"
                                            description="Once a paper is uploaded, its clean renamed file stays available while the summary is generated here."
                                        />
                                    ) : null}

                                    {selectedPaper && !selectedInsights && !isGeneratingInsights && !selectedInsightError ? (
                                        <div className="rw-preinsight-shell">
                                            <div className="rw-inline-status">
                                                <FolderKanban size={14} />
                                                <span>
                                                    {selectedPaper.displayTitle} is ready for insight generation.
                                                </span>
                                            </div>
                                            <div className="rw-insight-grid">
                                                {Array.from({ length: 3 }).map((_, index) => (
                                                    <InsightCard
                                                        key={`insight-preview-${index}`}
                                                        isPlaceholder
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}

                                    {selectedPaper && isGeneratingInsights ? (
                                        <div className="rw-insights-stack">
                                            <UploadProgress
                                                label="Generating structured paper insights"
                                                progress={insightProgress}
                                                statusText={insightStatusText}
                                                description="The paper is being processed page by page so the summary stays grounded in the actual document."
                                            />
                                            <div className="rw-insight-grid">
                                                {Array.from({ length: 3 }).map((_, index) => (
                                                    <InsightCard
                                                        key={`insight-placeholder-${index}`}
                                                        isPlaceholder
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}

                                    {selectedPaper && selectedInsightError ? (
                                        <ErrorState
                                            title="Insight generation paused"
                                            message={selectedInsightError}
                                        />
                                    ) : null}

                                    {selectedPaper && selectedInsights ? (
                                        <InsightSummaryView
                                            paper={selectedPaper}
                                            insights={selectedInsights}
                                            cleanDownloadUrl={cleanDownloadUrl || '#'}
                                            originalDownloadUrl={originalDownloadUrl || '#'}
                                            onPrint={() => window.print()}
                                        />
                                    ) : null}
                                </section>
                            ) : (
                                <RenamerFocusPanel
                                    paper={selectedPaper}
                                    cleanDownloadUrl={cleanDownloadUrl}
                                    originalDownloadUrl={originalDownloadUrl}
                                    insightsHref={
                                        selectedPaper
                                            ? `/research-workspace/insights?paper=${encodeURIComponent(selectedPaper.id)}`
                                            : '/research-workspace/insights'
                                    }
                                />
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </section>
    );
}

function deriveRenameMode(paper: UploadedPaper): RenameMode {
    if (!paper.preferredFileName) {
        return 'idle';
    }

    if (paper.preferredFileName === paper.originalFileName) {
        return 'original';
    }

    if (paper.preferredFileName === paper.cleanFileName) {
        return 'clean';
    }

    return 'custom';
}

function delay(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}
