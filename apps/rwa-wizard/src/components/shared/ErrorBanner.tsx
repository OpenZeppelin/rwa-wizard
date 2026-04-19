import { AlertCircle } from 'lucide-react';

/**
 * Visual + ARIA variants for `ErrorBanner`.
 *
 * - `error` (default): red destructive styling, `role="alert"`.
 * - `warning`: amber styling, `role="status"`.
 * - `info`: neutral styling, `role="status"`.
 */
export type ErrorBannerTone = 'error' | 'warning' | 'info';

export interface ErrorBannerProps {
  /** Primary message shown to the user. Required. */
  message: string;
  /** Optional callback invoked when the user clicks the dismiss affordance. If omitted, no dismiss button is rendered. */
  onDismiss?: () => void;
  /** Label for the dismiss button. Defaults to `"Dismiss"`. */
  dismissLabel?: string;
  /** Optional icon override. Defaults to a `lucide-react` `AlertCircle`. Pass `null` to hide the icon entirely. */
  icon?: React.ReactNode;
  /** Visual tone. Defaults to `"error"`. */
  tone?: ErrorBannerTone;
  /** Additional class names appended to the root element. */
  className?: string;
}

const toneToClassName: Record<ErrorBannerTone, string> = {
  error: 'border-destructive/30 bg-destructive/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  info: 'border-border bg-muted',
};

const toneToIconClassName: Record<ErrorBannerTone, string> = {
  error: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-muted-foreground',
};

const toneToRole: Record<ErrorBannerTone, 'alert' | 'status'> = {
  error: 'alert',
  warning: 'status',
  info: 'status',
};

/**
 * Reusable banner for surfacing transient errors, warnings, and notices
 * inside the wizard shell. Keeps styling, ARIA roles, and dismiss behaviour
 * consistent so callers do not reinvent a "red alert box" ad-hoc.
 *
 * For rendering many banners at once, prefer `ErrorBannerStack` which
 * deduplicates spacing concerns.
 */
export function ErrorBanner({
  message,
  onDismiss,
  dismissLabel = 'Dismiss',
  icon,
  tone = 'error',
  className,
}: ErrorBannerProps): React.ReactElement {
  const resolvedIcon =
    icon === null
      ? null
      : (icon ?? <AlertCircle className={`size-4 shrink-0 ${toneToIconClassName[tone]}`} />);

  const classes = [
    'flex items-start gap-2 rounded-md border px-3 py-2 text-sm text-foreground',
    toneToClassName[tone],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div role={toneToRole[tone]} className={classes}>
      {resolvedIcon}
      <span className="flex-1 text-muted-foreground">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {dismissLabel}
        </button>
      )}
    </div>
  );
}
