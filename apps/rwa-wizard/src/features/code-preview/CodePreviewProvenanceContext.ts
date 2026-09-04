import { createContext } from 'react';

import type { CodePreviewProvenance } from './provenanceState';

/**
 * `null` means "there is no code preview to ask about" — the same condition
 * that hides the drawer trigger. Kept distinct from `state.kind === 'none'`
 * (a preview exists, no tree yet) and `'unsupported'` (a tree exists, the
 * generator does not record), so a consumer can name which absence it hit.
 * SF-5 INV-8 / INV-20.
 */
export const CodePreviewProvenanceContext = createContext<CodePreviewProvenance | null>(null);
