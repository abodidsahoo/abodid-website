import rawQuotes from "../data/paul-graham-quotes.json";

export function normalizeQuotation(entry, index) {
  const quote = String(entry?.quote || "").trim();
  const author = String(entry?.author || "Unknown").trim();
  const suppliedWordCount = Number(entry?.wordCount);
  const calculatedWordCount =
    quote.match(/[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu)?.length || 0;

  return {
    id: String(entry?.id || `quote-${String(index + 1).padStart(3, "0")}`),
    quote,
    author,
    source: entry?.source ? String(entry.source).trim() : null,
    year: entry?.year ? String(entry.year).trim() : null,
    tags: Array.isArray(entry?.tags)
      ? entry.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    wordCount:
      Number.isFinite(suppliedWordCount) && suppliedWordCount >= 0
        ? suppliedWordCount
        : calculatedWordCount,
  };
}

export const paulGrahamQuotes = rawQuotes
  .map(normalizeQuotation)
  .filter((entry) => entry.quote && entry.author);
