/**
 * SF-16 — the three checks that had to be red before the projection changed.
 *
 * Nothing writes `selected: false` until SF-17, so on SF-16 alone the behaviour
 * change is unreachable through the wizard: "nothing moves on the sixteen
 * fixtures" is true and proves nothing (INV-35). These three are the only
 * evidence available, so each was authored and observed FAILING against the
 * selection-blind generator before a line of the projection moved:
 *
 * - INV-13 — the byte-identity oracle, with the unselected topic at a NON-FINAL
 *   position. Placement is load-bearing: with the FINAL topic unselected, the
 *   present-and-false config and the absent config emit the same bytes even
 *   under the count/index conflation, so the oracle passes with the defect
 *   present. `describes the final-position case as vacuous` is that control.
 * - INV-14 — the emitted claim-topic id sequence, asserted SEPARATELY at both
 *   loop sites. `deploy.sh`'s conflation became a type error; the `allow_key`
 *   loop in `bootstrap-demo-mint.sh` bounds on a plain local whose `.length`
 *   type-checks perfectly as an index bound, so only this check protects it.
 * - INV-27 — per-line attribution survives the filter. The detached-object
 *   implementation (`claimTopics.filter(isSelected)` then indexing the filtered
 *   array) emits byte-correct output, passes every golden, passes INV-13 and
 *   passes INV-14 — and attributes every claim-topic line to one read at the top
 *   of the file.
 */
import { describe, expect, it } from 'vitest';

import { selectedClaimTopicIds } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { undeterminedRanges } from './determination';
import {
  createdEntry,
  finalTopicAbsentConfig,
  finalTopicUnselectedConfig,
  GENERATE_PATHS,
  generateRecorded,
  GOLDEN_FIXTURES,
  rangeEntries,
  rangesForPath,
  sliceRange,
  textOf,
  topicAbsentConfig,
  topicUnselectedConfig,
  type GeneratePath,
} from './helpers';

const DEPLOY = 'scripts/deploy.sh';
const DEMO_MINT = 'scripts/bootstrap-demo-mint.sh';
const CONFIG_JSON = 'config.json';

/** Every `--claim_topic <id>` argument in `content`, in emission order. */
function emittedTopicIds(content: string): number[] {
  return [...content.matchAll(/--claim_topic (\d+)\b/g)].map((match) => Number(match[1]));
}

/* ------------------------------------------------------------------ *
 * INV-13 — the acceptance oracle
 * ------------------------------------------------------------------ */

/** File paths where the two generations differ, `config.json` excluded. */
function differingFiles(
  path: GeneratePath,
  unselected: ReturnType<typeof topicUnselectedConfig>,
  absent: ReturnType<typeof topicAbsentConfig>
): string[] {
  const left = path.run(unselected).files;
  const right = path.run(absent).files;
  const names = new Set([...Object.keys(left), ...Object.keys(right)]);
  const differing: string[] = [];

  for (const name of names) {
    if (name === CONFIG_JSON) continue;
    const a = left[name];
    const b = right[name];
    if (typeof a === 'string' && typeof b === 'string') {
      if (a !== b) differing.push(name);
      continue;
    }
    if (a === undefined || b === undefined) differing.push(name);
  }

  return differing.sort();
}

describe.each(GENERATE_PATHS)('$name — INV-13 the byte-identity oracle', (path) => {
  it('unselecting a NON-FINAL topic is byte-identical to removing it, on every file but config.json', () => {
    expect(differingFiles(path, topicUnselectedConfig(), topicAbsentConfig())).toEqual([]);
  });

  it('and config.json is the one file that MUST differ, so the exclusion is proved not assumed', () => {
    const unselected = textOf(path.run(topicUnselectedConfig()).files, CONFIG_JSON);
    const absent = textOf(path.run(topicAbsentConfig()).files, CONFIG_JSON);

    expect(unselected).not.toEqual(absent);
    expect(unselected).toContain('"selected": false');
  });

  it('describes the final-position case as vacuous: it passes with the defect present', () => {
    // Kept as a declared control, NOT as coverage. Selected count is 2 either
    // way and the surviving topics sit at indices 0 and 1, so a loop bounded by
    // the COUNT reads exactly the right positions and emits byte-correct output.
    // This assertion therefore passes under the count/index conflation as
    // readily as under the correct projection, which is the whole reason the
    // mandatory instance above unselects a non-final topic.
    //
    // Measured, and it corrects the invariant's phrasing: this case is NOT
    // "passes both before and after the projection change". It failed against
    // the selection-blind generator, because with no filter at all the
    // present-and-false config still emits the unselected topic. Its vacuity is
    // relative to the buggy FILTER, not to the absence of one.
    expect(differingFiles(path, finalTopicUnselectedConfig(), finalTopicAbsentConfig())).toEqual(
      []
    );
  });
});

/* ------------------------------------------------------------------ *
 * INV-14 — the emitted id sequence, at both loop sites
 * ------------------------------------------------------------------ */

describe.each(GENERATE_PATHS)('$name — INV-14 the emitted claim-topic id sequence', (path) => {
  it('deploy.sh emits exactly the selected ids, in order', () => {
    const config = topicUnselectedConfig();
    const content = textOf(path.run(config).files, DEPLOY);

    // [2, 7] — NOT [1, 2], which is what a loop bounded by the selected COUNT
    // over the unfiltered array emits.
    expect(emittedTopicIds(content)).toEqual([...selectedClaimTopicIds(config)]);
    expect(emittedTopicIds(content)).toEqual([2, 7]);
  });

  it('bootstrap-demo-mint.sh allows the demo signing key for exactly the selected ids', () => {
    const config = topicUnselectedConfig();
    const files = path.run(config).files;
    if (!(DEMO_MINT in files)) return; // the base root does not emit it

    const content = textOf(files, DEMO_MINT);

    // Asserted separately from deploy.sh on purpose: this loop bounds on a plain
    // local and has no type-level protection, so deploy.sh being right is not
    // evidence for this file.
    expect(emittedTopicIds(content)).toEqual([...selectedClaimTopicIds(config)]);
    expect(emittedTopicIds(content)).toEqual([2, 7]);
  });

  it('bootstrap-demo-mint.sh signs and registers the demo issuer for exactly the selected ids', () => {
    const files = GENERATE_PATHS[1]?.run(topicUnselectedConfig()).files ?? {};
    const content = textOf(files, DEMO_MINT);

    expect(content).toContain("--claim_topics '[2, 7]'");
    expect(content).toContain('for DEMO_TOPIC in 2 7; do');
    expect(content).not.toContain("--claim_topics '[1, 2, 7]'");
  });
});

/* ------------------------------------------------------------------ *
 * INV-27 — per-line attribution survives the filter
 * ------------------------------------------------------------------ */

describe.each(GENERATE_PATHS)('$name — INV-27 per-line attribution survives the filter', (path) => {
  it('an unselected topic determines no line of deploy.sh', () => {
    // Red before the change for the right reason: topic 1 was emitted, with
    // correct per-line attribution, so ranges existed for it.
    const { provenance } = generateRecorded(path, topicUnselectedConfig());

    expect(rangesForPath(provenance, DEPLOY, 'identityVerification.claimTopics[0].id')).toEqual([]);
    expect(rangesForPath(provenance, DEPLOY, 'identityVerification.claimTopics[0].name')).toEqual(
      []
    );
  });

  it('each selected topic is attributed to its OWN lines and no sibling’s', () => {
    // The detached-object detector. Hoisting a filtered array to the top of the
    // file leaves every `add_claim_topic` line attributed to one read, so one
    // topic's range holds every topic's line.
    const { files, provenance } = generateRecorded(path, topicUnselectedConfig());
    const content = textOf(files, DEPLOY);

    for (const [index, id] of [
      [1, 2],
      [2, 7],
    ] as const) {
      const lines = rangesForPath(
        provenance,
        DEPLOY,
        `identityVerification.claimTopics[${index}].id`
      ).flatMap((range) => sliceRange(content, range));

      expect(lines.join('\n'), `topic ${id}`).toContain(`--claim_topic ${id}`);
      for (const sibling of [2, 7].filter((candidate) => candidate !== id)) {
        expect(lines.join('\n'), `topic ${id} must not hold topic ${sibling}`).not.toContain(
          `--claim_topic ${sibling}`
        );
      }
    }
  });

  it('the determination oracle confirms every claim-topic range it claims', () => {
    // `name` only, and not for want of trying: the id is referenced by the
    // trusted issuer, so moving it alone fails validation and `generate()`
    // throws before the oracle can compare anything. `.id`'s per-line
    // determination is carried by the containment check above and by INV-14's
    // emitted sequence, which are stronger than an oracle pass anyway.
    const reference = topicUnselectedConfig();
    const renamed = (index: number): RWAConfig => ({
      ...reference,
      identityVerification: {
        ...reference.identityVerification,
        claimTopics: reference.identityVerification.claimTopics.map((topic, at) =>
          at === index ? { ...topic, name: `Renamed ${index}` } : topic
        ),
      },
    });

    for (const index of [1, 2]) {
      expect(
        undeterminedRanges(path, reference, `identityVerification.claimTopics[${index}].name`, [
          { label: `claimTopics[${index}] renamed`, config: renamed(index) },
        ])
      ).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ *
 * INV-21 / INV-26 — where the demo-mint gate's new input lands
 *
 * The gate now reads claim topics, and those reads have two possible
 * destinations. One is correct and one is the wrong-looking answer this whole
 * initiative exists to remove, so both are pinned.
 * ------------------------------------------------------------------ */

const IDENTITY_ROOT = GENERATE_PATHS[1];
if (IDENTITY_ROOT === undefined) throw new Error('the identity-support root must be present');

const emittingFixtures = GOLDEN_FIXTURES.filter(
  (fixture) => DEMO_MINT in IDENTITY_ROOT.run(fixture.config).files
);

describe('the demo-mint gate’s claim-topic input', () => {
  it('is exercised by some fixture, so the assertions below are not vacuous', () => {
    expect(emittingFixtures.length).toBeGreaterThan(0);
  });

  it.each(emittingFixtures)('INV-21: puts no path on the shebang: $name', (fixture) => {
    // Corrected behaviour (shebang-line1 round after SF-16): line 1 of
    // `bootstrap-demo-mint.sh` carries no config paths. SF-16 measured that
    // `isDemoAutoMintEligible(builder.config)` called bare drained
    // `deployment.target.*` and `token.initialSupply` onto `#!/bin/bash` via
    // `pending`, pinned "no claim-topic path" so SF-16 could not worsen it, and
    // deferred the four-path repair. The predicate is now `observe`d so those
    // reads attribute to nothing; this pin forbids any path on the shebang —
    // claim-topic or otherwise — not merely "no worse than the old leak".
    const { provenance } = generateRecorded(IDENTITY_ROOT, fixture.config);
    const covering = rangeEntries(provenance, DEMO_MINT).filter(
      (entry) => entry.range.start <= 1 && 1 <= entry.range.end
    );

    expect(covering.flatMap((entry) => entry.paths)).toEqual([]);
  });

  it.each(emittingFixtures)(
    'INV-26: puts them on the file’s created entry, where they belong: $name',
    (fixture) => {
      // The correct destination, and a provenance improvement obtained for free:
      // unselecting the last claim topic removes this file, and the created
      // entry now names the field that did it.
      const { provenance } = generateRecorded(IDENTITY_ROOT, fixture.config);
      const created = createdEntry(provenance, DEMO_MINT);

      expect(created?.paths).toContain('identityVerification.claimTopics');
      // The three pre-existing assertions on this entry still hold.
      expect(created?.paths.some((p) => p.startsWith('token.'))).toBe(true);
      for (const p of created?.paths ?? []) {
        expect(p).not.toMatch(/identitySupport|includeDemoAutoMint/);
      }
    }
  );

  it('gates the file off when every topic is unselected, instead of emitting malformed shell', () => {
    // Also the regression test for a defect that predates selection: with
    // `claimTopics: []` this file was generated with `for DEMO_TOPIC in ; do`.
    const allUnselected = {
      ...topicUnselectedConfig(),
      identityVerification: {
        ...topicUnselectedConfig().identityVerification,
        claimTopics: topicUnselectedConfig().identityVerification.claimTopics.map((topic) => ({
          ...topic,
          selected: false,
        })),
        trustedIssuers: [],
      },
    };

    expect(DEMO_MINT in IDENTITY_ROOT.run(allUnselected).files).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * INV-30 — selection never reaches a chain-projection artefact
 *
 * Anchored on emission positions, with a sanity control that selected topics
 * ARE present. Code Draft's naive "no file names the unselected topic" form
 * has a false positive: `deploy.sh` contains `KYC` in demo-mint guidance prose
 * ("NOT production KYC"), not as a topic name. Weakening to ids-only would
 * silently drop the name half of the property.
 * ------------------------------------------------------------------ */

describe.each(GENERATE_PATHS)('$name — INV-30 selected never reaches a chain artefact', (path) => {
  it('no generated file except config.json carries the token selected', () => {
    const files = path.run(topicUnselectedConfig()).files;
    const offenders: string[] = [];

    for (const [name, content] of Object.entries(files)) {
      if (name === CONFIG_JSON) continue;
      if (typeof content !== 'string') continue;
      if (/\bselected\b/.test(content)) offenders.push(name);
    }

    expect(offenders).toEqual([]);
  });

  it('and config.json DOES carry selected: false, so the exclusion is not vacuous', () => {
    // Watch the absence assertion's complement. A sweep that never saw the
    // token anywhere — including config.json — would pass the row above by
    // generating nothing interesting.
    expect(textOf(path.run(topicUnselectedConfig()).files, CONFIG_JSON)).toContain(
      '"selected": false'
    );
  });

  it('anchors the unselected topic’s id and name on emission positions, not prose', () => {
    const files = path.run(topicUnselectedConfig()).files;
    const content = textOf(files, DEPLOY);

    // Sanity: selected topics ARE emitted, so the check cannot pass by
    // generating an empty claim-topic block.
    expect(emittedTopicIds(content)).toEqual([2, 7]);
    expect(content).toContain('Claim topic 2 (AML)');
    expect(content).toContain('Claim topic 7 (Accredited Investor)');

    // Anchored absences — the positions an unselected topic would occupy under
    // a selection-blind generator. `KYC` may still appear in "NOT production
    // KYC" guidance prose on the identity-support root; that is not a
    // topic-name emission and must not fail this.
    expect(content).not.toContain('--claim_topic 1');
    expect(content).not.toContain('Claim topic 1 (KYC)');
    expect(content).not.toMatch(/--claim_topics '\[[^\]]*\b1\b[^\]]*\]'/);
  });

  it('and the KYC-in-prose false positive is real on the identity-support root', () => {
    // Code Draft Finding 5: a naive "no generated file names the unselected
    // topic" assertion fails on `deploy.sh` because the string `KYC` appears in
    // demo-mint guidance — "NOT production KYC" — not as a topic name. The
    // anchored form above keeps the name check; this row proves the prose is
    // present so weakening to ids-only would be an unforced retreat.
    if (path.name !== 'generate-with-identity-support') return;

    const content = textOf(path.run(topicUnselectedConfig()).files, DEPLOY);
    expect(content).toMatch(/NOT production KYC/);
    // And the naive form WOULD fail here — recorded so nobody "simplifies" the
    // anchored check back into a whole-file name scan.
    expect(content).toContain('KYC');
    expect(content).not.toContain('Claim topic 1 (KYC)');
  });

  it('and the same emission-position absences hold on bootstrap-demo-mint.sh when present', () => {
    const files = path.run(topicUnselectedConfig()).files;
    if (!(DEMO_MINT in files)) return;

    const content = textOf(files, DEMO_MINT);
    expect(emittedTopicIds(content)).toEqual([2, 7]);
    expect(content).toContain('for DEMO_TOPIC in 2 7; do');
    expect(content).toContain("--claim_topics '[2, 7]'");
    expect(content).not.toContain('--claim_topic 1');
    expect(content).not.toContain("--claim_topics '[1, 2, 7]'");
    expect(content).not.toContain('for DEMO_TOPIC in 1 2 7; do');
  });
});

/* ------------------------------------------------------------------ *
 * INV-31 — config.json keeps the full list; export → import → generate
 * is byte-identical on every file
 * ------------------------------------------------------------------ */

describe.each(GENERATE_PATHS)('$name — INV-31 config.json round trip', (path) => {
  it('config.json carries every defined topic, including the unselected one', () => {
    const snapshot = JSON.parse(textOf(path.run(topicUnselectedConfig()).files, CONFIG_JSON)) as {
      identityVerification: { claimTopics: Array<{ id: number; selected?: boolean }> };
    };

    expect(snapshot.identityVerification.claimTopics.map((topic) => topic.id)).toEqual([1, 2, 7]);
    expect(snapshot.identityVerification.claimTopics[0]).toEqual(
      expect.objectContaining({ id: 1, selected: false })
    );
    // Omit-when-true: selected topics do not spell the field out.
    expect(snapshot.identityVerification.claimTopics[1]).not.toHaveProperty('selected');
    expect(snapshot.identityVerification.claimTopics[2]).not.toHaveProperty('selected');
  });

  it('export → import → generate reproduces byte-identical output on every file', () => {
    const original = topicUnselectedConfig();
    const first = path.run(original).files;
    const imported = JSON.parse(textOf(first, CONFIG_JSON)) as RWAConfig;
    const second = path.run(imported).files;

    // The topic that was defined-but-unselected is still defined and still
    // unselected after the round trip — Spec AS-1.
    expect(imported.identityVerification.claimTopics[0]?.selected).toBe(false);
    expect(imported.identityVerification.claimTopics.map((topic) => topic.id)).toEqual([1, 2, 7]);

    const names = new Set([...Object.keys(first), ...Object.keys(second)]);
    const differing: string[] = [];
    for (const name of names) {
      if (first[name] !== second[name]) differing.push(name);
    }
    expect(differing).toEqual([]);
  });
});
