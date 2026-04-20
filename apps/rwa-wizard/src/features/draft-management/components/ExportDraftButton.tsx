import { Download } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@openzeppelin/ui-components';

import { exportDraftAsJson } from '../../../services/download/exportDraftAsJson';
import { useWizardDraftStorage } from '../../../storage';
import { toError } from '../../../utils/errorReporting';

interface ExportDraftButtonProps {
  draftId: string | null;
  onError?: (error: Error) => void;
}

export function ExportDraftButton({ draftId, onError }: ExportDraftButtonProps) {
  const storage = useWizardDraftStorage();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!draftId) return;
    setIsExporting(true);
    try {
      await exportDraftAsJson(draftId, storage);
    } catch (err) {
      onError?.(toError(err));
    } finally {
      setIsExporting(false);
    }
  }, [draftId, storage, onError]);

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs"
      disabled={!draftId || isExporting}
      onClick={() => void handleExport()}
    >
      <Download className="size-3.5" />
      {isExporting ? 'Exporting...' : 'Export'}
    </Button>
  );
}
