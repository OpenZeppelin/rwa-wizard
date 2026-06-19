import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { Banner } from '@openzeppelin/ui-components';
import { cn } from '@openzeppelin/ui-utils';

interface InfoNoticeBannerProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Non-dismissible neutral banner for wizard notices (matches UI Builder `Banner` usage). */
export function InfoNoticeBanner({ title, children, className }: InfoNoticeBannerProps) {
  return (
    <Banner
      variant="neutral"
      size="compact"
      title={title}
      dismissible={false}
      icon={<Info className="size-4" aria-hidden />}
      className={cn('min-w-0', className)}
    >
      {children}
    </Banner>
  );
}
