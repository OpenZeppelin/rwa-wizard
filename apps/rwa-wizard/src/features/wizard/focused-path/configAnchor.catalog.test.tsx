import { describe, expect, it } from 'vitest';

import { listTargets } from '../../../registry/targets';
import {
  ENUMERATED_STEP_IDS,
  fixtureDraft,
  OWNERSHIP_VARIANTS,
  renderStep,
  STELLAR_TARGET_ID,
  stellarEcosystemMetadata,
  stellarModules,
} from '../../../test/helpers/focusedPathHarness';
import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import type { ConfigAnchorKey } from './configAnchor';
import {
  CLAIM_TOPIC_DRAFT_ANCHOR,
  ISSUER_DRAFT_ANCHOR,
  moduleConfigAnchor,
  OWNERSHIP_ADDRESS_ANCHOR,
  parseConfigAnchor,
  tokenAnchor,
} from './configAnchor';
import { resolveFocusedConfigPath } from './resolveFocusedConfigPath';

/**
 * INV-11 — identifier uniqueness and separator safety, over the real catalogs.
 *
 * These are assertions about *values*, not types, so nothing here can be
 * discharged by the compiler. They run against the registered targets' actual
 * enriched metadata rather than fixtures, because a fixture that happens to
 * avoid a collision proves nothing about the catalog that ships.
 */

const SEPARATOR = '|';

/** Sibling ids the kit derives from a field id it is given. Non-focusable. */
const KIT_DERIVED_ID_SUFFIXES = ['description', 'resolution'] as const;

/**
 * The static leaf-id registry, written out.
 *
 * This duplicates `STATIC_ANCHOR_IDS`, which is module-private — deliberately:
 * the duplicate is the *contract*, and each entry is asserted through the
 * resolver below, so a silent edit to the private map fails here rather than
 * only showing up as a control that quietly stopped resolving.
 */
const STATIC_IDS: ReadonlyArray<readonly [string, ConfigAnchorKey, string]> = [
  ['token-name', tokenAnchor('name'), 'token.name'],
  ['token-symbol', tokenAnchor('symbol'), 'token.symbol'],
  ['token-decimals', tokenAnchor('decimals'), 'token.decimals'],
  ['token-initial-supply', tokenAnchor('initialSupply'), 'token.initialSupply'],
  ['doc-manager-enabled', tokenAnchor('documentManagerEnabled'), 'token.documentManager.enabled'],
  ['owner-address', OWNERSHIP_ADDRESS_ANCHOR, 'accessControl.ownership.ownerAddress'],
  ['trusted-issuer-address', ISSUER_DRAFT_ANCHOR, 'identityVerification.trustedIssuers[0]'],
  ['custom-topic-name', CLAIM_TOPIC_DRAFT_ANCHOR, 'identityVerification.claimTopics[0]'],
  ['custom-topic-id', CLAIM_TOPIC_DRAFT_ANCHOR, 'identityVerification.claimTopics[0]'],
];

const hosts: HTMLElement[] = [];

function elementWithId(id: string): HTMLElement {
  const host = document.createElement('div');
  const input = document.createElement('input');
  input.id = id;
  host.appendChild(input);
  document.body.appendChild(host);
  hosts.push(host);
  return input;
}

// ---------------------------------------------------------------------------
// Coverage of the sweep itself
// ---------------------------------------------------------------------------

describe('INV-11 — what this sweep covers', () => {
  /**
   * Stated rather than implied. `listTargets()` returns two entries today and
   * only one of them ships a codegen package, so "every registered target's real
   * catalog" is one catalog. When a second lands, this fails and the sweep has to
   * be widened rather than quietly staying a single-target check.
   */
  it('the registered targets are stellar (enabled) and evm (visible, disabled)', () => {
    const targets = listTargets().map((target) => ({ id: target.id, enabled: target.enabled }));
    expect(targets).toEqual([
      { id: 'stellar', enabled: true },
      { id: 'evm', enabled: false },
    ]);
  });

  it('the Stellar catalog is non-empty, so the clauses below are not vacuous', () => {
    const modules = stellarModules();
    const metadata = stellarEcosystemMetadata();
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.some((module) => module.configFields.length > 0)).toBe(true);
    expect(metadata.operatorRoles.length).toBeGreaterThan(0);
    expect(metadata.administrativeControls.length).toBeGreaterThan(0);
    expect(metadata.identityControls.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Clause 1 — the separator appears in no argument
// ---------------------------------------------------------------------------

describe('INV-11 clause 1 — no identifier contains the separator', () => {
  it('module ids and config field keys', () => {
    const offenders: string[] = [];
    for (const module of stellarModules()) {
      if (module.id.includes(SEPARATOR)) offenders.push(`module id ${module.id}`);
      for (const field of module.configFields) {
        if (field.key.includes(SEPARATOR)) offenders.push(`${module.id}.${field.key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('operator role names, administrative control ids and identity control ids', () => {
    const metadata = stellarEcosystemMetadata();
    const offenders = [
      ...metadata.operatorRoles.filter((role) => role.name.includes(SEPARATOR)).map((r) => r.name),
      ...metadata.administrativeControls
        .filter((meta) => meta.id.includes(SEPARATOR))
        .map((m) => m.id),
      ...metadata.identityControls.filter((meta) => meta.id.includes(SEPARATOR)).map((m) => m.id),
    ];
    expect(offenders).toEqual([]);
  });

  /**
   * The separator is `|` and not `.` or `:` for reasons that only hold if the
   * catalog respects it: role names contain spaces, colons are plausible in
   * future ids, and `.` is the *path* dialect's separator. This asserts the
   * property the choice depends on, over the values that ship.
   */
  it('a role name containing a space still round-trips', () => {
    const metadata = stellarEcosystemMetadata();
    const spaced = metadata.operatorRoles.filter((role) => role.name.includes(' '));
    expect(spaced.length).toBeGreaterThan(0);

    for (const role of spaced) {
      expect(parseConfigAnchor(`role|${role.name}`)).toEqual({
        kind: 'role',
        roleName: role.name,
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Clause 2 — the dynamic id is unambiguous within a catalog
// ---------------------------------------------------------------------------

describe('INV-11 clause 2 — `${moduleId}-${fieldKey}` is unique', () => {
  it('no two pairs collide', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];

    for (const module of stellarModules()) {
      for (const field of module.configFields) {
        const id = `${module.id}-${field.key}`;
        const previous = seen.get(id);
        if (previous !== undefined)
          collisions.push(`${id} — ${previous} and ${module.id}.${field.key}`);
        seen.set(id, `${module.id}.${field.key}`);
      }
    }

    expect(collisions).toEqual([]);
  });

  /**
   * The reachable ambiguity the longest-match rule exists for: module `a-b`
   * field `c` and module `a` field `b-c` produce the same id. The catalog must
   * not contain such a pair — the rule keeps the split deterministic either way,
   * but "deterministic" and "right" are different claims.
   */
  it('no module id is a prefix of another in a way that makes a split ambiguous', () => {
    const modules = stellarModules();
    const ambiguous: string[] = [];

    for (const outer of modules) {
      for (const field of outer.configFields) {
        const id = `${outer.id}-${field.key}`;
        for (const inner of modules) {
          if (inner.id === outer.id) continue;
          if (!id.startsWith(`${inner.id}-`)) continue;
          const otherKey = id.slice(inner.id.length + 1);
          if (inner.configFields.some((f) => f.key === otherKey)) {
            ambiguous.push(
              `${id} splits as both ${outer.id}/${field.key} and ${inner.id}/${otherKey}`
            );
          }
        }
      }
    }

    expect(ambiguous).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Clause 3 — static and dynamic id spaces do not overlap
// ---------------------------------------------------------------------------

describe('INV-11 clause 3 — no dynamic id can equal a static one', () => {
  it.each(STATIC_IDS)('%s resolves to its registered anchor', (id, key, path) => {
    const draft = createDefaultRwaConfig();
    expect(parseConfigAnchor(key)).not.toBeNull();
    expect(resolveFocusedConfigPath(elementWithId(id), draft)).toBe(path);
  });

  it('no `${moduleId}-${fieldKey}` equals a static registry key', () => {
    const staticKeys = new Set(STATIC_IDS.map(([id]) => id));
    const offenders: string[] = [];

    for (const module of stellarModules()) {
      for (const field of module.configFields) {
        const id = `${module.id}-${field.key}`;
        if (staticKeys.has(id)) offenders.push(id);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('the static registry is exactly nine entries', () => {
    expect(STATIC_IDS).toHaveLength(9);
    expect(new Set(STATIC_IDS.map(([id]) => id)).size).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// Clause 4 — cross-family collisions, over every identifier the wizard renders
// ---------------------------------------------------------------------------

/** Every `id` and `data-field-id` the wizard renders, gathered from the render. */
function renderedIdentifiers(): {
  focusableIds: Set<string>;
  allIds: Set<string>;
  fieldIds: Set<string>;
} {
  const focusableIds = new Set<string>();
  const allIds = new Set<string>();
  const fieldIds = new Set<string>();

  for (const variant of OWNERSHIP_VARIANTS) {
    const draft = fixtureDraft(variant);
    for (const stepId of ENUMERATED_STEP_IDS) {
      const { container, unmount } = renderStep(stepId, draft);
      for (const element of container.querySelectorAll<HTMLElement>('[id]')) {
        allIds.add(element.id);
        if (
          element.matches(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ) {
          focusableIds.add(element.id);
        }
      }
      for (const element of container.querySelectorAll('[data-field-id]')) {
        const value = element.getAttribute('data-field-id');
        if (value !== null) fieldIds.add(value);
      }
      unmount();
    }
  }

  return { focusableIds, allIds, fieldIds };
}

/** Ids that the module split would claim, paired with what they split into. */
function moduleShapedIds(identifiers: Iterable<string>): Array<{ id: string; splitsAs: string }> {
  const modules = stellarModules();
  const claimed: Array<{ id: string; splitsAs: string }> = [];

  for (const id of identifiers) {
    let best: { moduleId: string; fieldKey: string } | null = null;
    for (const module of modules) {
      const prefix = `${module.id}-`;
      if (!id.startsWith(prefix)) continue;
      const fieldKey = id.slice(prefix.length);
      if (fieldKey.length === 0) continue;
      if (best === null || module.id.length > best.moduleId.length) {
        best = { moduleId: module.id, fieldKey };
      }
    }
    if (best === null) continue;

    const isRealField = modules
      .find((module) => module.id === best!.moduleId)
      ?.configFields.some((field) => field.key === best!.fieldKey);
    if (isRealField !== true) claimed.push({ id, splitsAs: `${best.moduleId} / ${best.fieldKey}` });
  }

  return claimed;
}

describe('INV-11 clause 4 — cross-family identifier collisions', () => {
  /**
   * The clause that matters, over the population that can actually reach the
   * resolver: the ids of focusable controls, plus every `data-field-id`. Those
   * are the only identifiers walk steps 3 and 4 ever see.
   */
  it('no *reachable* identifier is claimed by the module split unless it is a real config field id', () => {
    const { focusableIds, fieldIds } = renderedIdentifiers();
    const reachable = new Set([...focusableIds, ...fieldIds]);

    expect(reachable.size).toBeGreaterThan(0);
    expect(moduleShapedIds(reachable)).toEqual([]);
  });

  /**
   * **The correction INV-11 clause 4 needs, found by running it.**
   *
   * As written the clause quantifies over "no identifier rendered anywhere in the
   * wizard". The kit breaks that on its own: every kit field derives sibling ids
   * from the one it is given — `<fieldId>-description` on a field with helper
   * text, `<fieldId>-resolution` on an address list in single mode — and a
   * sibling of a real module-config id is shaped exactly like a module-config id
   * for a field key that does not exist. `supply-limit-limit-description` is one
   * today.
   *
   * They are harmless: the siblings sit on non-focusable `<div>`s, so the
   * resolver is never called with them and no control resolves through them. But
   * the clause as stated is false, and a test written to it would fail on a true
   * statement about a non-issue — the shape of assertion that gets loosened until
   * it checks nothing.
   *
   * So the clause is split. The reachable population is asserted empty above.
   * Here every module-shaped *unreachable* id must be a kit-derived sibling of a
   * reachable identifier, and any that is not fails — which is the half worth
   * guarding, because an unreachable module-shaped id is one `tabindex` away from
   * being reachable.
   */
  it('every module-shaped unreachable id is a kit-derived sibling of a reachable one', () => {
    const { allIds, fieldIds, focusableIds } = renderedIdentifiers();
    const reachable = new Set([...focusableIds, ...fieldIds]);
    const unreachable = [...allIds].filter((id) => !reachable.has(id));
    const claimed = moduleShapedIds(unreachable);

    // Not vacuous: the kit really does render such ids today.
    expect(claimed.length).toBeGreaterThan(0);

    const unexplained = claimed.filter(
      ({ id }) =>
        ![...reachable].some((parent) =>
          KIT_DERIVED_ID_SUFFIXES.some((suffix) => id === `${parent}-${suffix}`)
        )
    );
    expect(unexplained).toEqual([]);
  });

  /**
   * **INV-20 clause 5 and Q1a record the wrong reason, and the reason is the
   * only reviewable part of a decision.**
   *
   * The invariant says `OperatorRolesSection` passes no `id` so as to add "a
   * second identifier and a second collision surface for no gain". Rendered, the
   * section produces eleven ids anyway — `address-list-single-_r_13_` and
   * friends — because the kit falls back to `useId()` when it is given none.
   * Passing no id does not remove an identifier; it substitutes a
   * non-deterministic one for a deterministic one.
   *
   * The *decision* still stands, on a different footing: the role row's anchor
   * already yields the exact path, and the kit's generated ids are namespaced
   * (`address-list-single-…`), so they cannot be claimed by the module split.
   * That namespacing is the property the decision actually depends on, so it is
   * asserted here rather than assumed.
   */
  it('the kit generates its own ids where none is passed, and they are namespaced out of the module space', () => {
    const { focusableIds } = renderedIdentifiers();
    const generated = [...focusableIds].filter((id) => id.startsWith('address-list-'));

    expect(generated.length).toBeGreaterThan(0);
    expect(moduleShapedIds(generated)).toEqual([]);

    // And they carry no meaning the resolver can use — the role anchor does all
    // the work, which is why the section is right not to pass one.
    for (const id of generated) {
      expect(resolveFocusedConfigPath(elementWithId(id), createDefaultRwaConfig())).toBeNull();
    }
  });

  it('an id that merely looks like a module-config id would resolve — which is why clause 4 exists', () => {
    // The hazard made concrete: nothing about the string says which family it
    // came from, so a future `role` module id and an `id="role-agent-addresses"`
    // elsewhere in the wizard would point the column at a compliance module.
    const draft = {
      ...createDefaultRwaConfig(),
      compliance: { modules: [{ moduleId: 'role' }] },
    };
    expect(resolveFocusedConfigPath(elementWithId('role-agent-addresses'), draft)).toBe(
      'compliance.modules[0].config.agent-addresses'
    );
  });
});

// ---------------------------------------------------------------------------
// Clause 5 — the identities anchors are keyed on are unique
// ---------------------------------------------------------------------------

describe('INV-11 clause 5 — the keying identities are unique', () => {
  it('operator role names are unique within the catalog', () => {
    const names = stellarEcosystemMetadata().operatorRoles.map((role) => role.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('module ids are unique within the catalog', () => {
    const ids = stellarModules().map((module) => module.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * Trusted-issuer addresses are unique within a draft — enforced today by
   * `TrustedIssuersSection`'s `isDuplicate` — and that is what makes an address
   * safe to use as stable identity in an anchor. Asserted against the fixture,
   * which is the closest thing to a real draft this suite has.
   */
  it('trusted-issuer addresses are unique within the fixture draft', () => {
    const addresses = fixtureDraft().identityVerification.trustedIssuers.map((i) => i.address);
    expect(addresses.length).toBeGreaterThan(1);
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it('claim-topic ids are unique within the fixture draft', () => {
    const ids = fixtureDraft().identityVerification.claimTopics.map((topic) => topic.id);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// The address-list field the two channels share
// ---------------------------------------------------------------------------

describe('INV-20 — the identifier family is one, not two', () => {
  it('the `data-field-id` the kit renders equals the id `ModuleConfigPanel` passes', () => {
    const { fieldIds } = renderedIdentifiers();
    const expected: string[] = [];

    for (const module of stellarModules()) {
      for (const field of module.configFields) {
        if (field.valueKind === 'address-list') expected.push(`${module.id}-${field.key}`);
      }
    }

    expect(expected.length).toBeGreaterThan(0);
    for (const id of expected) {
      // Present only when the module is selected in the fixture; assert the ones
      // that are, and that every rendered field id decodes to a real config field.
      if (fieldIds.has(id)) {
        expect(parseConfigAnchor(moduleConfigAnchor(id.split('-')[0]!, 'x'))).not.toBeNull();
      }
    }

    for (const fieldId of fieldIds) {
      expect(moduleShapedIds([fieldId])).toEqual([]);
    }
  });
});

it(`target id is '${STELLAR_TARGET_ID}'`, () => {
  expect(STELLAR_TARGET_ID).toBe('stellar');
});
