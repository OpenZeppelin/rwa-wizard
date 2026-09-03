import { useMemo, type ReactElement } from 'react';

import type { FileTree } from '@openzeppelin/codegen-core';
import { FileTree as KitFileTree } from '@openzeppelin/ui-components/file-tree';

import { useCopy } from '../../../app/providers/useCopy';
import { CODE_PREVIEW_TREE_PANE_WIDTH_PX } from '../codePreviewLayout';

export function PreviewFileTreePane(props: {
  files: FileTree;
  selectedPath: string | null;
  changedPaths: readonly string[];
  onSelectedPathChange: (path: string | null) => void;
}): ReactElement {
  const { files, selectedPath, changedPaths, onSelectedPathChange } = props;
  const copy = useCopy();

  // `useCodePreview` returns the same `files` reference while generate inputs are
  // unchanged, so this only recomputes when the tree actually changed. INV-3, INV-10
  const paths = useMemo(() => Object.keys(files).sort(), [files]);

  return (
    <KitFileTree
      aria-label={copy.notice('code-preview.file-tree-label').description}
      className="rwa-code-preview-tree h-full min-h-0 shrink-0"
      style={{ width: CODE_PREVIEW_TREE_PANE_WIDTH_PX }}
      paths={paths}
      selectedPath={selectedPath}
      onSelectedPathChange={onSelectedPathChange}
      changedPaths={changedPaths}
    />
  );
}
