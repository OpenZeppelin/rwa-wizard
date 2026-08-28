import { Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';

import type { FileTree } from '@openzeppelin/codegen-core';

import { useCopy } from '../../../app/providers/useCopy';
import type {
  StructuralUpstreamImportLinks,
  StructuralUpstreamSourceRevision,
} from '../../../types/wizard';
import type { CodePreviewPhase } from '../hooks/useCodePreview';
import { PreviewCodePane } from './PreviewCodePane';
import { PreviewContentErrorBoundary } from './PreviewContentErrorBoundary';
import { PreviewFileTreePane } from './PreviewFileTreePane';
import { PreviewGenerateError } from './PreviewGenerateError';

import '../code-preview.css';

/** Width of the file tree pane; must match `PreviewFileTreePane`'s `w-[280px]`. */
const TREE_PANE_WIDTH_PX = 280;

export function PreviewDrawerBody(props: {
  phase: CodePreviewPhase;
  selectedPath: string | null;
  onSelectedPathChange: (path: string | null) => void;
  files: FileTree | null;
  changedPaths: readonly string[] | undefined;
  errorMessages: readonly string[] | undefined;
  boundaryResetKey: string;
  /** Upstream coordinates from the codegen service; `null` disables import links. */
  sourceRevision: StructuralUpstreamSourceRevision | null;
  importLinks: StructuralUpstreamImportLinks | null;
  /** Show the file tree pane. Default true. */
  treeVisible?: boolean;
}): ReactElement {
  const {
    phase,
    selectedPath,
    onSelectedPathChange,
    changedPaths,
    errorMessages,
    boundaryResetKey,
    sourceRevision,
    importLinks,
    treeVisible = true,
  } = props;

  const copy = useCopy();

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pb-3 pt-1">
      {phase.kind === 'loading' || phase.kind === 'idle' ? (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {copy.notice('code-preview.generating').description}
        </div>
      ) : null}

      {phase.kind === 'error' && errorMessages ? (
        <PreviewGenerateError messages={errorMessages} />
      ) : null}

      {phase.kind === 'ready' ? (
        <PreviewContentErrorBoundary
          resetKey={boundaryResetKey}
          message={copy.notice('code-preview.render-failed').description}
        >
          <div className="rwa-code-preview flex min-h-0 flex-1 overflow-hidden rounded-md">
            {/* Kept mounted (preserves expansion state) and animated on width. */}
            <div
              className="shrink-0 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: treeVisible ? TREE_PANE_WIDTH_PX : 0 }}
              aria-hidden={!treeVisible}
              inert={!treeVisible}
            >
              <PreviewFileTreePane
                files={phase.files}
                selectedPath={selectedPath}
                changedPaths={changedPaths ?? phase.changedPaths}
                onSelectedPathChange={onSelectedPathChange}
              />
            </div>
            <PreviewCodePane
              files={phase.files}
              selectedPath={selectedPath}
              sourceRevision={sourceRevision}
              importLinks={importLinks}
            />
          </div>
        </PreviewContentErrorBoundary>
      ) : null}
    </div>
  );
}
