export function getViewerIndex(items, activeId) {
    if (!Array.isArray(items) || items.length === 0) return 0;
    if (!activeId) return 0;

    const index = items.findIndex((item) => item?.id === activeId);
    return index >= 0 ? index : 0;
}
