import type { ReactNode } from 'react';

type EmptyStateProps = {
    icon: ReactNode;
    title: string;
    description: string;
    compact?: boolean;
};

export default function EmptyState({
    icon,
    title,
    description,
    compact = false
}: EmptyStateProps) {
    return (
        <div className={`rw-empty-state${compact ? ' rw-empty-state--compact' : ''}`}>
            <div className="rw-empty-state__icon" aria-hidden="true">
                {icon}
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
}
