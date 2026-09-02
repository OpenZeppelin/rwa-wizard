import { afterEach, describe, expect, it } from 'vitest';

import type { ComplianceModuleSelection, RWAConfig } from '@openzeppelin/rwa-config';

import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import { isFocusTarget, resolveFocusedConfigPath } from './resolveFocusedConfigPath';

/**
 * INV-14 (totality and purity), INV-15 (the walk's precedence) and INV-16 (a
 * detached element resolves to `null`).
 *
 * Every fragment here is hand-rolled rather than rendered: the walk is a
 * property of the *element and the draft*, and building the DOM by hand is the
 * only way to reach shapes the wizard cannot currently produce — a malformed
 * attribute, two nested anchors, a field root inside an anchor — which is where
 * the precedence rules actually bite.
 */

function draftWith(modules: ComplianceModuleSelection[] = []): RWAConfig {
  const base = createDefaultRwaConfig();
  return { ...base, compliance: { modules } };
}

const mounted: HTMLElement[] = [];

/** Attach a fragment to the document so `isConnected` is true. */
function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  mounted.push(host);
  return host;
}

/** Build the same fragment *without* attaching it. */
function detach(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
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

// ---------------------------------------------------------------------------
// INV-15 — the ordered walk
// ---------------------------------------------------------------------------

describe('INV-15 — walk precedence', () => {
  it('returns null for a null element', () => {
    expect(resolveFocusedConfigPath(null, draftWith())).toBeNull();
  });

  it('returns null for the body', () => {
    expect(resolveFocusedConfigPath(document.body, draftWith())).toBeNull();
  });

  it('returns null for an element with neither an id nor an identifying ancestor', () => {
    const host = mount('<div><button id="not-registered">x</button></div>');
    expect(resolveFocusedConfigPath(target(host, 'button'), draftWith())).toBeNull();
  });

  it('resolves a registered static leaf id', () => {
    const host = mount('<div><input id="token-name" /></div>');
    expect(resolveFocusedConfigPath(target(host, 'input'), draftWith())).toBe('token.name');
  });

  it('resolves a dynamic module-config leaf id', () => {
    const host = mount('<div><input id="transfer-allow-allowedUsers" /></div>');
    const draft = draftWith([{ moduleId: 'supply-limit' }, { moduleId: 'transfer-allow' }]);
    expect(resolveFocusedConfigPath(target(host, 'input'), draft)).toBe(
      'compliance.modules[1].config.allowedUsers'
    );
  });

  /**
   * The precedence that matters most. Ancestor-first ordering would coarsen
   * every scalar module-config field to its module entry — a uniform, silent
   * loss of precision that no single test would be looking for.
   */
  it('the leaf id beats an enclosing anchor', () => {
    const host = mount(
      '<div data-config-anchor="module|supply-limit"><input id="supply-limit-limit" /></div>'
    );
    const draft = draftWith([{ moduleId: 'supply-limit' }]);
    expect(resolveFocusedConfigPath(target(host, 'input'), draft)).toBe(
      'compliance.modules[0].config.limit'
    );
  });

  it('an unregistered leaf id falls through to the enclosing anchor rather than failing', () => {
    const host = mount(
      '<div data-config-anchor="module|supply-limit"><button id="totally-unknown">x</button></div>'
    );
    const draft = draftWith([{ moduleId: 'supply-limit' }]);
    expect(resolveFocusedConfigPath(target(host, 'button'), draft)).toBe('compliance.modules[0]');
  });

  it('a registered leaf id inside another cluster still resolves by its id', () => {
    const host = mount(
      '<div data-config-anchor="module|supply-limit"><input id="token-name" /></div>'
    );
    expect(resolveFocusedConfigPath(target(host, 'input'), draftWith())).toBe('token.name');
  });

  it('the nearest of two nested anchors wins', () => {
    const host = mount(
      '<div data-config-anchor="module|supply-limit">' +
        '<div data-config-anchor="role|Manager"><button>x</button></div>' +
        '</div>'
    );
    const draft = draftWith([{ moduleId: 'supply-limit' }]);
    expect(resolveFocusedConfigPath(target(host, 'button'), draft)).toBe(
      'accessControl.roles[0].addresses'
    );
  });

  it('the anchor on the element itself wins over one on an ancestor', () => {
    const host = mount(
      '<div data-config-anchor="module|supply-limit">' +
        '<button data-config-anchor="ownershipType">x</button>' +
        '</div>'
    );
    const draft = draftWith([{ moduleId: 'supply-limit' }]);
    expect(resolveFocusedConfigPath(target(host, 'button'), draft)).toBe(
      'accessControl.ownership.type'
    );
  });

  it('a nearer `data-field-id` beats a farther `data-config-anchor`', () => {
    const host = mount(
      '<div data-config-anchor="module|supply-limit">' +
        '<div data-field-id="transfer-allow-allowedUsers"><button>x</button></div>' +
        '</div>'
    );
    const draft = draftWith([{ moduleId: 'supply-limit' }, { moduleId: 'transfer-allow' }]);
    expect(resolveFocusedConfigPath(target(host, 'button'), draft)).toBe(
      'compliance.modules[1].config.allowedUsers'
    );
  });

  it('a nearer `data-config-anchor` beats a farther `data-field-id`', () => {
    const host = mount(
      '<div data-field-id="transfer-allow-allowedUsers">' +
        '<div data-config-anchor="ownershipType"><button>x</button></div>' +
        '</div>'
    );
    const draft = draftWith([{ moduleId: 'transfer-allow' }]);
    expect(resolveFocusedConfigPath(target(host, 'button'), draft)).toBe(
      'accessControl.ownership.type'
    );
  });

  it('`data-field-id` wins over `data-config-anchor` on the same element', () => {
    const host = mount(
      '<div data-field-id="transfer-allow-allowedUsers" data-config-anchor="module|supply-limit">' +
        '<button>x</button>' +
        '</div>'
    );
    const draft = draftWith([{ moduleId: 'supply-limit' }, { moduleId: 'transfer-allow' }]);
    expect(resolveFocusedConfigPath(target(host, 'button'), draft)).toBe(
      'compliance.modules[1].config.allowedUsers'
    );
  });

  /**
   * The longest-match split, with the ambiguity that is actually reachable:
   * module `a-b` field `c` against module `a` field `b-c` produce the same id.
   * The rule takes the longest module id, so the answer is deterministic — and
   * INV-11's catalog sweep is what proves no real catalog contains the pair.
   */
  it('splits a dynamic id on the longest matching module id', () => {
    const host = mount('<div><input id="a-b-c" /></div>');
    const draft = draftWith([{ moduleId: 'a' }, { moduleId: 'a-b' }]);
    expect(resolveFocusedConfigPath(target(host, 'input'), draft)).toBe(
      'compliance.modules[1].config.c'
    );
  });

  it('an id that is exactly a module id with no field suffix does not split', () => {
    const host = mount('<div><input id="supply-limit-" /></div>');
    const draft = draftWith([{ moduleId: 'supply-limit' }]);
    expect(resolveFocusedConfigPath(target(host, 'input'), draft)).toBeNull();
  });

  it('a module-config id for a module that is not selected does not split', () => {
    const host = mount('<div><input id="transfer-allow-allowedUsers" /></div>');
    expect(resolveFocusedConfigPath(target(host, 'input'), draftWith([]))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// INV-10 at the resolver level — malformed reads exactly like absent
// ---------------------------------------------------------------------------

describe('INV-10 at the resolver — a malformed value reads like an absent one', () => {
  const draft = draftWith([{ moduleId: 'supply-limit' }]);

  it.each([
    ['', 'an empty value'],
    ['nope', 'an unknown kind'],
    ['claimTopic|1.5', 'a non-integer topic id'],
    ['moduleConfig|only-one', 'a missing segment'],
    ['a|b|c|d', 'too many segments'],
  ])('a malformed leaf anchor (%j — %s) falls through to the enclosing anchor', (value) => {
    const withAttr = mount(
      `<div data-config-anchor="module|supply-limit"><button data-config-anchor="${value}">x</button></div>`
    );
    const withoutAttr = mount(
      '<div data-config-anchor="module|supply-limit"><button>x</button></div>'
    );

    const malformed = resolveFocusedConfigPath(target(withAttr, 'button'), draft);
    const absent = resolveFocusedConfigPath(target(withoutAttr, 'button'), draft);

    expect(malformed).toBe(absent);
    expect(malformed).toBe('compliance.modules[0]');
  });

  it('a malformed anchor with nothing outside it resolves to null, like an absent one', () => {
    const withAttr = mount('<div><button data-config-anchor="nope">x</button></div>');
    const withoutAttr = mount('<div><button>x</button></div>');
    expect(resolveFocusedConfigPath(target(withAttr, 'button'), draft)).toBe(
      resolveFocusedConfigPath(target(withoutAttr, 'button'), draft)
    );
    expect(resolveFocusedConfigPath(target(withAttr, 'button'), draft)).toBeNull();
  });

  it('a malformed `data-field-id` does not block the anchor on the same element', () => {
    const host = mount(
      '<div data-field-id="not-a-known-identifier" data-config-anchor="ownershipType">' +
        '<button>x</button></div>'
    );
    expect(resolveFocusedConfigPath(target(host, 'button'), draft)).toBe(
      'accessControl.ownership.type'
    );
  });
});

// ---------------------------------------------------------------------------
// INV-16 — the detached gate
// ---------------------------------------------------------------------------

describe('INV-16 — a detached element resolves to null', () => {
  const draft = draftWith([{ moduleId: 'supply-limit' }, { moduleId: 'transfer-allow' }]);

  it('a detached subtree that would otherwise resolve returns null', () => {
    const html =
      '<div data-config-anchor="module|transfer-allow">' +
      '<input id="transfer-allow-allowedUsers" /></div>';

    const attached = mount(html);
    const detached = detach(html);

    // The control speaks for itself: the *same markup* resolves when attached.
    expect(resolveFocusedConfigPath(target(attached, 'input'), draft)).toBe(
      'compliance.modules[1].config.allowedUsers'
    );
    expect(resolveFocusedConfigPath(target(detached, 'input'), draft)).toBeNull();
  });

  it('holds for a leaf id with no ancestor anchor', () => {
    const detached = detach('<div><input id="token-name" /></div>');
    expect(resolveFocusedConfigPath(target(detached, 'input'), draft)).toBeNull();
  });

  it('holds for an element that is only reachable through an ancestor anchor', () => {
    const detached = detach('<div data-config-anchor="ownershipType"><button>x</button></div>');
    expect(resolveFocusedConfigPath(target(detached, 'button'), draft)).toBeNull();
  });

  /**
   * The gate is checked *before* the id lookup and before `closest()`, and the
   * reason is not stylistic: `element.id` reads fine on a detached node and
   * `Element.closest()` traverses a detached subtree happily, so a gate placed
   * later would still be reached — but only after the walk had already produced
   * an answer that a careless refactor could return.
   */
  it('`isFocusTarget` reports a detached element as not focused', () => {
    const detached = detach('<div><input id="token-name" /></div>');
    expect(isFocusTarget(target(detached, 'input'))).toBe(false);

    const attached = mount('<div><input id="token-name" /></div>');
    expect(isFocusTarget(target(attached, 'input'))).toBe(true);
  });

  /**
   * **Why detached is "not focused" rather than "focused, writes nothing."**
   *
   * The hook returns `{ path, hasFocusedElement }`, and it would be superficially
   * reasonable to report a detached element as `hasFocusedElement: true` with a
   * `null` path — it *was* focused, after all. That is the wrong call, and this
   * test exists so a later reader does not "simplify" it back.
   *
   * A consumer renders `hasFocusedElement && path === null` as "this control
   * affects no generated code". Saying that about a control React has already
   * unmounted is a false statement about a control that no longer exists — which
   * swaps one false statement for another and re-opens INV-16 from the other
   * side. `false` is the only reading that is true of a node that is not on the
   * page.
   */
  it('reports detached as *not focused*, not as focused-writes-nothing', () => {
    const detached = detach(
      '<div data-config-anchor="module|transfer-allow"><input id="transfer-allow-allowedUsers" /></div>'
    );
    const element = target(detached, 'input');
    expect(isFocusTarget(element)).toBe(false);
    expect(resolveFocusedConfigPath(element, draft)).toBeNull();
  });

  it('`isFocusTarget` rejects the body and a non-Element target', () => {
    expect(isFocusTarget(document.body)).toBe(false);
    expect(isFocusTarget(null)).toBe(false);
    // `focusin.target` is typed `EventTarget`; a Document can arrive here.
    expect(isFocusTarget(document as unknown as Element)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// INV-14 — totality, purity, and no `document`
// ---------------------------------------------------------------------------

describe('INV-14 — total and pure', () => {
  /** Drafts whose five slices are empty, singleton and populated. */
  const drafts: readonly RWAConfig[] = (() => {
    const base = createDefaultRwaConfig();
    return [
      base,
      {
        ...base,
        compliance: { modules: [{ moduleId: 'transfer-allow' }] },
        accessControl: {
          ownership: { type: 'dao', address: 'G' },
          roles: [{ name: 'Manager', addresses: ['G'] }],
        },
        identityVerification: {
          ...base.identityVerification,
          claimTopics: [{ id: 1, name: 'KYC' }],
          trustedIssuers: [{ address: 'GAAA', claimTopics: [1] }],
        },
      },
      {
        ...base,
        compliance: {
          modules: Array.from({ length: 6 }, (_, i) => ({ moduleId: `mod-${i}` })),
        },
        accessControl: {
          ownership: { type: 'multi-sig', address: 'G' },
          roles: Array.from({ length: 5 }, (_, i) => ({ name: `R${i}`, addresses: ['G'] })),
        },
        identityVerification: {
          ...base.identityVerification,
          claimTopics: Array.from({ length: 8 }, (_, i) => ({ id: i, name: `t${i}` })),
          trustedIssuers: Array.from({ length: 4 }, (_, i) => ({
            address: `G${i}`,
            claimTopics: [],
          })),
        },
      },
    ];
  })();

  it('never throws and always returns a string or null, over ~300 hostile combinations', () => {
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
      'token|[0]',
      'role|.a.b',
      'issuer|GA|extra',
      'módulo|ünïcode',
      '🙂|🙃',
      'x'.repeat(10_000),
      'module|' + 'y'.repeat(5_000),
    ];
    const attributeNames = ['data-config-anchor', 'data-field-id', 'id'];

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

      const draft = pick(drafts);
      expect(() => resolveFocusedConfigPath(inner, draft)).not.toThrow();
      const result = resolveFocusedConfigPath(inner, draft);
      expect(result === null || typeof result === 'string').toBe(true);
      expect(result).not.toBeUndefined();
    }
  });

  it('does not mutate a deeply frozen draft', () => {
    const deepFreeze = <T>(value: T): T => {
      if (value === null || typeof value !== 'object') return value;
      Object.freeze(value);
      for (const entry of Object.values(value as Record<string, unknown>)) deepFreeze(entry);
      return value;
    };

    const draft = deepFreeze(draftWith([{ moduleId: 'transfer-allow' }]));
    const host = mount('<div><input id="transfer-allow-allowedUsers" /></div>');
    expect(() => resolveFocusedConfigPath(target(host, 'input'), draft)).not.toThrow();
    expect(resolveFocusedConfigPath(target(host, 'input'), draft)).toBe(
      'compliance.modules[0].config.allowedUsers'
    );
  });

  it('two calls with the same element and draft return the same value', () => {
    const draft = draftWith([{ moduleId: 'transfer-allow' }]);
    const host = mount('<div><input id="transfer-allow-allowedUsers" /></div>');
    const element = target(host, 'input');
    expect(resolveFocusedConfigPath(element, draft)).toBe(resolveFocusedConfigPath(element, draft));
  });

  /**
   * INV-14's "never reads `document`" clause, made falsifiable: the resolver is
   * called against a *foreign document*'s element, where every global-`document`
   * lookup would miss. A resolver reaching for `document.body` or
   * `document.contains` would answer differently here, or throw.
   */
  it('reads only node properties — an element from another document still resolves', () => {
    const foreign = document.implementation.createHTMLDocument('foreign');
    foreign.body.innerHTML =
      '<div data-config-anchor="module|transfer-allow"><input id="transfer-allow-allowedUsers" /></div>';
    const element = foreign.querySelector('input');
    expect(element).not.toBeNull();

    const draft = draftWith([{ moduleId: 'transfer-allow' }]);
    expect(resolveFocusedConfigPath(element, draft)).toBe(
      'compliance.modules[0].config.allowedUsers'
    );

    // And the body of *that* document is still "focus resting on nothing".
    expect(resolveFocusedConfigPath(foreign.body, draft)).toBeNull();
  });
});
