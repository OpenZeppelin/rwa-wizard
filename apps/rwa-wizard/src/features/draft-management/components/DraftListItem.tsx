import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@openzeppelin/ui-components';
import { cn } from '@openzeppelin/ui-utils';

import type { DraftListItem as DraftListItemType, WizardDraftStatus } from '../../../types/wizard';
import { useTypewriterEffect } from '../hooks/useTypewriterEffect';
import { DraftDeleteDialog } from './DraftDeleteDialog';

interface DraftListItemProps {
  draft: DraftListItemType;
  isActive: boolean;
  isSaving: boolean;
  onLoad: () => void;
  onDelete: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onExport: () => Promise<void>;
}

const STATUS_STYLES: Record<WizardDraftStatus, string> = {
  draft: 'text-gray-500',
  ready: 'text-blue-600',
  generating: 'text-amber-600',
  generated: 'text-green-600',
  error: 'text-red-600',
};

/** Maps draft lifecycle to Alert variants from ui-components. */
const STATUS_ALERT_VARIANT: Record<WizardDraftStatus, 'default' | 'destructive' | 'success'> = {
  draft: 'default',
  ready: 'default',
  generating: 'default',
  generated: 'success',
  error: 'destructive',
};

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Same timing as UI Builder `ContractUIItem` / `useTypewriterEffect`. */
const TYPEWRITER_OPTIONS = {
  typingSpeed: 40,
  erasingSpeed: 25,
  eraseDelay: 150,
  typeDelay: 100,
  /** UI Builder skips animation for tiny edits; we always animate so sidebar title changes are visible. */
  minDifferenceThreshold: 0,
} as const;

/**
 * Artificially prolongs the saving animation for 1.5s after the save completes,
 * matching the UI Builder's ContractUIItem behaviour.
 */
function useLingeringAnimation(active: boolean, lingerMs = 1500): boolean {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setShow(true);
    } else {
      timerRef.current = setTimeout(() => setShow(false), lingerMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, lingerMs]);

  return show;
}

export function DraftListItem({
  draft,
  isActive,
  isSaving,
  onLoad,
  onDelete,
  onDuplicate,
  onExport,
}: DraftListItemProps) {
  const { displayText: animatedTitle, isAnimating: isTitleAnimating } = useTypewriterEffect(
    draft.title,
    TYPEWRITER_OPTIONS
  );
  const { displayText: animatedSymbol, isAnimating: isSymbolAnimating } = useTypewriterEffect(
    draft.symbol ?? '',
    TYPEWRITER_OPTIONS
  );
  const showSavingAnimation = useLingeringAnimation(isSaving);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onLoad}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onLoad();
          }
        }}
        className={cn(
          'group relative flex w-full cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-all duration-300 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          showSavingAnimation && 'animate-pulse bg-muted opacity-30 [animation-duration:1200ms]',
          !showSavingAnimation &&
            (isActive ? 'bg-selected/10 text-selected' : 'text-muted-foreground hover:bg-muted/50')
        )}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 truncate text-sm font-semibold">
              {animatedTitle}
              {isTitleAnimating && <span className="animate-pulse text-current">|</span>}
            </span>
            <Alert
              variant={STATUS_ALERT_VARIANT[draft.status] ?? 'default'}
              role="status"
              className={cn(
                'inline-flex w-fit shrink-0 items-center rounded-md p-0 px-2 py-0.5 text-[11px] font-medium leading-none shadow-none',
                STATUS_STYLES[draft.status],
                // Layered tint of `selected`: row is bg-selected/10; badge is darker so it reads clearly without a white chip.
                isActive && 'border border-selected/25 bg-selected/15 shadow-none'
              )}
            >
              <span className="truncate capitalize">{draft.status}</span>
            </Alert>
          </div>
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 w-5 shrink-0 p-0 transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void onDuplicate()}>Duplicate</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void onExport()}>Export</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <span className="text-[11px] uppercase text-gray-400">
          {draft.targetId}
          {animatedSymbol ? (
            <>
              {' · '}
              {animatedSymbol}
              {isSymbolAnimating && <span className="animate-pulse text-current">|</span>}
            </>
          ) : null}
        </span>
        <span className="text-[11px] text-gray-400">{formatDate(draft.updatedAt)}</span>
      </div>

      <DraftDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={draft.title}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </>
  );
}
