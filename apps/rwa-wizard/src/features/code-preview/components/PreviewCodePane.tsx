import { memo, useMemo, type ReactElement } from 'react';

import type { FileTree } from '@openzeppelin/codegen-core';
import { formatCopy } from '@openzeppelin/rwa-wizard-copy';
import { CodeView, type CodeViewReveal } from '@openzeppelin/ui-components/code-view';

import { useCopy } from '../../../app/providers/useCopy';
import { createImportLinkDecorator } from '../../../services/preview';
import type {
  StructuralUpstreamImportLinks,
  StructuralUpstreamSourceRevision,
} from '../../../types/wizard';
import { languageForPath } from '../languageForPath';

function fileContentToString(content: string | Uint8Array): string {
  return typeof content === 'string' ? content : new TextDecoder().decode(content);
}

interface PreviewCodePaneProps {
  files: FileTree | null;
  selectedPath: string | null;
  /** Upstream coordinates from the codegen service; `null` disables import links. */
  sourceRevision: StructuralUpstreamSourceRevision | null;
  /** Linkable import identifiers from the codegen service; `null` disables import links. */
  importLinks: StructuralUpstreamImportLinks | null;
  /** Range to mark and scroll to; passed to the kit untouched. `undefined` = plain pane. */
  reveal?: CodeViewReveal;
}

function PreviewCodePaneImpl(props: PreviewCodePaneProps): ReactElement {
  const { files, selectedPath, sourceRevision, importLinks, reveal } = props;
  const copy = useCopy();

  const decorateToken = useMemo(
    () => createImportLinkDecorator(sourceRevision, importLinks),
    [importLinks, sourceRevision] // INV-8
  );

  // Own-key membership: `in` would admit prototype names on an empty tree. SF-9 INV-9.
  if (!files || !selectedPath || !Object.prototype.hasOwnProperty.call(files, selectedPath)) {
    return (
      <div className="rwa-code-preview-empty m-3 flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed px-4 text-sm">
        {copy.notice('code-preview.no-file-selected').description}
      </div>
    ); // INV-19
  }

  const source = fileContentToString(files[selectedPath] ?? '');

  return (
    // SF-20: opaque clipping chrome at the tree/code join — see code-preview.css.
    <div className="rwa-code-preview-code-pane flex min-h-0 min-w-0 flex-1 flex-col">
      <CodeView
        source={source}
        language={languageForPath(selectedPath)}
        decorateToken={decorateToken ?? undefined}
        reveal={reveal} // SF-9 INV-2
        // The gutter is themed rather than inherited: unset, the kit falls back
        // to `--color-muted-foreground`, which on this surface is the light UI's
        // grey. `--code-view-line-number-color` is set on this element in
        // `code-preview.css` and reaches every row by inheritance.
        //
        // Nothing in that stylesheet forces soft wrap on the pane, and nothing
        // may: the gutter is a sticky sibling column aligned to unwrapped line
        // boxes, and a 400-char line under `pre-wrap` takes ten line boxes
        // against its one gutter row. `CodeView` ships `whitespace-pre` and
        // exposes no wrapping prop, so a consumer stylesheet is the only thing
        // that could put the two out of step.
        //
        // SF-20: gutter is opaque *and* stacked above scrolling source — see
        // `code-preview.css` (`[data-code-view-gutter]` z-index + left pad/border
        // zeroed on this pre). Solid background alone left glyphs painting over
        // the gutter's left edge (gap-ring-still-transparent).
        showLineNumbers
        aria-label={formatCopy(copy.notice('code-preview.source-label').description, {
          path: selectedPath,
        })}
        className="rwa-code-preview-code min-h-0 flex-1"
      />
      {/*
        VS Code-style status bar: the selected path, in a row of its own below
        the code. It used to float over the pane's bottom-right corner, where an
        opaque chip painted over whatever line happened to be there — and at any
        scroll position, not just at the end of the file. A laid-out row costs
        one line of height and can occlude nothing.
      */}
      <div
        className="rwa-code-preview-status shrink-0 truncate px-3 py-0.5 text-right text-[11px] leading-4"
        title={selectedPath}
      >
        {selectedPath}
      </div>
    </div>
  );
}

/**
 * Memoised because the sheet re-renders on every drag `pointermove` while none
 * of these props change. Without it each frame re-reconciled a whole file
 * through `CodeView`'s per-leaf decorator.
 */
export const PreviewCodePane = memo(PreviewCodePaneImpl);
