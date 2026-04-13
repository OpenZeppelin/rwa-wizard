import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '@openzeppelin/ui-components';

interface GenerationErrorStateProps {
  errorMessage: string;
  onRetry: () => void;
  onReset: () => void;
}

export function GenerationErrorState({
  errorMessage,
  onRetry,
  onReset,
}: GenerationErrorStateProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Generation Failed</h3>
            <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={onReset}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
