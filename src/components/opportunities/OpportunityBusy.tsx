import React from 'react';

export function OpportunityWaveDots() {
    return <span className="opp-wave-dots" aria-hidden="true"><i /><i /><i /></span>;
}

export function OpportunityBusy({ children, detail }: { children: React.ReactNode; detail?: string }) {
    return <span className="opp-busy-copy"><span className="opp-busy-line"><OpportunityWaveDots /><span>{children}</span></span>{detail && <small>{detail}</small>}</span>;
}
