import type { ReactElement } from 'react';

import type { FileTree } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';
import { BottomSheet } from '@openzeppelin/ui-components';
import type { CodeViewReveal } from '@openzeppelin/ui-components/code-view';

import { useCopy } from '../../../app/providers/useCopy';
import type {
  StructuralUpstreamImportLinks,
  StructuralUpstreamSourceRevision,
} from '../../../types/wizard';
import type { RevealInPreview } from '../CodePreviewRevealContext';
import { resolveDockSheetLayout } from '../dockLayout';
import type { CodePreviewDockPosition } from '../dockPosition';
import type { CodePreviewLayoutTools, CodePreviewPhase } from '../hooks/useCodePreview';
import type { CodePreviewProvenance } from '../provenanceState';
import { PreviewDrawerBody } from './PreviewDrawerBody';
import { previewDrawerHeader } from './PreviewDrawerHeader';

export function CodePreviewDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current dock edge. INV-1 */
  dockPosition: CodePreviewDockPosition;
  /** Perpendicular size already resolved (maximize applied by the hook). */
  size: number;
  /**
   * Axis clamp ceiling from the same `dockAxisMaxSize` the hook uses for
   * maximize — keeps BottomSheet from clamping a maximized `size` against a
   * divergent drawer-local ceiling.
   */
  maxSize: number;
  onSizeChange: (size: number) => void;
  sheetId: string;
  phase: CodePreviewPhase;
  selectedPath: string | null;
  onSelectedPathChange: (path: string | null) => void;
  files: FileTree | null;
  changedPaths?: readonly string[];
  substitutedKeys: readonly string[];
  errorMessages?: readonly string[];
  sourceRevision: StructuralUpstreamSourceRevision | null;
  /** Linkable import identifiers reported by the codegen service. */
  importLinks: StructuralUpstreamImportLinks | null;
  /** Tree / maximize / dock toggles for the header. Omit to render the header without tools. */
  tools?: CodePreviewLayoutTools;
  /** Pending reveal from `useCodePreview().reveal`; `undefined` renders the pane unmarked. */
  reveal?: CodeViewReveal;
  /**
   * The three inputs the field-impact column needs, threaded as props rather
   * than through the existing contexts.
   *
   * Those contexts exist because callers inside kit-owned step rendering cannot
   * receive props; the drawer is not such a caller — it is a sibling
   * `WizardPage` renders directly and already hands it a dozen props. Props
   * keep the column's memo inputs enumerable, which is what its memo rule
   * requires, and keep `WizardPage`'s diff to three lines. Both nullable ones
   * carry the same guard the two providers carry, so the drawer and the
   * providers can never disagree about whether there is a preview to ask about.
   * INV-14.
   */
  config: RWAConfig;
  provenance: CodePreviewProvenance | null;
  /** `null` disables activation in the impact column without hiding its rows. */
  onReveal: RevealInPreview | null;
}): ReactElement {
  const {
    open,
    onOpenChange,
    dockPosition,
    size,
    maxSize,
    onSizeChange,
    sheetId,
    phase,
    selectedPath,
    onSelectedPathChange,
    files,
    changedPaths,
    substitutedKeys,
    errorMessages,
    sourceRevision,
    importLinks,
    tools,
    reveal,
    config,
    provenance,
    onReveal,
  } = props;

  const copy = useCopy();
  // INV-22: stable across dock cycles — only open state, not dock, resets the body boundary.
  const boundaryResetKey = `${sheetId}-${open ? 'open' : 'closed'}`;
  // Viewport args unused by current layout resolver (bottom=inset; else overlay).
  const sheetLayout = resolveDockSheetLayout(dockPosition, 0, 0);

  return (
    <BottomSheet
      id={sheetId}
      aria-label={copy.notice('code-preview.sheet-label').description}
      closeLabel={copy.notice('code-preview.close').description}
      open={open}
      onOpenChange={onOpenChange}
      side={dockPosition}
      height={size}
      onHeightChange={onSizeChange}
      maxHeight={maxSize}
      header={previewDrawerHeader({ phase, substitutedKeys, tools })}
      layout={sheetLayout}
      className="rwa-code-preview-sheet"
    >
      <PreviewDrawerBody
        phase={phase}
        selectedPath={selectedPath}
        onSelectedPathChange={onSelectedPathChange}
        files={files}
        changedPaths={changedPaths}
        errorMessages={errorMessages}
        sourceRevision={sourceRevision}
        importLinks={importLinks}
        treeVisible={tools?.treeVisible ?? true}
        boundaryResetKey={boundaryResetKey}
        reveal={reveal}
        config={config}
        provenance={provenance}
        onReveal={onReveal}
        drawerOpen={open}
        dockPosition={dockPosition}
      />
    </BottomSheet>
  );
}
