type UploadProgressProps = {
    label: string;
    progress: number;
    description?: string;
    statusText?: string;
};

export default function UploadProgress({
    label,
    progress,
    description,
    statusText
}: UploadProgressProps) {
    return (
        <div className="rw-progress" aria-live="polite">
            <div className="rw-progress__header">
                <span>{label}</span>
                <span>{Math.round(progress)}%</span>
            </div>
            <div className="rw-progress__track" aria-hidden="true">
                <div
                    className="rw-progress__fill"
                    style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                />
            </div>
            {statusText ? <p className="rw-progress__status">{statusText}</p> : null}
            {description ? <p className="rw-progress__copy">{description}</p> : null}
        </div>
    );
}
