const normalizeText = (value) => String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function boundedEditDistance(first, second, maximum) {
    if (Math.abs(first.length - second.length) > maximum) return maximum + 1;

    let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
    for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
        const current = [firstIndex];
        let rowMinimum = firstIndex;

        for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
            const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
            const distance = Math.min(
                current[secondIndex - 1] + 1,
                previous[secondIndex] + 1,
                previous[secondIndex - 1] + substitutionCost,
            );
            current.push(distance);
            rowMinimum = Math.min(rowMinimum, distance);
        }

        if (rowMinimum > maximum) return maximum + 1;
        previous = current;
    }

    return previous[second.length];
}

function termMatchesToken(term, token) {
    if (!term || !token) return false;
    if (token.includes(term)) return true;
    if (term.length < 4 || token.length < 4) return false;

    const allowedDistance = term.length >= 8 ? 2 : 1;
    return boundedEditDistance(term, token, allowedDistance) <= allowedDistance;
}

export function matchesMoodboardQuery(item, rawQuery) {
    const query = normalizeText(rawQuery);
    if (!query) return true;

    const searchableValues = [
        item?.title,
        item?.artistName,
        ...(Array.isArray(item?.tags) ? item.tags : []),
    ].map(normalizeText).filter(Boolean);
    const searchableText = searchableValues.join(' ');

    if (searchableText.includes(query)) return true;

    const tokens = searchableText.split(/\s+/).filter(Boolean);
    return query.split(/\s+/).every(
        (term) => tokens.some((token) => termMatchesToken(term, token)),
    );
}

