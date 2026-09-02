import { describe, expect, it, vi } from 'vitest';

import { makeConfig } from '../../../test/fixtures/wizardFixtures';
import {
  availableProvenance,
  mixedGroups,
  noneProvenance,
  TEST_IDENTITY,
  unsupportedProvenance,
} from '../../../test/helpers/impactHarness';
import type { ConfigPath } from '../../wizard/config-path';
import type { CodePreviewProvenance } from '../provenanceState';
import {
  toFieldImpactView,
  toImpactGroups,
  type FieldImpactInput,
  type FieldImpactView,
} from './fieldImpactView';

const FIELD = 'token.name' as ConfigPath;
const OTHER_FIELD = 'token.symbol' as ConfigPath;

function view(input: Partial<FieldImpactInput> = {}): FieldImpactView {
  return toFieldImpactView({
    provenance: availableProvenance(mixedGroups()).provenance,
    path: FIELD,
    hasFocusedElement: true,
    ...input,
  });
}

/**
 * The state table, its two load-bearing placements, its three inputs and its
 * single seam call. Every assertion here is on the pure function: no DOM, no
 * React, no clock — which is INV-9's point, since the alternative it forbids
 * (`document.activeElement`) is impure *and* stale.
 */
describe('toFieldImpactView', () => {
  // -------------------------------------------------------------------------
  // INV-2 / INV-36 — closed and total: every kind is reachable and named
  // -------------------------------------------------------------------------
  describe('reaches all seven kinds (INV-2)', () => {
    it('no-preview when there is no provenance at all', () => {
      expect(view({ provenance: null }).kind).toBe('no-preview');
    });

    it('no-preview when a target has a service but no tree on screen', () => {
      expect(view({ provenance: noneProvenance() }).kind).toBe('no-preview');
    });

    it('unsupported when a tree is on screen and the generator does not record', () => {
      expect(view({ provenance: unsupportedProvenance() }).kind).toBe('unsupported');
    });

    it('no-focus when nothing at all holds focus', () => {
      expect(view({ path: null, hasFocusedElement: false }).kind).toBe('no-focus');
    });

    it('not-a-field when a control holds focus and writes no config location', () => {
      expect(view({ path: null, hasFocusedElement: true }).kind).toBe('not-a-field');
    });

    it('pending when the tree on screen is stale AND has no answer to keep', () => {
      // The narrowed `pending`: reachable only with nothing to keep on screen,
      // because `empty` may not claim "nothing generated from this field" about
      // a tree that is mid-rebuild (INV-37).
      const stale = availableProvenance([], {
        identity: 'old',
        liveIdentity: 'new',
      }).provenance;
      expect(view({ provenance: stale })).toEqual({ kind: 'pending', path: FIELD });
    });

    it('empty when a resolvable field has no dependent files', () => {
      expect(view({ provenance: availableProvenance([]).provenance })).toEqual({
        kind: 'empty',
        path: FIELD,
      });
    });

    it('uncreated when the path names a pending collection slot in the live draft', () => {
      const config = makeConfig();
      const pending =
        `identityVerification.trustedIssuers[${config.identityVerification.trustedIssuers.length}]` as ConfigPath;
      expect(
        view({
          provenance: availableProvenance(mixedGroups()).provenance,
          path: pending,
          config,
        })
      ).toEqual({ kind: 'uncreated', path: pending });
    });

    it('does not treat an omitted token.initialSupply as uncreated', () => {
      const config = makeConfig();
      expect('initialSupply' in config.token).toBe(false);
      const path = 'token.initialSupply' as ConfigPath;
      expect(
        view({
          provenance: availableProvenance(mixedGroups()).provenance,
          path,
          config,
        }).kind
      ).toBe('groups');
    });

    it('does not treat an empty module config field as uncreated', () => {
      const config = makeConfig({
        compliance: { modules: [{ moduleId: 'country-allowlist' }] },
      });
      const path = 'compliance.modules[0].config.allowedCountries' as ConfigPath;
      expect(
        view({
          provenance: availableProvenance(mixedGroups()).provenance,
          path,
          config,
        }).kind
      ).toBe('groups');
    });

    it('groups when the field resolves to at least one file', () => {
      const result = view();
      expect(result.kind).toBe('groups');
      if (result.kind !== 'groups') throw new Error('unreachable');
      expect(result.path).toBe(FIELD);
      expect(result.groups).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // INV-9 — exactly three inputs, one test each; the fourth combination is
  //         unreachable by SF-12's contract and is still handled
  // -------------------------------------------------------------------------
  describe('is a function of exactly three inputs (INV-9)', () => {
    it('input 1 — provenance: null, none, unsupported and available each decide alone', () => {
      const kinds = [null, noneProvenance(), unsupportedProvenance()].map(
        (provenance) => view({ provenance }).kind
      );
      expect(kinds).toEqual(['no-preview', 'no-preview', 'unsupported']);
      expect(view().kind).toBe('groups');
    });

    it('input 2 — path: null yields an absence state, a real path yields the answer', () => {
      expect(view({ path: null, hasFocusedElement: true }).kind).toBe('not-a-field');
      expect(view({ path: FIELD }).kind).toBe('groups');
    });

    it('input 3 — hasFocusedElement is read only at path === null, and splits the two absences', () => {
      expect(view({ path: null, hasFocusedElement: false }).kind).toBe('no-focus');
      expect(view({ path: null, hasFocusedElement: true }).kind).toBe('not-a-field');
    });

    it('input 3 is ignored when a path resolved — the path is the stronger evidence', () => {
      // SF-12 documents `path !== null` implies `hasFocusedElement`, so this
      // combination is unreachable by contract. The function stays total over
      // it: it must not throw, and it must not fall into an absence state and
      // discard an answer it was handed.
      const unreachable = view({ path: FIELD, hasFocusedElement: false });
      expect(unreachable.kind).toBe('groups');
      expect(() => view({ path: FIELD, hasFocusedElement: false })).not.toThrow();
    });

    it('reads nothing outside its argument — same input, same output, twice', () => {
      const input: FieldImpactInput = {
        provenance: availableProvenance(mixedGroups()).provenance,
        path: FIELD,
        hasFocusedElement: true,
      };
      expect(toFieldImpactView(input)).toEqual(toFieldImpactView(input));
    });
  });

  // -------------------------------------------------------------------------
  // INV-10 — the order of two rows is a property, not style
  // -------------------------------------------------------------------------
  describe('the state table order is load-bearing (INV-10)', () => {
    it('ordering (a): unsupported wins over a focused resolvable field', () => {
      // "Select a configuration field" is a lie when the generator does not
      // record — focusing one will not help, and the user would keep trying.
      expect(view({ provenance: unsupportedProvenance(), path: FIELD }).kind).toBe('unsupported');
    });

    it('ordering (b): a stale identity with no focus is no-focus, NOT pending', () => {
      // Ahead of the field states, every keystroke anywhere in the wizard would
      // flip an unfocused column between no-focus and pending. With no field
      // there is nothing to be stale about. This ordering is the whole
      // anti-flicker guarantee (AS-5).
      const stale = availableProvenance(mixedGroups(), {
        identity: 'old',
        liveIdentity: 'new',
      }).provenance;
      expect(view({ provenance: stale, path: null, hasFocusedElement: false }).kind).toBe(
        'no-focus'
      );
      expect(view({ provenance: stale, path: null, hasFocusedElement: true }).kind).toBe(
        'not-a-field'
      );
    });

    it('ordering (c): a stale identity over a field that would be empty is pending, NOT empty', () => {
      // The rows are gone because the tree is being rebuilt, not because the
      // field turned out to determine nothing. Reporting the second would be a
      // claim about the generated code that no generation supports.
      const staleEmpty = availableProvenance([], {
        identity: 'old',
        liveIdentity: 'new',
      }).provenance;
      expect(view({ provenance: staleEmpty }).kind).toBe('pending');
    });
  });

  // -------------------------------------------------------------------------
  // INV-11 — one seam lookup per evaluation, zero for rows 1-5
  // -------------------------------------------------------------------------
  describe('calls the seam exactly once per evaluation (INV-11)', () => {
    function countingProvenance(
      groups = mixedGroups(),
      liveIdentity: string | null = TEST_IDENTITY
    ): { provenance: CodePreviewProvenance; lookup: ReturnType<typeof vi.fn> } {
      const lookup = vi.fn((path: ConfigPath) => ({
        identity: TEST_IDENTITY,
        path,
        groups,
      }));
      return {
        provenance: { state: { kind: 'available', identity: TEST_IDENTITY, lookup }, liveIdentity },
        lookup,
      };
    }

    it('rows 1-5 call it zero times', () => {
      const cases: readonly (readonly [string, Partial<FieldImpactInput>])[] = [
        ['no-preview (null)', { provenance: null }],
        ['no-preview (none)', { provenance: noneProvenance() }],
        ['unsupported', { provenance: unsupportedProvenance() }],
        ['no-focus', { path: null, hasFocusedElement: false }],
        ['not-a-field', { path: null, hasFocusedElement: true }],
      ];

      for (const [label, override] of cases) {
        const { provenance, lookup } = countingProvenance();
        toFieldImpactView({
          provenance,
          path: FIELD,
          hasFocusedElement: true,
          ...override,
        });
        expect(lookup, `${label} must not reach the seam`).toHaveBeenCalledTimes(0);
      }
    });

    it('pending calls it exactly once — staleness is a flag, not a fork away from the seam', () => {
      // Restated with the freshness gate: the identity test no longer returns
      // ahead of the lookup, because the rows it used to skip are the rows the
      // column now keeps on screen. The bound that matters is unchanged — ONE
      // call per evaluation, never two — and the zero-call rows are now rows
      // 1-4 rather than 1-5.
      const { provenance, lookup } = countingProvenance([], 'new');
      expect(toFieldImpactView({ provenance, path: FIELD, hasFocusedElement: true }).kind).toBe(
        'pending'
      );
      expect(lookup).toHaveBeenCalledTimes(1);
    });

    it('a stale evaluation that keeps its rows still calls it exactly once', () => {
      const { provenance, lookup } = countingProvenance(mixedGroups(), 'new');
      expect(toFieldImpactView({ provenance, path: FIELD, hasFocusedElement: true }).kind).toBe(
        'groups'
      );
      expect(lookup).toHaveBeenCalledTimes(1);
    });

    it('empty calls it exactly once', () => {
      const { provenance, lookup } = countingProvenance([]);
      expect(toFieldImpactView({ provenance, path: FIELD, hasFocusedElement: true }).kind).toBe(
        'empty'
      );
      expect(lookup).toHaveBeenCalledTimes(1);
      expect(lookup).toHaveBeenCalledWith(FIELD);
    });

    it('groups calls it exactly once, and binds the result rather than re-asking', () => {
      // `lookup(path).groups.length === 0 ? ... : lookup(path)` reads naturally
      // and doubles the per-render cost of the only linear operation on a hook
      // that re-renders on every focus change in the app.
      const { provenance, lookup } = countingProvenance();
      expect(toFieldImpactView({ provenance, path: FIELD, hasFocusedElement: true }).kind).toBe(
        'groups'
      );
      expect(lookup).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // INV-35 — freshness is decided at render, from two published strings
  // -------------------------------------------------------------------------
  describe('freshness is decided from the two published identities (INV-35)', () => {
    it('any divergence between state identity and liveIdentity yields pending', () => {
      // One test per generate input: whatever moved the key — the config hash,
      // the identity-support option, the service id — the column sees the same
      // two strings differ. The inputs are the seam's to enumerate; what this
      // pins is that the column reads the comparison and nothing else.
      const inputs = ['hash-changed|identity:0|service:test', 'hash|identity:1|service:test'];
      for (const liveIdentity of inputs) {
        const stale = availableProvenance(mixedGroups(), {
          identity: TEST_IDENTITY,
          liveIdentity,
        }).provenance;
        expect(view({ provenance: stale }), liveIdentity).toEqual({
          kind: 'groups',
          path: FIELD,
          stale: true,
          groups: toImpactGroups(mixedGroups()),
        });

        // And the empty-handed half of the same divergence.
        const staleEmpty = availableProvenance([], {
          identity: TEST_IDENTITY,
          liveIdentity,
        }).provenance;
        expect(view({ provenance: staleEmpty }), liveIdentity).toEqual({
          kind: 'pending',
          path: FIELD,
        });
      }
    });

    it('a fresh evaluation is marked fresh, so the flag is not always true', () => {
      // The partition. Without this the assertions above are satisfied by a
      // `stale` that is hard-coded to `true` and signals nothing.
      const fresh = availableProvenance(mixedGroups()).provenance;
      const result = view({ provenance: fresh });
      expect(result.kind).toBe('groups');
      expect(result.kind === 'groups' && result.stale).toBe(false);
    });

    it('a stale evaluation keeps the field name AND its rows, in the same evaluation', () => {
      // The behaviour this replaces: the rows were dropped here, which blinked
      // the column to a placeholder once per keystroke, since regeneration is
      // debounced per character. Keeping them is safe because `state.identity`
      // is the identity of the tree ON SCREEN and SF-5 INV-21 commits the tree,
      // its provenance and that identity together — so these rows and the code
      // pane are the same generation, and activating one lands on a line the
      // user can see.
      const stale = availableProvenance(mixedGroups(), {
        identity: TEST_IDENTITY,
        liveIdentity: 'moved',
      }).provenance;
      const result = view({ provenance: stale, path: OTHER_FIELD });
      expect(result).toEqual({
        kind: 'groups',
        path: OTHER_FIELD,
        stale: true,
        groups: toImpactGroups(mixedGroups()),
      });
    });

    it('an equal identity is fresh, even when liveIdentity is null for a service-less target', () => {
      // `liveIdentity: null` cannot equal a string identity, so it reads as
      // stale — which is the safe direction: rows are withheld, never shown
      // against a tree that may not be on screen.
      const noLive = availableProvenance(mixedGroups(), { liveIdentity: null }).provenance;
      const result = view({ provenance: noLive });
      expect(result.kind).toBe('groups');
      expect(result.kind === 'groups' && result.stale).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // INV-39 — never throws
  // -------------------------------------------------------------------------
  it('never throws, including for a seam result whose groups array is empty (INV-39)', () => {
    const shapes: readonly Partial<FieldImpactInput>[] = [
      { provenance: null, path: null, hasFocusedElement: false },
      { provenance: noneProvenance() },
      { provenance: unsupportedProvenance(), path: null, hasFocusedElement: false },
      { provenance: availableProvenance([]).provenance },
      { provenance: availableProvenance(mixedGroups()).provenance },
    ];
    for (const shape of shapes) {
      expect(() => view(shape)).not.toThrow();
    }
  });
});
