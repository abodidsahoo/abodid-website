import { useId } from 'react';

type FilenamePreviewProps = {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
};

export default function FilenamePreview({
    value,
    onChange,
    onBlur
}: FilenamePreviewProps) {
    const inputId = useId();

    return (
        <div className="rw-filename-preview">
            <label className="rw-label" htmlFor={inputId}>
                Refined file name
            </label>
            <input
                id={inputId}
                className="rw-input"
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
            />
        </div>
    );
}
