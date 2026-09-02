import type { CodePreviewPhase } from './hooks/useCodePreview';

import { groupFieldProvenance } from '../../services/preview';
import type {
  FieldProvenanceResult,
  PreviewGenerateKey,
  PreviewProvenanceSource,
} from '../../services/preview';
import type { StructuralGeneratedFileKind } from '../../types/wizard';
import type { ConfigPath } from '../wizard/config-path';

/**
 * What the wizard knows about provenance for the tree on screen.
 * - `none`        — no tree on screen (idle / loading / error). Nothing to ask.
 * - `unsupported` — a tree is on screen and its result carried no provenance
 *                   field. The generator does not record. Nothing to offer.
 * - `available`   — a tree is on screen with provenance from the same result.
 * Every `available` state and every result it yields is stamped with the
 * generate key of that tree. SF-5 INV-8 / INV-19.
 */
export type PreviewProvenanceState =
  | { readonly kind: 'none' }
  | { readonly kind: 'unsupported'; readonly identity: PreviewGenerateKey }
  | {
      readonly kind: 'available';
      readonly identity: PreviewGenerateKey;
      /** Pure, synchronous, never throws for a wizard `ConfigPath`. */
      readonly lookup: (path: ConfigPath) => FieldProvenanceResult;
    };

/** Value carried by the context wizard-side consumers read. */
export interface CodePreviewProvenance {
  readonly state: PreviewProvenanceState;
  /**
   * Generate key of the draft *as it is right now* (undebounced), computed by
   * the same function that keys the tree. A result whose `identity` differs
   * from this is stale and must not be shown. `null` when there is no service.
   * SF-5 INV-18.
   */
  readonly liveIdentity: PreviewGenerateKey | null;
}

/**
 * Pure and exhaustive over `CodePreviewPhase`. `lookup` closes over a source
 * built from this phase and `kindOf` only — no ref read at call time — so a
 * held closure keeps answering for the tree it was built from and is
 * detectably stale by identity rather than silently current. It is not
 * memoised: a consumer calls it on demand over tens of files, and a memo would
 * add a `path` input to enumerate for no measurable win.
 */
export function toPreviewProvenanceState(
  phase: CodePreviewPhase,
  kindOf: (path: string) => StructuralGeneratedFileKind
): PreviewProvenanceState {
  switch (phase.kind) {
    case 'idle':
    case 'loading':
    case 'error':
      return { kind: 'none' };
    case 'ready': {
      if (phase.provenance === undefined) {
        return { kind: 'unsupported', identity: phase.generateKey };
      }
      const source: PreviewProvenanceSource = {
        identity: phase.generateKey,
        files: phase.files,
        provenance: phase.provenance,
        kindOf,
      };
      return {
        kind: 'available',
        identity: phase.generateKey,
        lookup: (path) => groupFieldProvenance(source, path),
      };
    }
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
}
