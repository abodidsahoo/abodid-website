export type OpportunityMenuRect = Pick<DOMRect, 'top' | 'right' | 'bottom'>;

interface OpportunityMenuPositionOptions {
    triggerRect: OpportunityMenuRect;
    menuWidth: number;
    menuHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    gap?: number;
    margin?: number;
}

export interface OpportunityMenuPosition {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
    Math.min(Math.max(value, minimum), maximum);

export const getOpportunityMenuPosition = ({
    triggerRect,
    menuWidth,
    menuHeight,
    viewportWidth,
    viewportHeight,
    gap = 8,
    margin = 12,
}: OpportunityMenuPositionOptions): OpportunityMenuPosition => {
    const width = Math.min(menuWidth, Math.max(0, viewportWidth - (margin * 2)));
    const left = clamp(triggerRect.right - width, margin, Math.max(margin, viewportWidth - width - margin));
    const spaceBelow = Math.max(0, viewportHeight - triggerRect.bottom - gap - margin);
    const spaceAbove = Math.max(0, triggerRect.top - gap - margin);
    const placeAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
    const availableHeight = placeAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(0, availableHeight);
    const renderedHeight = Math.min(menuHeight, maxHeight);
    const preferredTop = placeAbove
        ? triggerRect.top - gap - renderedHeight
        : triggerRect.bottom + gap;
    const top = clamp(preferredTop, margin, Math.max(margin, viewportHeight - renderedHeight - margin));

    return { top, left, width, maxHeight };
};
