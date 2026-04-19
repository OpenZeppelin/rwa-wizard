import type { ReactNode } from 'react';

import { TooltipProvider } from '@openzeppelin/ui-components';

/**
 * Shared providers and client-side app composition root for the RWA Wizard.
 * AppConfigService is initialized in {@link ../config/initAppConfig} (called
 * from `main.tsx` before render); this component wraps the app with any
 * React context providers (e.g. future draft storage, feature flags) that
 * need to be available to the tree.
 *
 * TooltipProvider is mounted here so educational info tooltips anywhere in the
 * wizard (e.g. <InfoTooltip>) share a single Radix provider and consistent
 * open/close timing.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <TooltipProvider delayDuration={200}>{children}</TooltipProvider>;
}
