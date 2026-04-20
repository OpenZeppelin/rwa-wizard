import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useRwaWizardAnalytics } from '../../hooks/useRwaWizardAnalytics';

interface TrackedRouteProps {
  /** Human-readable page name sent to GA as `page_title` (see shared `page_view` event). */
  name: string;
  children: ReactNode;
}

/**
 * Wraps a route element and records a `page_view` when the pathname changes.
 * Same pattern as Role Manager’s `TrackedRoute`.
 */
export function TrackedRoute({ name, children }: TrackedRouteProps) {
  const location = useLocation();
  const { trackPageView } = useRwaWizardAnalytics();

  useEffect(() => {
    trackPageView(name, location.pathname);
  }, [name, location.pathname, trackPageView]);

  return <>{children}</>;
}
