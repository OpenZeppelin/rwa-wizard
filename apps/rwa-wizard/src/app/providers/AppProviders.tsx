import type { ReactNode } from 'react';

import { TooltipProvider } from '@openzeppelin/ui-components';
import { AnalyticsProvider } from '@openzeppelin/ui-react';

/**
 * Shared providers and client-side app composition root for the RWA Wizard.
 * AppConfigService is initialized in {@link ../config/initAppConfig} (called
 * from `main.tsx` before render); this component wraps the app with any
 * React context providers (e.g. future draft storage, feature flags) that
 * need to be available to the tree.
 *
 * `AnalyticsProvider` mirrors Role Manager and UI Builder: it initializes the
 * shared `AnalyticsService` when `VITE_GA_TAG_ID` is set and
 * `analytics_enabled` is true (see `public/app.config.json` / Docker build args).
 *
 * TooltipProvider is mounted here so educational info tooltips anywhere in the
 * wizard (e.g. <InfoTooltip>) share a single Radix provider and consistent
 * open/close timing.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const analyticsTagId = import.meta.env.VITE_GA_TAG_ID || '';

  return (
    <AnalyticsProvider tagId={analyticsTagId} autoInit>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </AnalyticsProvider>
  );
}
