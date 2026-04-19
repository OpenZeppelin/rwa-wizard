import { Fragment, type ReactElement, type ReactNode } from 'react';

/**
 * Pattern that captures Markdown-style inline marks we support in copy
 * strings: `` `code` `` spans and `**strong**` emphasis.
 *
 * Kept in a single combined regex so we visit the string once and emit a
 * stable, ordered sequence of parts; splitting into two passes would risk
 * matching the same bytes twice when marks are adjacent.
 */
const INLINE_MARK_PATTERN = /`([^`]+)`|\*\*([^*]+)\*\*/g;

/**
 * Render a copy string with Markdown-style `` `inline code` `` and
 * `**strong**` marks lifted into matching elements.
 *
 * Educational copy in `@openzeppelin/rwa-wizard-copy` uses backticks for
 * contract-function and field names and `**bold**` for domain terms (e.g.
 * "a **claim topic** is …"). Everything else passes through as plain text
 * so the copy package stays strictly stringly-typed and JSX never leaks
 * across the package boundary.
 */
export function renderInlineCopy(text: string): ReactElement {
  if (!text) return <Fragment />;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_MARK_PATTERN)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, matchIndex));
    }
    if (match[1] !== undefined) {
      nodes.push(
        <code key={matchIndex} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {match[1]}
        </code>
      );
    } else if (match[2] !== undefined) {
      nodes.push(
        <strong key={matchIndex} className="font-semibold">
          {match[2]}
        </strong>
      );
    }
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return (
    <Fragment>
      {nodes.map((node, index) => (
        <Fragment key={index}>{node}</Fragment>
      ))}
    </Fragment>
  );
}
