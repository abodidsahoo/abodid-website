import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
    ExtractedPage,
    PaperInsightSummary,
    UploadedPaper,
    UploadSource
} from './contracts';
import {
    buildDownloadUrl,
    getSourceLabel
} from './paper-utils';

export const RESEARCH_WORKSPACE_TABLE = 'research_workspace_papers';
export const RESEARCH_PAPERS_BUCKET = 'research-workspace-papers';
export const RESEARCH_WORKSPACE_ANALYSIS_VERSION = 'research-workspace-v1';

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type ResearchPaperRow = {
    id: string;
    file_fingerprint: string;
    analysis_version: string;
    original_filename: string;
    cleaned_filename: string | null;
    preferred_filename: string | null;
    display_title: string | null;
    source_type: UploadSource;
    source_url: string | null;
    storage_bucket: string;
    storage_path: string;
    doi: string | null;
    authors_json: Json;
    year: number | null;
    journal: string | null;
    abstract: string | null;
    upload_status: 'pending' | 'uploading' | 'uploaded' | 'failed';
    extraction_status: 'pending' | 'processing' | 'complete' | 'partial' | 'failed';
    ocr_status: 'pending' | 'not_needed' | 'used' | 'partial' | 'failed';
    insight_status: 'idle' | 'processing' | 'ready' | 'failed';
    metadata_json: Json;
    page_map_json: Json;
    extracted_paper_json: Json | null;
    insights_json: Json | null;
    warnings_json: Json;
    created_at: string;
    updated_at: string;
};

type CreatePaperRecordInput = {
    fileFingerprint: string;
    analysisVersion: string;
    originalFilename: string;
    cleanedFilename: string;
    preferredFilename: string;
    displayTitle: string;
    sourceType: UploadSource;
    sourceUrl: string | null;
    storagePath: string;
    doi: string | null;
    authors: string[];
    year: number | null;
    journal: string | null;
    abstract: string | null;
    uploadStatus: ResearchPaperRow['upload_status'];
    extractionStatus: ResearchPaperRow['extraction_status'];
    ocrStatus: ResearchPaperRow['ocr_status'];
    insightStatus: ResearchPaperRow['insight_status'];
    metadata: Record<string, unknown>;
    pageMap: ExtractedPage[];
    extractedPaper: Record<string, unknown> | null;
    warnings: string[];
    insights?: PaperInsightSummary | null;
};

type UpdatePaperRecordInput = Partial<CreatePaperRecordInput>;

export function getResearchWorkspaceAdminClient(): SupabaseClient {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            'Research Workspace requires PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        );
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

export async function uploadPaperBuffer(
    client: SupabaseClient,
    paperId: string,
    fileName: string,
    buffer: Uint8Array,
    contentType = 'application/pdf'
): Promise<string> {
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-');
    const storagePath = `papers/${paperId}/${safeFileName}`;

    const { error } = await client.storage
        .from(RESEARCH_PAPERS_BUCKET)
        .upload(storagePath, buffer, {
            contentType,
            upsert: false,
            cacheControl: '3600'
        });

    if (error) {
        throw new Error(error.message);
    }

    return storagePath;
}

export async function createPaperRecord(
    client: SupabaseClient,
    input: CreatePaperRecordInput
): Promise<ResearchPaperRow> {
    const { data, error } = await client
        .from(RESEARCH_WORKSPACE_TABLE)
        .insert([
            {
                file_fingerprint: input.fileFingerprint,
                analysis_version: input.analysisVersion,
                original_filename: input.originalFilename,
                cleaned_filename: input.cleanedFilename,
                preferred_filename: input.preferredFilename,
                display_title: input.displayTitle,
                source_type: input.sourceType,
                source_url: input.sourceUrl,
                storage_bucket: RESEARCH_PAPERS_BUCKET,
                storage_path: input.storagePath,
                doi: input.doi,
                authors_json: input.authors,
                year: input.year,
                journal: input.journal,
                abstract: input.abstract,
                upload_status: input.uploadStatus,
                extraction_status: input.extractionStatus,
                ocr_status: input.ocrStatus,
                insight_status: input.insightStatus,
                metadata_json: input.metadata,
                page_map_json: input.pageMap,
                extracted_paper_json: input.extractedPaper,
                insights_json: input.insights ?? null,
                warnings_json: input.warnings
            }
        ])
        .select('*')
        .single<ResearchPaperRow>();

    if (error || !data) {
        throw new Error(error?.message || 'Failed to create research paper record.');
    }

    return data;
}

export async function getPaperRecord(
    client: SupabaseClient,
    paperId: string
): Promise<ResearchPaperRow> {
    const { data, error } = await client
        .from(RESEARCH_WORKSPACE_TABLE)
        .select('*')
        .eq('id', paperId)
        .single<ResearchPaperRow>();

    if (error || !data) {
        throw new Error(error?.message || 'Paper not found.');
    }

    return data;
}

export async function getRecentPaperRecords(
    client: SupabaseClient,
    limit = 24
): Promise<ResearchPaperRow[]> {
    const { data, error } = await client
        .from(RESEARCH_WORKSPACE_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
        .returns<ResearchPaperRow[]>();

    if (error || !data) {
        throw new Error(error?.message || 'Failed to load research papers.');
    }

    return data;
}

export async function findPaperRecordByFingerprint(
    client: SupabaseClient,
    fileFingerprint: string,
    analysisVersion: string
): Promise<ResearchPaperRow | null> {
    const { data, error } = await client
        .from(RESEARCH_WORKSPACE_TABLE)
        .select('*')
        .eq('file_fingerprint', fileFingerprint)
        .eq('analysis_version', analysisVersion)
        .maybeSingle<ResearchPaperRow>();

    if (error) {
        throw new Error(error.message);
    }

    return data ?? null;
}

export async function updatePaperRecord(
    client: SupabaseClient,
    paperId: string,
    input: UpdatePaperRecordInput
): Promise<ResearchPaperRow> {
    const patch: Record<string, unknown> = {};

    if (input.originalFilename !== undefined) patch.original_filename = input.originalFilename;
    if (input.cleanedFilename !== undefined) patch.cleaned_filename = input.cleanedFilename;
    if (input.preferredFilename !== undefined) patch.preferred_filename = input.preferredFilename;
    if (input.displayTitle !== undefined) patch.display_title = input.displayTitle;
    if (input.sourceType !== undefined) patch.source_type = input.sourceType;
    if (input.sourceUrl !== undefined) patch.source_url = input.sourceUrl;
    if (input.storagePath !== undefined) patch.storage_path = input.storagePath;
    if (input.doi !== undefined) patch.doi = input.doi;
    if (input.authors !== undefined) patch.authors_json = input.authors;
    if (input.year !== undefined) patch.year = input.year;
    if (input.journal !== undefined) patch.journal = input.journal;
    if (input.abstract !== undefined) patch.abstract = input.abstract;
    if (input.uploadStatus !== undefined) patch.upload_status = input.uploadStatus;
    if (input.extractionStatus !== undefined) patch.extraction_status = input.extractionStatus;
    if (input.ocrStatus !== undefined) patch.ocr_status = input.ocrStatus;
    if (input.insightStatus !== undefined) patch.insight_status = input.insightStatus;
    if (input.metadata !== undefined) patch.metadata_json = input.metadata;
    if (input.pageMap !== undefined) patch.page_map_json = input.pageMap;
    if (input.extractedPaper !== undefined) patch.extracted_paper_json = input.extractedPaper;
    if (input.warnings !== undefined) patch.warnings_json = input.warnings;
    if (input.insights !== undefined) patch.insights_json = input.insights;

    const { data, error } = await client
        .from(RESEARCH_WORKSPACE_TABLE)
        .update(patch)
        .eq('id', paperId)
        .select('*')
        .single<ResearchPaperRow>();

    if (error || !data) {
        throw new Error(error?.message || 'Failed to update research paper record.');
    }

    return data;
}

export async function downloadPaperBlob(
    client: SupabaseClient,
    row: ResearchPaperRow
): Promise<Blob> {
    const { data, error } = await client.storage
        .from(row.storage_bucket || RESEARCH_PAPERS_BUCKET)
        .download(row.storage_path);

    if (error || !data) {
        throw new Error(error?.message || 'Failed to download paper.');
    }

    return data;
}

export async function ensureUniquePreferredFilename(
    client: SupabaseClient,
    desiredFileName: string,
    excludePaperId?: string
): Promise<string> {
    const { data, error } = await client
        .from(RESEARCH_WORKSPACE_TABLE)
        .select('id')
        .eq('preferred_filename', desiredFileName);

    if (error) {
        throw new Error(error.message);
    }

    const conflict = (data ?? []).some((item) => item.id !== excludePaperId);
    if (!conflict) {
        return desiredFileName;
    }

    const suffix = Math.random().toString(36).slice(2, 6);
    const base = desiredFileName.replace(/\.pdf$/i, '');
    return `${base}-${suffix}.pdf`;
}

export function coerceStringArray(value: Json): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => String(item).trim())
        .filter(Boolean);
}

export function coerceStringList(value: Json): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => String(item).trim())
        .filter(Boolean);
}

export function coercePageMap(value: Json): ExtractedPage[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((item) => {
        if (!item || typeof item !== 'object') {
            return [];
        }

        const candidate = item as Record<string, unknown>;
        return [
            {
                pageNumber: Number(candidate.pageNumber) || 0,
                extractionType:
                    candidate.extractionType === 'ocr' || candidate.extractionType === 'mixed'
                        ? candidate.extractionType
                        : 'native',
                confidence:
                    typeof candidate.confidence === 'number'
                        ? candidate.confidence
                        : null,
                text: typeof candidate.text === 'string' ? candidate.text : '',
                nativeLength: Number(candidate.nativeLength) || 0,
                ocrLength: Number(candidate.ocrLength) || 0,
                wasOcrAttempted: Boolean(candidate.wasOcrAttempted)
            }
        ];
    }).filter((page) => page.pageNumber > 0);
}

export function coerceInsights(value: Json | null): PaperInsightSummary | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const candidate = value as PaperInsightSummary;
    if (!Array.isArray(candidate.sections)) {
        return null;
    }

    return candidate;
}

export function toClientPaper(row: ResearchPaperRow): UploadedPaper {
    const authors = coerceStringArray(row.authors_json);
    const warnings = coerceStringList(row.warnings_json);

    return {
        id: row.id,
        source: row.source_type,
        sourceUrl: row.source_url,
        sourceLabel: getSourceLabel(row.source_type, row.source_url),
        displayTitle: row.display_title || row.cleaned_filename || row.original_filename,
        detectedTitle: row.display_title || row.cleaned_filename || row.original_filename,
        originalFileName: row.original_filename,
        cleanFileName: row.cleaned_filename || row.original_filename,
        preferredFileName:
            row.preferred_filename || row.cleaned_filename || row.original_filename,
        storagePath: row.storage_path,
        doi: row.doi,
        authors,
        year: row.year,
        journal: row.journal,
        abstract: row.abstract,
        uploadStatus: row.upload_status,
        extractionStatus: row.extraction_status,
        insightStatus: row.insight_status,
        pageCount: coercePageMap(row.page_map_json).length || null,
        warnings,
        downloadUrls: {
            original: buildDownloadUrl(row.id, 'original'),
            clean: buildDownloadUrl(row.id, 'clean')
        },
        insights: coerceInsights(row.insights_json)
    };
}
