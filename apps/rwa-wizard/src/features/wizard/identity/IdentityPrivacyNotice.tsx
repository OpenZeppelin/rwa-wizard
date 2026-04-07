import { AlertTriangle } from 'lucide-react';

export function IdentityPrivacyNotice() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800/50 dark:bg-yellow-900/10">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-500" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Privacy Notice</p>
        <p className="text-xs text-yellow-700 dark:text-yellow-500/90">
          Identity verification data such as claim topics and trusted issuer addresses is stored
          locally in your browser only. No data is sent to any external service. However, once
          deployed on-chain, this information will be publicly visible.
        </p>
      </div>
    </div>
  );
}
