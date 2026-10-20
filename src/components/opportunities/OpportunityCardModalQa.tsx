import React, { useState } from 'react';
import type { Opportunity, OpportunityCategory, OpportunityStatus } from '../../lib/opportunities/types';
import { OpportunityCard } from './OpportunityCard';
import { OpportunityListItem } from './OpportunityListItem';
import { OpportunityDetailModal } from './OpportunityDetailModal';
import { ManualCreateModal } from './ManualCreateModal';

const categories: OpportunityCategory[] = [
    'grant',
    'fellowship',
    'job',
    'open_call',
    'residency',
    'conference',
    'event',
    'other',
];

const initialOpportunities: Opportunity[] = categories.map((cat, idx) => ({
    id: `qa-${cat}`,
    title: `${cat === 'open_call' ? 'Open Call' : cat.charAt(0).toUpperCase() + cat.slice(1)} Opportunity for Creative Technologists & Artists`,
    organisation: `Organisation for ${cat.toUpperCase()}`,
    category: cat,
    source_url: `https://example.org/${cat}`,
    canonical_url: `https://example.org/${cat}`,
    deadline_at: new Date(Date.now() + (idx + 1) * 86400000 * 3).toISOString(),
    deadline_raw: `${(idx + 1) * 3} days left`,
    deadline_timezone: 'Asia/Kolkata',
    deadline_confidence: 'exact',
    event_date: null,
    location: 'Worldwide / Remote',
    requirements: ['Portfolio PDF', 'Project statement'],
    completed_requirements: ['Portfolio PDF'],
    next_action: 'Complete proposal and submit online form.',
    application_url: `https://apply.example.org/${cat}`,
    meeting_url: null,
    fee_or_funding: 'Funded (£3,500 stipend)',
    application_fee: 'Free',
    summary: `Curated ${cat} opportunity description with details.`,
    status: 'reviewing',
    outcome: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    extracted_at: new Date().toISOString(),
    source_hash: null,
    llm_model: 'qa',
    llm_extraction_count: 1,
    notes: 'Important deadline note.',
    is_high_priority: idx === 0,
}));

const base = initialOpportunities[0];

export default function OpportunityCardModalQa() {
    const [opportunities, setOpportunities] = useState(initialOpportunities);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
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
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
                <button type="button" className="opp-btn opp-btn-primary" onClick={() => setIsCreateOpen(true)}>
                    Add opportunity
                </button>
                <button
                    type="button"
                    className={`opp-btn ${viewMode === 'list' ? 'opp-btn-primary' : 'opp-btn-secondary'}`}
                    onClick={() => setViewMode('list')}
                >
                    List view
                </button>
                <button
                    type="button"
                    className={`opp-btn ${viewMode === 'grid' ? 'opp-btn-primary' : 'opp-btn-secondary'}`}
                    onClick={() => setViewMode('grid')}
                >
                    Grid view
                </button>
            </div>

            {viewMode === 'list' ? (
                <div className="opp-list">
                    {opportunities.map((opportunity) => (
                        <OpportunityListItem
                            key={opportunity.id}
                            opportunity={opportunity}
                            onOpen={(item) => setSelectedId(item.id)}
                            showPriorityToggle={true}
                            onToggleHighPriority={(isHigh) => update(opportunity.id, { is_high_priority: isHigh })}
                        />
                    ))}
                </div>
            ) : (
                <div className="opp-grid">
                    {opportunities.map((opportunity) => (
                        <OpportunityCard
                            key={opportunity.id}
                            opportunity={opportunity}
                            onOpen={(item) => setSelectedId(item.id)}
                            showPriorityToggle={true}
                            onToggleHighPriority={(isHigh) => update(opportunity.id, { is_high_priority: isHigh })}
                        />
                    ))}
                </div>
            )}
            {selected && (
                <OpportunityDetailModal
                    opportunity={selected}
                    isOpen
                    isAuthenticated
                    onClose={() => setSelectedId(null)}
                    onUpdateStatus={async (id: string, status: OpportunityStatus) => update(id, { status })}
                    onUpdateHighPriority={async (id: string, is_high_priority: boolean) => update(id, { is_high_priority })}
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
