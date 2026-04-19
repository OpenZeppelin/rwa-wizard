import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';

import { initAppConfig } from './app/config/initAppConfig';

import App from './App';

// Bootstrap the shared AppConfigService before any component renders so the
// first feature-flag lookup (e.g. wizardSteps reading DEPLOYMENT_STEP) does
// not log a "called before initialization" warning. Safe to run synchronously
// — only the `viteEnv` strategy is used.
initAppConfig();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
