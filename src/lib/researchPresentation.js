// Lift an explicitly authored outcome into the research summary. Never consume
// an unrelated heading, image, or hidden block just because it follows a label.
export function researchPresentation(blocks = []) {
  const source = Array.isArray(blocks) ? blocks : [];
  const textTypes = new Set(['highlight', 'callout', 'note', 'body_text', 'text', 'paragraph', 'rich_text']);
  const index = source.findIndex((block, index) =>
    block?.visible !== false && block?.blockType === 'heading'
    && /^(outcome|status)$/i.test(String(block.content?.text || '').trim())
    && source[index + 1]?.visible !== false
    && textTypes.has(source[index + 1]?.blockType)
    && String(source[index + 1]?.content?.text || '').trim(),
  );
  if (index < 0) return { blocks: source, outcomeText: '', outcomeStatus: null };
  const text = String(source[index + 1].content.text).trim();
  const outcomeStatus = text.match(/^\*\*([^*]+)\*\*/)?.[1] || null;
  return {
    blocks: source.filter((_, position) => position !== index && position !== index + 1),
    outcomeStatus,
    outcomeText: text.replace(/^\*\*[^*]+\*\*\s*/, '').trim() || outcomeStatus || '',
  };
}
