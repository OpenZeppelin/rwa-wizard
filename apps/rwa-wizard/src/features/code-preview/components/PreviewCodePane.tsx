import { memo, useMemo, type ReactElement } from 'react';

import type { FileTree } from '@openzeppelin/codegen-core';
import { CodeView } from '@openzeppelin/ui-components/code-view';

import { useCopy } from '../../../app/providers/useCopy';
import { createStellarImportDecorator } from '../../../services/preview';
import type { StructuralUpstreamSourceRevision } from '../../../types/wizard';
import { languageForPath } from '../languageForPath';

function fileContentToString(content: string | Uint8Array): string {
  return typeof content === 'string' ? content : new TextDecoder().decode(content);
}

interface PreviewCodePaneProps {
  files: FileTree | null;
  selectedPath: string | null;
  /** Upstream coordinates from the codegen service; `null` disables import links. */
  sourceRevision: StructuralUpstreamSourceRevision | null;
}

function PreviewCodePaneImpl(props: PreviewCodePaneProps): ReactElement {
  const { files, selectedPath, sourceRevision } = props;
  const copy = useCopy();

  const decorateToken = useMemo(
    () => createStellarImportDecorator(sourceRevision),
    [sourceRevision] // INV-8
  );

  if (!files || !selectedPath || !(selectedPath in files)) {
    return (
      <div className="rwa-code-preview-empty m-3 flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed px-4 text-sm">
        {copy.notice('code-preview.no-file-selected').description}
      </div>
    ); // INV-19
  }

  const source = fileContentToString(files[selectedPath] ?? '');

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <CodeView
        source={source}
        language={languageForPath(selectedPath)}
        decorateToken={decorateToken}
        aria-label={`${selectedPath} source code`}
        className="rwa-code-preview-code h-full min-h-0 flex-1"
      />
      {/* VS Code-style status chip: selected path, pinned so it never moves other chrome. */}
      <span
        className="rwa-code-preview-status pointer-events-none absolute right-3 bottom-2 max-w-[70%] truncate rounded px-2 py-0.5 text-[11px] leading-4"
        title={selectedPath}
      >
        {selectedPath}
      </span>
    </div>
  );
}

/**
 * Memoised because the sheet re-renders on every drag `pointermove` while none
 * of these props change. Without it each frame re-reconciled a whole file
 * through `CodeView`'s per-leaf decorator.
 */
export const PreviewCodePane = memo(PreviewCodePaneImpl);
