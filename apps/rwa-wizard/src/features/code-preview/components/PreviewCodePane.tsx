import { useMemo, type ReactElement } from 'react';

import type { FileTree } from '@openzeppelin/codegen-core';
import { CodeView } from '@openzeppelin/ui-components/code-view';

import {
  createStellarImportDecorator,
  resolveStellarSourceRevision,
} from '../../../services/preview';
import { languageForPath } from '../languageForPath';

function fileContentToString(content: string | Uint8Array): string {
  return typeof content === 'string' ? content : new TextDecoder().decode(content);
}

export function PreviewCodePane(props: {
  files: FileTree | null;
  selectedPath: string | null;
}): ReactElement {
  const { files, selectedPath } = props;

  const revision = useMemo(
    () => (files ? resolveStellarSourceRevision(files) : null),
    [files] // INV-8
  );

  const decorateToken = useMemo(
    () => createStellarImportDecorator(revision),
    [revision] // INV-8
  );

  if (!files || !selectedPath || !(selectedPath in files)) {
    return (
      <div className="rwa-code-preview-empty m-3 flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed px-4 text-sm">
        Select a file to view its generated source.
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
