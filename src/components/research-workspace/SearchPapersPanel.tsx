import { FileSearch } from 'lucide-react';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import SearchInput from './SearchInput';
import SearchResultsList from './SearchResultsList';
import type { PaperResult, SearchState } from './types';

type SearchPapersPanelProps = {
    question: string;
    results: PaperResult[];
    state: SearchState;
    errorMessage: string | null;
    providerSummary: string | null;
    onQuestionChange: (value: string) => void;
    onSuggestionClick: (value: string) => void;
    onScan: () => void;
    suggestions: string[];
};

export default function SearchPapersPanel({
    question,
    results,
    state,
    errorMessage,
    providerSummary,
    onQuestionChange,
    onSuggestionClick,
    onScan,
    suggestions
}: SearchPapersPanelProps) {
    return (
        <section
            className="rw-panel"
            id="rw-panel-search"
            role="tabpanel"
            aria-labelledby="rw-tab-search"
        >
            <div className="rw-panel__intro">
                <div>
                    <p className="rw-kicker">Search Papers</p>
                    <h2>Find papers for your question</h2>
                </div>
                <p className="rw-panel__note">
                    Search now blends Google PDF discovery with scholarly providers and only shows
                    results that resolve to a direct PDF link.
                </p>
            </div>

            <SearchInput
                value={question}
                label="What are you trying to understand?"
                suggestions={suggestions}
                isLoading={state === 'loading'}
                onChange={onQuestionChange}
                onSuggestionClick={onSuggestionClick}
                onSubmit={onScan}
            />

            {state === 'error' && errorMessage ? (
                <ErrorState
                    title="Question needed"
                    message={errorMessage}
                />
            ) : null}

            {state === 'idle' ? (
                <EmptyState
                    icon={<FileSearch size={20} />}
                    title="Ask a question to find matching research papers"
                    description="Search returns ranked paper matches with direct download actions for the strongest PDF results."
                />
            ) : (
                <SearchResultsList
                    results={results}
                    isLoading={state === 'loading'}
                    isVisible={state === 'loading' || state === 'ready'}
                    providerSummary={providerSummary}
                />
            )}
        </section>
    );
}
