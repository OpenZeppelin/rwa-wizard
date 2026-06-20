import { AlertTriangle } from 'lucide-react';

import { Banner } from '@openzeppelin/ui-components';

import type { ComplianceModuleSelectionWarningMeta } from '../../../../types/wizard';

interface ComplianceSelectionWarningsProps {
  warnings: ComplianceModuleSelectionWarningMeta[];
}

export function ComplianceSelectionWarnings({ warnings }: ComplianceSelectionWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <Banner
          key={warning.id}
          variant="warning"
          dismissible={false}
          icon={<AlertTriangle className="size-4" aria-hidden />}
        >
          {warning.description}
        </Banner>
      ))}
    </div>
  );
}
