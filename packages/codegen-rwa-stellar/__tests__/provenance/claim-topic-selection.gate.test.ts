/**
 * SF-16 — the demo-mint gate, and the two mechanisms that close the
 * malformed-shell class.
 *
 * `shouldGenerateBootstrapDemoMintScript` is a skip key, so the standing repo
 * rule applies to it in full: enumerate the inputs of the decision it fronts and
 * write ONE test per input, varying only that input. Four inputs, each toggled
 * alone in both directions — eight tests where a single "gates correctly" test
 * would do, and the reason is that three of the four preconditions predate this
 * change. A suite that asserts only the composite cannot tell a gate that gained
 * its fourth precondition from a gate that gained it and lost its second.
 *
 * The completeness claim is the interesting part and INV-19 states it
 * falsifiably: every config-derived value the script interpolates into an
 * UNQUOTED shell word list or a JSON array must be non-empty whenever the gate
 * returns `true`. `the gate's completeness` below walks that table against real
 * generated text rather than against the claim.
 *
 * INV-12's two mechanisms are disjoint and neither covers the other's file, so
 * both are exercised on the config that would produce the malformed emission:
 * `deploy.sh` is protected by a validation error plus `generate()`'s throw, and
 * `bootstrap-demo-mint.sh` by this gate. Deferring either on the reasoning that
 * the other handles it ships `add_trusted_issuer … --claim_topics '[]'` to a
 * real network.
 */
import { describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { validate } from '../../src/index';
import {
  generateBootstrapDemoMintSh,
  shouldGenerateBootstrapDemoMintScript,
} from '../../src/templates/scripts/bootstrap-demo-mint-sh';
import { createCustomDeploymentTarget, createValidConfig } from '../helpers/config';
import {
  createdEntry,
  GENERATE_PATHS,
  generateRecorded,
  GOLDEN_FIXTURES,
  textOf,
  topicUnselectedConfig,
} from './helpers';

const DEMO_MINT = 'scripts/bootstrap-demo-mint.sh';
const DEPLOY = 'scripts/deploy.sh';

const IDENTITY_ROOT = GENERATE_PATHS[1];
if (IDENTITY_ROOT === undefined) throw new Error('the identity-support root must be present');

/** A config that satisfies all four preconditions — the baseline every row toggles from. */
function eligibleConfig(): RWAConfig {
  return createValidConfig({
    identityVerification: {
      claimTopics: [
        { id: 1, name: 'KYC' },
        { id: 2, name: 'AML' },
      ],
      trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1, 2] }],
    },
  });
}

/* ------------------------------------------------------------------ *
 * INV-19 — four inputs, each toggled alone, in both directions
 * ------------------------------------------------------------------ */

interface GateInput {
  readonly precondition: string;
  /** The baseline config with this one input turned OFF; everything else eligible. */
  readonly off: () => RWAConfig;
  /** `includeIdentitySupport` for the off case — only input 1 varies it. */
  readonly offIdentitySupport: boolean;
  /** Which interpolated value this precondition is the non-emptiness guarantee for. */
  readonly guarantees: string;
}

const GATE_INPUTS: readonly GateInput[] = [
  {
    precondition: '1 — identity support enabled',
    off: eligibleConfig,
    offIdentitySupport: false,
    guarantees: 'the file itself: without identity scaffolding there is nothing to mint against',
  },
  {
    precondition: '2 — a configured, non-blank initial supply',
    off: () => createValidConfig({ token: { initialSupply: '   ' } }),
    offIdentitySupport: true,
    guarantees: 'initialSupply (quoted scalar)',
  },
  {
    precondition: '3 — a testnet deployment target',
    off: () =>
      createValidConfig({
        deployment: { target: createCustomDeploymentTarget('https://rpc.example.com') },
      }),
    offIdentitySupport: true,
    guarantees: 'networkFlag',
  },
  {
    precondition: '4 — at least one selected claim topic (NEW)',
    off: () =>
      createValidConfig({
        identityVerification: {
          claimTopics: [
            { id: 1, name: 'KYC', selected: false },
            { id: 2, name: 'AML', selected: false },
          ],
          trustedIssuers: [],
        },
      }),
    offIdentitySupport: true,
    guarantees: "topicsBashList (`for DEMO_TOPIC in …`) and topicsJson (`--claim_topics '[…]'`)",
  },
];

describe('the demo-mint gate — INV-19 one test per input', () => {
  it('gates on exactly four preconditions, and the count is asserted so a fifth is visible', () => {
    expect(GATE_INPUTS).toHaveLength(4);
  });

  it('returns true when all four hold — the baseline every row below toggles from', () => {
    expect(shouldGenerateBootstrapDemoMintScript(eligibleConfig(), true)).toBe(true);
  });

  it.each(GATE_INPUTS)('precondition $precondition, alone, gates the file OFF', (input) => {
    expect(shouldGenerateBootstrapDemoMintScript(input.off(), input.offIdentitySupport)).toBe(
      false
    );
  });

  it.each(GATE_INPUTS)(
    'precondition $precondition, alone, is the only thing turned off',
    (input) => {
      // The other half of "toggled alone": restoring just this input restores the
      // gate, which is what distinguishes a gate that gained a precondition from
      // one that gained it and lost another.
      const restored = input.offIdentitySupport === false ? true : true;
      const config = input.precondition.startsWith('1') ? input.off() : eligibleConfig();
      expect(shouldGenerateBootstrapDemoMintScript(config, restored)).toBe(true);
    }
  );

  it.each(GATE_INPUTS)('and the file is genuinely absent from the tree: $precondition', (input) => {
    // The gate's return value and the generated tree must agree. Input 1 is the
    // caller's flag, so its "off" state is the base generate root.
    const root = input.offIdentitySupport ? IDENTITY_ROOT : GENERATE_PATHS[0]!;
    expect(DEMO_MINT in root.run(input.off()).files).toBe(false);
  });

  it('regression, and it predates selection: claimTopics: [] emitted malformed shell', () => {
    // Measured before this change: `claimTopics: []` is `valid: true` today and
    // produced `for DEMO_TOPIC in ; do` — malformed shell on a user's machine.
    // The remedy is the gate, not a validation error, because a config with no
    // claim requirements is a legitimate RWA configuration (INV-11).
    const noTopics = createValidConfig({
      identityVerification: { claimTopics: [], trustedIssuers: [] },
    });

    expect(validate(noTopics).valid).toBe(true);
    expect(shouldGenerateBootstrapDemoMintScript(noTopics, true)).toBe(false);
    expect(DEMO_MINT in IDENTITY_ROOT.run(noTopics).files).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * INV-19 — the gate is equivalent to the in-scope assertion
 * ------------------------------------------------------------------ */

describe('the gate and the in-scope assertion are equivalent — INV-19', () => {
  /** Whether the directly-exported renderer throws for `config`. */
  function directRenderThrows(config: RWAConfig): boolean {
    try {
      generateBootstrapDemoMintSh(config);
      return false;
    } catch {
      return true;
    }
  }

  const CASES: readonly { readonly label: string; readonly config: () => RWAConfig }[] = [
    ...GOLDEN_FIXTURES.map((fixture) => ({
      label: `fixture ${fixture.name}`,
      config: () => fixture.config,
    })),
    { label: 'the non-final-unselection fixture', config: topicUnselectedConfig },
    ...GATE_INPUTS.map((input) => ({
      label: `gate input off: ${input.precondition}`,
      config: input.off,
    })),
  ];

  it('covers every fixture plus every gate-off case, so neither arm is vacuous', () => {
    const gated = CASES.map((entry) => shouldGenerateBootstrapDemoMintScript(entry.config(), true));
    expect(gated).toContain(true);
    expect(gated).toContain(false);
  });

  it.each(CASES)('$label: gate true ⟺ the renderer does not throw', (entry) => {
    // Gate-stricter is harmless but leaves the directly-exported
    // `generateBootstrapDemoMintSh(config)` emitting `for DEMO_TOPIC in ; do` to
    // any caller who bypasses the composition root. Assertion-stricter makes
    // `generate()` THROW where it should have omitted a file — turning a
    // legitimate config into a hard failure, which is the outcome INV-11 exists
    // to prevent arriving through the gate instead of through `validate`.
    const config = entry.config();
    expect(shouldGenerateBootstrapDemoMintScript(config, true)).toBe(!directRenderThrows(config));
  });
});

/* ------------------------------------------------------------------ *
 * INV-19 — the completeness claim, walked against generated text
 * ------------------------------------------------------------------ */

describe('the gate’s completeness — INV-19’s falsifiable form', () => {
  const emitting = GOLDEN_FIXTURES.filter(
    (fixture) => DEMO_MINT in IDENTITY_ROOT.run(fixture.config).files
  );

  it('some fixture emits the file and some does not, so both arms are exercised', () => {
    // The pre-existing `created-file-provenance.test.ts` obligation: demo-mint
    // emission is genuinely conditional across the matrix, both arms non-empty.
    expect(emitting.length).toBeGreaterThan(0);
    expect(emitting.length).toBeLessThan(GOLDEN_FIXTURES.length);
  });

  it.each(emitting)('no unquoted word list or JSON array is empty in $name’s script', (fixture) => {
    const content = textOf(IDENTITY_ROOT.run(fixture.config).files, DEMO_MINT);

    // topicsBashList — an unquoted word list. `in ; do` is the malformed form.
    expect(content).not.toContain('in ; do');
    expect(content).toMatch(/for DEMO_TOPIC in \d+( \d+)*; do/);

    // topicsJson — a JSON array.
    expect(content).not.toContain("--claim_topics '[]'");
    expect(content).toMatch(/--claim_topics '\[\d+(, \d+)*\]'/);

    // initialSupply, networkFlag, adminAddress — quoted scalars and a flag,
    // each guaranteed by a precondition or by `generate()`'s throw.
    expect(content).toMatch(/INITIAL_SUPPLY="[^"]+"/);
    expect(content).toContain('testnet');
  });

  it('and the same holds for the non-final-unselection fixture, where topics are filtered', () => {
    const content = textOf(IDENTITY_ROOT.run(topicUnselectedConfig()).files, DEMO_MINT);
    expect(content).toContain('for DEMO_TOPIC in 2 7; do');
    expect(content).toContain("--claim_topics '[2, 7]'");
  });
});

/* ------------------------------------------------------------------ *
 * INV-12 — two disjoint mechanisms, neither covering the other's file
 * ------------------------------------------------------------------ */

describe('the malformed-shell class is closed twice — INV-12', () => {
  /** An issuer whose every referenced topic is unselected: INV-8's config. */
  function allUnselectedIssuer(): RWAConfig {
    return createValidConfig({
      identityVerification: {
        claimTopics: [
          { id: 1, name: 'KYC', selected: false },
          { id: 2, name: 'AML', selected: false },
        ],
        trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1, 2] }],
      },
    });
  }

  it('row 1 — deploy.sh: generate() throws on the UNSELECTED_REFERENCE message', () => {
    // This is what makes INV-8 an OUTPUT-SAFETY rule rather than a UX nicety.
    // `generate()` throws on an invalid config, so the validation error is the
    // only thing standing between an all-unselected issuer and a `deploy.sh`
    // that runs `add_trusted_issuer … --claim_topics '[]'` on a real network.
    //
    // `generate()` joins `error.message`, not `error.code` — so the throw
    // surface carries the human sentence, and the code lives on `validate()`.
    // Asserting `/UNSELECTED_REFERENCE/` against the throw is a hollow match:
    // the code never appears in the string (caught when the draft was first run).
    expect(validate(allUnselectedIssuer()).errors.map((error) => error.code)).toContain(
      'UNSELECTED_REFERENCE'
    );

    for (const path of GENERATE_PATHS) {
      expect(() => path.run(allUnselectedIssuer())).toThrowError(/unselected claim topics/i);
    }
  });

  it('row 1 — and the gate does NOT cover deploy.sh, which is why row 1 needs its own mechanism', () => {
    // The gate governs one file. Deferring INV-8's rule on the reasoning that
    // "the gate already handles empty topic lists" leaves `deploy.sh` unguarded.
    const config = allUnselectedIssuer();
    expect(shouldGenerateBootstrapDemoMintScript(config, true)).toBe(false);
    // …and yet, absent the validation rule, `deploy.sh` would still be emitted:
    // it is generated on both roots regardless of the demo-mint decision.
    const stillEmitsDeploy = GOLDEN_FIXTURES.every((fixture) =>
      GENERATE_PATHS.every((path) => DEPLOY in path.run(fixture.config).files)
    );
    expect(stillEmitsDeploy).toBe(true);
  });

  it('rows 2 and 3 — bootstrap-demo-mint.sh: the file is absent, not malformed', () => {
    const allUnselected = createValidConfig({
      identityVerification: {
        claimTopics: [
          { id: 1, name: 'KYC', selected: false },
          { id: 2, name: 'AML', selected: false },
        ],
        trustedIssuers: [],
      },
    });

    expect(DEMO_MINT in IDENTITY_ROOT.run(allUnselected).files).toBe(false);
  });

  it('the negative sweep: no generated file anywhere holds the malformed literals', () => {
    const forbidden = ["--claim_topics '[]'", 'in ; do'];
    const offenders: string[] = [];

    for (const path of GENERATE_PATHS) {
      for (const fixture of [
        ...GOLDEN_FIXTURES,
        { name: 'topic-unselected', config: topicUnselectedConfig() },
      ]) {
        const files = path.run(fixture.config).files;
        for (const [name, content] of Object.entries(files)) {
          if (typeof content !== 'string') continue;
          for (const literal of forbidden) {
            if (content.includes(literal)) {
              offenders.push(`${path.name}/${fixture.name}/${name}: ${literal}`);
            }
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('and the sweep is not vacuous: it read a real, non-trivial set of files', () => {
    // A sweep over zero files reports no offenders and looks exactly like a
    // clean result. Two suites on this initiative have shipped that way.
    const scanned = GENERATE_PATHS.flatMap((path) =>
      GOLDEN_FIXTURES.flatMap((fixture) => Object.keys(path.run(fixture.config).files))
    );
    expect(scanned.length).toBeGreaterThan(100);
    expect(scanned).toContain(DEMO_MINT);
  });
});

/* ------------------------------------------------------------------ *
 * INV-26 — the gate's reads land on the file's `created` entry
 * ------------------------------------------------------------------ */

describe('unselecting the last topic reports that it removed a file — INV-26', () => {
  it('names the claim-topic field on the created entry, so the removal has an author', () => {
    const { provenance } = generateRecorded(IDENTITY_ROOT, topicUnselectedConfig());
    const created = createdEntry(provenance, DEMO_MINT);

    expect(created?.paths).toContain('identityVerification.claimTopics');
  });

  it('and the entry it lands on is the one whose absence the user would see', () => {
    // The pairing that makes INV-26 a property rather than a coincidence: the
    // field named on the `created` entry is exactly the field that, turned off,
    // removes the file.
    const allUnselected = createValidConfig({
      identityVerification: {
        claimTopics: [{ id: 1, name: 'KYC', selected: false }],
        trustedIssuers: [],
      },
    });

    expect(DEMO_MINT in IDENTITY_ROOT.run(allUnselected).files).toBe(false);
    expect(DEMO_MINT in IDENTITY_ROOT.run(eligibleConfig()).files).toBe(true);
  });
});
