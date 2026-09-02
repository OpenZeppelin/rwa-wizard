import {
  Dock,
  Maximize2,
  Minimize2,
  PanelBottom,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelTop,
  type LucideIcon,
} from 'lucide-react';
import { type ReactElement } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@openzeppelin/ui-components';
import { cn } from '@openzeppelin/ui-utils';

import { useCopy } from '../../../app/providers/useCopy';
import {
  ALL_DOCK_MENU_POSITIONS,
  parseDockPosition,
  resolveDockMenuSelection,
  type CodePreviewDockPosition,
} from '../dockPosition';
import type { CodePreviewLayoutTools } from '../hooks/useCodePreview';

const TOOL_BUTTON_CLASSES =
  'inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none aria-pressed:text-foreground';

const DOCK_TO_NOTICE: Record<CodePreviewDockPosition, string> = {
  bottom: 'code-preview.dock-to-bottom',
  right: 'code-preview.dock-to-right',
  top: 'code-preview.dock-to-top',
  left: 'code-preview.dock-to-left',
};

/** Lucide panel glyphs — one per dock edge for the set-position menu. */
const DOCK_MENU_ICONS: Record<CodePreviewDockPosition, LucideIcon> = {
  bottom: PanelBottom,
  left: PanelLeft,
  top: PanelTop,
  right: PanelRight,
};

/**
 * Layout toggles for the preview drawer, rendered in the sheet header beside the kit's
 * close button. Tree and maximize are `aria-pressed` toggles; dock is a click/keyboard
 * dropdown that **sets** an offered edge (not a cryptic cycle). The menu lists
 * `dockMenuPositions` (default: all four) as icon buttons matching tool weight.
 * A stable `Dock` glyph is the trigger.
 */
export function PreviewDrawerTools(props: CodePreviewLayoutTools): ReactElement {
  const {
    treeVisible,
    onToggleTree,
    maximized,
    onToggleMaximize,
    dockPosition,
    onDockPositionChange,
    dockMenuPositions = ALL_DOCK_MENU_POSITIONS,
  } = props;
  const copy = useCopy();

  const menuPositions = dockMenuPositions.length > 0 ? dockMenuPositions : ALL_DOCK_MENU_POSITIONS;
  const selectedDock = resolveDockMenuSelection(dockPosition, menuPositions);

  const treeLabel = copy.notice(
    treeVisible ? 'code-preview.hide-file-tree' : 'code-preview.show-file-tree'
  ).description;
  const sizeLabel = copy.notice(
    maximized ? 'code-preview.restore-size' : 'code-preview.maximize'
  ).description;
  const dockTriggerLabel = copy.notice('code-preview.dock-position').description;

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
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={TOOL_BUTTON_CLASSES}
            aria-label={dockTriggerLabel}
            title={dockTriggerLabel}
          >
            <Dock className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={4}
          className="min-w-0 p-1"
          // Reach marker for useFieldImpact: Radix portals this outside the sheet.
          data-rwa-preview-chrome=""
          onCloseAutoFocus={(event) => {
            // Keep focus on the trigger after a menu pick so layout tools stay operable.
            event.preventDefault();
          }}
        >
          <DropdownMenuRadioGroup
            className="flex flex-row gap-0.5"
            value={selectedDock}
            onValueChange={(value) => {
              onDockPositionChange(parseDockPosition(value));
            }}
          >
            {menuPositions.map((position) => {
              const Icon = DOCK_MENU_ICONS[position];
              const label = copy.notice(DOCK_TO_NOTICE[position]).description;
              return (
                <DropdownMenuRadioItem
                  key={position}
                  value={position}
                  aria-label={label}
                  title={label}
                  className={cn(
                    TOOL_BUTTON_CLASSES,
                    // Kit RadioItem defaults (pl-8 + left indicator) fight icon tools —
                    // collapse to the same size-9 hit target as the header toggles.
                    'relative m-0 size-9 justify-center border-0 p-0 pl-0 pr-0',
                    'focus:bg-muted focus:text-foreground',
                    'data-[state=checked]:bg-muted data-[state=checked]:text-foreground',
                    '[&>span:first-child]:hidden'
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="sr-only">{label}</span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
