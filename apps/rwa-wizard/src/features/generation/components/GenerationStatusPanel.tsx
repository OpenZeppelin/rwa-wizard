import { CheckCircle, Loader2 } from 'lucide-react';

import { cn } from '@openzeppelin/ui-utils';

import type { GenerationPhase } from '../../../types/wizard';

interface GenerationStatusPanelProps {
  phase: GenerationPhase;
  phaseLog: GenerationPhase[];
  zipFileName?: string;
}

const PHASE_LABEL: Record<string, string> = {
  validating: 'Validating configuration',
  generating: 'Generating project',
  packaging: 'Packaging files',
  success: 'Done',
};

export function GenerationStatusPanel({
  phase,
  phaseLog,
  zipFileName,
}: GenerationStatusPanelProps) {
  if (phaseLog.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-in fade-in rounded-lg border border-border/60 bg-muted/30 px-4 py-3 duration-200"
    >
      <ul className="space-y-1.5">
        {phaseLog.map((entry) => {
          const isDone = entry !== phase || phase === 'success';
          const isCurrent = entry === phase && phase !== 'success';
          const isSuccess = entry === 'success';

          const label =
            isSuccess && zipFileName ? `Done — ${zipFileName}` : (PHASE_LABEL[entry] ?? entry);

          return (
            <li
              key={entry}
              className={cn(
                'flex items-center gap-2 text-sm animate-in fade-in slide-in-from-bottom-1 duration-150',
                isDone && !isSuccess && 'text-muted-foreground',
                isCurrent && 'font-medium text-foreground',
                isSuccess && 'font-medium text-emerald-700 dark:text-emerald-300'
              )}
            >
              {isCurrent ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden />
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
