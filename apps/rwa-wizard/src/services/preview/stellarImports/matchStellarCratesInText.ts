import { STELLAR_CRATE_REPO_PATHS } from './stellarCratePaths';
import type { StellarCrateMatch } from './types';

const STELLAR_CRATE_IDENTIFIERS = Object.keys(STELLAR_CRATE_REPO_PATHS);

const STELLAR_CRATE_MATCH_RE = new RegExp(`\\b(${STELLAR_CRATE_IDENTIFIERS.join('|')})\\b`, 'g');

/**
 * Find mapped `stellar_*` identifiers in a single text leaf.
 * `leafOffset` is the leaf's absolute start in `source` (SF-10 contract).
 */
export function matchStellarCratesInText(
  text: string,
  leafOffset: number
): readonly StellarCrateMatch[] {
  const matches: StellarCrateMatch[] = [];

  STELLAR_CRATE_MATCH_RE.lastIndex = 0;
  for (
    let match = STELLAR_CRATE_MATCH_RE.exec(text);
    match;
    match = STELLAR_CRATE_MATCH_RE.exec(text)
  ) {
    const crateId = match[1];
    if (!STELLAR_CRATE_REPO_PATHS[crateId]) {
      continue;
    }

    matches.push({
      start: leafOffset + match.index,
      end: leafOffset + match.index + match[0].length,
      crateId,
      text: match[0],
    });
  }

  return matches;
}
