import React from 'react';

export function OpportunityWaveDots() {
    return <span className="opp-wave-dots" aria-hidden="true"><i /><i /><i /></span>;
}

export function OpportunityBusy({ children }: { children: React.ReactNode }) {
    return <span className="opp-busy-copy"><span className="opp-busy-line"><span>{children}</span><OpportunityWaveDots /></span></span>;
}
