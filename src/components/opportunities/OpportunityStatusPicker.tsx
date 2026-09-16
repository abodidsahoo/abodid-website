import React, { useState, useRef, useEffect } from 'react';
import type { OpportunityStatus } from '../../lib/opportunities/types';

export interface StatusConfig {
    id: OpportunityStatus;
    label: string;
    icon: string;
    description: string;
    color: string;
}

export const WORKFLOW_STATUSES: StatusConfig[] = [
    { id: 'inbox', label: 'Inbox', icon: '📥', description: 'New capture · Unsorted', color: '#f3f4f6' },
    { id: 'interested', label: 'Interested', icon: '⭐', description: 'Bookmarked for consideration', color: '#ffe44f' },
    { id: 'preparing', label: 'Preparing', icon: '📝', description: 'Drafting materials & portfolio', color: '#fde047' },
    { id: 'submitted', label: 'Submitted', icon: '🚀', description: 'Application delivered', color: '#86efac' },
    { id: 'registered', label: 'Registered', icon: '🎟️', description: 'Ticket / spot confirmed', color: '#a7f3d0' },
    { id: 'attending', label: 'Attending', icon: '📍', description: 'In progress / participating', color: '#93c5fd' },
    { id: 'done', label: 'Done', icon: '✅', description: 'Finished & outcome archived', color: '#c7d2fe' },
    { id: 'dismissed', label: 'Dismissed', icon: '✕', description: 'Not applying / passed', color: '#e5e7eb' },
];

interface OpportunityStatusPickerProps {
    status: OpportunityStatus;
    onChange: (status: OpportunityStatus) => Promise<void> | void;
    disabled?: boolean;
    position?: 'top' | 'bottom' | 'auto';
    size?: 'sm' | 'md';
}

export const OpportunityStatusPicker: React.FC<OpportunityStatusPickerProps> = ({
    status,
    onChange,
    disabled = false,
    position = 'top',
    size = 'sm',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentConfig = WORKFLOW_STATUSES.find((s) => s.id === status) || WORKFLOW_STATUSES[0];

    // Close on click outside or escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleSelect = async (newStatus: OpportunityStatus, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsOpen(false);
        if (newStatus !== status) {
            await onChange(newStatus);
        }
    };

    return (
        <div
            className={`opp-status-picker ${size} ${isOpen ? 'open' : ''}`}
            ref={containerRef}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                className={`opp-status-picker-trigger ${isOpen ? 'active' : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) setIsOpen((prev) => !prev);
                }}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={`Change status (current: ${currentConfig.label})`}
            >
                <span className="opp-status-trigger-icon">{currentConfig.icon}</span>
                <span className="opp-status-trigger-label">{currentConfig.label}</span>
                <svg
                    className={`opp-status-chevron ${isOpen ? 'rotated' : ''}`}
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {isOpen && (
                <div
                    className={`opp-status-popover pop-position-${position}`}
                    role="listbox"
                    aria-label="Select workflow status"
                >
                    <div className="opp-status-popover-header">
                        <span className="opp-status-popover-title">WORKFLOW STATUS</span>
                    </div>

                    <div className="opp-status-list">
                        {WORKFLOW_STATUSES.map((item) => {
                            const isSelected = item.id === status;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`opp-status-option ${isSelected ? 'selected' : ''}`}
                                    onClick={(e) => handleSelect(item.id, e)}
                                    role="option"
                                    aria-selected={isSelected}
                                >
                                    <span className="opp-status-option-icon">{item.icon}</span>
                                    <div className="opp-status-option-info">
                                        <div className="opp-status-option-label">{item.label}</div>
                                        <div className="opp-status-option-desc">{item.description}</div>
                                    </div>
                                    {isSelected && (
                                        <span className="opp-status-check-badge">✓</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
