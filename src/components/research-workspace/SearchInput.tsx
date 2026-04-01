import { Search } from 'lucide-react';
import { useId } from 'react';

type SearchInputProps = {
    value: string;
    label: string;
    suggestions: string[];
    isLoading: boolean;
    onChange: (value: string) => void;
    onSuggestionClick: (value: string) => void;
    onSubmit: () => void;
};

export default function SearchInput({
    value,
    label,
    suggestions,
    isLoading,
    onChange,
    onSuggestionClick,
    onSubmit
}: SearchInputProps) {
    const inputId = useId();

    return (
        <form
            className="rw-search-form"
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}
        >
            <label className="rw-label" htmlFor={inputId}>
                {label}
            </label>

            <textarea
                id={inputId}
                className="rw-textarea"
                rows={4}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={suggestions[0]}
            />

            <div className="rw-search-form__footer">
                <div className="rw-suggestion-row" aria-label="Suggested questions">
                    {suggestions.map((suggestion) => (
                        <button
                            key={suggestion}
                            type="button"
                            className="rw-suggestion-pill"
                            onClick={() => onSuggestionClick(suggestion)}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>

                <button
                    className="rw-button rw-button--primary"
                    type="submit"
                    disabled={isLoading}
                >
                    <Search size={16} />
                    <span>{isLoading ? 'Scanning...' : 'Scan Internet'}</span>
                </button>
            </div>
        </form>
    );
}
