import { FileUp, FileText } from 'lucide-react';
import {
    useRef,
    type ChangeEvent,
    type DragEvent,
    type KeyboardEvent
} from 'react';

type UploadDropzoneProps = {
    selectedLabel: string;
    disabled: boolean;
    onFilesSelected: (files: File[]) => void;
    onUpload: () => void;
};

export default function UploadDropzone({
    selectedLabel,
    disabled,
    onFilesSelected,
    onUpload
}: UploadDropzoneProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const openPicker = () => {
        if (disabled) {
            return;
        }

        inputRef.current?.click();
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        onFilesSelected(Array.from(event.target.files ?? []));
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (disabled) {
            return;
        }
        onFilesSelected(Array.from(event.dataTransfer.files ?? []));
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
        }
    };

    return (
        <div className="rw-upload-option">
            <div
                className={`rw-dropzone${selectedLabel ? ' rw-dropzone--selected' : ''}`}
                onClick={openPicker}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-label="Choose a PDF to upload"
            >
                <div className="rw-dropzone__icon" aria-hidden="true">
                    {selectedLabel ? <FileText size={20} /> : <FileUp size={20} />}
                </div>
                <h3>{selectedLabel ? 'PDF batch selected' : 'Drop PDFs here'}</h3>
                <p>
                    {selectedLabel
                        ? selectedLabel
                        : 'Or click to pick one or more research papers from your device.'}
                </p>
            </div>

            <input
                ref={inputRef}
                className="rw-hidden-input"
                type="file"
                accept="application/pdf"
                multiple
                disabled={disabled}
                onChange={handleFileChange}
            />

            <button
                className="rw-button rw-button--primary"
                type="button"
                disabled={disabled}
                onClick={selectedLabel ? onUpload : openPicker}
            >
                Upload PDFs
            </button>
        </div>
    );
}
