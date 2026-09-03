import React from 'react';

export default function ResourceLoading({ label = 'Loading dashboard.', reconnecting = false }: { label?: string; reconnecting?: boolean }) {
    return (
        <section className="resource-loading" role="status" aria-live="polite">
            <div className="resource-loading-content">
                <span className="resource-loading-indicator" aria-hidden="true" />
                <h1>{label}</h1>
                {reconnecting && <p>Reconnecting automatically…</p>}
            </div>
        </section>
    );
}
