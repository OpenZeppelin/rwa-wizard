import { Maximize2, Minimize2, PanelLeft, PanelLeftClose } from 'lucide-react';
import type { ReactElement } from 'react';

import type { CodePreviewLayoutTools } from '../hooks/useCodePreview';

const TOOL_BUTTON_CLASSES =
  'inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none aria-pressed:text-foreground';

/**
 * Layout toggles for the preview drawer, rendered in the sheet header beside the kit's
 * close button. Both are `aria-pressed` toggles whose names describe the action.
 */
export function PreviewDrawerTools(props: CodePreviewLayoutTools): ReactElement {
  const { treeVisible, onToggleTree, maximized, onToggleMaximize } = props;

  return (
    <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Preview layout">
      <button
        type="button"
        className={TOOL_BUTTON_CLASSES}
        aria-pressed={!treeVisible}
        aria-label={treeVisible ? 'Hide file tree' : 'Show file tree'}
        title={treeVisible ? 'Hide file tree' : 'Show file tree'}
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
        aria-label={maximized ? 'Restore preview size' : 'Maximize preview'}
        title={maximized ? 'Restore preview size' : 'Maximize preview'}
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
