import { Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';

import type { FileTree } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';
import type { CodeViewReveal } from '@openzeppelin/ui-components/code-view';

import { useCopy } from '../../../app/providers/useCopy';
import type {
  StructuralUpstreamImportLinks,
  StructuralUpstreamSourceRevision,
} from '../../../types/wizard';
import type { RevealInPreview } from '../CodePreviewRevealContext';
import type { CodePreviewDockPosition } from '../dockPosition';
import type { CodePreviewPhase } from '../hooks/useCodePreview';
import type { CodePreviewProvenance } from '../provenanceState';
import { PreviewCodePane } from './PreviewCodePane';
import { PreviewContentErrorBoundary } from './PreviewContentErrorBoundary';
import { PreviewFileTreePane } from './PreviewFileTreePane';
import { PreviewGenerateError } from './PreviewGenerateError';
import { PreviewImpactColumn } from './PreviewImpactColumn';

import '../code-preview.css';

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
  /** Pending reveal for the selected file; threaded to the code pane untouched. */
  reveal?: CodeViewReveal;
  /** The live draft, for resolving which config path the focused control writes. */
  config: RWAConfig;
  /** Provenance for the tree on screen; `null` when there is no preview to ask about. */
  provenance: CodePreviewProvenance | null;
  /** Reveal callback; `null` disables activation in the impact column. */
  onReveal: RevealInPreview | null;
  /**
   * Whether the preview sheet is open. Threaded to the impact column so
   * auto-select runs only while the drawer is visible (SF-21 AS-2).
   */
  drawerOpen: boolean;
  /**
   * Current dock edge. Stamped as `data-dock` so CSS can stack the impact band
   * above tree+code on left/right without importing dock under `impact/`.
   */
  dockPosition: CodePreviewDockPosition;
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
    reveal,
    config,
    provenance,
    onReveal,
    drawerOpen,
    dockPosition,
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
          {/*
            `data-tree-visible` is the ENTIRE seam between React's knowledge and
            the container query, which matches on the literal string "true".
            React stringifies `data-*` values including `false`, so this renders
            "true" / "false" and never an empty string or an absent attribute.
            The idiomatic boolean-attribute refactor (`treeVisible ? '' :
            undefined`) is correct for a presence-tested attribute and wrong
            here: the selector stops matching, the column is shown at every
            width, and at 900x700 with the tree open the code pane silently
            becomes 328px with nothing throwing and nothing overflowing. INV-15.
          */}
          <div
            className="rwa-code-preview flex min-h-0 flex-1 overflow-hidden rounded-md"
            data-tree-visible={treeVisible}
            data-dock={dockPosition}
          >
            {/* Kept mounted (preserves expansion state) and animated on width. */}
            <div
              className="rwa-code-preview-tree-slot shrink-0 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none"
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
              reveal={reveal}
            />
            {/*
              Mounted UNCONDITIONALLY — no `treeVisible` test, no width test, no
              row-count test. Whether it is visible is decided by CSS alone.
              Matching the container query in JS would state the rule twice; the
              two would disagree above the threshold, the column would disappear
              at 1280 for every user with the tree shown, and no test in the unit
              suite could see it. INV-1.
            */}
            <PreviewImpactColumn
              config={config}
              provenance={provenance}
              onReveal={onReveal}
              drawerOpen={drawerOpen}
            />
          </div>
        </PreviewContentErrorBoundary>
      ) : null}
    </div>
  );
}
