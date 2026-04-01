import type { WorkspaceTabId } from './types';

type WorkspaceTabsProps = {
    activeTab: WorkspaceTabId;
    onChange: (tab: WorkspaceTabId) => void;
};

const tabs: { id: WorkspaceTabId; label: string }[] = [
    { id: 'search', label: 'Search Papers' },
    { id: 'rename', label: 'Rename & Insights' }
];

export default function WorkspaceTabs({
    activeTab,
    onChange
}: WorkspaceTabsProps) {
    return (
        <div
            className="rw-tablist"
            role="tablist"
            aria-label="Research workspace sections"
        >
            {tabs.map((tab) => {
                const isActive = tab.id === activeTab;

                return (
                    <button
                        key={tab.id}
                        id={`rw-tab-${tab.id}`}
                        className={`rw-tab${isActive ? ' rw-tab--active' : ''}`}
                        role="tab"
                        type="button"
                        aria-selected={isActive}
                        aria-controls={`rw-panel-${tab.id}`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => onChange(tab.id)}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
