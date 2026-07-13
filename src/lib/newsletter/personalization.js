const FIRST_NAME_TOKEN = /{{\s*first_name\s*}}/gi;

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export function getNewsletterFirstName(name, fallback = 'there') {
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    return normalizedName.split(/\s+/)[0] || fallback;
}

export function personalizeNewsletterMessage(message, name, fallback = 'there') {
    const firstName = escapeHtml(getNewsletterFirstName(name, fallback));
    return String(message || '').replace(FIRST_NAME_TOKEN, firstName);
}
