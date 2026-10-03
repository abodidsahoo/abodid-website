const shannonEntropy = (value) => {
    const frequencies = new Map();
    for (const character of value.toLowerCase()) {
        frequencies.set(character, (frequencies.get(character) || 0) + 1);
    }

    let entropy = 0;
    for (const count of frequencies.values()) {
        const probability = count / value.length;
        entropy -= probability * Math.log2(probability);
    }
    return entropy;
};

/**
 * Blocks short, machine-generated token payloads without trying to judge normal prose.
 * Non-ASCII text and anything containing spaces or sentence punctuation is left alone.
 */
export const looksLikeRandomCharacterMessage = (value) => {
    if (typeof value !== 'string') return false;

    const message = value.trim();
    if (message.length < 12 || message.length > 120) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(message)) return false;

    const letters = message.replace(/[^A-Za-z]/g, '');
    const digits = message.replace(/\D/g, '');
    const caseTransitions = [...letters].slice(1).reduce((count, character, index) => {
        const previous = letters[index];
        const changedCase = /[a-z]/.test(previous) !== /[a-z]/.test(character);
        return count + (changedCase ? 1 : 0);
    }, 0);
    const mixedCaseToken = /[a-z]/.test(letters) && /[A-Z]/.test(letters) && caseTransitions >= 3;
    const denseAlphaNumericToken = letters.length >= 6 && digits.length >= 2;
    const repeatedToken = /(.)\1{5,}/i.test(message);
    const highEntropyToken = message.length >= 16 && shannonEntropy(message) >= 3.9;

    return mixedCaseToken || denseAlphaNumericToken || repeatedToken || highEntropyToken;
};

/**
 * Finds random-looking tokens embedded inside an otherwise plausible message.
 * Contact bots often prepend copied marketing language, then append their
 * machine-generated marker on a separate line.
 */
export const containsRandomCharacterToken = (value) => {
    if (typeof value !== 'string') return false;

    return value
        .split(/\s+/)
        .map((token) => token.replace(/^["'“”‘’([{<]+|["'“”‘’),.;:!?\]}>]+$/g, ''))
        .some((token) => looksLikeRandomCharacterMessage(token));
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'tempmail.com',
    'yopmail.com',
]);

/**
 * Conservative email abuse check. It targets noisy machine-generated local
 * parts and common disposable inboxes while leaving ordinary aliases intact.
 */
export const looksLikeSuspiciousEmail = (value) => {
    if (typeof value !== 'string') return true;
    const email = value.trim().toLowerCase();
    const at = email.lastIndexOf('@');
    if (at <= 0 || at === email.length - 1) return true;

    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
    if (local.length > 64 || /\.{2,}|[-_+]{4,}/.test(local)) return true;

    const punctuationCount = (local.match(/[._+-]/g) || []).length;
    const compact = local.replace(/[^a-z0-9]/g, '');
    const vowels = (compact.match(/[aeiou]/g) || []).length;
    const digits = (compact.match(/\d/g) || []).length;
    const vowelRatio = compact.length ? vowels / compact.length : 0;
    const tinyDotSegments = local.split('.').length >= 5 &&
        local.split('.').filter(Boolean).every((segment) => segment.length <= 2);
    const randomDenseLocal = compact.length >= 16 &&
        shannonEntropy(compact) >= 3.75 &&
        vowelRatio < 0.22 &&
        (digits >= 3 || punctuationCount >= 3);

    return tinyDotSegments || punctuationCount >= 7 || randomDenseLocal;
};

/**
 * Requires multiple independent signals before classifying a normal-looking
 * enquiry as spam. A message that is only a random token remains an immediate
 * match, preserving the original protection.
 */
export const isHighConfidenceContactSpam = ({ name, email, message } = {}) => {
    const randomName = looksLikeRandomCharacterMessage(name);
    const suspiciousEmail = looksLikeSuspiciousEmail(email);
    const randomWholeMessage = looksLikeRandomCharacterMessage(message);
    const embeddedRandomToken = !randomWholeMessage && containsRandomCharacterToken(message);

    return randomWholeMessage || (
        [randomName, suspiciousEmail, embeddedRandomToken].filter(Boolean).length >= 2 &&
        (randomName || embeddedRandomToken)
    );
};
