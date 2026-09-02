import { createContext } from 'react';

import type { InspectedAnchorStore } from './inspectedAnchorStore';

/**
 * The store handle, or `null` when no provider is mounted above.
 *
 * **The `null` default is the dependency-injection seam and it is bought
 * deliberately.** All three consumer hooks degrade to inert on it, because
 * `TogglePill`, the step harness's `renderStep` and the 25-file markup guard all
 * render these components with no provider, and a throwing hook would take every
 * one of them down. The cost is that forgetting the provider in `WizardPage`
 * ships the whole feature inert with a fully green suite — which is why the
 * structural assertion that `WizardPage` mounts it above *both* subtrees is
 * required rather than optional. INV-13.
 */
export const InspectedAnchorContext = createContext<InspectedAnchorStore | null>(null);
