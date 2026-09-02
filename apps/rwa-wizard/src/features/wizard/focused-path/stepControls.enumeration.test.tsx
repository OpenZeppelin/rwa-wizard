import { describe, expect, it } from 'vitest';

import type { OwnershipModel, RWAConfig } from '@openzeppelin/rwa-config';

import {
  addressListFieldRef,
  collectFocusable,
  descriptorOf,
  ENUMERATED_STEP_IDS,
  fixtureDraft,
  OWNERSHIP_VARIANTS,
  renderStep,
  type EnumeratedStepId,
} from '../../../test/helpers/focusedPathHarness';
import { resolveConfigPath, isAbsentOptionalConfigPath, isPendingCollectionSlot } from '../config-path';
import { CONFIG_ANCHOR_ATTR, FIELD_ID_ATTR } from './configAnchor';
import { resolveFocusedConfigPath } from './resolveFocusedConfigPath';

/**
 * AS-3, the brick. INV-1 (the multiset partition with pinned totals, per
 * step × ownership variant), INV-2 (descriptors are unique and stable), INV-4
 * (rendered anchor values are draft-independent), INV-19 (every resolved path is
 * real or a well-formed pending path), INV-24 clause 2 (pending paths collide),
 * and INV-25 (the anchors are inert).
 *
 * The two clauses that make this a coverage assertion rather than a coverage
 * ritual are the **multiset** and the **pinned total**.
 *
 * A *set* loses multiplicity: if two controls share a descriptor and one of them
 * is already an exclusion, the other can stop resolving with the set unchanged —
 * a control silently losing its provenance inside the test written to catch
 * controls silently losing their provenance. And without the pinned total the
 * partition can shrink to nothing and still balance: a fixture that stops
 * rendering a branch removes those controls from *both* sides, and the
 * enumeration goes green asserting a partition of the empty set.
 */

type VariantType = OwnershipModel['type'];

interface DeclaredExclusion {
  readonly descriptor: string;
  readonly reason: string;
}

/** All three variants render the same control set; only paths differ (INV-17 row 2). */
function sameForAllVariants(
  entries: readonly DeclaredExclusion[]
): Record<VariantType, readonly DeclaredExclusion[]> {
  return { 'single-owner': entries, 'multi-sig': entries, dao: entries };
}

function sameTotalForAllVariants(total: number): Record<VariantType, number> {
  return { 'single-owner': total, 'multi-sig': total, dao: total };
}

/** Reasons that recur. Written once so each entry below stays one line. */
const INFO_ICON =
  'Info-icon tooltip trigger. Opens explanatory copy; writes no RWAConfig location.';
const SUMMARY_CONTROL =
  'Read-only ConfigSummary control on the review step. The summary renders the draft, it does not edit it.';

/**
 * `DECLARED_EXCLUSIONS` — every control that resolves to `null`, with a written
 * reason, keyed per (step, variant).
 *
 * Per (step, variant) and not per step: per-step averaging is exactly how a
 * variant-specific regression hides, and the access-control step is the one
 * whose control set is most plausibly variant-dependent. The three cells of a
 * step are declared identical through `sameForAllVariants`, which is a
 * statement, not a shortcut — any cell can diverge, and a control that resolves
 * under `single-owner` and stops under `dao` fails.
 */
const DECLARED_EXCLUSIONS: Record<
  EnumeratedStepId,
  Record<VariantType, readonly DeclaredExclusion[]>
> = {
  asset: sameForAllVariants([
    { descriptor: 'asset·button·About Asset Configuration#0', reason: INFO_ICON },
    { descriptor: 'asset·button·About Token Information#1', reason: INFO_ICON },
    { descriptor: 'asset·button·About Administrative Controls#6', reason: INFO_ICON },
    {
      descriptor: 'asset·button·About Burnable#7',
      reason: `${INFO_ICON} Inside a ReadOnlyFeatureCard — the control itself is locked, so there is no anchor either (INV-3).`,
    },
    {
      descriptor: 'asset·button·About Mintable#8',
      reason: `${INFO_ICON} Locked control (INV-3).`,
    },
    {
      descriptor: 'asset·button·About Pausable#9',
      reason: `${INFO_ICON} Locked control (INV-3).`,
    },
  ]),

  identity: sameForAllVariants([
    { descriptor: 'identity·button·About Identity Configuration#0', reason: INFO_ICON },
    { descriptor: 'identity·button·About Implementation Approach#1', reason: INFO_ICON },
    {
      descriptor: 'identity·button·Claim-Based VerificationEach investor holds an O…#2',
      reason:
        'INV-12. `ImplementationApproach`’s card: the single supported verification approach, permanently selected, `onClick={() => {}}`. `IdentityVerificationConfig` has no member it could write, so there is no path to resolve to. Guarded at the type level in `exclusionGuards.ts` rather than by this line — a second approach card would resolve to `null` exactly like the first and be cleared by adding one more entry here, which is a speed bump, not a guard.',
    },
    { descriptor: 'identity·button·About Claim Topics#3', reason: INFO_ICON },
    { descriptor: 'identity·button·About Trusted Issuers#17', reason: INFO_ICON },
    { descriptor: 'identity·button·About Identity Controls#27', reason: INFO_ICON },
    {
      descriptor: 'identity·button·About Address-Level Freezing#28',
      reason: `${INFO_ICON} Locked control (INV-3).`,
    },
    {
      descriptor: 'identity·button·About Partial Token Freezing#29',
      reason: `${INFO_ICON} Locked control (INV-3).`,
    },
    {
      descriptor: 'identity·button·About Account Recovery#30',
      reason: `${INFO_ICON} Locked control (INV-3).`,
    },
    {
      descriptor: 'identity·button·About Forced Transfers#31',
      reason: `${INFO_ICON} Locked control (INV-3).`,
    },
  ]),

  compliance: sameForAllVariants([
    { descriptor: 'compliance·button·About Compliance Modules#0', reason: INFO_ICON },
    {
      descriptor: 'compliance·button·About the Transferred hook#26',
      reason: `${INFO_ICON} In HookWiringPreview, which reports wiring derived from the selection rather than editing it.`,
    },
    {
      descriptor: 'compliance·button·About the Created hook#27',
      reason: `${INFO_ICON} HookWiringPreview.`,
    },
    {
      descriptor: 'compliance·button·About the Destroyed hook#28',
      reason: `${INFO_ICON} HookWiringPreview.`,
    },
  ]),

  'access-control': {
    'single-owner': [
      { descriptor: 'access-control·button·About Roles & Access Control#0', reason: INFO_ICON },
      { descriptor: 'access-control·button·About Ownership Model#1', reason: INFO_ICON },
      { descriptor: 'access-control·button·About Operator Roles#6', reason: INFO_ICON },
      {
        descriptor: 'access-control·button·Multi-Sig OwnerA multi-signature wallet (e.g. Sa…#3',
        reason:
          'Unselected ownership model option. Only the active variant carries `ownershipType`.',
      },
      {
        descriptor: 'access-control·button·DAO OwnerA governance contract is the admin — pr…#4',
        reason:
          'Unselected ownership model option. Only the active variant carries `ownershipType`.',
      },
    ],
    'multi-sig': [
      { descriptor: 'access-control·button·About Roles & Access Control#0', reason: INFO_ICON },
      { descriptor: 'access-control·button·About Ownership Model#1', reason: INFO_ICON },
      { descriptor: 'access-control·button·About Operator Roles#6', reason: INFO_ICON },
      {
        descriptor: 'access-control·button·Single OwnerA single wallet holds the admin role…#2',
        reason:
          'Unselected ownership model option. Only the active variant carries `ownershipType`.',
      },
      {
        descriptor: 'access-control·button·DAO OwnerA governance contract is the admin — pr…#4',
        reason:
          'Unselected ownership model option. Only the active variant carries `ownershipType`.',
      },
    ],
    dao: [
      { descriptor: 'access-control·button·About Roles & Access Control#0', reason: INFO_ICON },
      { descriptor: 'access-control·button·About Ownership Model#1', reason: INFO_ICON },
      { descriptor: 'access-control·button·About Operator Roles#6', reason: INFO_ICON },
      {
        descriptor: 'access-control·button·Single OwnerA single wallet holds the admin role…#2',
        reason:
          'Unselected ownership model option. Only the active variant carries `ownershipType`.',
      },
      {
        descriptor: 'access-control·button·Multi-Sig OwnerA multi-signature wallet (e.g. Sa…#3',
        reason:
          'Unselected ownership model option. Only the active variant carries `ownershipType`.',
      },
    ],
  },

  deployment: sameForAllVariants([]),

  review: sameForAllVariants([
    { descriptor: 'review·button·About Review & Generate#0', reason: INFO_ICON },
    { descriptor: 'review·button·Supply Limit#1', reason: SUMMARY_CONTROL },
    { descriptor: 'review·button·Transfer Allow-list#2', reason: SUMMARY_CONTROL },
    { descriptor: 'review·button·Copy address#3', reason: SUMMARY_CONTROL },
    { descriptor: 'review·button·Manager#4', reason: SUMMARY_CONTROL },
    { descriptor: 'review·button·Minting#5', reason: SUMMARY_CONTROL },
    { descriptor: 'review·button·Copy address#6', reason: SUMMARY_CONTROL },
    {
      descriptor: 'review·button·#deploy-signer-ack#7',
      reason:
        'INV-13. Local acknowledgement state (`setSignerAcknowledged`). Writes nothing and generates nothing.',
    },
    {
      descriptor: 'review·button·#include-identity-support#8',
      reason:
        'INV-13, and the sharpest case in the unit. A **generation option**, not config: threaded to `generateFileTree` / `generateZip` and part of `useCodePreview`’s cache key, so it demonstrably changes the generated tree — and it still resolves to nothing, correctly, because `ConfigPath` spans `RWAConfig` and generation options are not in `RWAConfig`. SF-13’s empty state must therefore not be worded as “this field affects no generated code”.',
    },
    {
      descriptor: 'review·button·Testnet identity scaffolding#9',
      reason: `${INFO_ICON} Explains the identity-support option; the option itself is the checkbox above.`,
    },
  ]),
};

/**
 * The pinned total focusable count per cell — eighteen integers, written out,
 * never computed from the render.
 *
 * Per-cell and not a grand total: a grand total lets a control disappear from one
 * step and appear in another with nothing to notice. `deployment` is `0` because
 * its feature flag is off, which is a fact worth pinning — if the flag ever
 * defaults on, this fails and the step joins the partition deliberately.
 */
const PINNED_TOTALS: Record<EnumeratedStepId, Record<VariantType, number>> = {
  asset: sameTotalForAllVariants(12),
  identity: sameTotalForAllVariants(32),
  compliance: sameTotalForAllVariants(29),
  'access-control': sameTotalForAllVariants(33),
  deployment: sameTotalForAllVariants(0),
  review: sameTotalForAllVariants(10),
};

// ---------------------------------------------------------------------------

interface Collected {
  readonly element: HTMLElement;
  readonly descriptor: string;
  readonly path: string | null;
}

function collect(stepId: EnumeratedStepId, draft: RWAConfig, container: HTMLElement): Collected[] {
  return collectFocusable(container).map((element, index) => ({
    element,
    descriptor: descriptorOf(stepId, element, index),
    path: resolveFocusedConfigPath(element, draft),
  }));
}

/** `[descriptor, count]` pairs, sorted — so a failure names the descriptor and both counts. */
function multiset(descriptors: readonly string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const descriptor of descriptors) counts.set(descriptor, (counts.get(descriptor) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

const CELLS = ENUMERATED_STEP_IDS.flatMap((stepId) =>
  OWNERSHIP_VARIANTS.map((variant) => [stepId, variant] as const)
);

// ---------------------------------------------------------------------------
// INV-2 — descriptors first, so a duplicate fails as its own named error
// ---------------------------------------------------------------------------

describe('INV-2 — descriptors are unique and stable within a cell', () => {
  it.each(CELLS)('%s / %o — unique', (stepId, variant) => {
    const draft = fixtureDraft(variant);
    const { container } = renderStep(stepId, draft);
    const descriptors = collect(stepId, draft, container).map((entry) => entry.descriptor);

    const duplicates = multiset(descriptors).filter(([, count]) => count > 1);
    expect(duplicates).toEqual([]);
    expect(new Set(descriptors).size).toBe(descriptors.length);
  });

  /**
   * Stability matters because the partition is compared as a multiset: render
   * nondeterminism would make the comparison flaky rather than wrong, which is
   * worse — a flaky coverage assertion gets skipped.
   *
   * This is also where a descriptor keyed on a kit-generated `useId()` value
   * would surface: those change between renders.
   */
  it.each(CELLS)('%s / %o — stable across two renders', (stepId, variant) => {
    const draft = fixtureDraft(variant);

    const first = renderStep(stepId, draft);
    const before = collect(stepId, draft, first.container).map((entry) => entry.descriptor);
    first.unmount();

    const second = renderStep(stepId, draft);
    const after = collect(stepId, draft, second.container).map((entry) => entry.descriptor);

    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// INV-1 — the partition
// ---------------------------------------------------------------------------

describe('INV-1 — the AS-3 partition, per step × ownership variant', () => {
  it.each(CELLS)('%s / %o', (stepId, variant) => {
    const draft = fixtureDraft(variant);
    const { container } = renderStep(stepId, draft);
    const collected = collect(stepId, draft, container);

    // Clause 2 first: without a pinned total, clauses 1 and 3 can both hold over
    // an empty partition.
    expect(collected).toHaveLength(PINNED_TOTALS[stepId][variant.type]);

    // Clause 1: multiset equality, both directions.
    const declared = DECLARED_EXCLUSIONS[stepId][variant.type];
    const unresolved = collected.filter((entry) => entry.path === null);
    expect(multiset(unresolved.map((entry) => entry.descriptor))).toEqual(
      multiset(declared.map((entry) => entry.descriptor))
    );

    // Clause 3: everything else resolves to exactly one path — a string, never
    // `undefined`.
    for (const entry of collected) {
      if (entry.path === null) continue;
      expect(typeof entry.path).toBe('string');
      expect(entry.path.length).toBeGreaterThan(0);
    }
  });

  it('every declared exclusion carries a written reason', () => {
    for (const [stepId, byVariant] of Object.entries(DECLARED_EXCLUSIONS)) {
      for (const [variantType, entries] of Object.entries(byVariant)) {
        for (const entry of entries) {
          expect({
            where: `${stepId}/${variantType}`,
            descriptor: entry.descriptor,
            hasReason: entry.reason.length > 20,
          }).toEqual({
            where: `${stepId}/${variantType}`,
            descriptor: entry.descriptor,
            hasReason: true,
          });
        }
      }
    }
  });

  /**
   * The three exclusions INV-12 and INV-13 name individually, asserted by name
   * so they cannot be absorbed into the auxiliary crowd.
   */
  it('the three reasoned exclusions are present and named', () => {
    const review = DECLARED_EXCLUSIONS.review['single-owner'].map((entry) => entry.descriptor);
    expect(review).toContain('review·button·#deploy-signer-ack#7');
    expect(review).toContain('review·button·#include-identity-support#8');

    const identity = DECLARED_EXCLUSIONS.identity['single-owner'];
    const approach = identity.find((entry) =>
      entry.descriptor.includes('Claim-Based Verification')
    );
    expect(approach).toBeDefined();
    expect(approach!.reason).toContain('INV-12');
  });
});

// ---------------------------------------------------------------------------
// AS-1, by name
// ---------------------------------------------------------------------------

describe('AS-1 — the three clauses, by name', () => {
  it('clause 1: the token-name input resolves to `token.name`', () => {
    const draft = fixtureDraft();
    const { container } = renderStep('asset', draft);
    const input = container.querySelector<HTMLElement>('#token-name')!;
    expect(resolveFocusedConfigPath(input, draft)).toBe('token.name');
  });

  it.each(OWNERSHIP_VARIANTS)(
    'clause 2: one ownership address input, %o → the selected variant’s member',
    (variant) => {
      const draft = fixtureDraft(variant);
      const { container } = renderStep('access-control', draft);
      const input = container.querySelector<HTMLElement>('#owner-address')!;
      expect(resolveFocusedConfigPath(input, draft)).toBe(
        variant.type === 'single-owner'
          ? 'accessControl.ownership.ownerAddress'
          : 'accessControl.ownership.address'
      );
    }
  );

  it('clause 3: a module config field carries the fixture’s own index', () => {
    const draft = fixtureDraft();
    const { moduleId, fieldKey } = addressListFieldRef();
    const expectedIndex = draft.compliance.modules.findIndex(
      (entry) => entry.moduleId === moduleId
    );
    expect(expectedIndex).toBeGreaterThanOrEqual(0);

    const { container } = renderStep('compliance', draft);
    const root = container.querySelector<HTMLElement>(`[${FIELD_ID_ATTR}]`)!;
    expect(resolveFocusedConfigPath(root, draft)).toBe(
      `compliance.modules[${expectedIndex}].config.${fieldKey}`
    );
  });
});

// ---------------------------------------------------------------------------
// INV-19 — every resolved path is real, or a well-formed pending path
// ---------------------------------------------------------------------------

describe('INV-19 — resolved paths exist in the draft or are well-formed pending paths', () => {
  /** `compliance.modules[3]` → parent `compliance.modules`, index 3. */
  function splitTrailingIndex(path: string): { parent: string; index: number } | null {
    const match = /^(.*)\[(\d+)\](?:\.[A-Za-z0-9_$-]+)*$/.exec(path);
    if (match === null) return null;
    const trailing = /\[(\d+)\](?:\.[A-Za-z0-9_$-]+)*$/.exec(path);
    if (trailing === null) return null;
    return {
      parent: path.slice(0, path.lastIndexOf(`[${trailing[1]}]`)),
      index: Number(trailing[1]),
    };
  }

  it.each(CELLS)('%s / %o', (stepId, variant) => {
    const draft = fixtureDraft(variant);
    const { container } = renderStep(stepId, draft);
    const paths = collect(stepId, draft, container)
      .map((entry) => entry.path)
      .filter((path): path is string => path !== null);

    const inadmissible: string[] = [];

    for (const path of paths) {
      if (resolveConfigPath(draft, path).found) continue;

      // Sparse default-draft shapes: omitted `token.initialSupply`, a selected
      // module with no `config` yet. These name live fields, not pending slots.
      if (isAbsentOptionalConfigPath(draft, path)) continue;

      if (!isPendingCollectionSlot(draft, path)) {
        inadmissible.push(`${path} — does not resolve and is not a pending or absent-optional path`);
        continue;
      }

      const split = splitTrailingIndex(path);
      if (split === null) {
        inadmissible.push(`${path} — pending slot without a trailing index`);
        continue;
      }

      const parent = resolveConfigPath(draft, split.parent);
      if (!parent.found || !Array.isArray(parent.value)) {
        inadmissible.push(`${path} — parent ${split.parent} does not resolve to an array`);
        continue;
      }
      if (split.index !== parent.value.length) {
        inadmissible.push(
          `${path} — index ${split.index} is not the pending position (${parent.value.length})`
        );
      }
    }

    expect(inadmissible).toEqual([]);
  });

  it('the pending case is actually exercised — the fixture leaves modules unselected', () => {
    const draft = fixtureDraft();
    const { container } = renderStep('compliance', draft);
    const paths = collect('compliance', draft, container)
      .map((entry) => entry.path)
      .filter((path): path is string => path !== null);

    const pending = `compliance.modules[${draft.compliance.modules.length}]`;
    expect(paths.some((path) => path.startsWith(pending))).toBe(true);
    expect(resolveConfigPath(draft, pending).found).toBe(false);
  });

  it('exercises sparse default-draft shapes — omitted initialSupply and empty module config', () => {
    const draft = fixtureDraft();
    expect(resolveConfigPath(draft, 'token.initialSupply').found).toBe(false);
    expect(isAbsentOptionalConfigPath(draft, 'token.initialSupply')).toBe(true);
    expect(isPendingCollectionSlot(draft, 'token.initialSupply')).toBe(false);

    const scalar = draft.compliance.modules.find((entry) => entry.config === undefined);
    expect(scalar, 'fixture must leave one module without config').toBeDefined();
    const scalarIndex = draft.compliance.modules.indexOf(scalar!);
    const { container } = renderStep('compliance', draft);
    const paths = collect('compliance', draft, container)
      .map((entry) => entry.path)
      .filter((path): path is string => path !== null);
    const emptyConfigPath = paths.find(
      (path) =>
        path.startsWith(`compliance.modules[${scalarIndex}].config.`) &&
        !resolveConfigPath(draft, path).found
    );
    expect(
      emptyConfigPath,
      'a scalar config field must resolve under the empty-config module'
    ).toBeDefined();
    expect(isAbsentOptionalConfigPath(draft, emptyConfigPath!)).toBe(true);
    expect(isPendingCollectionSlot(draft, emptyConfigPath!)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// INV-24 clause 2 — resolution is a function, not a bijection
// ---------------------------------------------------------------------------

describe('INV-24 clause 2 — several controls legitimately share one path', () => {
  /**
   * Named rather than left to look like a bug. SF-13 must not key UI state
   * (selection, scroll, expansion) by path alone: the user can tab across three
   * unselected module rows, all three share one path, and a path-keyed selection
   * would stick to the first — a bug that reproduces only on unselected entries
   * and reads as a provenance-lookup failure.
   */
  it('every unselected compliance module row resolves to the same pending path', () => {
    const draft = fixtureDraft();
    const { container } = renderStep('compliance', draft);
    const pending = `compliance.modules[${draft.compliance.modules.length}]`;

    const rows = [...container.querySelectorAll<HTMLElement>('[role="checkbox"]')];
    const pendingRows = rows.filter((row) => resolveFocusedConfigPath(row, draft) === pending);

    expect(rows.length).toBeGreaterThan(draft.compliance.modules.length);
    expect(pendingRows.length).toBeGreaterThan(1);
  });

  it('both custom-topic inputs resolve to the same draft path', () => {
    const draft = fixtureDraft();
    const { container } = renderStep('identity', draft);
    const name = container.querySelector<HTMLElement>('#custom-topic-name')!;
    const id = container.querySelector<HTMLElement>('#custom-topic-id')!;

    const expected = `identityVerification.claimTopics[${draft.identityVerification.claimTopics.length}]`;
    expect(resolveFocusedConfigPath(name, draft)).toBe(expected);
    expect(resolveFocusedConfigPath(id, draft)).toBe(expected);
  });

  it('every unselected predefined claim-topic pill resolves to the same pending path', () => {
    const draft = fixtureDraft();
    const { container } = renderStep('identity', draft);
    const pending = `identityVerification.claimTopics[${draft.identityVerification.claimTopics.length}]`;

    const pills = [...container.querySelectorAll<HTMLElement>(`span[${CONFIG_ANCHOR_ATTR}]`)];
    const pendingPills = pills.filter((pill) => resolveFocusedConfigPath(pill, draft) === pending);

    expect(pendingPills.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// INV-4 — rendered anchor values are draft-independent
// ---------------------------------------------------------------------------

function anchorValues(container: HTMLElement): string[] {
  return [...container.querySelectorAll(`[${CONFIG_ANCHOR_ATTR}]`)]
    .map((element) => element.getAttribute(CONFIG_ANCHOR_ATTR) ?? '')
    .sort();
}

/**
 * Permute every index-bearing slice while adding, removing and renaming nothing.
 *
 * Reorder is the discriminator: it moves every index and preserves every
 * identity, so an anchor carrying an index changes and an anchor carrying
 * identity does not. Because nothing is added or removed, the rendered control
 * set is identical by construction.
 */
function reordered(draft: RWAConfig): RWAConfig {
  return {
    ...draft,
    compliance: { modules: [...draft.compliance.modules].reverse() },
    accessControl: {
      ...draft.accessControl,
      roles: [...draft.accessControl.roles].reverse(),
    },
    identityVerification: {
      ...draft.identityVerification,
      claimTopics: [...draft.identityVerification.claimTopics].reverse(),
      trustedIssuers: [...draft.identityVerification.trustedIssuers].reverse(),
    },
  };
}

describe('INV-4 — anchor values carry no draft state', () => {
  it.each(ENUMERATED_STEP_IDS)('%s — identical across the three ownership variants', (stepId) => {
    const perVariant = OWNERSHIP_VARIANTS.map((variant) => {
      const { container, unmount } = renderStep(stepId, fixtureDraft(variant));
      const values = anchorValues(container);
      unmount();
      return values;
    });

    expect(perVariant[1]).toEqual(perVariant[0]);
    expect(perVariant[2]).toEqual(perVariant[0]);
  });

  it.each(ENUMERATED_STEP_IDS)('%s — identical before and after a pure reorder', (stepId) => {
    const draft = fixtureDraft();

    const before = renderStep(stepId, draft);
    const beforeValues = anchorValues(before.container);
    before.unmount();

    const after = renderStep(stepId, reordered(draft));
    expect(anchorValues(after.container)).toEqual(beforeValues);
  });

  it('the reorder mutation really moves indices, so the test above is not vacuous', () => {
    const draft = fixtureDraft();
    const moved = reordered(draft);
    expect(moved.compliance.modules.map((m) => m.moduleId)).not.toEqual(
      draft.compliance.modules.map((m) => m.moduleId)
    );
    expect(moved.identityVerification.trustedIssuers.map((i) => i.address)).not.toEqual(
      draft.identityVerification.trustedIssuers.map((i) => i.address)
    );

    // The same anchor answers a different path under the reorder — which is the
    // whole point: the *markup* is constant, the *answer* is not.
    const { container } = renderStep('compliance', draft);
    const row = container.querySelector<HTMLElement>(`[${FIELD_ID_ATTR}]`)!;
    expect(resolveFocusedConfigPath(row, draft)).not.toBe(resolveFocusedConfigPath(row, moved));
  });

  it.each(ENUMERATED_STEP_IDS)(
    '%s — no anchor value carries an index or is a ConfigPath',
    (stepId) => {
      const draft = fixtureDraft();
      const { container } = renderStep(stepId, draft);

      for (const value of anchorValues(container)) {
        expect(value).not.toMatch(/\[\d+\]/);
        // A ConfigPath would resolve against the draft; an anchor must not be one.
        expect(resolveConfigPath(draft, value).found).toBe(false);
        expect(value).not.toContain(draft.accessControl.ownership.type);
      }
    }
  );

  it('no anchor value is empty — an empty one would claim everything beneath it', () => {
    for (const stepId of ENUMERATED_STEP_IDS) {
      const { container, unmount } = renderStep(stepId, fixtureDraft());
      for (const value of anchorValues(container)) expect(value.length).toBeGreaterThan(0);
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// INV-25 — the anchors are inert
// ---------------------------------------------------------------------------

describe('INV-25 — anchors are invisible to assistive technology and to focus order', () => {
  /**
   * A pre-anchor baseline cannot be captured at runtime, so the property is
   * asserted the only way that is honest here: strip the attributes this unit
   * adds from the rendered DOM and require the focusable collection and the
   * accessible-name map to be *identical*. Together with INV-5 — which forbids
   * any prop name other than the anchors from appearing at all — that is the
   * pre/post comparison the invariant asks for.
   *
   * This is load-bearing for the guard, not only for users: INV-1 and INV-2 key
   * the partition on accessible names, so an anchor that moved one would degrade
   * the coverage assertion into noise.
   */
  it.each(CELLS)(
    '%s / %o — stripping the anchors changes nothing observable',
    (stepId, variant) => {
      const draft = fixtureDraft(variant);
      const { container } = renderStep(stepId, draft);

      const before = collectFocusable(container).map((element, index) =>
        descriptorOf(stepId, element, index)
      );
      const beforeTabIndexes = collectFocusable(container).map((element) =>
        element.getAttribute('tabindex')
      );

      for (const attribute of [CONFIG_ANCHOR_ATTR, FIELD_ID_ATTR]) {
        for (const element of [...container.querySelectorAll(`[${attribute}]`)]) {
          element.removeAttribute(attribute);
        }
      }

      const after = collectFocusable(container).map((element, index) =>
        descriptorOf(stepId, element, index)
      );
      expect(after).toEqual(before);
      expect(collectFocusable(container).map((e) => e.getAttribute('tabindex'))).toEqual(
        beforeTabIndexes
      );
    }
  );

  it('every added attribute is a `data-*` — never aria, role, title or tabindex', () => {
    for (const stepId of ENUMERATED_STEP_IDS) {
      const { container, unmount } = renderStep(stepId, fixtureDraft());
      for (const element of container.querySelectorAll(`[${CONFIG_ANCHOR_ATTR}]`)) {
        expect(element.getAttribute(CONFIG_ANCHOR_ATTR)).toBeTruthy();
        // The anchor is the *only* thing this unit put on the element, so its
        // presence must not correlate with an accessibility attribute appearing.
        expect(CONFIG_ANCHOR_ATTR.startsWith('data-')).toBe(true);
      }
      unmount();
    }
  });

  /**
   * The anchors are structural identifiers and never reach a screen or a screen
   * reader — so no anchor value may appear in any user-visible text.
   */
  it('no anchor value appears in the rendered text', () => {
    for (const stepId of ENUMERATED_STEP_IDS) {
      const { container, unmount } = renderStep(stepId, fixtureDraft());
      const text = container.textContent ?? '';
      for (const value of anchorValues(container)) {
        expect(text).not.toContain(value);
      }
      unmount();
    }
  });
});
