import { Download } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@openzeppelin/ui-components';

import type { GenerationJobState, GenerationPhase } from '../../../types/wizard';
import { GenerationErrorState } from './GenerationErrorState';
import { GenerationStatusPanel } from './GenerationStatusPanel';

interface GenerationDialogProps {
  jobState: GenerationJobState;
  isGenerating: boolean;
  onDownload: () => void;
  onRetry: () => void;
  onReset: () => void;
}

/**
 * Header copy derived from the current phase so the modal frames the state
 * without duplicating the phase log rendered in the body.
 */
function getDialogCopy(phase: GenerationPhase): { title: string; description: string } {
  switch (phase) {
    case 'success':
      return {
        title: 'Project ready',
        description: 'Your project has been generated. Download it to your machine below.',
      };
    case 'error':
      return {
        title: 'Generation failed',
        description: 'We could not finish generating your project.',
      };
    case 'idle':
      return { title: '', description: '' };
    case 'validating':
    case 'generating':
    case 'packaging':
      return {
        title: 'Generating project',
        description: 'Please wait while we validate, generate, and package your project.',
      };
  }
}

export function GenerationDialog({
  jobState,
  isGenerating,
  onDownload,
  onRetry,
  onReset,
}: GenerationDialogProps) {
  const { phase, phaseLog, zipFileName, errorMessage } = jobState;
  const isError = phase === 'error';
  const isSuccess = phase === 'success';
  const { title, description } = getDialogCopy(phase);

  // Closing the dialog always resets the flow so the wizard can return to the
  // review step without a stale job lingering. We block dismissal while a run
  // is in-flight so the user cannot orphan an active generation.
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return;
    if (isGenerating) return;
    onReset();
  };

  return (
    <Dialog open={phase !== 'idle'} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {isError ? (
            <GenerationErrorState
              errorMessage={errorMessage ?? 'Generation failed.'}
              onRetry={onRetry}
              onReset={onReset}
            />
          ) : (
            <GenerationStatusPanel phase={phase} phaseLog={phaseLog} zipFileName={zipFileName} />
          )}
        </div>

        {isSuccess && (
          <DialogFooter>
            <Button variant="outline" onClick={onReset}>
              Close
            </Button>
            <Button onClick={onDownload}>
              <Download className="mr-2 size-4" />
              Download
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
