import { AlertTriangle } from 'lucide-react';

import { useCopy } from '../../../../app/providers/useCopy';

export function IdentityPrivacyNotice() {
  const notice = useCopy().notice('identity.privacy');
  return (
    <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800/50 dark:bg-yellow-900/10">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-500" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">{notice.title}</p>
        <p className="text-xs text-yellow-700 dark:text-yellow-500/90">{notice.description}</p>
      </div>
    </div>
  );
}
