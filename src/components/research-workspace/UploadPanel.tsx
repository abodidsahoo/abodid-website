import { CheckCircle2, UploadCloud } from 'lucide-react';
import ErrorState from './ErrorState';
import LinkInput from './LinkInput';
import UploadDropzone from './UploadDropzone';
import UploadProgress from './UploadProgress';
import type { UploadState } from './types';

type UploadPanelProps = {
    selectedLabel: string;
    queuedCount: number;
    uploadState: UploadState;
    uploadProgress: number;
    uploadStatusText?: string;
    errorMessage: string | null;
    linkValue: string;
    heading?: string;
    hint?: string;
    onFilesSelected: (files: File[]) => void;
    onLinkChange: (value: string) => void;
    onUploadLink: () => void;
    onUploadFiles: () => void;
};

export default function UploadPanel({
    selectedLabel,
    queuedCount,
    uploadState,
    uploadProgress,
    uploadStatusText,
    errorMessage,
    linkValue,
    heading,
    hint,
    onFilesSelected,
    onLinkChange,
    onUploadLink,
    onUploadFiles
}: UploadPanelProps) {
    const isUploading = uploadState === 'uploading';

    return (
        <section className="rw-section">
            <div className="rw-section-heading">
                <div>
                    <p className="rw-section-heading__eyebrow">Upload</p>
                    <h2>{heading || 'Upload papers and clean their names'}</h2>
                </div>
                <div className="rw-inline-badge">
                    <UploadCloud size={14} />
                    <span>{queuedCount} saved</span>
                </div>
            </div>

            <UploadDropzone
                selectedLabel={selectedLabel}
                disabled={isUploading}
                onFilesSelected={onFilesSelected}
                onUpload={onUploadFiles}
            />

            <LinkInput
                value={linkValue}
                disabled={isUploading}
                onChange={onLinkChange}
                onSubmit={onUploadLink}
            />

            <p className="rw-field-hint">
                {hint || 'Upload one PDF or a whole batch. Each paper gets a clean filename suggestion and can be downloaded individually or all at once.'}
            </p>

            {errorMessage ? (
                <ErrorState title="Upload blocked" message={errorMessage} />
            ) : null}

            {uploadState !== 'idle' ? (
                <UploadProgress
                    label={
                        uploadState === 'ready'
                            ? 'Paper batch complete'
                            : 'Preparing paper workspace'
                    }
                    progress={uploadProgress}
                    statusText={
                        uploadState === 'ready'
                            ? 'Paper uploaded successfully'
                            : uploadStatusText
                    }
                    description={
                        uploadState === 'ready'
                            ? 'The original file is stored, metadata is extracted, and rename suggestions are ready below.'
                            : 'Uploading paper, checking the file, and preparing extraction.'
                    }
                />
            ) : null}

            {uploadState === 'ready' ? (
                <div className="rw-upload-success">
                    <CheckCircle2 size={16} />
                    <span>Metadata extracted and ready for rename.</span>
                </div>
            ) : null}
        </section>
    );
}
