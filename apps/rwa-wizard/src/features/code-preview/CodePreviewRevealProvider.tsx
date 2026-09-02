import type { ReactElement, ReactNode } from 'react';

import { CodePreviewRevealContext, type RevealInPreview } from './CodePreviewRevealContext';

/**
 * Exposes `useCodePreview().revealInPreview` to deep callers. Component-only
 * module so Vite's Fast Refresh keeps working; the hook lives in
 * `useCodePreviewReveal.ts`.
 */
export function CodePreviewRevealProvider(props: {
  /** `null` when the preview cannot be driven (no codegen service). Consumers then get `null`. */
  readonly revealInPreview: RevealInPreview | null;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <CodePreviewRevealContext.Provider value={props.revealInPreview}>
      {props.children}
    </CodePreviewRevealContext.Provider>
  );
}
