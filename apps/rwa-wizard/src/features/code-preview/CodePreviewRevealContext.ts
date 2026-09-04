import { createContext } from 'react';

import type { CodePreviewRevealTarget } from './reveal';

export type RevealInPreview = (target: CodePreviewRevealTarget) => void;

/**
 * `null` means "there is no code preview to point at" — the same condition
 * that hides the drawer trigger. Callers several layers below `WizardPage`
 * (inside kit-owned step rendering) read the callback from here rather than
 * through props the kit cannot carry. INV-12.
 */
export const CodePreviewRevealContext = createContext<RevealInPreview | null>(null);
