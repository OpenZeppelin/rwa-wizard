/**
 * Progress phases emitted by `StellarRwaGenerator`.
 *
 * After `complete`, `generateZip` reports ZIP steps with `packaging` from codegen-core.
 */
export const StellarRwaProgressPhase = {
  validating: 'validating',
  generatingContracts: 'generating-contracts',
  generatingScripts: 'generating-scripts',
  /** File tree is ready; subsequent `generateZip` uses `packaging`. */
  complete: 'complete',
} as const;

export type StellarRwaProgressPhaseName =
  (typeof StellarRwaProgressPhase)[keyof typeof StellarRwaProgressPhase];
