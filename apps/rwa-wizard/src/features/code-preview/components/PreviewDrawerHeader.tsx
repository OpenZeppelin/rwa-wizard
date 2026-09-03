import type { ReactElement } from 'react';

import type { CodePreviewLayoutTools, CodePreviewPhase } from '../hooks/useCodePreview';
import { PreviewDrawerTools } from './PreviewDrawerTools';
import { PreviewSubstitutionsNotice } from './PreviewSubstitutionsNotice';

/**
 * Content for the kit `BottomSheet` `header` slot: the placeholder notice (INV-2) and
 * the layout tools, sharing the row with the sheet's close button. The selected path is
 * shown in the code pane's status chip instead, so the notice never shifts with path
 * length. Returns `undefined` when there is nothing to show, so the sheet renders its
 * default chrome.
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
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="min-w-0 flex-1">
        <PreviewSubstitutionsNotice substitutedKeys={keys} />
      </div>
      {tools ? <PreviewDrawerTools {...tools} /> : null}
    </div>
  );
}
