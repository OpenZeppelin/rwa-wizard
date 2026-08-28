import type { ReactElement } from 'react';

import type { FileTree } from '@openzeppelin/codegen-core';
import { BottomSheet } from '@openzeppelin/ui-components';

import { useCopy } from '../../../app/providers/useCopy';
import type { StructuralUpstreamSourceRevision } from '../../../types/wizard';
import type { CodePreviewLayoutTools, CodePreviewPhase } from '../hooks/useCodePreview';
import { PreviewDrawerBody } from './PreviewDrawerBody';
import { previewDrawerHeader } from './PreviewDrawerHeader';

export function CodePreviewDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  height: number;
  onHeightChange: (height: number) => void;
  sheetId: string;
  phase: CodePreviewPhase;
  selectedPath: string | null;
  onSelectedPathChange: (path: string | null) => void;
  files: FileTree | null;
  changedPaths: readonly string[] | undefined;
  substitutedKeys: readonly string[];
  errorMessages: readonly string[] | undefined;
  /** Upstream coordinates from the codegen service; `null` disables import links. */
  sourceRevision: StructuralUpstreamSourceRevision | null;
  /** Tree / maximize toggles for the header. Omit to render the header without tools. */
  tools?: CodePreviewLayoutTools;
}): ReactElement {
  const {
    open,
    onOpenChange,
    height,
    onHeightChange,
    sheetId,
    phase,
    selectedPath,
    onSelectedPathChange,
    files,
    changedPaths,
    substitutedKeys,
    errorMessages,
    sourceRevision,
    tools,
  } = props;

  const copy = useCopy();
  const boundaryResetKey = `${sheetId}-${open ? 'open' : 'closed'}`;

  return (
    <BottomSheet
      id={sheetId}
      aria-label={copy.notice('code-preview.sheet-label').description}
      open={open}
      onOpenChange={onOpenChange}
      height={height}
      onHeightChange={onHeightChange}
      header={previewDrawerHeader({ phase, substitutedKeys, tools })}
      layout="inset"
    >
      <PreviewDrawerBody
        phase={phase}
        selectedPath={selectedPath}
        onSelectedPathChange={onSelectedPathChange}
        files={files}
        changedPaths={changedPaths}
        errorMessages={errorMessages}
        sourceRevision={sourceRevision}
        treeVisible={tools?.treeVisible ?? true}
        boundaryResetKey={boundaryResetKey}
      />
    </BottomSheet>
  );
}
