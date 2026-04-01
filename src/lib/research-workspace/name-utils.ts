export function normalizeWhitespace(value: string): string {
    return value
        .replace(/\r/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

export function toReadableTitle(value: string): string {
    return normalizeWhitespace(
        value
            .replace(/\.pdf$/i, '')
            .replace(/[_-]+/g, ' ')
    )
        .split(' ')
        .filter(Boolean)
        .map((segment) => {
            if (/^[A-Z0-9]{2,}$/.test(segment)) {
                return segment;
            }

            return segment.charAt(0).toUpperCase() + segment.slice(1);
        })
        .join(' ');
}

export function slugify(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}
