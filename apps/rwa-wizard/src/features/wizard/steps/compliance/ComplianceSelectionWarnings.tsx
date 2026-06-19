import { AlertTriangle } from 'lucide-react';

import type { ComplianceModuleSelectionWarningMeta } from '../../../../types/wizard';

interface ComplianceSelectionWarningsProps {
  warnings: ComplianceModuleSelectionWarningMeta[];
}

export function ComplianceSelectionWarnings({ warnings }: ComplianceSelectionWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <div
          key={warning.id}
          className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-foreground"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p>{warning.description}</p>
        </div>
      ))}
    </div>
  );
}
