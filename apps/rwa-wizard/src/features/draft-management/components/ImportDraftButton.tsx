import { Upload } from 'lucide-react';
import { useCallback, useRef } from 'react';
import type { ChangeEvent } from 'react';

import { Button } from '@openzeppelin/ui-components';

import { useWizardDraftStorage } from '../../../storage';
import { toError } from '../../../utils/errorReporting';

interface ImportDraftButtonProps {
  onImported?: (ids: string[]) => void;
  onError?: (error: Error) => void;
}

export function ImportDraftButton({ onImported, onError }: ImportDraftButtonProps) {
  const storage = useWizardDraftStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const ids = await storage.import(text);
        onImported?.(ids);
      } catch (err) {
        onError?.(toError(err));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [storage, onImported, onError]
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="size-3.5" />
        Import
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />
    </>
  );
}
