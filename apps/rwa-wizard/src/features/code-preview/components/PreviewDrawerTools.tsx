import { Maximize2, Minimize2, PanelLeft, PanelLeftClose } from 'lucide-react';
import type { ReactElement } from 'react';

import { useCopy } from '../../../app/providers/useCopy';
import type { CodePreviewLayoutTools } from '../hooks/useCodePreview';

const TOOL_BUTTON_CLASSES =
  'inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none aria-pressed:text-foreground';

/**
 * Layout toggles for the preview drawer, rendered in the sheet header beside the kit's
 * close button. Both are `aria-pressed` toggles whose names describe the action.
 */
export function PreviewDrawerTools(props: CodePreviewLayoutTools): ReactElement {
  const { treeVisible, onToggleTree, maximized, onToggleMaximize } = props;
  const copy = useCopy();

  const treeLabel = copy.notice(
    treeVisible ? 'code-preview.hide-file-tree' : 'code-preview.show-file-tree'
  ).description;
  const sizeLabel = copy.notice(
    maximized ? 'code-preview.restore-size' : 'code-preview.maximize'
  ).description;

  return (
    <div
      className="flex shrink-0 items-center gap-0.5"
      role="group"
      aria-label={copy.notice('code-preview.tools-group').description}
    >
      <button
        type="button"
        className={TOOL_BUTTON_CLASSES}
        aria-pressed={!treeVisible}
        aria-label={treeLabel}
        title={treeLabel}
        onClick={onToggleTree}
      >
        {treeVisible ? (
          <PanelLeftClose className="size-4" aria-hidden />
        ) : (
          <PanelLeft className="size-4" aria-hidden />
        )}
      </button>
      <button
        type="button"
        className={TOOL_BUTTON_CLASSES}
        aria-pressed={maximized}
        aria-label={sizeLabel}
        title={sizeLabel}
        onClick={onToggleMaximize}
      >
        {maximized ? (
          <Minimize2 className="size-4" aria-hidden />
        ) : (
          <Maximize2 className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
