import { ErrorBanner, type ErrorBannerProps } from './ErrorBanner';

export interface ErrorBannerStackEntry extends Omit<ErrorBannerProps, 'className'> {
  /**
   * Stable key for React reconciliation. Callers should derive this from
   * the error's origin (e.g. `"persist"`, `"target-load"`) rather than the
   * message text, so consecutive distinct errors do not collapse into one.
   */
  id: string;
}

export interface ErrorBannerStackProps {
  /**
   * Entries to render, top-to-bottom. Any falsy value (`null`, `undefined`,
   * `false`, `""`, `0`) is skipped so callers can use inline `&&` with any
   * truthy-guarded expression.
   */
  entries: ReadonlyArray<ErrorBannerStackEntry | null | undefined | false | '' | 0>;
  /** Additional class names appended to the stack wrapper. */
  className?: string;
}

/**
 * Renders a vertical stack of `ErrorBanner`s with consistent spacing and
 * horizontal padding. Centralising the layout keeps wizard chrome from
 * drifting between pages when multiple transient errors coexist
 * (e.g. persist failure + target load failure).
 *
 * Entries are filtered for falsy values so call sites can write:
 *
 * ```tsx
 * <ErrorBannerStack
 *   entries={[
 *     targetLoadError && { id: 'target-load', message: targetLoadError, onDismiss: clearTarget },
 *     persistError && { id: 'persist', message: persistError, onDismiss: clearPersist },
 *   ]}
 * />
 * ```
 */
export function ErrorBannerStack({
  entries,
  className,
}: ErrorBannerStackProps): React.ReactElement | null {
  const visible = entries.filter((entry): entry is ErrorBannerStackEntry => Boolean(entry));

  if (visible.length === 0) return null;

  const classes = ['mx-4 mt-3 flex flex-col gap-2', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {visible.map(({ id, ...bannerProps }) => (
        <ErrorBanner key={id} {...bannerProps} />
      ))}
    </div>
  );
}
