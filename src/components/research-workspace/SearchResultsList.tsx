import { SearchX } from 'lucide-react';
import EmptyState from './EmptyState';
import PaperResultCard from './PaperResultCard';
import type { PaperResult } from './types';

type SearchResultsListProps = {
    results: PaperResult[];
    isLoading: boolean;
    isVisible: boolean;
    providerSummary: string | null;
};

export default function SearchResultsList({
    results,
    isLoading,
    isVisible,
    providerSummary
}: SearchResultsListProps) {
    if (!isVisible) {
        return null;
    }

    return (
        <section className="rw-results-section" aria-live="polite">
            <div className="rw-section-heading">
                <div>
                    <p className="rw-section-heading__eyebrow">Live Results</p>
                    <h3>Top papers for your question</h3>
                </div>
                <p className="rw-section-heading__note">
                    {providerSummary || 'Searching scholarly metadata sources.'}
                </p>
            </div>

            {isLoading ? (
                <div className="rw-results-stack">
                    {Array.from({ length: 3 }).map((_, index) => (
                          <div
                              key={`result-skeleton-${index}`}
                              className="rw-paper-card rw-paper-card--skeleton"
                              aria-hidden="true"
                          >
                              <div className="rw-skeleton rw-skeleton--short" />
                              <div className="rw-skeleton rw-skeleton--medium" />
                              <div className="rw-skeleton rw-skeleton--long" />
                          </div>
                      ))}
                </div>
            ) : results.length > 0 ? (
                <div className="rw-results-stack">
                    {results.map((paper) => (
                        <PaperResultCard key={paper.id} paper={paper} />
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={<SearchX size={20} />}
                    title="No matching papers found"
                    description="Try a shorter question, swap in clearer keywords, or focus on the paper method or topic you care about most."
                    compact
                />
            )}
        </section>
    );
}
