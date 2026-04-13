import { CheckCircle, Download, Loader2, Package, Search, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@openzeppelin/ui-utils';

import type { GenerationPhase } from '../../../types/wizard';

interface GenerationStatusPanelProps {
  phase: GenerationPhase;
  message?: string;
  zipFileName?: string;
}

interface PhaseConfig {
  id: GenerationPhase;
  label: string;
  icon: React.ReactNode;
  completedIcon: React.ReactNode;
}

const PHASES: PhaseConfig[] = [
  {
    id: 'validating',
    label: 'Validating',
    icon: <Search className="size-4" />,
    completedIcon: <CheckCircle className="size-4" />,
  },
  {
    id: 'generating',
    label: 'Generating',
    icon: <Sparkles className="size-4" />,
    completedIcon: <CheckCircle className="size-4" />,
  },
  {
    id: 'packaging',
    label: 'Packaging',
    icon: <Package className="size-4" />,
    completedIcon: <CheckCircle className="size-4" />,
  },
  {
    id: 'success',
    label: 'Complete',
    icon: <Download className="size-4" />,
    completedIcon: <CheckCircle className="size-4" />,
  },
];

function phaseIndex(phase: GenerationPhase): number {
  return PHASES.findIndex((p) => p.id === phase);
}

/**
 * Tracks when a phase becomes "just entered" so we can apply a one-shot
 * entrance animation via CSS (scale up + fade in).
 */
function usePhaseEntrance(phase: GenerationPhase) {
  const [entering, setEntering] = useState<GenerationPhase | null>(null);
  const prevPhase = useRef(phase);

  useEffect(() => {
    if (phase !== prevPhase.current) {
      setEntering(phase);
      prevPhase.current = phase;
      const id = setTimeout(() => setEntering(null), 400);
      return () => clearTimeout(id);
    }
  }, [phase]);

  return entering;
}

export function GenerationStatusPanel({ phase, message, zipFileName }: GenerationStatusPanelProps) {
  const currentIdx = phaseIndex(phase);
  const entering = usePhaseEntrance(phase);

  if (phase === 'idle') return null;

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 rounded-lg border bg-card p-6 shadow-sm duration-300"
      role="status"
      aria-live="polite"
    >
      <h3 className="mb-4 text-sm font-semibold text-foreground">Generation Progress</h3>

      <div className="flex items-center gap-2">
        {PHASES.map((p, idx) => {
          const isComplete = currentIdx > idx || phase === 'success';
          const isCurrent = p.id === phase;
          const isPending = currentIdx < idx && phase !== 'success';
          const isEntering = entering === p.id;

          return (
            <div key={p.id} className="flex items-center gap-2">
              {idx > 0 && (
                <div
                  className={cn(
                    'h-px w-6 origin-left transition-all duration-500 ease-out',
                    isComplete ? 'scale-x-100 bg-green-500' : 'scale-x-75 bg-border'
                  )}
                />
              )}
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                  'transition-all duration-300 ease-out',
                  isComplete && 'bg-green-50 text-green-700',
                  isCurrent && !isComplete && 'bg-primary/10 text-primary',
                  isPending && 'bg-muted text-muted-foreground opacity-60',
                  isEntering && 'animate-in zoom-in-95 fade-in duration-300'
                )}
              >
                {isCurrent && !isComplete ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isComplete ? (
                  <span className="animate-in zoom-in-50 duration-200">{p.completedIcon}</span>
                ) : (
                  p.icon
                )}
                <span>{p.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {message && (
        <p className="animate-in fade-in mt-3 text-sm text-muted-foreground duration-200">
          {message}
        </p>
      )}

      {phase === 'success' && zipFileName && (
        <div className="animate-in fade-in slide-in-from-bottom-1 mt-3 flex items-center gap-2 duration-300">
          <CheckCircle className="size-4 text-green-600" />
          <p className="text-sm font-medium text-green-700">Downloaded: {zipFileName}</p>
        </div>
      )}
    </div>
  );
}
