import { ArrowRight } from 'lucide-react';
import type { ReactElement } from 'react';

import { formatCopy } from '@openzeppelin/rwa-wizard-copy';

import { useCopy } from '../../../app/providers/useCopy';
import type { FieldProvenanceRow } from '../../../services/preview';

interface PreviewImpactRowProps {
  /** The generated file this site is in. Named in the row's label. */
  readonly path: string;
  readonly row: FieldProvenanceRow;
  /** Rendered under the "Mentions" heading. Presentation only. */
  readonly secondary: boolean;
  /**
   * Shared activation path (column-local `activateSite`). `null` disables the
   * button without hiding the row. INV-8 / INV-14.
   */
  readonly onActivate: (() => void) | null;
  /**
   * True when this row is the column's active site for the current subject.
   * Drives `aria-current="true"` and the selected-background class.
   * Default false. Does not change activation behaviour (INV-2).
   */
  readonly active?: boolean;
}

/**
 * One activatable site: a real `<button type="button">` inside an `<li>`.
 *
 * A real button means Enter and Space activate for free, with no key handling
 * of our own — and no roving tabindex, no `aria-activedescendant`, no composite
 * widget. AS-7 asks for reachable and activatable, not for a listbox, and a
 * roving list is the expensive answer to a question nobody asked. INV-42.
 *
 * The three row kinds have **equal standing**: same element, same affordance,
 * same tab stop. They differ only in their label and in what activation sends.
 * INV-4.
 */
export function PreviewImpactRow(props: PreviewImpactRowProps): ReactElement {
  const { path, row, secondary, onActivate, active = false } = props;
  const copy = useCopy();

  const detail = describeRow(row, copy);
  const span = row.kind === 'range' ? row.range.endLine - row.range.startLine + 1 : 0;

  return (
    <li>
      <button
        type="button"
        // A disabled button, not a missing one and not a `<span>`: the row
        // count and the DOM shape stay stable across the `onActivate === null`
        // guard, which is what keeps the three-region structure assertion
        // honest, and it correctly leaves the tab order for a control that
        // does nothing. INV-14.
        disabled={onActivate === null}
        // Reveal / defer live in the column's `activateSite` — one path for
        // click and auto-select (INV-8). The row only fires that path.
        onClick={() => {
          onActivate?.();
        }}
        aria-label={formatCopy(copy.notice('code-preview.impact.row-label').description, {
          detail,
          path,
        })}
        // INV-21: mark the current site without promoting the list to a listbox.
        // Omitted when inactive — prefer absence over `aria-current="false"`.
        aria-current={active ? 'true' : undefined}
        // Read by the layout probe to pick the widest range for V8; carries no
        // behaviour and is not read by any component.
        data-row-span={span}
        className={`rwa-code-preview-impact-row disabled:cursor-default disabled:opacity-60${
          secondary ? ' rwa-code-preview-impact-row-secondary' : ''
        }${active ? ' rwa-code-preview-impact-row-active' : ''}`}
      >
        {/*
          The rest-state affordance, and the reason it is not a hover effect:
          the rows jump the code pane, which is the entire point of the column,
          and nothing about a muted line of text at 11px says so until the
          pointer is already on it. A keyboard user and a reader who never
          hovers got no signal at all.

          An ARROW, not a chevron. A chevron pointing right is the disclosure
          glyph — it is what the file tree beside this column uses to expand a
          folder — so at rest, in a list of indented lines under a filename, it
          read as "these rows open up". They do not; they take you somewhere. An
          arrow says go, and says it without borrowing the tree's vocabulary.

          A glyph rather than colour, because the reveal accent is deliberately
          the only colour-carrying signal in this composition and a second one
          would compete with it. `aria-hidden`: the row's whole message is its
          `aria-label`, and a decorative arrow in the accessible name is noise.
          `shrink-0` so it is the text that truncates, never the affordance.
        */}
        <ArrowRight className="rwa-code-preview-impact-go size-3 shrink-0" aria-hidden />
        <span className="truncate">{detail}</span>
      </button>
    </li>
  );
}

function describeRow(row: FieldProvenanceRow, copy: ReturnType<typeof useCopy>): string {
  switch (row.kind) {
    case 'file':
      return copy.notice('code-preview.impact.row-file').description;
    case 'created':
      return copy.notice('code-preview.impact.row-created').description;
    case 'range':
      return row.range.startLine === row.range.endLine
        ? formatCopy(copy.notice('code-preview.impact.row-line').description, {
            startLine: row.range.startLine,
          })
        : formatCopy(copy.notice('code-preview.impact.row-range').description, {
            startLine: row.range.startLine,
            endLine: row.range.endLine,
          });
    default: {
      const exhaustive: never = row;
      return exhaustive;
    }
  }
}
