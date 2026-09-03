import { AlertCircle } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { Banner } from '@openzeppelin/ui-components';

import {
  errorBannerIconClassName,
  errorBannerVariant,
  type ErrorBannerTone,
} from './errorBannerTone';

export type { ErrorBannerTone };

export interface ErrorBannerProps {
  /** Primary message shown to the user. Required. */
  message: ReactNode;
  /** Optional callback invoked when the user dismisses the banner. If omitted, the banner is not dismissible. */
  onDismiss?: () => void;
  /** Label for the dismiss button. Kept for API compatibility; ui-components `Banner` uses an icon dismiss control. */
  dismissLabel?: string;
  /** Optional icon override. Defaults to a `lucide-react` `AlertCircle`. Pass `null` to hide the icon entirely. */
  icon?: ReactNode;
  /** Visual tone. Defaults to `"error"`. */
  tone?: ErrorBannerTone;
  /** Additional class names appended to the root element. */
  className?: string;
}

/**
 * Thin wrapper around `@openzeppelin/ui-components` `Banner` for transient wizard
 * errors, warnings, and notices. For multiple banners, prefer `ErrorBannerStack`.
 */
export function ErrorBanner({
  message,
  onDismiss,
  icon,
  tone = 'error',
  className,
}: ErrorBannerProps): ReactElement {
  const resolvedIcon =
    icon === null
      ? undefined
      : (icon ?? <AlertCircle className={`size-4 ${errorBannerIconClassName(tone)}`} />);

  return (
    <Banner
      variant={errorBannerVariant[tone]}
      dismissible={Boolean(onDismiss)}
      onDismiss={onDismiss}
      icon={resolvedIcon}
      className={className}
    >
      {message}
    </Banner>
  );
}
