import { BrowserRouter, Route, Routes } from 'react-router-dom';

/**
 * First-iteration app routing and state entry.
 * Renders the application shell root; wizard and draft surfaces will be
 * mounted here in later phases.
 */
function AppShell() {
  return (
    <div data-testid="app-shell" className="min-h-screen">
      <header className="border-b p-4">
        <h1 className="text-lg font-semibold">RWA Wizard</h1>
      </header>
      <main className="p-4" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}
