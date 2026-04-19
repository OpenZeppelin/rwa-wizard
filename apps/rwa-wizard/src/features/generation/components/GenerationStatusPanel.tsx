import { CheckCircle, Circle, Loader2 } from 'lucide-react';

import { cn } from '@openzeppelin/ui-utils';

import type { GenerationPhase } from '../../../types/wizard';

interface GenerationStatusPanelProps {
  phase: GenerationPhase;
  zipFileName?: string;
}

/**
 * Fixed visual ordering for the progress list. We render every row from the
 * start so the dialog doesn't grow as phases are appended; state (pending /
 * current / done / success) is derived from the active `phase`.
 */
const DISPLAY_PHASES: GenerationPhase[] = ['validating', 'generating', 'packaging', 'success'];

const PHASE_LABEL: Record<GenerationPhase, string> = {
  idle: '',
  validating: 'Validating configuration',
  generating: 'Generating project',
  packaging: 'Packaging files',
  success: 'Ready',
  error: '',
};

type RowStatus = 'pending' | 'current' | 'done' | 'success';

function getRowStatus(entry: GenerationPhase, activePhase: GenerationPhase): RowStatus {
  if (entry === 'success') {
    return activePhase === 'success' ? 'success' : 'pending';
  }
  const activeIndex = DISPLAY_PHASES.indexOf(activePhase);
  const entryIndex = DISPLAY_PHASES.indexOf(entry);
  if (activePhase === 'success' || (activeIndex >= 0 && entryIndex < activeIndex)) return 'done';
  if (entry === activePhase) return 'current';
  return 'pending';
}

export function GenerationStatusPanel({ phase, zipFileName }: GenerationStatusPanelProps) {
  if (phase === 'idle') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-in fade-in rounded-lg border border-border/60 bg-muted/30 px-4 py-3 duration-200"
    >
      <ul className="space-y-1.5">
        {DISPLAY_PHASES.map((entry) => {
          const status = getRowStatus(entry, phase);
          const isSuccess = status === 'success';
          const isPending = status === 'pending';
          const label = isSuccess && zipFileName ? `Ready — ${zipFileName}` : PHASE_LABEL[entry];

          return (
            <li
              key={entry}
              className={cn(
                'flex items-center gap-2 text-sm transition-colors duration-150',
                status === 'done' && 'text-muted-foreground',
                status === 'current' && 'font-medium text-foreground',
                isPending && 'text-muted-foreground/60',
                isSuccess && 'font-medium text-emerald-700 dark:text-emerald-300'
              )}
            >
              {status === 'current' ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden />
              ) : isPending ? (
                <Circle className="size-3.5 shrink-0 text-muted-foreground/40" aria-hidden />
              ) : (
                <CheckCircle
                  className={cn(
                    'size-3.5 shrink-0',
                    isSuccess
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground/60'
                  )}
                  aria-hidden
                />
              )}
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
