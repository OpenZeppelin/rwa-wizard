import { afterEach, describe, expect, it } from 'vitest';

import type { ComplianceModuleSelection, RWAConfig } from '@openzeppelin/rwa-config';

import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import type { ConfigPath } from '../config-path';
import { anchorToConfigPath } from './anchorToConfigPath';
import { parseConfigAnchor } from './configAnchor';
import { resolveFocusedAnchorKey, resolveFocusedConfigPath } from './resolveFocusedConfigPath';

/**
 * SF-14 INV-12 — `resolveFocusedAnchorKey` is a **behaviour-preserving
 * extraction** of `resolveFocusedConfigPath`'s first hop, and inherits SF-12's
 * purity contract.
 *
 * The property is asserted as an equivalence over the resolver's own fixture
 * space rather than by re-testing the walk: for every element `e` and draft `c`,
 *
 * ```
 * resolveFocusedConfigPath(e, c) === compose(resolveFocusedAnchorKey(e, c.compliance.modules))
 * ```
 *
 * **Why an equivalence and not a second suite of walk tests.** The failure this
 * guards is the extraction quietly dropping the leaf-`id` hop, because the
 * ancestor walk "looks like the whole thing" — at which point a scalar
 * module-config field inside an anchored module panel coarsens to the module
 * entry instead of resolving to its own `config.<key>` path. A second suite
 * written against the extracted function would encode whatever the extraction
 * does; the equivalence encodes what the resolver did before it.
 *
 * `resolveFocusedConfigPath`'s own suite runs unchanged alongside this one. A
 * green suite with an altered walk order is exactly the failure this pair
 * exists to make impossible.
 */

function draftWith(modules: ComplianceModuleSelection[] = []): RWAConfig {
  const base = createDefaultRwaConfig();
  return { ...base, compliance: { modules } };
}

const mounted: HTMLElement[] = [];

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  mounted.push(host);
  return host;
}

function target(host: HTMLElement, selector: string): HTMLElement {
  const element = host.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`fixture has no ${selector}`);
  return element;
}

afterEach(() => {
  for (const host of mounted.splice(0)) host.remove();
});

/** The right-hand side of the equivalence, spelled out rather than imported. */
function composeThroughKey(element: Element | null, config: RWAConfig): ConfigPath | null {
  const key = resolveFocusedAnchorKey(element, config.compliance.modules);
  if (key === null) return null;
  const anchor = parseConfigAnchor(key);
  return anchor === null ? null : anchorToConfigPath(anchor, config);
}

const MODULES: ComplianceModuleSelection[] = [
  { moduleId: 'transfer-allow' },
  { moduleId: 'supply-limit' },
];

/**
 * The precedence fixtures from `resolveFocusedConfigPath.test.ts`, restated as
 * `(html, selector, draft)` triples so both sides can be driven over the same
 * elements. Every clause of the four-step walk appears, including the two the
 * extraction is most likely to lose.
 */
const FIXTURES: ReadonlyArray<{
  readonly name: string;
  readonly html: string;
  readonly selector: string;
  readonly config: RWAConfig;
}> = [
  {
    name: 'nothing identifying',
    html: '<div><button id="unknown">x</button></div>',
    selector: 'button',
    config: draftWith(),
  },
  {
    name: 'a registered static leaf id',
    html: '<div><input id="token-name" /></div>',
    selector: 'input',
    config: draftWith(),
  },
  {
    name: 'a dynamic module-config leaf id',
    html: '<div><input id="transfer-allow-allowedUsers" /></div>',
    selector: 'input',
    config: draftWith(MODULES),
  },
  {
    name: 'the leaf id beats an enclosing anchor — step 2 before step 3',
    html: '<div data-config-anchor="module|transfer-allow"><input id="transfer-allow-allowedUsers" /></div>',
    selector: 'input',
    config: draftWith(MODULES),
  },
  {
    name: 'an unregistered leaf id falls through to the enclosing anchor',
    html: '<div data-config-anchor="module|transfer-allow"><input id="not-registered" /></div>',
    selector: 'input',
    config: draftWith(MODULES),
  },
  {
    name: 'the nearest of two nested anchors wins',
    html: '<div data-config-anchor="issuer|GAAA"><div data-config-anchor="issuerTopics|GAAA"><button>x</button></div></div>',
    selector: 'button',
    config: draftWith(),
  },
  {
    name: 'the anchor on the element itself wins over one on an ancestor',
    html: '<div data-config-anchor="issuer|GAAA"><button data-config-anchor="issuerTopics|GAAA">x</button></div>',
    selector: 'button',
    config: draftWith(),
  },
  {
    name: 'a nearer data-field-id beats a farther data-config-anchor',
    html: '<div data-config-anchor="module|transfer-allow"><div data-field-id="token-name"><button>x</button></div></div>',
    selector: 'button',
    config: draftWith(MODULES),
  },
  {
    name: 'data-field-id wins over data-config-anchor on the same element',
    html: '<div data-field-id="token-name" data-config-anchor="module|transfer-allow"><button>x</button></div>',
    selector: 'button',
    config: draftWith(MODULES),
  },
  {
    name: 'a malformed anchor reads like an absent one and falls through',
    html: '<div data-config-anchor="module|transfer-allow"><div data-config-anchor="claimTopic|not-an-integer"><button>x</button></div></div>',
    selector: 'button',
    config: draftWith(MODULES),
  },
  {
    name: 'a malformed anchor with nothing outside it',
    html: '<div data-config-anchor="claimTopic|1.5"><button>x</button></div>',
    selector: 'button',
    config: draftWith(),
  },
  {
    name: 'a malformed data-field-id does not block the anchor on the same element',
    html: '<div data-field-id="nonsense" data-config-anchor="claimTopic|1"><button>x</button></div>',
    selector: 'button',
    config: draftWith(),
  },
  {
    name: 'a module-config id for a module that is not selected does not split',
    html: '<div><input id="transfer-allow-allowedUsers" /></div>',
    selector: 'input',
    config: draftWith([{ moduleId: 'supply-limit' }]),
  },
  {
    name: 'an anchor whose item is absent still resolves to its pending slot',
    html: '<div data-config-anchor="claimTopic|42"><button>x</button></div>',
    selector: 'button',
    config: draftWith(),
  },
];

describe('resolveFocusedAnchorKey is a behaviour-preserving extraction (INV-12)', () => {
  it.each(FIXTURES)('$name — both sides agree', ({ html, selector, config }) => {
    const element = target(mount(html), selector);
    expect(composeThroughKey(element, config)).toBe(resolveFocusedConfigPath(element, config));
  });

  /**
   * Non-vacuity: the equivalence above is satisfied by two functions that both
   * return `null` for everything. The fixture set must contain both answers, and
   * enough distinct non-null paths that the agreement is saying something.
   */
  it('the fixture set produces both answers, and several distinct paths', () => {
    const results = FIXTURES.map(({ html, selector, config }) =>
      resolveFocusedConfigPath(target(mount(html), selector), config)
    );
    expect(results.filter((path) => path === null).length).toBeGreaterThan(0);
    const resolved = results.filter((path): path is ConfigPath => path !== null);
    expect(resolved.length).toBeGreaterThan(5);
    expect(new Set(resolved).size).toBeGreaterThan(3);
  });

  /**
   * The step-2 clause, called out by name because it is the one the extraction
   * is most likely to lose and the one nothing else in SF-14's own suite would
   * catch: a scalar module-config field inside an anchored module panel must
   * resolve to its own `config.<key>` path, not coarsen to the module entry.
   */
  it('the leaf-id hop survives the extraction, on both sides', () => {
    const config = draftWith(MODULES);
    const element = target(
      mount(
        '<div data-config-anchor="module|transfer-allow"><input id="transfer-allow-allowedUsers" /></div>'
      ),
      'input'
    );

    expect(resolveFocusedAnchorKey(element, config.compliance.modules)).toBe(
      'moduleConfig|transfer-allow|allowedUsers'
    );
    expect(composeThroughKey(element, config)).toBe(resolveFocusedConfigPath(element, config));
    expect(resolveFocusedConfigPath(element, config)).toContain('allowedUsers');
  });

  // -------------------------------------------------------------------------
  // The equivalence over hostile input — the same ~300 combinations the
  // resolver's own totality test uses
  // -------------------------------------------------------------------------
  it('agrees over ~300 hostile element/draft combinations, and never throws', () => {
    const base = createDefaultRwaConfig();
    const drafts: readonly RWAConfig[] = [
      base,
      draftWith([{ moduleId: 'transfer-allow' }]),
      draftWith(Array.from({ length: 6 }, (_, i) => ({ moduleId: `mod-${i}` }))),
    ];

    let seed = 0x1234;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;

    const tags = ['div', 'span', 'button', 'input', 'a', 'section'];
    const hostileValues = [
      '',
      '|',
      '||||',
      'module|',
      'moduleConfig|a|b|c|d',
      'claimTopic|NaN',
      'token|name',
      'token|[0]',
      'role|.a.b',
      'issuer|GA|extra',
      'módulo|ünïcode',
      '🙂|🙃',
      'transfer-allow-allowedUsers',
      'token-name',
      'x'.repeat(2_000),
    ];
    const attributeNames = ['data-config-anchor', 'data-field-id', 'id'];

    let agreedNonNull = 0;
    for (let i = 0; i < 300; i += 1) {
      const host = document.createElement('div');
      const outer = document.createElement(pick(tags));
      const inner = document.createElement(pick(tags));
      outer.setAttribute(pick(attributeNames), pick(hostileValues));
      inner.setAttribute(pick(attributeNames), pick(hostileValues));
      outer.appendChild(inner);
      host.appendChild(outer);
      document.body.appendChild(host);
      mounted.push(host);

      const config = pick(drafts);
      expect(() => composeThroughKey(inner, config)).not.toThrow();
      const viaKey = composeThroughKey(inner, config);
      const direct = resolveFocusedConfigPath(inner, config);
      expect(viaKey, `disagreement on combination ${i}`).toBe(direct);
      if (direct !== null) agreedNonNull += 1;
    }

    // Non-vacuity again: a run in which everything resolved to `null` would
    // agree perfectly and prove nothing.
    expect(agreedNonNull, 'the hostile run resolved nothing at all').toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // SF-12 INV-14's purity contract, inherited
  // -------------------------------------------------------------------------
  describe('inherits the purity contract (SF-12 INV-14, INV-16)', () => {
    it('returns null for a null element, the body, and a detached node', () => {
      expect(resolveFocusedAnchorKey(null, [])).toBeNull();
      expect(resolveFocusedAnchorKey(document.body, [])).toBeNull();

      const detached = document.createElement('div');
      detached.innerHTML = '<div data-config-anchor="claimTopic|1"><button>x</button></div>';
      expect(resolveFocusedAnchorKey(detached.querySelector('button'), [])).toBeNull();
    });

    it('two calls with the same element and modules return the same value', () => {
      const element = target(mount('<div data-config-anchor="claimTopic|1"><b>x</b></div>'), 'b');
      expect(resolveFocusedAnchorKey(element, MODULES)).toBe(
        resolveFocusedAnchorKey(element, MODULES)
      );
    });

    it('does not mutate the modules array it is given', () => {
      const modules = Object.freeze([...MODULES]);
      const element = target(
        mount('<div><input id="transfer-allow-allowedUsers" /></div>'),
        'input'
      );
      expect(() => resolveFocusedAnchorKey(element, modules)).not.toThrow();
      expect(modules).toEqual(MODULES);
    });

    /**
     * The key it returns is a **typed** `ConfigAnchorKey` with no cast, so it
     * always decodes. A cast would type-check, and a corrupted attribute would
     * then be stored as the subject and decode to `null` at read time — the
     * column silently describing nothing. INV-11.
     */
    it('every key it returns decodes', () => {
      for (const { html, selector, config } of FIXTURES) {
        const key = resolveFocusedAnchorKey(
          target(mount(html), selector),
          config.compliance.modules
        );
        if (key !== null) expect(parseConfigAnchor(key), `${key} does not decode`).not.toBeNull();
      }
    });
  });
});
