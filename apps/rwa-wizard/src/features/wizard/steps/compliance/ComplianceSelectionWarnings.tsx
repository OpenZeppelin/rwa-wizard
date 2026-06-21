import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { renderInlineCopy } from '../../../../components/shared/renderInlineCopy';
import type { ComplianceModuleSelectionWarningMeta } from '../../../../types/wizard';

interface ComplianceSelectionWarningsProps {
  warnings: ComplianceModuleSelectionWarningMeta[];
}

export function ComplianceSelectionWarnings({ warnings }: ComplianceSelectionWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <ErrorBanner
          key={warning.id}
          tone={warning.blocking ? 'error' : 'warning'}
          message={renderInlineCopy(warning.description ?? '')}
        />
      ))}
    </div>
  );
}
