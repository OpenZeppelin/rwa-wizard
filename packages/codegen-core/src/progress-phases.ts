/**
 * Canonical progress phase strings for the core engine ZIP pipeline.
 *
 * Generators emit their own phase names (e.g. Stellar RWA phases); these
 * values cover {@link generateZip} and {@link generateZipFromFileTree} only.
 */
export const CoreProgressPhase = {
  /** ZIP assembly: file tree → archive (also used by {@link generateZip} wrapper). */
  packaging: 'packaging',
} as const;

export type CoreProgressPhaseName = (typeof CoreProgressPhase)[keyof typeof CoreProgressPhase];
