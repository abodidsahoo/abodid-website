import React, { useState } from 'react';
import type { Opportunity, OpportunityStatus } from '../../lib/opportunities/types';
import { OpportunityCard } from './OpportunityCard';
import { OpportunityDetailModal } from './OpportunityDetailModal';
import { ManualCreateModal } from './ManualCreateModal';

const base: Opportunity = {
    id: 'qa-long',
    title: 'International Creative Technology Fellowship for Emerging Researchers and Artists Working Across Multiple Disciplines',
    organisation: 'Example Arts Foundation With A Very Long Organisation Name',
    category: 'fellowship',
    source_url: 'https://example.org/fellowship',
    canonical_url: 'https://example.org/fellowship',
    deadline_at: new Date(Date.now() + 35 * 60 * 60 * 1000).toISOString(),
    deadline_raw: 'Tomorrow',
    deadline_timezone: 'Asia/Kolkata',
    deadline_confidence: 'exact',
    event_date: null,
    location: 'Worldwide',
    requirements: ['Portfolio PDF', 'Project statement', 'Reference letter'],
    completed_requirements: ['Portfolio PDF'],
    next_action: 'Finish the project statement and ask your referee for a letter.',
    application_url: 'https://apply.example.org/fellowship',
    meeting_url: null,
    fee_or_funding: 'Fully funded with a £2,000 stipend',
    application_fee: '£20 submission fee; waivers available',
    summary: 'A supported research fellowship for emerging practitioners.',
    status: 'preparing',
    outcome: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    extracted_at: new Date().toISOString(),
    source_hash: null,
    llm_model: 'qa',
    llm_extraction_count: 1,
    notes: 'Request the recommendation at least one week early.',
    priority: 2,
};

const initialOpportunities: Opportunity[] = [
    base,
    {
        ...base,
        id: 'qa-short',
        title: 'Short Grant',
        organisation: 'Studio X',
        category: 'grant',
        deadline_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    },
];

export default function OpportunityCardModalQa() {
    const [opportunities, setOpportunities] = useState(initialOpportunities);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const selected = opportunities.find((opportunity) => opportunity.id === selectedId) || null;
    const selectedIndex = opportunities.findIndex((opportunity) => opportunity.id === selectedId);

    const update = (id: string, changes: Partial<Opportunity>) => {
        setOpportunities((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
    };

    const navigate = (direction: 1 | -1) => {
        if (selectedIndex < 0) return;
        const nextIndex = (selectedIndex + direction + opportunities.length) % opportunities.length;
        setSelectedId(opportunities[nextIndex].id);
    };

    return (
        <>
            <button type="button" className="opp-btn opp-btn-primary" onClick={() => setIsCreateOpen(true)}>
                Add opportunity
            </button>
            <div className="opp-grid">
                {opportunities.map((opportunity) => (
                    <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        onOpen={(item) => setSelectedId(item.id)}
                    />
                ))}
            </div>
            {selected && (
                <OpportunityDetailModal
                    opportunity={selected}
                    isOpen
                    isAuthenticated
                    onClose={() => setSelectedId(null)}
                    onUpdateStatus={async (id: string, status: OpportunityStatus) => update(id, { status })}
                    onUpdatePriority={async (id: string, priority: number) => update(id, { priority })}
                    onUpdateChecklist={async (id: string, completed_requirements: string[]) => update(id, { completed_requirements })}
                    onUpdateDeadline={async () => undefined}
                    onEdit={() => undefined}
                    onReExtract={async () => undefined}
                    onDelete={async () => undefined}
                    onNavigatePrev={() => navigate(-1)}
                    onNavigateNext={() => navigate(1)}
                    currentIndex={selectedIndex + 1}
                    totalCount={opportunities.length}
                />
            )}
            <ManualCreateModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onCreate={async () => undefined}
                onExtract={async () => ({
                    title: base.title,
                    organisation: base.organisation,
                    category: base.category,
                    deadline: base.deadline_at?.slice(0, 10) || '',
                    timezone: base.deadline_timezone || '',
                    event_date: base.event_date,
                    location: base.location || '',
                    requirements: base.requirements,
                    next_action: base.next_action || '',
                    application_url: base.application_url || '',
                    fee_or_funding: base.fee_or_funding || '',
                    application_fee: base.application_fee || '',
                    summary: base.summary || '',
                })}
            />
        </>
    );
}
