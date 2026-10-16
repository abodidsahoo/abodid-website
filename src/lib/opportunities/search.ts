import type { Opportunity } from './types';

type SearchField = {
    text: string;
    words: string[];
    weight: number;
};

type SearchDocument = {
    combinedText: string;
    fields: SearchField[];
};

export type OpportunitySearchIndex = Map<string, SearchDocument>;

const normalizeSearchText = (value: unknown): string => {
    if (typeof value !== 'string') return '';

    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
};

const boundedLevenshtein = (first: string, second: string, maximum: number): number => {
    if (Math.abs(first.length - second.length) > maximum) return maximum + 1;
    if (first === second) return 0;

    let previous = Array.from({ length: second.length + 1 }, (_, index) => index);

    for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
        const current = [firstIndex];
        let rowMinimum = current[0];

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
};

const fuzzyDistanceLimit = (token: string): number => {
    if (token.length < 3) return 0;
    if (token.length <= 4) return 1;
    if (token.length <= 8) return 2;
    return 3;
};

const fieldScoreForToken = (field: SearchField, token: string): number => {
    if (!field.text) return 0;

    if (field.words.includes(token)) return 90 * field.weight;
    if (field.words.some((word) => word.startsWith(token))) return 72 * field.weight;
    if (field.text.includes(token)) return 60 * field.weight;

    const maximumDistance = fuzzyDistanceLimit(token);
    if (maximumDistance === 0) return 0;

    let closestDistance = maximumDistance + 1;
    for (const word of field.words) {
        if (Math.abs(word.length - token.length) > maximumDistance) continue;
        closestDistance = Math.min(
            closestDistance,
            boundedLevenshtein(token, word, maximumDistance),
        );
        if (closestDistance === 1) break;
    }

    return closestDistance <= maximumDistance
        ? (45 - closestDistance * 10) * field.weight
        : 0;
};

const searchableValues = (opportunity: Opportunity): Array<[unknown, number]> => [
    [opportunity.title, 10],
    [opportunity.organisation, 8],
    [opportunity.category.replace(/_/g, ' '), 6],
    [opportunity.summary, 5],
    [opportunity.requirements.join(' '), 5],
    [opportunity.completed_requirements.join(' '), 4],
    [opportunity.next_action, 5],
    [opportunity.location, 4],
    [opportunity.notes, 4],
    [opportunity.fee_or_funding, 3],
    [opportunity.application_fee, 3],
    [opportunity.deadline_raw, 2],
    [opportunity.deadline_timezone, 2],
    [opportunity.source_url, 2],
    [opportunity.canonical_url, 2],
    [opportunity.application_url, 2],
    [opportunity.meeting_url, 2],
    [opportunity.status, 1],
    [opportunity.outcome, 1],
];

export function buildOpportunitySearchIndex(
    opportunities: Opportunity[],
): OpportunitySearchIndex {
    return new Map(opportunities.map((opportunity) => {
        const fields = searchableValues(opportunity)
            .map(([value, weight]) => {
                const text = normalizeSearchText(value);
                return { text, words: text.split(' ').filter(Boolean), weight };
            })
            .filter((field) => field.text.length > 0);

        return [
            opportunity.id,
            {
                fields,
                combinedText: fields.map((field) => field.text).join(' '),
            },
        ];
    }));
}

export function rankOpportunitySearch(
    opportunities: Opportunity[],
    query: string,
    index: OpportunitySearchIndex,
): Opportunity[] {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return opportunities;

    const queryTokens = [...new Set(normalizedQuery.split(' ').filter(Boolean))];

    return opportunities
        .map((opportunity, originalIndex) => {
            const document = index.get(opportunity.id);
            if (!document) return { opportunity, originalIndex, score: 0, matches: false };

            let score = document.combinedText.includes(normalizedQuery) ? 600 : 0;
            for (const token of queryTokens) {
                const tokenScore = document.fields.reduce(
                    (best, field) => Math.max(best, fieldScoreForToken(field, token)),
                    0,
                );
                if (tokenScore === 0) {
                    return { opportunity, originalIndex, score: 0, matches: false };
                }
                score += tokenScore;
            }

            return { opportunity, originalIndex, score, matches: true };
        })
        .filter((result) => result.matches)
        .sort((first, second) => (
            second.score - first.score || first.originalIndex - second.originalIndex
        ))
        .map(({ opportunity }) => opportunity);
}
