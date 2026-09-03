/**
 * Tone tokens for `ErrorBanner`, kept out of the component module so call sites
 * that render their own glyph can take the colour from here instead of
 * restating the literal — which is how the preview notice drifted out of step
 * with the default icon.
 */

/**
 * Visual + ARIA variants for `ErrorBanner`.
 *
 * - `error` (default): red destructive styling.
 * - `warning`: amber styling.
 * - `info`: neutral info styling.
 */
export type ErrorBannerTone = 'error' | 'warning' | 'info';

export const errorBannerVariant: Record<ErrorBannerTone, 'error' | 'warning' | 'info'> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const toneToIconClassName: Record<ErrorBannerTone, string> = {
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
};

/** Icon colour for a banner tone. */
export function errorBannerIconClassName(tone: ErrorBannerTone): string {
  return toneToIconClassName[tone];
}
