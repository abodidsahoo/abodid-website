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
