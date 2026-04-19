import { ArrowDownToLine, CheckCircle2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@openzeppelin/ui-components';

import { useWizardDraftStorage } from '../../../storage';

interface DraftImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

/**
 * Maps WizardDraftStorage error codes to human-readable copy; falls back to the
 * raw message when we don't recognize the code.
 */
function formatImportError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (message.startsWith('draft-storage/import-invalid-json')) {
    return 'This file is not valid JSON.';
  }
  if (message.startsWith('draft-storage/import-invalid-envelope')) {
    return 'This file is missing the expected export envelope.';
  }
  if (message.startsWith('draft-storage/import-unsupported-version')) {
    return 'This file uses a schema version that is not supported by this version of the wizard.';
  }
  if (message.startsWith('draft-storage/import-invalid-draft:')) {
    return 'One or more drafts in this file are missing required fields.';
  }
  return message || 'Failed to import projects.';
}

/**
 * How long the post-import confirmation stays on-screen before we close the
 * dialog. Long enough to be perceived, short enough to feel snappy.
 */
const IMPORT_SUCCESS_FEEDBACK_MS = 1200;

export function DraftImportDialog({ open, onOpenChange, onImported }: DraftImportDialogProps) {
  const storage = useWizardDraftStorage();
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const dismiss = () => {
    setError(null);
    setImportedCount(null);
    resetFileInput();
    onOpenChange(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (isImporting) return;
      dismiss();
    }
  };

  // Show the success confirmation briefly before closing so the user has a
  // clear signal that the import landed. Cleanup cancels the timer if the
  // dialog closes via another path (e.g. dismiss button).
  useEffect(() => {
    if (importedCount === null) return;
    const timer = setTimeout(() => {
      setImportedCount(null);
      resetFileInput();
      onOpenChange(false);
    }, IMPORT_SUCCESS_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [importedCount, onOpenChange]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      return;
    }

    // A realistic upper bound for configuration-only JSON; keeps us far below
    // browser IndexedDB quotas and avoids stalling the main thread while parsing.
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setError('File size exceeds maximum limit of 5MB');
      return;
    }

    setError(null);
    setImportedCount(null);
    setIsImporting(true);

    try {
      const text = await file.text();
      const ids = await storage.import(text);
      onImported?.();
      setImportedCount(ids.length);
    } catch (err) {
      setError(formatImportError(err));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import projects</DialogTitle>
          <DialogDescription>
            Import a JSON file containing exported RWA Wizard projects. Existing drafts are
            unchanged; imported entries are added as new projects.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="draft-import-file">Select file</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                id="draft-import-file"
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleFileChange(e)}
                disabled={isImporting}
                className="cursor-pointer"
              />
              <Button
                size="icon"
                variant="outline"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                <ArrowDownToLine className="h-4 w-4" />
                <span className="sr-only">Select import file</span>
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {importedCount !== null && (
              <p
                role="status"
                className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"
              >
                <CheckCircle2 className="size-4" aria-hidden />
                {importedCount === 1 ? 'Imported 1 project' : `Imported ${importedCount} projects`}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">File requirements:</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              <li>• JSON format (.json extension)</li>
              <li>• Must be a valid RWA Wizard export (single project or full backup)</li>
              <li>• Maximum size: 5MB</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={dismiss} disabled={isImporting}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
