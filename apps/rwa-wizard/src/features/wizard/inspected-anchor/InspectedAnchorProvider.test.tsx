import { act, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeConfig } from '../../../test/fixtures/wizardFixtures';
import { mountProvider } from '../../../test/helpers/inspectedAnchorHarness';
import { WIZARD_STEP_IDS } from '../../../types/wizard';
import {
  CLAIM_TOPIC_DRAFT_ANCHOR,
  claimTopicAnchor,
  CONFIG_ANCHOR_ATTR,
  issuerAnchor,
  issuerTopicsAnchor,
  tokenAnchor,
} from '../focused-path';

const TOPIC = claimTopicAnchor(1);
const ISSUER = issuerAnchor('GISSUER');
const ISSUER_TOPICS = issuerTopicsAnchor('GISSUER');
const TOKEN_NAME = tokenAnchor('name');

/**
 * Anchored markup, standing in for the wizard's own. Nothing here carries a
 * `tabIndex`, an `onClick` or a `role`: every write below travels through the
 * provider's two document listeners and the resolver's outward walk, which is
 * the whole mechanism under test.
 */
function AnchoredMarkup(): React.ReactElement {
  return (
    <div>
      <input data-testid="token-name" {...{ [CONFIG_ANCHOR_ATTR]: TOKEN_NAME }} />
      <span data-testid="chip" {...{ [CONFIG_ANCHOR_ATTR]: TOPIC }}>
        <button data-testid="chip-body" type="button">
          KYC
        </button>
      </span>
      <div data-testid="issuer-row" {...{ [CONFIG_ANCHOR_ATTR]: ISSUER }}>
        <button data-testid="issuer-remove" type="button" aria-label="Remove issuer">
          ×
        </button>
        <div data-testid="issuer-topics" {...{ [CONFIG_ANCHOR_ATTR]: ISSUER_TOPICS }}>
          <button data-testid="issuer-topic-pill" type="button">
            KYC
          </button>
        </div>
      </div>
      <button
        data-testid="add"
        type="button"
        {...{ [CONFIG_ANCHOR_ATTR]: CLAIM_TOPIC_DRAFT_ANCHOR }}
      >
        Add
      </button>
      <button data-testid="unanchored" type="button">
        outside the wizard
      </button>
    </div>
  );
}

const CANDIDATES = [TOKEN_NAME, TOPIC, ISSUER, ISSUER_TOPICS, CLAIM_TOPIC_DRAFT_ANCHOR] as const;

function mount(options: { scopeToken?: string } = {}) {
  return mountProvider({
    candidates: CANDIDATES,
    scopeToken: options.scopeToken,
    config: makeConfig({
      identityVerification: {
        ...makeConfig().identityVerification,
        claimTopics: [{ id: 1, name: 'KYC' }],
        trustedIssuers: [{ address: 'GISSUER', claimTopics: [1] }],
      },
    }),
    children: <AnchoredMarkup />,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('InspectedAnchorProvider', () => {
  // -------------------------------------------------------------------------
  // INV-15 — the subject changes on exactly four inputs
  // -------------------------------------------------------------------------
  describe('writes the subject on exactly four inputs (INV-15)', () => {
    it('input 1 — a document click resolving to an inspectable anchor', () => {
      const harness = mount();
      fireEvent.click(harness.getByTestId('chip-body'));
      expect(harness.probe.inspected()).toBe(TOPIC);
    });

    it('input 2 — a document focusin resolving to an inspectable anchor', () => {
      const harness = mount();
      act(() => {
        harness.getByTestId('token-name').focus();
      });
      expect(harness.probe.inspected()).toBe(TOKEN_NAME);
    });

    /**
     * Input 3 — an add handler calling `inspect` directly — is asserted against
     * the two real components in `inspectedAnchor.identity.integration.test.tsx`,
     * where the two opposite handler orderings live. It cannot be isolated here
     * without re-implementing the handler, which would assert the harness.
     */
    it('input 4 — a scopeToken change clears the subject', () => {
      const harness = mount();
      fireEvent.click(harness.getByTestId('chip-body'));
      expect(harness.probe.inspected()).toBe(TOPIC);

      harness.setProps({ scopeToken: 'a-different-scope' });
      expect(harness.probe.inspected()).toBeNull();
      expect(harness.probe.path()).toBeNull();
    });

    /**
     * **The non-input tests are the load-bearing half.** An input list is only as
     * good as its complement: the fifth writer anyone would add is a `focusout`
     * clear, because "focus left, so nothing is selected" reads as obviously
     * right — and it ships the reported defect.
     */
    describe('and nothing else — one negative test per non-input', () => {
      it('a focusout with a null relatedTarget is not an input (INV-17)', () => {
        const harness = mount();
        fireEvent.click(harness.getByTestId('chip-body'));
        fireEvent.focusOut(harness.getByTestId('chip-body'), { relatedTarget: null });
        expect(harness.probe.inspected()).toBe(TOPIC);
      });

      it('a focusout with a non-null relatedTarget is not an input (INV-17)', () => {
        const harness = mount();
        fireEvent.click(harness.getByTestId('chip-body'));
        fireEvent.focusOut(harness.getByTestId('chip-body'), {
          relatedTarget: harness.getByTestId('unanchored'),
        });
        expect(harness.probe.inspected()).toBe(TOPIC);
      });

      it('a focusout on an unanchored control is not an input (INV-17)', () => {
        const harness = mount();
        fireEvent.click(harness.getByTestId('chip-body'));
        fireEvent.focusOut(harness.getByTestId('unanchored'), { relatedTarget: null });
        expect(harness.probe.inspected()).toBe(TOPIC);
      });

      it('focus resting on the body is not an input (INV-17)', () => {
        const harness = mount();
        act(() => {
          harness.getByTestId('token-name').focus();
        });
        act(() => {
          (document.activeElement as HTMLElement | null)?.blur();
        });
        expect(document.activeElement === null || document.activeElement === document.body).toBe(
          true
        );
        expect(harness.probe.inspected()).toBe(TOKEN_NAME);
      });

      it('elapsed time is not an input', () => {
        vi.useFakeTimers();
        const harness = mount();
        fireEvent.click(harness.getByTestId('chip-body'));
        act(() => {
          vi.advanceTimersByTime(600_000);
        });
        expect(harness.probe.inspected()).toBe(TOPIC);
      });

      /**
       * The config object is an input to the *reader*, never to the subject. Here
       * the subject names a token field, which exists in every draft, so the
       * resolved path must survive a whole-config replacement untouched.
       */
      it('the config object is not an input to the subject', () => {
        const harness = mount();
        act(() => {
          harness.getByTestId('token-name').focus();
        });
        const before = harness.probe.path();

        harness.setProps({ config: makeConfig({ token: { ...makeConfig().token, name: 'X' } }) });
        expect(harness.probe.inspected()).toBe(TOKEN_NAME);
        expect(harness.probe.path()).toBe(before);
      });

      /**
       * A removal writes nothing: the `×` handlers are untouched and the subject
       * stops naming a removed item at *read* time instead. An event-driven
       * clear would be a guard that looks present in review and never runs —
       * React fires no event when it unmounts a focused element. INV-20.
       */
      it('a removal is not an input — clicking the `×` does not clear (INV-20)', () => {
        const harness = mount();
        fireEvent.click(harness.getByTestId('issuer-row'));
        expect(harness.probe.inspected()).toBe(ISSUER);

        fireEvent.click(harness.getByTestId('issuer-remove'));
        // The `×` resolves outward to the row's own anchor, so the subject is
        // unchanged rather than cleared — and *nothing* about removal wrote it.
        expect(harness.probe.inspected()).toBe(ISSUER);
      });

      it('an unanchored click resolves to nothing and leaves the subject alone', () => {
        const harness = mount();
        fireEvent.click(harness.getByTestId('chip-body'));
        fireEvent.click(harness.getByTestId('unanchored'));
        expect(harness.probe.inspected()).toBe(TOPIC);
      });

      it('a click on a draft anchor is refused, and leaves the subject alone (INV-8)', () => {
        const harness = mount();
        fireEvent.click(harness.getByTestId('chip-body'));
        fireEvent.click(harness.getByTestId('add'));
        expect(harness.probe.inspected()).toBe(TOPIC);
      });

      it('a draft anchor cannot become the subject from nothing (INV-8)', () => {
        const harness = mount();
        fireEvent.click(harness.getByTestId('add'));
        act(() => {
          harness.getByTestId('add').focus();
        });
        expect(harness.probe.inspected()).toBeNull();
        expect(harness.probe.path()).toBeNull();
      });

      it('the viewport is not an input', () => {
        const harness = mount();
        fireEvent.click(harness.getByTestId('chip-body'));
        act(() => {
          window.dispatchEvent(new Event('resize'));
        });
        expect(harness.probe.inspected()).toBe(TOPIC);
      });
    });
  });

  // -------------------------------------------------------------------------
  // INV-17 — the Safari guarantee, asserted structurally
  // -------------------------------------------------------------------------
  describe('does not change the subject when focus moves without a write (INV-17)', () => {
    /**
     * **Why this is asserted structurally and not behaviourally.** On Safari,
     * clicking a `<button>` does not focus it *and actively pulls focus off the
     * previously focused element*. No CI job in this repo runs Safari, and
     * Research measured that disabling the focused button fires **no** `focusout`
     * in happy-dom at all — so a clear-on-focus-departure would make the whole
     * feature Safari-only-broken with every test green. The property therefore
     * has to be the *absence of a listener*, asserted by its absence of effect
     * (here) and by the listener names (`inspectedAnchorSource.test.ts`).
     *
     * The three cases above cover the `focusout` arms. This one covers the arm
     * the harness *can* reproduce: React unmounting the anchored element that
     * held focus.
     */
    it('unmounting the focused anchored element leaves the subject, and the path drops separately', () => {
      const config = makeConfig({
        identityVerification: {
          ...makeConfig().identityVerification,
          claimTopics: [{ id: 1, name: 'KYC' }],
          trustedIssuers: [],
        },
      });
      const harness = mountProvider({
        candidates: [TOPIC],
        config,
        children: (
          <span data-testid="chip" {...{ [CONFIG_ANCHOR_ATTR]: TOPIC }}>
            <button data-testid="chip-body" type="button">
              KYC
            </button>
          </span>
        ),
      });

      act(() => {
        harness.getByTestId('chip-body').focus();
      });
      expect(harness.probe.inspected()).toBe(TOPIC);
      expect(harness.probe.path()).toBe('identityVerification.claimTopics[0]');

      // Remove the topic from the draft: the element unmounts with focus on it.
      harness.setProps({
        config: makeConfig({
          identityVerification: {
            ...config.identityVerification,
            claimTopics: [],
          },
        }),
      });

      // Two facts, asserted separately so the two mechanisms cannot be confused
      // for one another: the subject is untouched, and the *reader* returns null
      // because `anchorItemExists` says the item is gone.
      expect(harness.probe.inspected()).toBe(TOPIC);
      expect(harness.probe.path()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // INV-18 — a click selects with `activeElement` null
  // -------------------------------------------------------------------------
  describe('selects on click with activeElement null — the Safari path (INV-18)', () => {
    /**
     * `fireEvent.click` leaves `document.activeElement` null while still bubbling
     * to `document`. **The harness's inability to focus on click is what makes
     * this assertion meaningful, not what limits it**: this is precisely the
     * Safari case, directly assertable.
     */
    it.each([
      ['a chip body', 'chip-body', TOPIC],
      ['an issuer row background', 'issuer-row', ISSUER],
      ['an issuer row control', 'issuer-remove', ISSUER],
      ['a nested pill group', 'issuer-topic-pill', ISSUER_TOPICS],
      ['a plain anchored input — an excluded component’s shape', 'token-name', TOKEN_NAME],
    ])('clicking %s selects it', (_what, testId, expected) => {
      const harness = mount();
      const target = harness.getByTestId(testId);

      fireEvent.click(target);

      expect(
        document.activeElement === null || document.activeElement === document.body,
        'precondition: the harness did not focus on click, which is the Safari case'
      ).toBe(true);
      expect(harness.probe.inspected()).toBe(expected);
    });

    /**
     * Bubble phase, so a React `onClick` on the same element runs first and the
     * document listener still fires. A capture-phase listener, or one on the
     * wizard root rather than `document`, would make AS-1 and AS-3 work on Chrome
     * and Firefox — where focus already selected — and fail on Safari, which is
     * the browser the click writer exists for.
     */
    it('runs after a React onClick on the same element', () => {
      const order: string[] = [];
      const harness = mountProvider({
        candidates: [TOPIC],
        children: (
          <span {...{ [CONFIG_ANCHOR_ATTR]: TOPIC }}>
            <button data-testid="chip-body" type="button" onClick={() => order.push('react')}>
              KYC
            </button>
          </span>
        ),
        config: makeConfig({
          identityVerification: {
            ...makeConfig().identityVerification,
            claimTopics: [{ id: 1, name: 'KYC' }],
          },
        }),
      });

      fireEvent.click(harness.getByTestId('chip-body'));

      expect(order).toEqual(['react']);
      expect(harness.probe.inspected()).toBe(TOPIC);
    });
  });

  // -------------------------------------------------------------------------
  // INV-21 — the nearest-anchor rule resolves nesting
  // -------------------------------------------------------------------------
  describe('resolves nesting by the nearest anchor, with no hand-written guard (INV-21)', () => {
    it.each([
      ['the pill inside the group', 'issuer-topic-pill', ISSUER_TOPICS],
      ['the group background', 'issuer-topics', ISSUER_TOPICS],
      ['the row background', 'issuer-row', ISSUER],
      ['the row’s remove control', 'issuer-remove', ISSUER],
    ])('a click on %s resolves to the nearest anchor', (_what, testId, expected) => {
      const harness = mount();
      fireEvent.click(harness.getByTestId(testId));
      expect(harness.probe.inspected()).toBe(expected);
    });

    /**
     * AS-5, made trivially true by INV-6's *move*: the row and its `×` resolve to
     * the same anchor because there is only one attribute to find. Two attributes
     * could drift apart in a later edit and leave the user inspecting row 2 and
     * deleting row 1.
     */
    it('the row and its `×` resolve to the same anchor (INV-6, AS-5)', () => {
      const harness = mount();
      fireEvent.click(harness.getByTestId('issuer-row'));
      const fromRow = harness.probe.inspected();

      harness.setProps({ scopeToken: 'reset' });
      expect(harness.probe.inspected()).toBeNull();

      fireEvent.click(harness.getByTestId('issuer-remove'));
      expect(harness.probe.inspected()).toBe(fromRow);
    });
  });

  // -------------------------------------------------------------------------
  // INV-23 — the scope token
  // -------------------------------------------------------------------------
  describe('drops the subject on a scope change, and names the scope unambiguously (INV-23)', () => {
    const token = (resetKey: number, draftId: string | null, step: string): string =>
      `${resetKey}-${draftId ?? 'none'}-${step}`;

    it.each([
      ['resetKey', token(1, 'draft-a', 'identity')],
      ['activeDraftId', token(0, 'draft-b', 'identity')],
      ['currentStep', token(0, 'draft-a', 'compliance')],
    ])('one input at a time — %s moving alone drops the subject', (_which, next) => {
      const harness = mount({ scopeToken: token(0, 'draft-a', 'identity') });
      fireEvent.click(harness.getByTestId('chip-body'));
      expect(harness.probe.inspected()).toBe(TOPIC);

      harness.setProps({ scopeToken: next });
      expect(harness.probe.inspected()).toBeNull();
    });

    it('the same token re-rendered does not drop the subject', () => {
      const harness = mount({ scopeToken: token(0, 'draft-a', 'identity') });
      fireEvent.click(harness.getByTestId('chip-body'));
      harness.setProps({ scopeToken: token(0, 'draft-a', 'identity') });
      expect(harness.probe.inspected()).toBe(TOPIC);
    });

    /**
     * Injectivity over the **real** step ids, because the reachable collision is
     * an `activeDraftId` ending in `-<WizardStepId>` and a comment is not a test.
     * `resetKey` is a `number`, so the first segment cannot absorb a delimiter,
     * and `currentStep` is a closed union in the last position.
     */
    it('two different triples never produce the same token', () => {
      const draftIds = [null, 'draft-a', 'draft-b', 'draft-identity', 'a-review'];
      const seen = new Map<string, string>();

      for (const resetKey of [0, 1, 10]) {
        for (const draftId of draftIds) {
          for (const step of WIZARD_STEP_IDS) {
            const key = token(resetKey, draftId, step);
            const triple = `${resetKey}|${draftId ?? 'none'}|${step}`;
            const previous = seen.get(key);
            expect(previous ?? triple, `token ${key} is produced by two triples`).toBe(triple);
            seen.set(key, triple);
          }
        }
      }

      expect(seen.size).toBe(3 * draftIds.length * WIZARD_STEP_IDS.length);
    });
  });

  // -------------------------------------------------------------------------
  // INV-24 — the retargeted target, and a plain walk
  // -------------------------------------------------------------------------
  /**
   * A click inside the code preview's shadow root retargets to a host that
   * carries no anchor, so browsing generated files can never change what the
   * column claims the user's form field does. A composed walk would reach through
   * the boundary into elements that are not wizard markup — the reveal and the
   * impact directions crossed.
   */
  it('a click inside a shadow root does not change the subject (INV-24)', () => {
    const harness = mount();
    fireEvent.click(harness.getByTestId('chip-body'));
    expect(harness.probe.inspected()).toBe(TOPIC);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    shadow.appendChild(inner);

    fireEvent.click(inner);

    expect(harness.probe.inspected()).toBe(TOPIC);
    host.remove();
  });

  // -------------------------------------------------------------------------
  // INV-27 — exactly two document listeners, added once, both released
  // -------------------------------------------------------------------------
  describe('adds exactly two document listeners and releases both (INV-27)', () => {
    it('two added on mount, two removed on unmount, by name', () => {
      const add = vi.spyOn(document, 'addEventListener');
      const remove = vi.spyOn(document, 'removeEventListener');

      const harness = mountProvider({ children: null });
      const added = add.mock.calls
        .map((call) => call[0])
        .filter((n) => n === 'click' || n === 'focusin');
      expect(added.sort()).toEqual(['click', 'focusin']);

      harness.unmount();
      const removed = remove.mock.calls
        .map((call) => call[0])
        .filter((n) => n === 'click' || n === 'focusin');
      expect(removed.sort()).toEqual(['click', 'focusin']);

      add.mockRestore();
      remove.mockRestore();
    });

    /**
     * The effect's dependency array is empty on purpose: depending on the store
     * handle or on `scopeToken` would re-subscribe on every change, accumulating
     * listeners across a long session and racing their writes. This is what says
     * so — a re-subscribing effect adds a pair per token change.
     */
    it('a scopeToken change does not re-subscribe', () => {
      const add = vi.spyOn(document, 'addEventListener');
      const harness = mountProvider({ children: null, scopeToken: 'a' });
      const before = add.mock.calls.filter(
        (call) => call[0] === 'click' || call[0] === 'focusin'
      ).length;

      harness.setProps({ scopeToken: 'b' });
      harness.setProps({ scopeToken: 'c' });

      const after = add.mock.calls.filter(
        (call) => call[0] === 'click' || call[0] === 'focusin'
      ).length;
      expect(after).toBe(before);
      add.mockRestore();
    });

    /**
     * Repeated mount/unmount returns the listener count to where it started —
     * StrictMode's double-invocation is handled by the add/remove pair, not by a
     * flag.
     */
    it('mount/unmount cycles leave no listener behind', () => {
      const add = vi.spyOn(document, 'addEventListener');
      const remove = vi.spyOn(document, 'removeEventListener');

      for (let cycle = 0; cycle < 20; cycle += 1) {
        mountProvider({ children: null }).unmount();
      }

      const count = (spy: typeof add) =>
        spy.mock.calls.filter((call) => call[0] === 'click' || call[0] === 'focusin').length;
      expect(count(add)).toBe(count(remove));
      expect(count(add)).toBeGreaterThan(0);

      add.mockRestore();
      remove.mockRestore();
    });

    /** A fresh mount starts at `null`: the store dies with the provider (INV-33). */
    it('a fresh mount starts at null after a previous one held a subject', () => {
      const first = mount();
      fireEvent.click(first.getByTestId('chip-body'));
      expect(first.probe.inspected()).toBe(TOPIC);
      first.unmount();

      const second = mount();
      expect(second.probe.inspected()).toBeNull();
      expect(second.probe.path()).toBeNull();
    });
  });
});
