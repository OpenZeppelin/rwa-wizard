/**
 * INV-25 / INV-30 / INV-31 — the AS-4 oracle.
 *
 * Two assertions, in opposite directions, over every golden fixture on both
 * generate roots:
 *
 * 1. Inside `.sh`, a **biconditional**: a recorded range is display-only under
 *    the grammar iff it is marked secondary. The forward direction catches
 *    promotion drift — a display range left unmarked. The reverse direction is
 *    the demotion-catcher and is the one this sub-feature is rated High for: a
 *    range containing a deploy command declared secondary fails immediately,
 *    and that failure is invisible to the goldens, which see only bytes.
 *
 * 2. Outside `.sh`, a flat, **grammar-free prohibition**: nothing is marked.
 *    This turns Research's measured boundedness into a property. A genuine
 *    display-only range appearing in a contract or a README cannot be marked
 *    without someone first changing this test.
 *
 * No count is pinned anywhere. Counts are fixture-dependent — `deploy.sh`
 * carries between 9 and 34 recorded ranges depending on how many modules and
 * claim topics a fixture selects — so an oracle that asserts "12 of 22" passes
 * on one fixture and fails on the rest. A non-vacuity floor stands in for what
 * a count was reaching for: a biconditional over an empty set passes, so the
 * sweep must also see at least one marked and one unmarked range per fixture.
 *
 * The sweep itself lives in `significance-oracle.ts` and is driven against
 * deliberately corrupted provenance by `display-significance.meta.test.ts` — an
 * oracle that has never been shown to fail is the one failure that would let
 * this sub-feature ship hollow.
 */
import { describe, expect, it } from 'vitest';

import { GENERATE_PATHS, generateRecorded, GOLDEN_FIXTURES } from './helpers';
import { ALLOWLIST, describeFinding, marksOutsideShell, shellCensus } from './significance-oracle';

describe('INV-31 — the AS-4 biconditional over every recorded `.sh` range', () => {
  for (const path of GENERATE_PATHS) {
    for (const fixture of GOLDEN_FIXTURES) {
      it(`${fixture.name} × ${path.name}: display-only iff marked secondary`, () => {
        const { files, provenance } = generateRecorded(path, fixture.config);
        const where = `${fixture.name} (${path.name})`;
        const { findings, marked, primary } = shellCensus(files, provenance);

        expect(
          findings.map((finding) => describeFinding(finding, where)).join('\n\n'),
          'AS-4 biconditional'
        ).toBe('');

        // The non-vacuity floor: a biconditional over an empty set passes, so
        // the sweep must have seen both kinds. If this fails while the
        // biconditional passes, marking was removed wholesale.
        expect(marked, `${fixture.name}: no .sh range is marked secondary`).toBeGreaterThan(0);
        expect(primary, `${fixture.name}: no .sh range is left primary`).toBeGreaterThan(0);
      });
    }
  }

  it('the divergence allowlist is empty', () => {
    expect(ALLOWLIST).toHaveLength(0);
  });
});

describe('INV-25 — no mark exists outside `.sh`', () => {
  for (const path of GENERATE_PATHS) {
    for (const fixture of GOLDEN_FIXTURES) {
      it(`${fixture.name} × ${path.name}: every non-shell range is primary`, () => {
        const { files, provenance } = generateRecorded(path, fixture.config);
        expect(marksOutsideShell(files, provenance).join('\n'), 'significance outside `.sh`').toBe(
          ''
        );
      });
    }
  }
});
