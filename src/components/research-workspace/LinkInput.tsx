import { Link2 } from 'lucide-react';
import { useId } from 'react';

type LinkInputProps = {
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
    onSubmit: () => void;
};

export default function LinkInput({
    value,
    disabled,
    onChange,
    onSubmit
}: LinkInputProps) {
    const inputId = useId();

    return (
        <div className="rw-upload-option">
            <label className="rw-label" htmlFor={inputId}>
                Paper link
            </label>

            <div className="rw-link-field">
                <Link2 size={16} aria-hidden="true" />
                <input
                    id={inputId}
                    className="rw-input"
                    type="url"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            onSubmit();
                        }
                    }}
                    placeholder="Paste a DOI, arXiv, or publisher link"
                    disabled={disabled}
                />
            </div>

            <p className="rw-field-hint">
                Paste a direct PDF, DOI landing page, or supported publisher link.
            </p>

            <button
                className="rw-button rw-button--secondary"
                type="button"
                disabled={disabled}
                onClick={onSubmit}
            >
                Paste Link
            </button>
        </div>
    );
}
