import { Check, Circle, X } from 'lucide-react';
import { useId } from 'react';

import { formatCopy } from '@openzeppelin/rwa-wizard-copy';
import { cn } from '@openzeppelin/ui-utils';

import { useCopy } from '../../app/providers/useCopy';
import type { ConfigAnchorKey } from '../../features/wizard/focused-path';
import { useIsInspected } from '../../features/wizard/inspected-anchor';

interface TogglePillProps {
  label: string;
  detail?: string | number;
  /**
   * Config membership (issuer pills) or deploy-selection (claim-topic pills).
   */
  selected: boolean;
  /**
   * Pure-toggle mode (AS-7 leave-as-is). Body activation toggles membership.
   * Mutually exclusive with `onToggleSelection` — INV-7.
   */
  onClick?: () => void;
  /**
   * Three-affordance mode (claim topics). Activating the selection control
   * toggles deploy-selection. Body has no config handler — inspection is the
   * document listener's job (SF-14).
   */
  onToggleSelection?: () => void;
  /** Custom topics only. The sole delete path. */
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
  /** Optional context for pure-toggle chips (e.g. deploy-unselected issuer topics). */
  ariaDescription?: string;
  /**
   * Config location this pill edits. Sits on the wrapper rather than on the
   * inner buttons, which reach it through `closest()`. INV-6.
   */
  configAnchor?: ConfigAnchorKey;
}

/**
 * Shared chip. Two modes, discriminated by which callback is passed.
 *
 * Inspected state is `useIsInspected(configAnchor)` alone — never gated on
 * `selected`. The former `&& selected` conjunction existed because SF-14 INV-1
 * needed to hide `aria-current` / ring on a *predefined* pill that still rendered
 * a `configAnchor` after remove-from-array deselection (the topic left the array,
 * the store kept the subject, and without the gate the chip would lie). That
 * premise is gone: unselected topics remain in the array (SF-16), stay
 * inspectable (AS-4), and `anchorItemExists` already drops a truly deleted
 * subject. Restoring the conjunction would hide inspected state on the exact
 * case this feature makes reachable — do not restore it. INV-1.
 */
export function TogglePill({
  label,
  detail,
  selected,
  onClick,
  onToggleSelection,
  onRemove,
  disabled,
  className,
  ariaDescription,
  configAnchor,
}: TogglePillProps) {
  // INV-7: never both modes on one chip.
  if (onClick !== undefined && onToggleSelection !== undefined) {
    throw new Error('TogglePill: pass onClick or onToggleSelection, not both');
  }

  const copy = useCopy();
  const descriptionId = useId();
  const threeAffordance = onToggleSelection !== undefined;
  // INV-1: inspected is the store alone — never `&& selected`.
  const inspected = useIsInspected(configAnchor);
  const hasTrailingControl = threeAffordance || onRemove !== undefined;

  const selectionLabel = formatCopy(
    copy.notice(selected ? 'claim-topics.chip.deselect' : 'claim-topics.chip.select').description,
    { label }
  );
  const removeLabel = formatCopy(copy.notice('claim-topics.chip.remove').description, { label });
  const pureToggleLabel = formatCopy(
    copy.notice(selected ? 'claim-topics.chip.deselect' : 'claim-topics.chip.select').description,
    { label }
  );

  const handleSelectionClick = (): void => {
    // Do not stopPropagation. SF-14's document click writer is bubble-phase
    // (Safari path); stopping would hide the checkmark press from inspection.
    // INV-7 already forbids a body `onClick` alongside this handler, so there
    // is no double-fire to prevent. INV-17 revised locally — see code-draft.
    onToggleSelection?.();
  };

  return (
    <span
      data-config-anchor={configAnchor}
      // One carrier, on the element that already carries the anchor — not
      // mirrored onto the inner buttons. INV-6.
      aria-current={inspected ? 'true' : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border text-xs font-medium transition-colors',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-dashed border-border text-muted-foreground hover:bg-muted',
        disabled && 'opacity-50',
        // Offset ring is inspection only — never a selection cue. INV-4.
        inspected && 'ring-1 ring-primary ring-offset-1 ring-offset-background',
        className
      )}
    >
      {/*
        Stays a `<button>` even with no handler. It is still a tab stop, so a
        keyboard user can reach a chip and the `focusin` writer selects it.
        INV-2.
      */}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={onClick !== undefined ? pureToggleLabel : undefined}
        aria-describedby={ariaDescription ? descriptionId : undefined}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 py-1 pl-2.5',
          hasTrailingControl ? 'pr-1' : 'pr-2.5',
          disabled && 'cursor-not-allowed'
        )}
      >
        {/* Pure-toggle: decorative Check stays inside the body. INV-3. */}
        {!threeAffordance && selected && <Check className="size-3" />}
        {label}
        {detail != null && <span className="font-normal opacity-40">id:{detail}</span>}
      </button>
      {ariaDescription ? (
        <span id={descriptionId} className="sr-only">
          {ariaDescription}
        </span>
      ) : null}
      {threeAffordance && (
        <button
          type="button"
          onClick={handleSelectionClick}
          disabled={disabled}
          aria-pressed={selected}
          aria-label={selectionLabel}
          className={cn(
            'inline-flex cursor-pointer items-center justify-center',
            onRemove ? 'px-0.5' : 'pr-1.5 pl-0.5',
            disabled && 'cursor-not-allowed',
            !selected && 'text-muted-foreground'
          )}
        >
          {selected ? <Check className="size-3" /> : <Circle className="size-3" />}
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex cursor-pointer items-center justify-center pr-1.5 hover:text-destructive"
          aria-label={removeLabel}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
