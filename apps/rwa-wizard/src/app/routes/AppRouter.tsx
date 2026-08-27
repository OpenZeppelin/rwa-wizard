import { useState } from 'react';
import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Footer, Header } from '@openzeppelin/ui-components';

import { TrackedRoute } from '../../components/analytics/TrackedRoute';
import { WizardPage } from '../../features/wizard/WizardPage';
import { AppSidebar } from './AppSidebar';
import { DEFAULT_WIZARD_NETWORK_ID, wizardPath } from './wizardPaths';

/**
 * App-wide layout: sidebar + header + routed page + footer. Owns the
 * mobile-sidebar open/close toggle so both the sidebar (which needs to
 * know when it is open) and the header (which needs to open it) can share
 * the same state without a Context.
 */
function AppShell(): ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />

      <div className="flex h-[calc(100dvh-var(--bottom-sheet-inset,0px))] min-w-0 flex-1 flex-col overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none [html[data-bottom-sheet-inset=resizing]_&]:transition-none">
        <Header title="Real World Asset" onOpenSidebar={() => setMobileOpen(true)} />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={<Navigate to={wizardPath(DEFAULT_WIZARD_NETWORK_ID)} replace />}
            />
            <Route
              path="/wizard"
              element={<Navigate to={wizardPath(DEFAULT_WIZARD_NETWORK_ID)} replace />}
            />
            <Route
              path="/wizard/:networkId"
              element={
                <TrackedRoute name="Wizard">
                  <WizardPage />
                </TrackedRoute>
              }
            />
          </Routes>
        </div>

        {/* Hidden while an inset code-preview sheet is open so the reclaimed space goes to the form. */}
        <div className="[html[data-bottom-sheet-inset]_&]:hidden">
          <Footer />
        </div>
      </div>
    </div>
  );
}

export function AppRouter(): ReactElement {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
