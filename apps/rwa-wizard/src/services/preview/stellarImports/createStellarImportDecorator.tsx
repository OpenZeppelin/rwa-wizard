import { Fragment, type ReactNode } from 'react';

import type { CodeViewTokenDecorator } from '@openzeppelin/ui-components/code-view';

import type { StructuralUpstreamSourceRevision } from '../../../types/wizard';
import { buildStellarCrateUrl } from './buildStellarCrateUrl';
import { matchStellarCratesInText } from './matchStellarCratesInText';
import type { StellarCrateMatch, StellarImportDecoratorOptions } from './types';

function lineStartsWithUse(source: string, offset: number): boolean {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  const lineEnd = source.indexOf('\n', offset);
  const line = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  return line.trimStart().startsWith('use '); // INV-16
}

function relativeMatches(
  tokenText: string,
  leafOffset: number,
  matches: readonly StellarCrateMatch[]
): Array<StellarCrateMatch & { relStart: number; relEnd: number }> {
  return matches
    .map((match) => ({
      ...match,
      relStart: match.start - leafOffset,
      relEnd: match.end - leafOffset,
    }))
    .filter((match) => match.relStart >= 0 && match.relEnd <= tokenText.length)
    .sort((a, b) => a.relStart - b.relStart);
}

function renderLinkedLeaf(
  tokenText: string,
  matches: Array<StellarCrateMatch & { relStart: number; relEnd: number }>,
  revision: StructuralUpstreamSourceRevision,
  degradeMode: StellarImportDecoratorOptions['degradeMode']
): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.relStart > cursor) {
      parts.push(tokenText.slice(cursor, match.relStart));
    }

    const url = buildStellarCrateUrl(revision, match.crateId);
    if (url && degradeMode !== 'plain-text') {
      parts.push(
        <a
          key={match.relStart}
          href={url}
          rel="noopener noreferrer"
          target="_blank"
          className="underline"
        >
          {match.crateId}
        </a>
      );
    } else {
      parts.push(match.text);
    }

    cursor = match.relEnd;
  }

  if (cursor < tokenText.length) {
    parts.push(tokenText.slice(cursor));
  }

  return <Fragment>{parts}</Fragment>; // INV-15
}

/**
 * Factory for SF-10's `decorateToken` prop.
 *
 * Closes over the revision the codegen service reports for the loaded target;
 * callers memoize per revision reference (INV-10). `null` disables decoration,
 * which is the case for any target that does not report one.
 */
export function createStellarImportDecorator(
  revision: StructuralUpstreamSourceRevision | null,
  options?: StellarImportDecoratorOptions
): CodeViewTokenDecorator {
  const degradeMode = options?.degradeMode ?? 'repo-root';

  return ({ source, language, token }) => {
    if (language !== 'rust' || revision === null) {
      return undefined; // INV-2, INV-8
    }

    if (!lineStartsWithUse(source, token.offset)) {
      return undefined; // INV-16
    }

    const matches = matchStellarCratesInText(token.text, token.offset);
    if (matches.length === 0) {
      return undefined;
    }

    const rel = relativeMatches(token.text, token.offset, matches);
    const hasLink = rel.some((match) => {
      const url = buildStellarCrateUrl(revision, match.crateId);
      return url !== null && degradeMode !== 'plain-text';
    });

    if (!hasLink) {
      return undefined; // INV-8: no fallback link when design chose plain text
    }

    return renderLinkedLeaf(token.text, rel, revision, degradeMode);
  };
}
