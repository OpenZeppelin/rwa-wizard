/**
 * The closed set of ranking kinds a generator may report for an emitted file.
 *
 * Owned here so every chain generator and every consumer (the wizard's codegen
 * seam, a CLI, an agent) narrows against one vocabulary instead of re-declaring
 * it. Generators classify their own paths; consumers must never recover a kind
 * from a filename. `unknown` is a member so a path a generator does not
 * classify — or a value a consumer does not recognise — degrades to an explicit
 * kind rather than to `undefined`.
 */
export const GENERATED_FILE_KINDS = [
  'contract',
  'script',
  'provenance-and-docs',
  'unknown',
] as const;

export type GeneratedFileKind = (typeof GENERATED_FILE_KINDS)[number];

/** Files consumers hide from field-impact ranking: config dumps and prose, not code. */
export const PROVENANCE_AND_DOCS_KIND: GeneratedFileKind = 'provenance-and-docs';

/** True when `value` is one of the ranking kinds. Never throws. */
export function isGeneratedFileKind(value: string): value is GeneratedFileKind {
  return (GENERATED_FILE_KINDS as readonly string[]).includes(value);
}
