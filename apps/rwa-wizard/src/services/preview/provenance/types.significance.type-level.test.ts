/**
 * SF-11 INV-8 — the type-level half, which is the whole of it.
 *
 * `significance` is a REQUIRED member of every row variant, and `file` and
 * `created` are typed to the literal `'primary'` rather than to the union. A
 * runtime assertion here would be strictly weaker than what `tsc` already
 * refuses, so the fixtures below are `@ts-expect-error` lines: each one asserts
 * that the compiler REJECTS a construction, and each one starts failing the
 * moment the compiler stops rejecting it.
 *
 * **The gate for this file is `pnpm typecheck`, including the real-kit pass —
 * not `vitest`.** An unsatisfied `@ts-expect-error` is a compile error
 * (`ts(2578): Unused '@ts-expect-error' directive`), which vitest's transform
 * does not surface because esbuild strips types without checking them. The
 * single runtime test at the bottom exists so that the file is not silently
 * skipped, and says this out loud.
 *
 * INV-8, and SF-10 INV-2 raised from a convention to a `tsc` fact.
 */
import { describe, expect, it } from 'vitest';

import type { FieldProvenanceRow, FieldProvenanceSignificance } from './types';

// ---------------------------------------------------------------------------
// Positive controls. If these ever stop compiling, the negatives below are
// rejecting for the wrong reason and prove nothing.
// ---------------------------------------------------------------------------

const rangePrimary: FieldProvenanceRow = {
  kind: 'range',
  range: { startLine: 3, endLine: 3 },
  significance: 'primary',
};

const rangeSecondary: FieldProvenanceRow = {
  kind: 'range',
  range: { startLine: 9, endLine: 12 },
  significance: 'secondary',
};

const wholeFile: FieldProvenanceRow = { kind: 'file', significance: 'primary' };
const createdFile: FieldProvenanceRow = { kind: 'created', significance: 'primary' };

/** The union is exactly two members, and the assignment below is how that is asserted. */
const everySignificance: readonly FieldProvenanceSignificance[] = ['primary', 'secondary'];

// ---------------------------------------------------------------------------
// Negative fixtures. Each line must be an error for the directive to be used.
// ---------------------------------------------------------------------------

// A whole-file row can never be demoted: SF-10 refused significance on
// whole-file attributions, and this is that refusal as a compiler fact.
// @ts-expect-error INV-8: `file` is typed to the literal 'primary'
const demotedFile: FieldProvenanceRow = { kind: 'file', significance: 'secondary' };

// Nor can a file-creation row.
// @ts-expect-error INV-8: `created` is typed to the literal 'primary'
const demotedCreated: FieldProvenanceRow = { kind: 'created', significance: 'secondary' };

// `significance` is required, not optional: every construction site must answer,
// which is how each of them gets FOUND rather than remembered.
// @ts-expect-error INV-8: `significance` is a required member of the range variant
const rangeWithout: FieldProvenanceRow = { kind: 'range', range: { startLine: 1, endLine: 1 } };

// @ts-expect-error INV-8: `significance` is a required member of the file variant
const fileWithout: FieldProvenanceRow = { kind: 'file' };

// @ts-expect-error INV-8: `significance` is a required member of the created variant
const createdWithout: FieldProvenanceRow = { kind: 'created' };

// The union is CLOSED — no third state. A third member is what would make the
// partition's `never` arm reachable and rows vanish from a two-filter partition.
// @ts-expect-error INV-8: 'informational' is not a FieldProvenanceSignificance
const thirdState: FieldProvenanceSignificance = 'informational';

// And no absent state. SF-10's default-primary guarantee is spent AT the seam,
// so there is nothing on the wizard side for a `?? 'primary'` to coalesce.
// @ts-expect-error INV-8: significance is never nullable
const nullable: FieldProvenanceSignificance = null;

const undefinedSignificance: FieldProvenanceRow = {
  kind: 'range',
  range: { startLine: 1, endLine: 1 },
  // The directive sits on the PROPERTY, not on the `const`: an excess- or
  // missing-property error inside an object literal is reported at the member,
  // and a directive one line too high is an unused directive — itself an error
  // (ts2578), which is how this file catches its own misplacement.
  // @ts-expect-error INV-8: significance is never optional at the row
  significance: undefined,
};

describe('FieldProvenanceRow — significance is required and closed (INV-8)', () => {
  it('is enforced by tsc, not by vitest: this suite only proves the fixtures are reachable', () => {
    // esbuild strips types without checking them, so this file passes `vitest`
    // whatever the annotations say. The eight `@ts-expect-error` directives
    // above are checked by `pnpm typecheck` (and by the real-kit pass, which is
    // the one that matters — `significance` crosses the kit's `ReactNode` seam).
    // If any of them stops being an error, typecheck fails with ts(2578).
    expect([rangePrimary, rangeSecondary, wholeFile, createdFile]).toHaveLength(4);
    expect(everySignificance).toEqual(['primary', 'secondary']);
    // Referenced so the negative fixtures are not dead code the linter removes.
    expect([
      demotedFile,
      demotedCreated,
      rangeWithout,
      fileWithout,
      createdWithout,
      thirdState,
      nullable,
      undefinedSignificance,
    ]).toHaveLength(8);
  });

  it('the positive controls are genuinely assignable, so the negatives fail for the right reason', () => {
    expect(rangePrimary.significance).toBe('primary');
    expect(rangeSecondary.significance).toBe('secondary');
    expect(wholeFile.significance).toBe('primary');
    expect(createdFile.significance).toBe('primary');
  });
});
