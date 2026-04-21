import { createContext } from 'react';

import { coreCopy, type ChainCopy } from '@openzeppelin/rwa-wizard-copy';

/**
 * The wizard's chain-scoped copy context.
 *
 * `coreCopy` is used as the default so call sites outside the wizard (e.g.
 * shared shell chrome) can read chain-neutral
 * copy without every consumer threading a target id.
 *
 * Kept in a dedicated module so the provider file exports only components
 * and the hook file exports only hooks — a constraint that keeps Vite's
 * Fast Refresh working for hot reloads.
 */
export const CopyContext = createContext<ChainCopy>(coreCopy);
