import type { ImportIdentifierMatch } from './types';

function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find whole-word occurrences of `identifiers` in a single text leaf.
 *
 * `identifiers` comes from the active codegen package; this module recognises
 * no identifier of its own, so it stays chain-neutral. `leafOffset` is the
 * leaf's absolute start in `source` (SF-10 contract).
 */
export function matchImportIdentifiers(
  text: string,
  leafOffset: number,
  identifiers: readonly string[]
): readonly ImportIdentifierMatch[] {
  if (identifiers.length === 0) {
    return [];
  }

  const known = new Set(identifiers);
  const pattern = new RegExp(`\\b(${identifiers.map(escapeForPattern).join('|')})\\b`, 'g');
  const matches: ImportIdentifierMatch[] = [];

  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const identifier = match[1];
    if (identifier === undefined || !known.has(identifier)) {
      continue;
    }

    matches.push({
      start: leafOffset + match.index,
      end: leafOffset + match.index + match[0].length,
      identifier,
      text: match[0],
    });
  }

  return matches;
}
