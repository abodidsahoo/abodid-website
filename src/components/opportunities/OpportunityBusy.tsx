import React from 'react';

export function OpportunityWaveDots() {
    return <span className="opp-wave-dots" aria-hidden="true"><i /><i /><i /></span>;
}

export function OpportunityBusy({ children, inline = true }: { children: React.ReactNode; inline?: boolean }) {
    return <span className={`opp-busy-copy${inline ? ' is-inline' : ''}`}><span className="opp-busy-line"><span>{children}</span><OpportunityWaveDots /></span></span>;
}
