import type { ReactElement, ReactNode } from 'react';

import { CodePreviewProvenanceContext } from './CodePreviewProvenanceContext';
import type { CodePreviewProvenance } from './provenanceState';

/**
 * Exposes `useCodePreview().provenance` to deep callers inside kit-owned step
 * rendering. Component-only module so Vite's Fast Refresh keeps working; the
 * hook lives in `useCodePreviewProvenance.ts` (same split as the reveal seam).
 */
export function CodePreviewProvenanceProvider(props: {
  /** `null` when the preview cannot be asked (no codegen service). Consumers then get `null`. */
  readonly value: CodePreviewProvenance | null;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <CodePreviewProvenanceContext.Provider value={props.value}>
      {props.children}
    </CodePreviewProvenanceContext.Provider>
  );
}
