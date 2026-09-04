import { useContext } from 'react';

import { CodePreviewProvenanceContext } from './CodePreviewProvenanceContext';
import type { CodePreviewProvenance } from './provenanceState';

/**
 * `null` outside a provider or when the current target has no code preview.
 * Consumers treat `null` exactly like "no capability": no affordance, no throw.
 * SF-5 INV-20.
 */
export function useCodePreviewProvenance(): CodePreviewProvenance | null {
  return useContext(CodePreviewProvenanceContext);
}
