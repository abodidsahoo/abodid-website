import { Sparkles } from 'lucide-react';

type GenerateInsightsButtonProps = {
    disabled: boolean;
    isLoading: boolean;
    onClick: () => void;
};

export default function GenerateInsightsButton({
    disabled,
    isLoading,
    onClick
}: GenerateInsightsButtonProps) {
    return (
        <button
            className="rw-button rw-button--primary"
            type="button"
            disabled={disabled}
            onClick={onClick}
        >
            <Sparkles size={16} />
            <span>{isLoading ? 'Generating...' : 'Generate Insights'}</span>
        </button>
    );
}
