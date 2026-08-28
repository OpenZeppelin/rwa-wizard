import { Fragment, type ReactNode } from 'react';

import type { CodeViewTokenDecorator } from '@openzeppelin/ui-components/code-view';

import type {
  StructuralUpstreamImportLinks,
  StructuralUpstreamImportTarget,
  StructuralUpstreamSourceRevision,
} from '../../../types/wizard';
import { buildImportTargetUrl } from './buildImportTargetUrl';
import { matchImportIdentifiers } from './matchImportIdentifiers';
import type { ImportIdentifierMatch, ImportLinkDecoratorOptions } from './types';

type PositionedMatch = ImportIdentifierMatch & { relStart: number; relEnd: number };

/**
 * Whether the line holding `offset` declares an import.
 *
 * The prefix is the generated language's syntax and is supplied by the codegen
 * package, so this stays a string comparison rather than knowledge of any
 * particular language. Without it, an identifier mentioned in a comment or a
 * doc block would link as if it were an import. INV-16
 */
function lineDeclaresImport(source: string, offset: number, importLinePrefix: string): boolean {
  if (importLinePrefix === '') {
    return true;
  }

  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  const lineEnd = source.indexOf('\n', offset);
  const line = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  return line.trimStart().startsWith(importLinePrefix);
}

function relativeMatches(
  tokenText: string,
  leafOffset: number,
  matches: readonly ImportIdentifierMatch[]
): PositionedMatch[] {
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
  matches: PositionedMatch[],
  targetsById: ReadonlyMap<string, StructuralUpstreamImportTarget>,
  revision: StructuralUpstreamSourceRevision
): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.relStart > cursor) {
      parts.push(tokenText.slice(cursor, match.relStart));
    }

    const target = targetsById.get(match.identifier);
    if (target) {
      parts.push(
        <a
          key={match.relStart}
          href={buildImportTargetUrl(revision, target)}
          rel="noopener noreferrer"
          target="_blank"
          className="underline"
        >
          {match.text}
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
 * Closes over the revision and the import targets the codegen service reports
 * for the loaded target; callers memoize per reference (INV-10).
 *
 * Returns `null` — not a decorator that declines every token — when the active
 * package supplies nothing to link to, so that callers can leave the prop off
 * and `CodeView` skips the per-leaf call entirely on a file that has no links
 * to draw. A target whose package reports no revision or no targets is the
 * common case, and a 700-line file is thousands of leaves.
 */
export function createImportLinkDecorator(
  revision: StructuralUpstreamSourceRevision | null,
  links: StructuralUpstreamImportLinks | null,
  options?: ImportLinkDecoratorOptions
): CodeViewTokenDecorator | null {
  const degradeMode = options?.degradeMode ?? 'repo-root';
  const linksAvailable =
    revision !== null &&
    links !== null &&
    links.targets.length > 0 &&
    !(revision.commitHash === null && degradeMode === 'plain-text');

  if (!linksAvailable) {
    return null; // INV-2, INV-8
  }

  const identifiers = links.targets.map((target) => target.identifier);
  const targetsById = new Map(links.targets.map((target) => [target.identifier, target]));

  return ({ source, language, token }) => {
    if (language !== links.language) {
      return undefined; // INV-2, INV-8
    }

    if (!lineDeclaresImport(source, token.offset, links.importLinePrefix)) {
      return undefined; // INV-16
    }

    const matches = matchImportIdentifiers(token.text, token.offset, identifiers);
    if (matches.length === 0) {
      return undefined;
    }

    const positioned = relativeMatches(token.text, token.offset, matches);
    if (positioned.length === 0) {
      return undefined;
    }

    return renderLinkedLeaf(token.text, positioned, targetsById, revision);
  };
}
