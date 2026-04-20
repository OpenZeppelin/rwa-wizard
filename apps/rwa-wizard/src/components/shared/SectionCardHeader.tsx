import type { ReactNode } from 'react';

import { CardHeader, CardTitle } from '@openzeppelin/ui-components';

import { InfoTooltip } from './InfoTooltip';

interface SectionCardHeaderProps {
  title: string;
  /**
   * Educational copy revealed on hover / focus of an info icon next to the title.
   * Keep to a short paragraph; long prose is hard to read inside a tooltip.
   */
  info?: ReactNode;
  /** Tailwind max-width class for the tooltip popup. Defaults to `max-w-sm`. */
  infoMaxWidthClassName?: string;
}

/**
 * Standard section header for wizard cards: a title with an optional
 * info-icon tooltip. Replaces `CardDescription` for sections where the
 * explanatory copy is long enough to feel like noise in the primary layout.
 */
export function SectionCardHeader({
  title,
  info,
  infoMaxWidthClassName = 'max-w-sm',
}: SectionCardHeaderProps) {
  if (!info) {
    return (
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
    );
  }

  return (
    <CardHeader>
      <div className="flex items-center gap-2">
        <CardTitle>{title}</CardTitle>
        <InfoTooltip label={`About ${title}`} maxWidthClassName={infoMaxWidthClassName}>
          {info}
        </InfoTooltip>
      </div>
    </CardHeader>
  );
}
