import type { ReactNode } from 'react';

/**
 * Shared providers and client-side app composition root for the RWA Wizard.
 * AppConfigService is initialized in main.tsx before render; this component
 * wraps the app with any React context providers (e.g. future draft storage,
 * feature flags) that need to be available to the tree.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
