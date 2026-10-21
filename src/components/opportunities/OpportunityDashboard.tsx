import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Opportunity, OpportunityStatus } from '../../lib/opportunities/types';
import {
    formatCategoryTitle,
    formatDaysRemaining,
    formatOpportunityTitle,
    formatStatusTitle,
    getFirstName,
} from '../../lib/opportunities/ui-helpers';
import {
    doesOpportunityRequireAction,
    getOpportunityActionAt,
    isOutstandingDirectTask,
    isOpportunityPastDeadline,
} from '../../lib/opportunities/attention';
import {
    sortRadarOpportunities,
} from '../../lib/opportunities/sorting';
import {
    buildOpportunitySearchIndex,
    rankOpportunitySearch,
} from '../../lib/opportunities/search';
import { OpportunityCard, type RadarSaveState } from './OpportunityCard';
import { OpportunityListItem } from './OpportunityListItem';
import { OpportunityDetailModal } from './OpportunityDetailModal';
import {
    WORKFLOW_STATUSES,
    opportunityMatchesTrackerStatus,
    type TrackerStatus,
} from './OpportunityStatusPicker';
import { EditOpportunityModal } from './EditOpportunityModal';
import type { OpportunityExtractionDraft } from './ManualCreateModal';
import {
    OpportunityProfileDialog,
    type OpportunityEditableProfile,
} from './OpportunityProfileDialog';
import { OpportunitySupportPrompt } from './OpportunitySupportPrompt';
import { OpportunityRadarSignInDialog } from './OpportunityRadarSignInDialog';
import { OpportunitySettingsMenu } from './OpportunitySettingsMenu';
import { opportunitySupabase as supabase } from '../../lib/opportunitySupabase';
import {
    getOpportunitySupportPromptStorageKey,
    shouldShowOpportunitySupportPrompt,
} from '../../lib/opportunities/supportPrompt';
import {
    RADAR_IMPORT_INTENT_STORAGE_KEY,
    createRadarImportIntent,
    getRadarImportNextPath,
    parseRadarImportIntent,
} from '../../lib/opportunities/importIntent';
import {
    clearSubmittedCaptureUrl,
    finalizeOpportunityCaptureJob,
    OpportunityCaptureTimeoutError,
    requestOpportunityCapture,
    requestOpportunityCaptureJob,
    requestOpportunityCaptureJobStatus,
    requestOpportunityInputCaptureJob,
    type OpportunityCaptureJob,
    type OpportunityCaptureUploadTarget,
} from '../../lib/opportunities/captureClient';
import {
    buildExtractedOpportunityPayload,
    classifyUnifiedOpportunityInput,
} from '../../lib/opportunities/unifiedInput';

const GOOGLE_IDENTITY_SCOPES = 'openid email profile';

type UrgencyRailFilter = 'apply_asap' | 'newly_added';
type OpportunityViewMode = 'grid' | 'list';
const FILTER_EASE = [0.2, 0.8, 0.2, 1] as const;

type ProfileSummary = OpportunityEditableProfile;

type PendingDuplicate = {
    existing: Opportunity;
    proposedUpdates: Record<string, unknown> | null;
    sourceKind: 'url' | 'extracted';
};

type CaptureNotice = {
    eyebrow: string;
    title: string;
    detail: string;
};

const captureNotice = (eyebrow: string, title: string, detail: string): CaptureNotice => ({
    eyebrow,
    title,
    detail,
});

interface OpportunityDashboardProps {
    username: string;
    accessToken?: string | null;
    isOwner?: boolean;
    viewerProfile?: ProfileSummary | null;
}

export const OpportunityDashboard: React.FC<OpportunityDashboardProps> = ({
    username,
    accessToken = null,
    isOwner = false,
    viewerProfile = null,
}) => {
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [activeViewerProfile, setActiveViewerProfile] = useState<ProfileSummary | null>(viewerProfile);
    const [collectionProfile, setCollectionProfile] = useState<ProfileSummary | null>(
        isOwner ? viewerProfile : null,
    );
    const [profileVisibility, setProfileVisibility] = useState(Boolean(viewerProfile?.is_public));
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState('');

    // Capture bar state
    const [captureUrl, setCaptureUrl] = useState('');
    const [captureFiles, setCaptureFiles] = useState<File[]>([]);
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureResult, setCaptureResult] = useState<Opportunity | null>(null);
    const [captureError, setCaptureError] = useState('');
    const [captureProgress, setCaptureProgress] = useState<CaptureNotice | null>(null);
    const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null);
    const [failedCaptureJobId, setFailedCaptureJobId] = useState<string | null>(null);
    const captureAbortRef = useRef<AbortController | null>(null);
    const captureJobPollTimerRef = useRef<number | null>(null);
    const latestCaptureJobIdRef = useRef<string | null>(null);
    const captureFileInputRef = useRef<HTMLInputElement | null>(null);

    // Filters: Single clean Urgency Rail + Secondary Filter Tray Toggle
    const [urgencyFilter, setUrgencyFilter] = useState<UrgencyRailFilter>('apply_asap');
    const [isFilterTrayOpen, setIsFilterTrayOpen] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [isDeadlineFilterActive, setIsDeadlineFilterActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<OpportunityViewMode>('grid');
    const [resultsAnnouncement, setResultsAnnouncement] = useState('');
    const prefersReducedMotion = Boolean(useReducedMotion());

    // Modals
    const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
    const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
    const [supportPromptSource, setSupportPromptSource] = useState<'automatic' | 'manual' | null>(null);
    const [radarStates, setRadarStates] = useState<Record<string, RadarSaveState>>({});
    const [radarSignInOpportunity, setRadarSignInOpportunity] = useState<Opportunity | null>(null);
    const [isStartingRadarSignIn, setIsStartingRadarSignIn] = useState(false);
    const [radarSignInError, setRadarSignInError] = useState('');

    // Toast
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Ticker state to force relative deadline re-render every 60s
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => () => {
        captureAbortRef.current?.abort();
        captureAbortRef.current = null;
        if (captureJobPollTimerRef.current !== null) {
            window.clearTimeout(captureJobPollTimerRef.current);
            captureJobPollTimerRef.current = null;
        }
    }, []);

    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    }, []);

    const authenticatedHeaders = (includeJson = false) => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    });

    const handleAddToRadar = useCallback(async (opportunity: Opportunity) => {
        if (!accessToken) {
            setRadarSignInError('');
            setRadarSignInOpportunity(opportunity);
            return;
        }

        setRadarStates((current) => ({ ...current, [opportunity.id]: 'adding' }));
        try {
            const response = await fetch('/api/opportunities/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ source_opportunity_id: opportunity.id }),
            });
            const payload = await response.json().catch(() => ({}));

            if (response.status === 401) {
                setRadarStates((current) => ({ ...current, [opportunity.id]: 'idle' }));
                setRadarSignInOpportunity(opportunity);
                return;
            }
            if (!response.ok) throw new Error(payload.error || 'Could not add this opportunity');

            const nextState: RadarSaveState = payload.status === 'added' ? 'added' : 'already';
            setRadarStates((current) => ({ ...current, [opportunity.id]: nextState }));
            showToast(nextState === 'added' ? '✓ Added to your radar' : '✓ Already on your radar');
        } catch (error) {
            setRadarStates((current) => ({ ...current, [opportunity.id]: 'error' }));
            showToast(error instanceof Error ? `❌ ${error.message}` : '❌ Could not add this opportunity');
        }
    }, [accessToken, showToast]);

    const beginRadarSignIn = async () => {
        if (!radarSignInOpportunity) return;
        setIsStartingRadarSignIn(true);
        setRadarSignInError('');

        try {
            const intent = createRadarImportIntent(radarSignInOpportunity.id, username);
            window.sessionStorage.setItem(RADAR_IMPORT_INTENT_STORAGE_KEY, JSON.stringify(intent));
            const callback = new URL('/opportunities/auth/callback', window.location.origin);
            callback.searchParams.set('next', getRadarImportNextPath(intent));

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: GOOGLE_IDENTITY_SCOPES,
                    redirectTo: callback.toString(),
                    queryParams: { prompt: 'select_account' },
                },
            });
            if (error) throw error;
        } catch {
            setRadarSignInError('Google sign-in could not start. Try again.');
            setIsStartingRadarSignIn(false);
        }
    };

    // 1. Fetch the owner's private rows, or a deliberately safe public projection.
    const fetchOpportunities = async (silent = false): Promise<Opportunity[]> => {
        if (!silent) setIsLoading(true);
        setLoadError('');
        try {
            const endpoint = isOwner
                ? `/api/opportunities?refresh=${Date.now()}`
                : `/api/opportunities/public/${encodeURIComponent(username)}?refresh=${Date.now()}`;
            const res = await fetch(endpoint, {
                cache: 'no-store',
                headers: authenticatedHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                const loadedOpportunities = (data.opportunities || []) as Opportunity[];
                setOpportunities(loadedOpportunities);
                if (data.profile) setCollectionProfile(data.profile);
                return loadedOpportunities;
            } else if (res.status === 404) {
                setOpportunities([]);
                setCollectionProfile(null);
                return [];
            } else {
                setLoadError('Your opportunities could not be loaded.');
            }
        } catch (err) {
            console.error('Failed to load opportunities:', err);
            setLoadError('Your opportunities could not be loaded. Check your connection and try again.');
        } finally {
            if (!silent) setIsLoading(false);
        }
        return [];
    };

    useEffect(() => {
        void fetchOpportunities();
    }, [username, accessToken, isOwner]);

    useEffect(() => {
        if (isLoading) return;

        const url = new URL(window.location.href);
        const sourceId = url.searchParams.get('add') || '';
        const nonce = url.searchParams.get('intent') || '';
        if (!sourceId && !nonce) return;

        const cleanPendingUrl = () => {
            url.searchParams.delete('add');
            url.searchParams.delete('intent');
            window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        };

        const pending = parseRadarImportIntent(
            window.sessionStorage.getItem(RADAR_IMPORT_INTENT_STORAGE_KEY),
            { sourceId, sourceUsername: username, nonce },
        );
        if (!pending) {
            window.sessionStorage.removeItem(RADAR_IMPORT_INTENT_STORAGE_KEY);
            cleanPendingUrl();
            return;
        }

        const opportunity = opportunities.find((item) => item.id === sourceId);
        if (!opportunity) {
            window.sessionStorage.removeItem(RADAR_IMPORT_INTENT_STORAGE_KEY);
            cleanPendingUrl();
            showToast('This opportunity is no longer available');
            return;
        }

        if (!accessToken) {
            setRadarSignInOpportunity(opportunity);
            return;
        }

        window.sessionStorage.removeItem(RADAR_IMPORT_INTENT_STORAGE_KEY);
        cleanPendingUrl();
        setRadarSignInOpportunity(null);

        if (isOwner) {
            setRadarStates((current) => ({ ...current, [opportunity.id]: 'already' }));
            showToast('✓ Already on your radar');
            return;
        }

        void handleAddToRadar(opportunity);
    }, [accessToken, handleAddToRadar, isLoading, isOwner, opportunities, showToast, username]);

    useEffect(() => {
        setProfileVisibility(Boolean(viewerProfile?.is_public));
    }, [viewerProfile?.is_public]);

    useEffect(() => {
        setActiveViewerProfile(viewerProfile);
    }, [viewerProfile]);

    const supportPromptStorageKey = useMemo(
        () => getOpportunitySupportPromptStorageKey(username),
        [username],
    );

    useEffect(() => {
        if (editingOpp) return;
        if (isProfileDialogOpen) return;
        if (supportPromptSource) return;

        let hasBeenDismissed = false;
        try {
            hasBeenDismissed = window.localStorage.getItem(supportPromptStorageKey) === 'dismissed';
        } catch {
            // The prompt can still work when browser storage is unavailable.
        }

        if (shouldShowOpportunitySupportPrompt({
            opportunityCount: opportunities.length,
            isOwner,
            isLoading,
            hasBeenDismissed,
        })) {
            setSupportPromptSource('automatic');
        }
    }, [editingOpp, isLoading, isOwner, isProfileDialogOpen, opportunities.length, supportPromptStorageKey]);

    const closeProfileDialog = () => {
        setIsProfileDialogOpen(false);
        window.requestAnimationFrame(() => {
            document.querySelector<HTMLButtonElement>('#opportunity-settings-trigger')?.focus();
        });
    };

    const handleProfileSaved = (nextProfile: OpportunityEditableProfile) => {
        const previousUsername = activeViewerProfile?.username;
        setActiveViewerProfile(nextProfile);
        setProfileVisibility(nextProfile.is_public);
        if (isOwner) setCollectionProfile(nextProfile);
        showToast('Profile saved.');

        if (previousUsername && previousUsername !== nextProfile.username) {
            window.location.assign(`/opportunities/${encodeURIComponent(nextProfile.username)}`);
        }
    };

    const dismissSupportPrompt = () => {
        const shouldReturnToSettings = supportPromptSource === 'manual';
        if (supportPromptSource === 'automatic') {
            try {
                window.localStorage.setItem(supportPromptStorageKey, 'dismissed');
            } catch {
                // Dismiss for this visit even when browser storage is unavailable.
            }
        }
        setSupportPromptSource(null);
        if (shouldReturnToSettings) {
            window.requestAnimationFrame(() => {
                document.querySelector<HTMLButtonElement>('#opportunity-settings-trigger')?.focus();
            });
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut({ scope: 'local' });
            window.location.assign('/opportunities');
        } catch {
            showToast('Logout failed');
        }
    };

    const clearCaptureAttachments = () => {
        setCaptureFiles([]);
        if (captureFileInputRef.current) captureFileInputRef.current.value = '';
    };

    const refreshOpportunityAccessToken = async () => {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) return null;
        return data.session?.access_token || null;
    };

    const watchCaptureJob = async (jobId: string) => {
        if (latestCaptureJobIdRef.current !== jobId) return;
        try {
            const { response, payload } = await requestOpportunityCaptureJobStatus({
                jobId,
                accessToken,
                refreshAccessToken: refreshOpportunityAccessToken,
            });
            if (latestCaptureJobIdRef.current !== jobId) return;
            if (!response.ok || !payload.job) {
                throw new Error(payload.error || 'Capture status could not be checked');
            }

            const job = payload.job as OpportunityCaptureJob;
            if (job.status === 'pending' || job.status === 'processing') {
                setCaptureProgress(captureNotice(
                    'Capture received',
                    'Your capture is processing in the background.',
                    'It is safely stored. You can close this tab.',
                ));
                captureJobPollTimerRef.current = window.setTimeout(() => {
                    void watchCaptureJob(jobId);
                }, 2_000);
                return;
            }

            setCaptureProgress(null);
            if (job.status === 'failed') {
                latestCaptureJobIdRef.current = null;
                setFailedCaptureJobId(job.id);
                setCaptureError(job.error_message || 'Background capture failed. You can retry it safely.');
                showToast('❌ Background capture needs attention');
                return;
            }

            setFailedCaptureJobId(null);
            latestCaptureJobIdRef.current = null;
            setCaptureError('');
            const loaded = await fetchOpportunities(true);
            const saved = loaded.find((opportunity) => opportunity.id === job.opportunity_id) || null;
            if (saved) setCaptureResult(saved);
            showToast(job.is_duplicate ? '✓ Already on your radar' : '✓ Opportunity saved in the background');
        } catch (error) {
            if (latestCaptureJobIdRef.current !== jobId) return;
            console.warn('Background capture status check failed', error);
            captureJobPollTimerRef.current = window.setTimeout(() => {
                void watchCaptureJob(jobId);
            }, 5_000);
        }
    };

    const retryFailedCaptureJob = async () => {
        if (!failedCaptureJobId) return;
        setCaptureError('');
        setFailedCaptureJobId(null);
        setCaptureProgress(captureNotice(
            'Retrying capture',
            'Your capture is being sent to the server again.',
            'You can leave this page once the new receipt is confirmed.',
        ));
        const response = await fetch(`/api/opportunities/capture-jobs/${encodeURIComponent(failedCaptureJobId)}`, {
            method: 'POST',
            headers: authenticatedHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.job) {
            setCaptureProgress(null);
            setCaptureError(data.error || 'This capture could not be retried.');
            setFailedCaptureJobId(failedCaptureJobId);
            return;
        }
        latestCaptureJobIdRef.current = failedCaptureJobId;
        void watchCaptureJob(failedCaptureJobId);
    };

    useEffect(() => {
        if (!isOwner || !accessToken) return;
        let cancelled = false;
        void (async () => {
            const response = await fetch('/api/opportunities/capture-jobs?limit=10', {
                headers: authenticatedHeaders(),
                cache: 'no-store',
            });
            if (!response.ok || cancelled) return;
            const data = await response.json().catch(() => ({}));
            const jobs = Array.isArray(data.jobs) ? data.jobs as OpportunityCaptureJob[] : [];
            const unfinished = jobs.find((job) => job.status === 'pending' || job.status === 'processing');
            if (!unfinished || cancelled) return;
            latestCaptureJobIdRef.current = unfinished.id;
            setCaptureProgress(captureNotice(
                'Capture resumed',
                'Your capture is still processing in the background.',
                'It is safely stored. You can close this tab.',
            ));
            void watchCaptureJob(unfinished.id);
        })().catch(() => undefined);

        return () => {
            cancelled = true;
        };
    }, [accessToken, isOwner]);

    const addSavedOpportunity = (opportunity: Opportunity) => {
        setOpportunities((current) => [
            opportunity,
            ...current.filter((item) => item.id !== opportunity.id),
        ]);
        setCaptureResult(opportunity);
        setCaptureUrl('');
        clearCaptureAttachments();
        setEditingOpp(opportunity);
        showToast('✓ Opportunity saved');
    };

    const extractUnifiedInput = async (
        text: string,
        files: File[],
        signal: AbortSignal,
    ): Promise<OpportunityExtractionDraft> => {
        const formData = new FormData();
        formData.set('mode', text.trim().length < 50 ? 'note' : 'text');
        formData.set('captured_at', new Date().toISOString());
        formData.set('capture_timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
        if (text.trim()) formData.set('text', text);
        files.forEach((file) => formData.append('files', file, file.name));

        const response = await fetch('/api/opportunities/extract-input', {
            method: 'POST',
            headers: authenticatedHeaders(),
            body: formData,
            signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.extraction) {
            throw new Error(data.error || 'The opportunity details could not be extracted.');
        }
        return data.extraction as OpportunityExtractionDraft;
    };

    // 3. Unified URL, text, note, and attachment handler
    const handleCapture = async (e: React.FormEvent) => {
        e.preventDefault();
        const submittedInput = captureUrl.trim();
        const submittedFiles = [...captureFiles];
        if ((!submittedInput && submittedFiles.length === 0) || captureAbortRef.current) return;

        const controller = new AbortController();
        captureAbortRef.current = controller;
        let keepBackgroundProgress = false;

        setIsCapturing(true);
        setCaptureError('');
        setCaptureResult(null);
        setPendingDuplicate(null);
        setFailedCaptureJobId(null);
        try {
            const inputKind = classifyUnifiedOpportunityInput(submittedInput, submittedFiles.length);
            if (inputKind === 'url') {
                setCaptureProgress(captureNotice(
                    'Sending link',
                    'Your link is being sent to the server.',
                    'Please wait while we create a secure capture receipt.',
                ));
                const { response: queuedResponse, payload: queuedPayload } = await requestOpportunityCaptureJob({
                    url: submittedInput,
                    accessToken,
                    channel: 'dashboard',
                    signal: controller.signal,
                    refreshAccessToken: refreshOpportunityAccessToken,
                });

                if (queuedResponse.ok && queuedPayload.job) {
                    const job = queuedPayload.job as OpportunityCaptureJob;
                    latestCaptureJobIdRef.current = job.id;
                    setCaptureUrl((current) => clearSubmittedCaptureUrl(current, submittedInput));
                    setCaptureProgress(captureNotice(
                        'Capture received',
                        'Your link is processing in the background.',
                        'It is safely stored. You can close this tab.',
                    ));
                    keepBackgroundProgress = true;
                    void watchCaptureJob(job.id);
                    return;
                }

                // Compatibility path while the additive database migration is
                // being deployed. Existing users continue to receive the old
                // synchronous behavior instead of a broken capture button.
                if (queuedResponse.status === 503 && queuedPayload.code === 'CAPTURE_JOBS_NOT_CONFIGURED') {
                    setCaptureProgress(captureNotice(
                        'Reading link',
                        'Your link is being read and organized.',
                        'Please keep this tab open until saving is complete.',
                    ));
                    const { response: res, payload: data } = await requestOpportunityCapture({
                        url: submittedInput,
                        accessToken,
                        signal: controller.signal,
                        refreshAccessToken: refreshOpportunityAccessToken,
                    });
                    if (res.ok && data.opportunity) {
                        const capturedOpportunity = data.opportunity as Opportunity;
                        if (data.is_duplicate) {
                            setPendingDuplicate({ existing: capturedOpportunity, proposedUpdates: null, sourceKind: 'url' });
                            return;
                        }
                        addSavedOpportunity(capturedOpportunity);
                        return;
                    }
                    throw new Error(data.error || 'Failed to capture this opportunity');
                }

                throw new Error(queuedPayload.error || 'Failed to safely record this capture');
            }

            const isSinglePdf = submittedFiles.length === 1
                && (submittedFiles[0].type === 'application/pdf' || submittedFiles[0].name.toLowerCase().endsWith('.pdf'));
            setCaptureProgress(submittedFiles.length > 0
                ? captureNotice(
                    isSinglePdf ? 'PDF upload' : 'File upload',
                    isSinglePdf
                        ? 'Your PDF is being uploaded. Please wait.'
                        : 'Your files are being uploaded. Please wait.',
                    'Keep this tab open until the secure capture receipt is ready.',
                )
                : captureNotice(
                    'Sending note',
                    'Your note is being sent to the server.',
                    'Please wait while we create a secure capture receipt.',
                ));
            const { response: queuedResponse, payload: queuedPayload } = await requestOpportunityInputCaptureJob({
                text: submittedInput,
                attachments: submittedFiles,
                accessToken,
                channel: 'dashboard',
                signal: controller.signal,
                refreshAccessToken: refreshOpportunityAccessToken,
            });

            if (queuedResponse.ok && queuedPayload.job) {
                let job = queuedPayload.job as OpportunityCaptureJob;
                const uploads = Array.isArray(queuedPayload.uploads)
                    ? queuedPayload.uploads as OpportunityCaptureUploadTarget[]
                    : [];

                if (submittedFiles.length > 0) {
                    if (job.status !== 'uploading' || uploads.length !== submittedFiles.length) {
                        throw new Error('The secure attachment upload could not be prepared.');
                    }
                    setCaptureProgress(captureNotice(
                        isSinglePdf ? 'PDF upload' : 'File upload',
                        isSinglePdf
                            ? 'Your PDF is being uploaded. Please wait.'
                            : 'Your files are being uploaded. Please wait.',
                        'Keep this tab open until the secure capture receipt is ready.',
                    ));
                    for (const [index, file] of submittedFiles.entries()) {
                        const target = uploads[index];
                        const { error: uploadError } = await supabase.storage
                            .from('opportunity-capture-files')
                            .uploadToSignedUrl(target.path, target.token, file, {
                                contentType: file.type || undefined,
                            });
                        if (uploadError) throw new Error(`Could not upload ${file.name}. Try again.`);
                    }

                    setCaptureProgress(captureNotice(
                        'Finalizing upload',
                        'Your upload is safely recorded.',
                        'Please wait while the server confirms the capture receipt.',
                    ));
                    const finalized = await finalizeOpportunityCaptureJob({
                        jobId: job.id,
                        accessToken,
                        signal: controller.signal,
                        refreshAccessToken: refreshOpportunityAccessToken,
                    });
                    if (!finalized.response.ok || !finalized.payload.job) {
                        throw new Error(finalized.payload.error || 'The attachment capture could not be finalized.');
                    }
                    job = finalized.payload.job as OpportunityCaptureJob;
                }

                latestCaptureJobIdRef.current = job.id;
                setCaptureUrl((current) => clearSubmittedCaptureUrl(current, submittedInput));
                clearCaptureAttachments();
                setCaptureProgress(captureNotice(
                    'Capture received',
                    'Your capture is processing in the background.',
                    'It is safely stored. You can close this tab.',
                ));
                keepBackgroundProgress = true;
                void watchCaptureJob(job.id);
                return;
            }

            // Compatibility path while the additive migration is rolling out.
            if (queuedResponse.status === 503 && queuedPayload.code === 'CAPTURE_JOBS_NOT_CONFIGURED') {
                setCaptureProgress(captureNotice(
                    submittedFiles.length > 0 ? 'Reading files' : 'Reading note',
                    submittedFiles.length > 0
                        ? 'Your note and attachments are being read.'
                        : 'Your note is being read and organized.',
                    'Please keep this tab open until saving is complete.',
                ));
                const draft = await extractUnifiedInput(submittedInput, submittedFiles, controller.signal);
                if (controller.signal.aborted) return;

                setCaptureProgress(captureNotice(
                    'Saving opportunity',
                    'Your opportunity is being saved.',
                    'Please keep this tab open until saving is complete.',
                ));
                const payload = buildExtractedOpportunityPayload({
                    draft,
                    input: submittedInput,
                    directEntryId: crypto.randomUUID(),
                });
                const response = await fetch('/api/opportunities', {
                    method: 'POST',
                    headers: authenticatedHeaders(true),
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => ({}));
                if (response.status === 409 && data.is_duplicate && data.opportunity) {
                    const { source_url: _sourceUrl, ...proposedUpdates } = payload;
                    setPendingDuplicate({
                        existing: data.opportunity as Opportunity,
                        proposedUpdates,
                        sourceKind: 'extracted',
                    });
                    return;
                }
                if (!response.ok || !data.opportunity) {
                    throw new Error(data.error || 'The opportunity could not be saved.');
                }
                addSavedOpportunity(data.opportunity as Opportunity);
                return;
            }

            throw new Error(queuedPayload.error || 'Failed to safely record this capture');
        } catch (error) {
            if (controller.signal.aborted && !(error instanceof OpportunityCaptureTimeoutError)) return;
            const message = error instanceof OpportunityCaptureTimeoutError
                ? error.message
                : error instanceof Error ? error.message : 'The opportunity could not be saved.';
            setCaptureError(message);
            showToast(`❌ ${message}`);
        } finally {
            if (captureAbortRef.current === controller) {
                captureAbortRef.current = null;
                setIsCapturing(false);
                if (!keepBackgroundProgress) setCaptureProgress(null);
            }
        }
    };

    const handleDuplicateOpen = () => {
        if (!pendingDuplicate) return;
        setSelectedDetailId(pendingDuplicate.existing.id);
    };

    const handleDuplicateUpdate = async () => {
        if (!pendingDuplicate || isCapturing) return;
        setIsCapturing(true);
        setCaptureError('');
        setCaptureProgress(captureNotice(
            'Updating opportunity',
            'Your existing opportunity is being updated.',
            'Please keep this tab open until the update is saved.',
        ));
        try {
            const response = pendingDuplicate.sourceKind === 'url'
                ? await fetch(`/api/opportunities/${pendingDuplicate.existing.id}/re-extract`, {
                    method: 'POST',
                    headers: authenticatedHeaders(),
                })
                : await fetch(`/api/opportunities/${pendingDuplicate.existing.id}`, {
                    method: 'PATCH',
                    headers: authenticatedHeaders(true),
                    body: JSON.stringify(pendingDuplicate.proposedUpdates),
                });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.opportunity) {
                throw new Error(data.error || 'The existing opportunity could not be updated.');
            }
            setPendingDuplicate(null);
            addSavedOpportunity(data.opportunity as Opportunity);
            showToast('✓ Existing opportunity updated');
        } catch (error) {
            setCaptureError(error instanceof Error ? error.message : 'The existing opportunity could not be updated.');
        } finally {
            setIsCapturing(false);
            setCaptureProgress(null);
        }
    };

    // 4. Update Status
    const handleUpdateStatus = async (id: string, newStatus: OpportunityStatus) => {
        const previousStatus = opportunities.find((opportunity) => opportunity.id === id)?.status;
        setOpportunities((prev) =>
            prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
        );

        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: authenticatedHeaders(true),
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                showToast(`✓ Status updated to ${formatStatusTitle(newStatus)}`);
            } else {
                if (previousStatus) {
                    setOpportunities((prev) => prev.map((o) => (
                        o.id === id ? { ...o, status: previousStatus } : o
                    )));
                }
                showToast('❌ Failed to update status');
            }
        } catch {
            if (previousStatus) {
                setOpportunities((prev) => prev.map((o) => (
                    o.id === id ? { ...o, status: previousStatus } : o
                )));
            }
            showToast('❌ Network error updating status');
        }
    };

    const handleUpdateChecklist = async (id: string, completedRequirements: string[]) => {
        const response = await fetch(`/api/opportunities/${id}`, {
            method: 'PATCH',
            headers: authenticatedHeaders(true),
            body: JSON.stringify({ completed_requirements: completedRequirements }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.opportunity) {
            throw new Error(data.error || 'Checklist progress could not be saved');
        }

        setOpportunities((current) => current.map((opportunity) => (
            opportunity.id === id ? data.opportunity : opportunity
        )));
    };

    const handleUpdateDeadline = async (id: string, deadline: string) => {
        const response = await fetch(`/api/opportunities/${id}`, {
            method: 'PATCH',
            headers: authenticatedHeaders(true),
            body: JSON.stringify({ deadline }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.opportunity) {
            throw new Error(data.error || 'Deadline could not be saved');
        }

        setOpportunities((current) => current.map((opportunity) => (
            opportunity.id === id ? data.opportunity : opportunity
        )));
        showToast('✓ Deadline saved');
    };

    // 5. Toggle the only elevated priority tier.
    const handleUpdateHighPriority = async (id: string, isHighPriority: boolean) => {
        const previousPriority = Boolean(opportunities.find((opportunity) => opportunity.id === id)?.is_high_priority);
        setOpportunities((prev) =>
            prev.map((o) => (o.id === id ? { ...o, is_high_priority: isHighPriority } : o))
        );

        let res: Response;
        try {
            res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: authenticatedHeaders(true),
                body: JSON.stringify({ is_high_priority: isHighPriority }),
            });
        } catch {
            setOpportunities((prev) => prev.map((o) => (
                o.id === id ? { ...o, is_high_priority: previousPriority } : o
            )));
            showToast('❌ Failed to update priority');
            throw new Error('Failed to update priority');
        }

        if (!res.ok) {
            setOpportunities((prev) => prev.map((o) => (
                o.id === id ? { ...o, is_high_priority: previousPriority } : o
            )));
            showToast('❌ Failed to update priority');
            throw new Error('Failed to update priority');
        }

        showToast(isHighPriority ? '✓ Added to high priority' : '✓ Returned to normal priority');
    };

    // 6. Save Edits from Modal
    const handleSaveEdit = async (id: string, updates: Partial<Opportunity>) => {
        setOpportunities((prev) =>
            prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
        );

        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: authenticatedHeaders(true),
                body: JSON.stringify(updates),
            });
            if (res.ok) {
                showToast('✓ Opportunity details saved');
                fetchOpportunities();
            } else {
                showToast('❌ Failed to save changes');
            }
        } catch {
            showToast('❌ Network error saving changes');
        }
    };

    // 8. Re-extract
    const handleReExtract = async (id: string) => {
        try {
            const res = await fetch(`/api/opportunities/${id}/re-extract`, {
                method: 'POST',
                headers: authenticatedHeaders(),
            });
            const data = await res.json();
            if (res.ok && data.opportunity) {
                showToast('✓ Re-extracted fresh metadata');
                setOpportunities((prev) =>
                    prev.map((o) => (o.id === id ? data.opportunity : o))
                );
            } else {
                showToast(`❌ ${data.error || 'Failed to re-extract'}`);
            }
        } catch {
            showToast('❌ Error re-extracting');
        }
    };

    // 9. Delete
    const handleDelete = async (id: string) => {
        setOpportunities((prev) => prev.filter((o) => o.id !== id));
        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'DELETE',
                headers: authenticatedHeaders(),
            });
            if (res.ok) {
                showToast('✓ Opportunity deleted');
            } else {
                showToast('❌ Failed to delete');
            }
        } catch {
            showToast('❌ Error deleting');
        }
    };

    const opportunitySearchIndex = useMemo(
        () => buildOpportunitySearchIndex(opportunities),
        [opportunities],
    );

    // Filter, rank fuzzy-search matches, and sort opportunities.
    const filteredOpportunities = useMemo(() => {
        const shouldHidePastDeadlines = urgencyFilter === 'apply_asap'
            ? !isDeadlineFilterActive
            : isDeadlineFilterActive;

        const filtered = opportunities.filter((o) => {
            const hasExplicitStatusFilter = statusFilter !== 'all';
            const isAppliedFilter = statusFilter === 'applied';

            // Category Filter
            if (categoryFilter !== 'all' && o.category !== categoryFilter) {
                return false;
            }

            // Workflow Status Filter
            if (
                statusFilter !== 'all'
                && !opportunityMatchesTrackerStatus(o.status, statusFilter as TrackerStatus)
            ) {
                return false;
            }

            // An explicit Applied view is the completed archive, so it must include
            // finished items even when their original deadline has passed.
            if (
                !isAppliedFilter
                && shouldHidePastDeadlines
                && isOpportunityPastDeadline(o, now)
                && !isOutstandingDirectTask(o)
            ) {
                return false;
            }

            // Workflow filters intentionally override the Apply ASAP attention view.
            // Otherwise the Applied filter can never return results because completed
            // opportunities no longer require action.
            if (hasExplicitStatusFilter) return true;

            if (urgencyFilter !== 'apply_asap') return true;

            if (!doesOpportunityRequireAction(o)) return false;
            if (isOutstandingDirectTask(o)) return true;
            if (o.is_high_priority) return true;

            const actionableAt = getOpportunityActionAt(o);
            if (!actionableAt) return false;

            const actionableTimestamp = Date.parse(actionableAt);
            return Number.isFinite(actionableTimestamp) && actionableTimestamp >= now;
        });

        const sorted = urgencyFilter === 'apply_asap'
            ? [...filtered].sort((first, second) => {
                if (first.is_high_priority !== second.is_high_priority) return first.is_high_priority ? -1 : 1;
                const firstDeadline = Date.parse(getOpportunityActionAt(first) || '9999-12-31');
                const secondDeadline = Date.parse(getOpportunityActionAt(second) || '9999-12-31');
                return firstDeadline - secondDeadline;
            })
            : sortRadarOpportunities(
                filtered,
                'date_added',
                now,
            );
        return rankOpportunitySearch(sorted, searchQuery, opportunitySearchIndex);
    }, [opportunities, opportunitySearchIndex, urgencyFilter, categoryFilter, statusFilter, isDeadlineFilterActive, searchQuery, now]);

    useEffect(() => {
        if (isLoading || loadError) return undefined;
        const timer = window.setTimeout(() => {
            setResultsAnnouncement(
                `${filteredOpportunities.length} ${filteredOpportunities.length === 1 ? 'opportunity' : 'opportunities'} shown.`,
            );
        }, 250);
        return () => window.clearTimeout(timer);
    }, [filteredOpportunities.length, isLoading, loadError]);

    // Active secondary filters count for badge
    const activeSecondaryFiltersCount =
        (categoryFilter !== 'all' ? 1 : 0) +
        (statusFilter !== 'all' ? 1 : 0) +
        (isDeadlineFilterActive ? 1 : 0);

    const activeFiltersCount =
        (categoryFilter !== 'all' ? 1 : 0) +
        (statusFilter !== 'all' ? 1 : 0) +
        (isDeadlineFilterActive ? 1 : 0) +
        (searchQuery.trim() ? 1 : 0);

    const resetFilters = useCallback(() => {
        setUrgencyFilter('apply_asap');
        setCategoryFilter('all');
        setStatusFilter('all');
        setIsDeadlineFilterActive(false);
        setSearchQuery('');
    }, []);

    const collectionOwnerName = collectionProfile?.display_name || username;
    const collectionTitle = `${collectionOwnerName.charAt(0).toUpperCase()}${collectionOwnerName.slice(1)}'s Opportunities`;
    const viewerFirstName = getFirstName(activeViewerProfile?.display_name || activeViewerProfile?.username || username);
    const viewerDashboardPath = activeViewerProfile
        ? `/opportunities/${encodeURIComponent(activeViewerProfile.username)}`
        : '/opportunities';

    return (
        <div className="opportunities-shell">
            {/* Enlarged Curated Opportunities Hero Deck */}
            <header className="opp-hero-deck">
                <div className="opp-hero-main">
                    <div className="opp-hero-header-row">
                        <div className="opp-hero-branding">
                            <span className="opp-hero-eyebrow">OPPORTUNITY TRACKER</span>
                            <h1 className="opp-hero-title">
                                {isOwner ? `Hi, ${viewerFirstName}.` : collectionTitle}
                            </h1>
                            <p className="opp-hero-tagline">
                                {isOwner ? 'One Click. Every opportunity organized.' : 'Curated opportunities, ready to track.'}
                            </p>
                        </div>
                        {activeViewerProfile ? (
                            <div className="opp-hero-account-actions">
                                {!isOwner && (
                                    <a
                                        className="opp-my-radar-link"
                                        href={viewerDashboardPath}
                                    >
                                        <span aria-hidden="true">←</span>
                                        <span>My Radar</span>
                                    </a>
                                )}
                                <OpportunitySettingsMenu
                                    accessToken={accessToken}
                                    isPublic={profileVisibility}
                                    username={activeViewerProfile.username}
                                    onLogout={handleLogout}
                                    onEditProfile={() => setIsProfileDialogOpen(true)}
                                    onOpenSupport={() => setSupportPromptSource('manual')}
                                    onToast={showToast}
                                    onVisibilityChange={setProfileVisibility}
                                />
                            </div>
                        ) : (
                            <a className="opp-google-signin-compact" href={`/opportunities?next=${encodeURIComponent(`/opportunities/${username}`)}`}>
                                Sign in with Google <span aria-hidden="true">→</span>
                            </a>
                        )}
                    </div>

                    {/* Capture Bar: Only the collection owner may mutate data. */}
                    {isOwner && (
                        <div className="opp-capture-workspace">
                            <div className="opp-capture-heading">
                                <label htmlFor="opportunity-capture-input">Save an opportunity</label>
                                <p id="opportunity-capture-help">
                                    Paste a link or description, write a quick note, or attach supporting files.
                                </p>
                            </div>
                            <form
                                action="/api/opportunities/capture-jobs"
                                method="post"
                                onSubmit={handleCapture}
                                className="opp-hero-capture-bar"
                            >
                                <div className="opp-capture-input-shell">
                                    <textarea
                                        id="opportunity-capture-input"
                                        name="opportunity_input"
                                        className="opp-hero-capture-input"
                                        placeholder="Paste here"
                                        value={captureUrl}
                                        onChange={(event) => {
                                            setCaptureUrl(event.target.value);
                                            setCaptureError('');
                                            setPendingDuplicate(null);
                                        }}
                                        aria-describedby={`opportunity-capture-help${captureError ? ' opportunity-capture-error' : ''}`}
                                        aria-invalid={Boolean(captureError)}
                                        rows={1}
                                        maxLength={100000}
                                        disabled={isCapturing}
                                    />
                                    <input
                                        ref={captureFileInputRef}
                                        id="opportunity-capture-files"
                                        name="opportunity_files"
                                        type="file"
                                        className="sr-only"
                                        accept="application/pdf,text/plain,text/markdown,image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.pdf,.txt,.md,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov"
                                        multiple
                                        onChange={(event) => {
                                            const nextFiles = Array.from(event.target.files || []).slice(0, 4);
                                            setCaptureFiles(nextFiles);
                                            setCaptureError('');
                                            setPendingDuplicate(null);
                                        }}
                                        disabled={isCapturing}
                                    />
                                    <label
                                        htmlFor="opportunity-capture-files"
                                        className="opp-capture-attach-button"
                                        aria-label="Attach images, videos, or documents"
                                        title="Attach images, videos, or documents"
                                    >
                                        <span aria-hidden="true">+</span>
                                    </label>
                                </div>
                                {captureFiles.length > 0 && (
                                    <div className="opp-capture-files" aria-label="Selected attachments">
                                        {captureFiles.map((file, index) => (
                                            <span className="opp-capture-file" key={`${file.name}-${file.size}-${index}`}>
                                                <span>{file.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCaptureFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
                                                        if (captureFileInputRef.current) captureFileInputRef.current.value = '';
                                                    }}
                                                    aria-label={`Remove ${file.name}`}
                                                    disabled={isCapturing}
                                                >×</button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    className="opp-btn opp-btn-primary opp-hero-btn"
                                    disabled={isCapturing}
                                >
                                    {isCapturing ? 'Saving…' : 'Save Opportunity'}
                                </button>
                            </form>
                            {captureProgress && (
                                <aside className="opp-capture-processing" role="status" aria-live="polite" aria-atomic="true">
                                    <span className="opp-capture-processing-eyebrow">{captureProgress.eyebrow}</span>
                                    <strong>{captureProgress.title}</strong>
                                    <span>{captureProgress.detail}</span>
                                    <progress aria-label={captureProgress.title} />
                                </aside>
                            )}
                            {captureError && (
                                <div id="opportunity-capture-error" className="opp-capture-error" role="alert">
                                    <span>{captureError}</span>
                                    {failedCaptureJobId && (
                                        <button
                                            type="button"
                                            className="opp-btn opp-btn-secondary"
                                            onClick={() => void retryFailedCaptureJob()}
                                        >
                                            Retry capture
                                        </button>
                                    )}
                                </div>
                            )}
                            {pendingDuplicate && (
                                <div className="opp-capture-duplicate" role="status" aria-live="polite">
                                    <div>
                                        <span className="opp-capture-success-label">Already on your radar</span>
                                        <strong>{formatOpportunityTitle(pendingDuplicate.existing.title)}</strong>
                                        <span>Choose whether to open it or replace its details with this submission.</span>
                                    </div>
                                    <div className="opp-capture-duplicate-actions">
                                        <button type="button" className="opp-btn opp-btn-secondary" onClick={handleDuplicateOpen}>Open existing</button>
                                        <button type="button" className="opp-btn opp-btn-primary" onClick={() => void handleDuplicateUpdate()} disabled={isCapturing}>Update existing</button>
                                    </div>
                                </div>
                            )}
                            {captureResult && (
                                <aside className="opp-capture-success" aria-live="polite">
                                    <div>
                                        <span className="opp-capture-success-label">Saved to your radar</span>
                                        <strong>{formatOpportunityTitle(captureResult.title)}</strong>
                                        <span>
                                            {formatDaysRemaining(
                                                captureResult.deadline_at,
                                                captureResult.deadline_confidence,
                                            ).label}
                                        </span>
                                    </div>
                                    <div className="opp-capture-success-actions">
                                        <button
                                            type="button"
                                            className="opp-capture-success-dismiss"
                                            aria-label="Dismiss saved opportunity notification"
                                            onClick={() => setCaptureResult(null)}
                                        >×</button>
                                        <button
                                            type="button"
                                            className="opp-btn opp-btn-secondary opp-capture-view-btn"
                                            onClick={() => {
                                                setSelectedDetailId(captureResult.id);
                                                setCaptureResult(null);
                                            }}
                                        >
                                            View Opportunity →
                                        </button>
                                    </div>
                                </aside>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Thin Divider Line */}
            <div className="opp-radar-divider" />

            {!isOwner && collectionProfile && (
                <aside className="opp-radar-intro" aria-label="Save opportunities">
                    <strong>See something useful?</strong>
                    <span>Add it to your private radar.</span>
                </aside>
            )}

            {/* Primary opportunity views & filter popover toggle */}
            <div className="opp-rail-wrapper">
                <div className="opp-urgency-rail">
                    {(
                        [
                            { id: 'apply_asap', label: 'Apply ASAP' },
                            { id: 'newly_added', label: 'Newly Added' },
                        ] as { id: UrgencyRailFilter; label: string }[]
                    ).map((r) => (
                        <button
                            key={r.id}
                            type="button"
                            className={`opp-rail-pill ${urgencyFilter === r.id ? 'active' : ''}`}
                            aria-pressed={urgencyFilter === r.id}
                            onClick={() => {
                                if (r.id === urgencyFilter) return;
                                setUrgencyFilter(r.id);
                                setIsDeadlineFilterActive(false);
                            }}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                <div className="opp-rail-actions">
                    <div className="opp-search-control" role="search" aria-label="Search opportunities">
                        <label className="sr-only" htmlFor="opp-radar-search">Search opportunities</label>
                        <input
                            id="opp-radar-search"
                            name="opportunity-search"
                            type="search"
                            className="opp-search-input"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            enterKeyHint="search"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="opp-search-clear"
                                onClick={() => setSearchQuery('')}
                                aria-label="Clear opportunity search"
                            >
                                <span aria-hidden="true">×</span>
                            </button>
                        )}
                    </div>

                    {/* Filter Button with Badge and Dropdown Anchor */}
                    <div className="opp-filter-anchor-wrap">
                    <button
                        type="button"
                        className={`opp-filter-toggle-btn ${isFilterTrayOpen || activeSecondaryFiltersCount > 0 ? 'active' : ''}`}
                        onClick={() => setIsFilterTrayOpen(!isFilterTrayOpen)}
                        aria-expanded={isFilterTrayOpen}
                        aria-haspopup="dialog"
                    >
                        <span>Filter {isFilterTrayOpen ? '↑' : '↓'}</span>
                        {activeSecondaryFiltersCount > 0 && (
                            <span className="opp-filter-count-badge">{activeSecondaryFiltersCount}</span>
                        )}
                    </button>

                    {/* Floating Popover: Floats right below the filter button with NO layout shift */}
                    {isFilterTrayOpen && (
                        <>
                            <div
                                className="opp-popover-backdrop"
                                onClick={() => setIsFilterTrayOpen(false)}
                            />
                            <div className="opp-filter-popover" role="dialog" aria-label="Filter Opportunities">
                                <div className="opp-popover-header">
                                    <span className="opp-popover-title">Refine Radar</span>
                                    {activeSecondaryFiltersCount > 0 && (
                                        <button
                                            type="button"
                                            className="opp-reset-filters-link"
                                            onClick={resetFilters}
                                        >
                                            Reset All ↺
                                        </button>
                                    )}
                                </div>

                                {/* Box 1: Category Selection */}
                                <div className="opp-popover-section">
                                    <div className="opp-popover-section-label">Category</div>
                                    <div className="opp-popover-pills">
                                        {['all', 'grant', 'residency', 'fellowship', 'open_call', 'job', 'conference', 'event'].map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                className={`opp-popover-pill ${categoryFilter === cat ? 'active' : ''}`}
                                                aria-pressed={categoryFilter === cat}
                                                onClick={() => setCategoryFilter(cat)}
                                            >
                                                {cat === 'all' ? 'All' : cat === 'open_call' ? 'Open Call' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Box 2: Status Selection */}
                                <div className="opp-popover-section">
                                    <div className="opp-popover-section-label">Status</div>
                                    <div className="opp-popover-pills">
                                        {[{ id: 'all', label: 'All' }, ...WORKFLOW_STATUSES].map((statusOption) => (
                                            <button
                                                key={statusOption.id}
                                                type="button"
                                                className={`opp-popover-pill ${statusFilter === statusOption.id ? 'active' : ''}`}
                                                aria-pressed={statusFilter === statusOption.id}
                                                onClick={() => setStatusFilter(statusOption.id)}
                                            >
                                                {statusOption.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="opp-popover-section">
                                    <div className="opp-popover-section-label">Deadline</div>
                                    <label className="opp-popover-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={isDeadlineFilterActive}
                                            onChange={(event) => setIsDeadlineFilterActive(event.target.checked)}
                                        />
                                        <span>
                                            {urgencyFilter === 'apply_asap'
                                                ? 'Show past deadlines'
                                                : 'Hide past deadlines'}
                                        </span>
                                    </label>
                                </div>

                            </div>
                        </>
                    )}
                    </div>

                    <div className="opp-view-toggle" role="group" aria-label="Opportunity view">
                        <button
                            type="button"
                            className={viewMode === 'list' ? 'active' : ''}
                            aria-label="Show list view"
                            aria-pressed={viewMode === 'list'}
                            title="List view"
                            onClick={() => setViewMode('list')}
                        >
                            <svg viewBox="0 0 20 20" aria-hidden="true">
                                <path d="M3 5h14M3 10h14M3 15h14" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            className={viewMode === 'grid' ? 'active' : ''}
                            aria-label="Show grid view"
                            aria-pressed={viewMode === 'grid'}
                            title="Grid view"
                            onClick={() => setViewMode('grid')}
                        >
                            <svg viewBox="0 0 20 20" aria-hidden="true">
                                <rect x="3" y="3" width="5" height="5" rx="0.8" />
                                <rect x="12" y="3" width="5" height="5" rx="0.8" />
                                <rect x="3" y="12" width="5" height="5" rx="0.8" />
                                <rect x="12" y="12" width="5" height="5" rx="0.8" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {!isLoading && !loadError && opportunities.length > 0 && (
                <div className="opp-results-summary">
                    <output>
                        <strong>{filteredOpportunities.length}</strong>{' '}
                        {filteredOpportunities.length === 1 ? 'opportunity' : 'opportunities'}
                    </output>
                    {activeFiltersCount > 0 && (
                        <span>{activeFiltersCount} active {activeFiltersCount === 1 ? 'filter' : 'filters'}</span>
                    )}
                </div>
            )}
            <span className="sr-only" aria-live="polite" aria-atomic="true">
                {resultsAnnouncement}
            </span>

            {/* Category Filter Title Heading (e.g. "Residency Listings", "Job Listings", "Open Call Listings") */}
            {categoryFilter !== 'all' && (
                <div className="opp-category-header-banner">
                    <h2 className="opp-category-header-title">
                        {formatCategoryTitle(categoryFilter)} Listings
                    </h2>
                    <button
                        type="button"
                        className="opp-category-header-clear"
                        onClick={() => setCategoryFilter('all')}
                        aria-label={`Remove ${formatCategoryTitle(categoryFilter)} filter`}
                        title="Remove current filter"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
            )}

            {/* Opportunities Grid / Empty State */}
            {isLoading ? (
                <div className="opp-loading-state" role="status">
                    Loading opportunities…
                </div>
            ) : loadError ? (
                <div className="opp-load-error" role="alert">
                    <strong>{loadError}</strong>
                    <button type="button" className="opp-btn opp-btn-secondary" onClick={() => void fetchOpportunities()}>
                        Try again
                    </button>
                </div>
            ) : !collectionProfile && !isOwner ? (
                <div className="opp-empty-split-grid">
                    <div className="opp-empty-block">
                        <div className="opp-empty-block-header">
                            <div className="opp-empty-icon-sm">🔒</div>
                            <div>
                                <h2 className="opp-empty-heading">Collection unavailable</h2>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--opp-muted)' }}>Private or not found</p>
                            </div>
                        </div>
                        <p className="opp-empty-text">This username does not exist or the owner has kept their collection private.</p>
                        <a className="opp-btn opp-btn-primary opp-btn-sm" href="/opportunities">Create your collection →</a>
                    </div>
                </div>
            ) : opportunities.length === 0 ? (
                /* Split Empty State when 0 opportunities recorded */
                <div className="opp-empty-split-grid">
                    <div className="opp-empty-block">
                        <div className="opp-empty-block-header">
                            <div className="opp-empty-icon-sm">⚡</div>
                            <div>
                                <h3 className="opp-empty-heading">{isOwner ? 'Start Tracking' : 'No Shared Opportunities Yet'}</h3>
                                <p className="opp-empty-kicker">
                                    {isOwner ? 'Quick capture workflow' : `@${username}'s public collection`}
                                </p>
                            </div>
                        </div>
                        <p className="opp-empty-text">
                            {isOwner
                                ? 'Paste a link or description, write a note, or attach a file above to track the opportunity.'
                                : 'This collection is public, but its owner has not shared any active opportunities yet.'}
                        </p>
                        {isOwner && <div className="opp-empty-block-actions">
                            <button
                                type="button"
                                className="opp-btn opp-btn-primary opp-btn-sm"
                                onClick={() => {
                                    document.querySelector<HTMLTextAreaElement>('#opportunity-capture-input')?.focus();
                                }}
                            >
                                Save your first opportunity ↑
                            </button>
                        </div>}
                    </div>

                    <div className="opp-empty-block accent">
                        <div className="opp-empty-block-header">
                            <div className="opp-empty-icon-sm">📡</div>
                            <div>
                                <h3 className="opp-empty-heading">What your first card will show</h3>
                                <p className="opp-empty-kicker">Interactive example</p>
                            </div>
                        </div>
                        <div className="opp-empty-demo-card" aria-label="Example opportunity card">
                            <div className="opp-empty-demo-meta">
                                <span className="opp-days-remaining warning"><span className="opp-days-pulse-dot" />12 days left</span>
                            </div>
                            <strong>Creative Research Fellowship</strong>
                            <span>Example Arts Foundation</span>
                            <div className="opp-empty-demo-actions" aria-hidden="true">
                                <span>Fellowship</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <AnimatePresence initial={false}>
                        {filteredOpportunities.length === 0 && (
                            <motion.div
                                key="opportunity-filter-empty"
                                className="opp-no-filter-alert"
                                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={prefersReducedMotion
                                    ? { duration: 0 }
                                    : { duration: 0.2, ease: FILTER_EASE }}
                            >
                                <div>
                                    <strong>No opportunities match your search and filters.</strong>
                                    <span style={{ color: 'var(--opp-muted)', marginLeft: '8px' }}>
                                        Try another keyword, category, deadline period, or attention status.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="opp-btn opp-btn-secondary opp-btn-sm"
                                    onClick={resetFilters}
                                >
                                    Reset filters ↺
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Stable keyed rows/cards let Motion project results into their filtered position. */}
                    <div className={viewMode === 'grid' ? 'opp-grid' : 'opp-list'}>
                        <AnimatePresence initial={false} mode="popLayout">
                            {filteredOpportunities.map((opp) => (
                                <motion.div
                                    key={opp.id}
                                    className={viewMode === 'grid' ? 'opp-card-motion' : 'opp-list-motion'}
                                    layout={!prefersReducedMotion}
                                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={prefersReducedMotion
                                        ? { opacity: 0, transition: { duration: 0 } }
                                        : {
                                            opacity: 0,
                                            scale: 0.97,
                                            transition: { duration: 0.135, ease: 'easeOut' },
                                        }}
                                    transition={prefersReducedMotion
                                        ? { duration: 0 }
                                        : {
                                            layout: { duration: 0.27, ease: FILTER_EASE },
                                            opacity: { duration: 0.2, ease: 'easeOut' },
                                            y: { duration: 0.2, ease: FILTER_EASE },
                                            scale: { duration: 0.135, ease: 'easeOut' },
                                        }}
                                >
                                    {viewMode === 'grid' ? (
                                        <OpportunityCard
                                            opportunity={opp}
                                            onOpen={(o) => setSelectedDetailId(o.id)}
                                            onSelectCategory={(cat) => setCategoryFilter(cat)}
                                            showRadarAction={!isOwner}
                                            radarState={radarStates[opp.id] || 'idle'}
                                            onAddToRadar={handleAddToRadar}
                                            showPriorityToggle={isOwner}
                                            onToggleHighPriority={(isHigh) => handleUpdateHighPriority(opp.id, isHigh)}
                                        />
                                    ) : (
                                        <OpportunityListItem
                                            opportunity={opp}
                                            onOpen={(o) => setSelectedDetailId(o.id)}
                                            onSelectCategory={(cat) => setCategoryFilter(cat)}
                                            showRadarAction={!isOwner}
                                            radarState={radarStates[opp.id] || 'idle'}
                                            onAddToRadar={handleAddToRadar}
                                            showPriorityToggle={isOwner}
                                            onToggleHighPriority={(isHigh) => handleUpdateHighPriority(opp.id, isHigh)}
                                        />
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </>
            )}

            {/* Bottom ownership / sign-in action */}
            <footer className="opp-public-footer">
                {!activeViewerProfile ? (
                    <div className="opp-curator-trigger-box">
                        <a className="opp-curator-login-btn" href="/opportunities">
                            Sign in to save opportunities →
                        </a>
                    </div>
                ) : !isOwner ? (
                    <div className="opp-curator-active-bar">
                        <span className="opp-curator-badge">Viewing @{username}</span>
                        <a className="opp-curator-logout-btn" href={viewerDashboardPath}>
                            My Radar
                        </a>
                    </div>
                ) : (
                    <div className="opp-curator-active-bar">
                        <span className="opp-curator-badge">
                            {profileVisibility ? '● Public collection' : '● Private collection'}
                        </span>
                    </div>
                )}
            </footer>

            {/* Opportunity Detail Modal with Keyboard Arrow Navigation */}
            {(() => {
                // Keep the open modal anchored to the full collection. A status change may
                // remove its card from the current filtered grid, but it should not unmount
                // the modal or leave a selected ID that reappears when filters are reset.
                const selectedOpp = opportunities.find((o) => o.id === selectedDetailId) || null;
                const selectedIndex = filteredOpportunities.findIndex((o) => o.id === selectedDetailId);

                if (!selectedOpp) return null;

                const canNavigateFilteredResults = selectedIndex >= 0 && filteredOpportunities.length > 1;

                const handleNavigate = (direction: 1 | -1) => {
                    if (!canNavigateFilteredResults) return;
                    const nextIdx = (selectedIndex + direction + filteredOpportunities.length) % filteredOpportunities.length;
                    setSelectedDetailId(filteredOpportunities[nextIdx].id);
                };

                return (
                    <OpportunityDetailModal
                        opportunity={selectedOpp}
                        isAuthenticated={isOwner}
                        isOpen={Boolean(selectedOpp)}
                        onClose={() => setSelectedDetailId(null)}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateHighPriority={handleUpdateHighPriority}
                        onUpdateChecklist={handleUpdateChecklist}
                        onUpdateDeadline={handleUpdateDeadline}
                        onSelectCategory={(cat) => setCategoryFilter(cat)}
                        onEdit={(o) => {
                            setSelectedDetailId(null);
                            setEditingOpp(o);
                        }}
                        onReExtract={handleReExtract}
                        onDelete={async (id) => {
                            setSelectedDetailId(null);
                            await handleDelete(id);
                        }}
                        onNavigateNext={canNavigateFilteredResults ? () => handleNavigate(1) : undefined}
                        onNavigatePrev={canNavigateFilteredResults ? () => handleNavigate(-1) : undefined}
                        currentIndex={selectedIndex >= 0 ? selectedIndex + 1 : undefined}
                        totalCount={selectedIndex >= 0 ? filteredOpportunities.length : undefined}
                        showRadarAction={!isOwner}
                        radarState={radarStates[selectedOpp.id] || 'idle'}
                        onAddToRadar={handleAddToRadar}
                    />
                );
            })()}

            <OpportunityRadarSignInDialog
                opportunity={radarSignInOpportunity}
                isStarting={isStartingRadarSignIn}
                error={radarSignInError}
                onClose={() => {
                    setRadarSignInOpportunity(null);
                    setIsStartingRadarSignIn(false);
                    setRadarSignInError('');
                }}
                onContinue={() => void beginRadarSignIn()}
            />

            {/* Edit Modal */}
            {editingOpp && (
                <EditOpportunityModal
                    opportunity={editingOpp}
                    isOpen={Boolean(editingOpp)}
                    onClose={() => setEditingOpp(null)}
                    onSave={handleSaveEdit}
                />
            )}

            {activeViewerProfile && (
                <OpportunityProfileDialog
                    accessToken={accessToken}
                    isOpen={isProfileDialogOpen}
                    profile={activeViewerProfile}
                    onClose={closeProfileDialog}
                    onSaved={handleProfileSaved}
                />
            )}

            {activeViewerProfile && (
                <OpportunitySupportPrompt
                    isOpen={supportPromptSource !== null}
                    onDismiss={dismissSupportPrompt}
                />
            )}

            {/* Toast Notification */}
            {toastMessage && <div className="opp-toast" role="status" aria-live="polite">{toastMessage}</div>}
        </div>
    );
};
export default OpportunityDashboard;
