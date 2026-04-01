import type { InsightSection } from './types';

type InsightCardProps = {
    insight?: InsightSection;
    isPlaceholder?: boolean;
};

export default function InsightCard({
    insight,
    isPlaceholder = false
}: InsightCardProps) {
    if (isPlaceholder) {
        return (
            <article className="rw-insight-card rw-insight-card--placeholder" aria-hidden="true">
                <div className="rw-skeleton rw-skeleton--short" />
                <div className="rw-skeleton rw-skeleton--medium" />
                <div className="rw-skeleton rw-skeleton--long" />
            </article>
        );
    }

    if (!insight) {
        return null;
    }

    return (
        <article className="rw-insight-card">
            <p className="rw-insight-card__label">{insight.heading}</p>
            <h3>{insight.summary}</h3>
            <p>{insight.detail || 'Not clearly found'}</p>
        </article>
    );
}
