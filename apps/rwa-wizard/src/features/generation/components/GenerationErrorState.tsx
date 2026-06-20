import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle, Button } from '@openzeppelin/ui-components';

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
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>Generation Failed</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{errorMessage}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
