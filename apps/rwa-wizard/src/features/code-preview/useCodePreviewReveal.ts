import { useContext } from 'react';

import { CodePreviewRevealContext, type RevealInPreview } from './CodePreviewRevealContext';

/**
 * `null` outside a provider or when the current target has no code preview.
 * Consumers treat `null` exactly like "no capability": no affordance, no throw.
 * INV-12, INV-17.
 */
export function useCodePreviewReveal(): RevealInPreview | null {
  return useContext(CodePreviewRevealContext);
}
