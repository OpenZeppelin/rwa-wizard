import { ArrowDownToLine } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';

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

export function DraftImportDialog({ open, onOpenChange, onImported }: DraftImportDialogProps) {
  const storage = useWizardDraftStorage();
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const dismiss = () => {
    setError(null);
    resetFileInput();
    onOpenChange(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (isImporting) return;
      dismiss();
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      return;
    }

    const MAX_FILE_SIZE = 200 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setError('File size exceeds maximum limit of 200MB');
      return;
    }

    setError(null);
    setIsImporting(true);

    try {
      const text = await file.text();
      await storage.import(text);
      onImported?.();
      resetFileInput();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import projects');
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
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">File requirements:</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              <li>• JSON format (.json extension)</li>
              <li>• Must be a valid RWA Wizard export (single project or full backup)</li>
              <li>• Maximum size: 200MB</li>
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
