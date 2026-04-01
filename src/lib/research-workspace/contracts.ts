export type WorkspaceTabId = 'search' | 'rename';

export type SearchState = 'idle' | 'loading' | 'ready' | 'error';

export type UploadState = 'idle' | 'uploading' | 'ready' | 'error';

export type InsightState = 'idle' | 'generating' | 'ready' | 'error';

export type UploadSource = 'file' | 'link';

export type SearchProvider = 'google' | 'openalex' | 'crossref';

export type ExtractionSource = 'native' | 'ocr' | 'mixed';

export type RenameMode = 'idle' | 'clean' | 'original' | 'custom';

export type UploadStatus =
    | 'pending'
    | 'uploading'
    | 'uploaded'
    | 'failed';

export type ExtractionStatus =
    | 'pending'
    | 'processing'
    | 'complete'
    | 'partial'
    | 'failed';

export type StoredInsightStatus =
    | 'idle'
    | 'processing'
    | 'ready'
    | 'failed';

export type PaperResult = {
    id: string;
    title: string;
    authors: string[];
    year: number | null;
    relevanceNote: string;
    sourceLabel: string;
    venue: string | null;
    doi: string | null;
    actionLabel: string;
    actionUrl: string | null;
    pdfUrl: string | null;
    landingPageUrl: string | null;
    isOpenAccess: boolean;
    provider: SearchProvider;
};

export type PageProvenance = {
    pageNumber: number;
    extractionType: ExtractionSource;
    confidence: number | null;
};

export type ExtractedPage = PageProvenance & {
    text: string;
    nativeLength: number;
    ocrLength: number;
    wasOcrAttempted: boolean;
};

export type InsightQuote = {
    id: string;
    text: string;
    note: string;
    provenance: PageProvenance;
};

export type InsightSectionId =
    | 'about'
    | 'objective'
    | 'methods'
    | 'findings'
    | 'conclusion'
    | 'quotes'
    | 'human-detail';

export type InsightSection = {
    id: InsightSectionId;
    heading: string;
    summary: string;
    detail: string | null;
    status: 'found' | 'partial' | 'missing';
    provenance: PageProvenance[];
    quotes?: InsightQuote[];
};

export type InsightSnapshotFieldId =
    | 'paper-about'
    | 'construct'
    | 'research-focus'
    | 'people'
    | 'participants'
    | 'location'
    | 'conducted-by'
    | 'conclusion';

export type InsightSnapshotGroupId =
    | 'paper'
    | 'study'
    | 'context'
    | 'outcome';

export type InsightSnapshotField = {
    id: InsightSnapshotFieldId;
    label: string;
    value: string;
    evidence: string | null;
    status: 'found' | 'partial' | 'missing';
    provenance: PageProvenance[];
};

export type InsightSnapshotGroup = {
    id: InsightSnapshotGroupId;
    heading: string;
    fields: InsightSnapshotField[];
};

export type CuratedPdfMetadataPreview = {
    publisher: string | null;
    authorsLine: string | null;
    doi: string | null;
    abstract: string | null;
    rightsMessage: string;
};

export type PaperInsightSummary = {
    generatedAt: string;
    modelLabel: string | null;
    extractionNotes: string[];
    sections: InsightSection[];
    provenanceMap: Record<string, PageProvenance[]>;
    snapshot?: InsightSnapshotGroup[];
};

export type UploadedPaper = {
    id: string;
    source: UploadSource;
    sourceUrl: string | null;
    sourceLabel: string;
    displayTitle: string;
    detectedTitle: string;
    originalFileName: string;
    cleanFileName: string;
    preferredFileName: string;
    storagePath: string;
    doi: string | null;
    authors: string[];
    year: number | null;
    journal: string | null;
    abstract: string | null;
    uploadStatus: UploadStatus;
    extractionStatus: ExtractionStatus;
    insightStatus: StoredInsightStatus;
    pageCount: number | null;
    warnings: string[];
    downloadUrls: {
        original: string;
        clean: string;
    };
    curation: CuratedPdfMetadataPreview | null;
    insights: PaperInsightSummary | null;
};

export type UploadPaperResponse = {
    paper: UploadedPaper;
    meta: {
        extractedWithOcr: boolean;
        warnings: string[];
        linkResolvedFrom?: string | null;
    };
};

export type RenamePaperRequest = {
    preferredFileName: string;
    selection: Exclude<RenameMode, 'idle'>;
};

export type RenamePaperResponse = {
    paper: UploadedPaper;
};

export type GenerateInsightsResponse = {
    paper: UploadedPaper;
    insights: PaperInsightSummary;
    meta: {
        usedOpenRouter: boolean;
        fallbackUsed: boolean;
    };
};

export type GetPaperResponse = {
    paper: UploadedPaper;
};
