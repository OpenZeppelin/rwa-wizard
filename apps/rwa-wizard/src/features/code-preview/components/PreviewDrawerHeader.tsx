import type { ReactElement } from 'react';

import type { CodePreviewLayoutTools, CodePreviewPhase } from '../hooks/useCodePreview';
import { PreviewDrawerTools } from './PreviewDrawerTools';
import { PreviewSubstitutionsNotice } from './PreviewSubstitutionsNotice';

/**
 * Content for the kit `BottomSheet` `header` slot: the placeholder notice (INV-2)
 * and the layout tools. The sheet's close button is kit-owned and sits beside
 * this slot.
 *
 * Bottom / top: flex row — notice + tools share one band under the visible
 * drag separator (kit column stack; see `code-preview.css`).
 *
 * Left / right: `code-preview.css` uses `display: contents` + a 2-row grid so
 * the notice is alone on row 1 and tools align with Close on row 2.
 */
export function previewDrawerHeader(props: {
  phase: CodePreviewPhase;
  substitutedKeys: readonly string[];
  tools?: CodePreviewLayoutTools;
}): ReactElement | undefined {
  const { phase, substitutedKeys, tools } = props;

  const keys = phase.kind === 'ready' || phase.kind === 'error' ? substitutedKeys : [];

  if (keys.length === 0 && !tools) {
    return undefined;
  }

  return (
    <div className="rwa-code-preview-sheet-header flex min-w-0 flex-1 items-center gap-2">
      {keys.length > 0 ? (
        <div className="rwa-code-preview-sheet-notice min-w-0 flex-1">
          <PreviewSubstitutionsNotice substitutedKeys={keys} />
        </div>
      ) : (
        // Bottom/top: keeps tools right-aligned in the flex row. Side docks hide
        // this via CSS so it does not occupy a grid cell under display:contents.
        <div className="rwa-code-preview-sheet-header-spacer min-w-0 flex-1" aria-hidden />
      )}
      {tools ? <PreviewDrawerTools {...tools} /> : null}
    </div>
  );
}
