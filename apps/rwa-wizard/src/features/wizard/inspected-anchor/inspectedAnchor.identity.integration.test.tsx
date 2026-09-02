import { act, fireEvent, render, waitFor, type RenderResult } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';

import type { IdentityVerificationConfig, RWAConfig } from '@openzeppelin/rwa-config';
import { TooltipProvider } from '@openzeppelin/ui-components';

import { CopyProvider } from '../../../app/providers/CopyProvider';
import {
  collectFocusable,
  FIXTURE_CUSTOM_TOPIC,
  FIXTURE_ISSUER_A,
  FIXTURE_ISSUER_B,
  FIXTURE_PREDEFINED_TOPIC,
  fixtureDraft,
  STELLAR_TARGET_ID,
  stellarEcosystemMetadata,
} from '../../../test/helpers/focusedPathHarness';
import {
  claimTopicAnchor,
  CONFIG_ANCHOR_ATTR,
  issuerAnchor,
  issuerTopicsAnchor,
  type ConfigAnchorKey,
} from '../focused-path';
import { IdentityStep } from '../steps/identity/IdentityStep';
import { InspectedAnchorProvider } from './index';

/**
 * SF-14's adopted components, against the **real** identity step: INV-1 to INV-6
 * (the marker's render contract), INV-19 (an add handler's write survives its own
 * interaction, under **both** handler orderings), INV-21 (nesting), INV-34,
 * INV-35, INV-36 and INV-37 (accessibility).
 *
 * The step is rendered with the Stellar package's own metadata through the app's
 * enrichment seam and the § 8.5 fixture draft, the same way
 * `stepControls.enumeration.test.tsx` renders it — so the markup under test is
 * the wizard's, not a convenient reproduction of it. What this harness adds is
 * the provider above it and a **stateful** `onUpdate`: a `noop` would make every
 * add, remove and deselect assertion below vacuous.
 */

const PREDEFINED = claimTopicAnchor(FIXTURE_PREDEFINED_TOPIC.id);
const CUSTOM = claimTopicAnchor(FIXTURE_CUSTOM_TOPIC.id);
const ISSUER_A = issuerAnchor(FIXTURE_ISSUER_A);
const ISSUER_B = issuerAnchor(FIXTURE_ISSUER_B);
const ISSUER_A_TOPICS = issuerTopicsAnchor(FIXTURE_ISSUER_A);

const NEW_ISSUER = 'GNEWISSUERZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';

interface Harness extends RenderResult {
  /** The live draft's identity slice, as the stateful host holds it. */
  readonly identity: () => IdentityVerificationConfig;
  readonly setScope: (token: string) => void;
  /** Every element currently carrying this unit's marker. */
  readonly marked: () => HTMLElement[];
  readonly anchorOf: (element: Element) => string | null;
  readonly elementFor: (anchor: ConfigAnchorKey) => HTMLElement;
}

function StatefulIdentityStep({
  initial,
  onIdentity,
  scopeToken,
}: {
  initial: RWAConfig;
  onIdentity: (identity: IdentityVerificationConfig) => void;
  scopeToken: string;
}) {
  const [identity, setIdentity] = useState(initial.identityVerification);
  const metadata = stellarEcosystemMetadata();

  return (
    <InspectedAnchorProvider scopeToken={scopeToken} modules={initial.compliance.modules}>
      <IdentityStep
        identity={identity}
        maxTrustedIssuers={metadata.limits.maxTrustedIssuers}
        identityControlsMeta={metadata.identityControls}
        onUpdate={(patch) => {
          setIdentity((current) => {
            const next = { ...current, ...patch };
            onIdentity(next);
            return next;
          });
        }}
      />
    </InspectedAnchorProvider>
  );
}

function mountIdentityStep(): Harness {
  const draft = fixtureDraft();
  let latest = draft.identityVerification;
  let scopeToken = 'scope';

  const tree = (token: string) => (
    <CopyProvider targetId={STELLAR_TARGET_ID}>
      <TooltipProvider delayDuration={200}>
        <StatefulIdentityStep
          initial={draft}
          scopeToken={token}
          onIdentity={(identity) => {
            latest = identity;
          }}
        />
      </TooltipProvider>
    </CopyProvider>
  );

  const result = render(tree(scopeToken));

  return {
    ...result,
    identity: () => latest,
    setScope: (token) => {
      scopeToken = token;
      result.rerender(tree(scopeToken));
    },
    marked: () => [...result.container.querySelectorAll<HTMLElement>('[aria-current]')],
    anchorOf: (element) => element.getAttribute(CONFIG_ANCHOR_ATTR),
    elementFor: (anchor) => {
      const found = result.container.querySelector<HTMLElement>(
        `[${CONFIG_ANCHOR_ATTR}="${anchor}"]`
      );
      if (found === null) throw new Error(`no element carries ${anchor}`);
      return found;
    },
  };
}

/** The custom chip's own body button, the one a user clicks to inspect it. */
function chipBody(harness: Harness, anchor: ConfigAnchorKey): HTMLElement {
  const button = harness.elementFor(anchor).querySelector<HTMLElement>('button');
  if (button === null) throw new Error(`${anchor} renders no body button`);
  return button;
}

describe('the inspected anchor on the real identity step', () => {
  // -------------------------------------------------------------------------
  // INV-19 — the add handlers, under BOTH orderings
  // -------------------------------------------------------------------------
  /**
   * **The two adopted components have opposite Add-handler orderings, and the
   * add write survives both only because the competing write is refused — not
   * because it is early.**
   *
   * `TopicToggleGroup`'s Add is a plain synchronous `onClick`, so React's handler
   * runs first and the document listener second. `TrustedIssuersSection`'s is
   * `onClick={handleSubmit(handleAdd)}`, and react-hook-form's `handleSubmit`
   * returns an async function — so `handleAdd` runs in a **later microtask**,
   * after the document listener has already resolved the Add button. A suite that
   * covered only the synchronous ordering would pass while the async path was
   * protected by something nobody knew was load-bearing.
   */
  describe('an add handler’s write survives its own interaction (INV-19)', () => {
    it('synchronous ordering — TopicToggleGroup selects the created topic', () => {
      const harness = mountIdentityStep();
      const newId = 9500;

      fireEvent.change(harness.container.querySelector('#custom-topic-name')!, {
        target: { value: 'Accredited' },
      });
      fireEvent.change(harness.container.querySelector('#custom-topic-id')!, {
        target: { value: String(newId) },
      });

      const add = harness.elementFor('claimTopicDraft');
      fireEvent.click(add);

      // Synchronous handler: the created topic is the subject immediately.
      const created = claimTopicAnchor(newId);
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([created]);
      expect(harness.identity().claimTopics.map((topic) => topic.id)).toContain(newId);
    });

    it('async ordering — TrustedIssuersSection selects the created issuer', async () => {
      const harness = mountIdentityStep();

      fireEvent.change(harness.container.querySelector('#trusted-issuer-address')!, {
        target: { value: NEW_ISSUER },
      });

      const add = harness.elementFor('issuerDraft');
      await act(async () => {
        fireEvent.click(add);
      });

      await waitFor(() => {
        expect(harness.identity().trustedIssuers.map((issuer) => issuer.address)).toContain(
          NEW_ISSUER
        );
      });
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([
        issuerAnchor(NEW_ISSUER),
      ]);
    });

    /**
     * **The refusal, isolated — this is the assertion that says *why* both
     * orderings work.** In the async flow the document listener has already run
     * and resolved the Add button by the time `handleAdd` fires. If the Add
     * button's draft anchor were inspectable, the subject would be the *pending
     * slot* at this instant, and the reported AS-2 defect would be restored in
     * the very component the report came from. So: immediately after the click
     * and before the microtask, the subject must be **unchanged** — proof that
     * the competing write was refused rather than merely late.
     */
    it('the competing write is refused, not merely late — the async intermediate state', async () => {
      const harness = mountIdentityStep();

      // Establish a subject the refusal must leave alone.
      fireEvent.click(harness.elementFor(ISSUER_A));
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([ISSUER_A]);

      fireEvent.change(harness.container.querySelector('#trusted-issuer-address')!, {
        target: { value: NEW_ISSUER },
      });

      // The click alone, with no microtask flush: the document listener has run.
      fireEvent.click(harness.elementFor('issuerDraft'));
      expect(
        harness.marked().map((element) => harness.anchorOf(element)),
        'the Add button’s draft anchor became the subject — AS-2 restored'
      ).toEqual([ISSUER_A]);

      // Now let `handleSubmit` settle: the direct write lands and wins.
      await waitFor(() => {
        expect(harness.identity().trustedIssuers.map((issuer) => issuer.address)).toContain(
          NEW_ISSUER
        );
      });
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([
        issuerAnchor(NEW_ISSUER),
      ]);
    });

    /**
     * The repeat-entry focus return, which fires a `focusin` on a draft input.
     * Independent of the write above: the draft anchor that focus resolves to is
     * refused, so the `focusin` cannot overwrite the subject.
     */
    it('the focus return to the draft input does not overwrite the created item', () => {
      const harness = mountIdentityStep();

      fireEvent.change(harness.container.querySelector('#custom-topic-name')!, {
        target: { value: 'Accredited' },
      });
      fireEvent.change(harness.container.querySelector('#custom-topic-id')!, {
        target: { value: '9600' },
      });
      fireEvent.click(harness.elementFor('claimTopicDraft'));

      const created = claimTopicAnchor(9600);
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([created]);

      // Fire the focus event the handler's `.focus()` call would produce, again.
      act(() => {
        harness.container.querySelector<HTMLElement>('#custom-topic-name')!.focus();
      });
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([created]);
    });
  });

  // -------------------------------------------------------------------------
  // INV-1 / INV-2 — the marker and the column name the same location, once
  // -------------------------------------------------------------------------
  describe('marks at most one element, and only an item that exists (INV-1, INV-2)', () => {
    /**
     * **SF-17 restatement of SF-14's deselection half.**
     *
     * Superseded text (kept): *deselecting an inspected predefined topic drops
     * the marker in the same commit* — that assumed body-click remove-from-array
     * deselection and the `&& selected` inspected gate.
     *
     * Under SF-17: body inspects only; unselect writes `selected: false` and
     * keeps the topic in the array; inspected is `useIsInspected` alone. So an
     * inspected-then-unselected chip **keeps** its marker (AS-4 / SF-17 INV-1).
     * Truly deleted subjects still drop via `anchorItemExists` (INV-20) — covered
     * by the issuer-removal case below.
     */
    it('unselecting an inspected predefined topic keeps the marker (SF-17 INV-1 / AS-4)', () => {
      const harness = mountIdentityStep();

      const pill = chipBody(harness, PREDEFINED);
      act(() => {
        pill.focus();
      });
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([PREDEFINED]);

      // Selection control — not the body — toggles deploy-selection.
      const selection = harness
        .elementFor(PREDEFINED)
        .querySelector<HTMLElement>('button[aria-pressed]');
      expect(selection, 'SF-17: predefined chip must expose a selection control').not.toBeNull();
      fireEvent.click(selection!);

      const topic = harness
        .identity()
        .claimTopics.find((candidate) => candidate.id === FIXTURE_PREDEFINED_TOPIC.id);
      expect(topic, 'SF-17 INV-9: unselect keeps the topic in the array').toBeDefined();
      expect(topic!.selected).toBe(false);
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([PREDEFINED]);
    });

    /**
     * Superseded text (kept): *re-selecting it brings the marker back, with no
     * new write* — depended on the marker vanishing on unselect.
     *
     * Under SF-17 the marker never left; reselect omits the key and the marker
     * remains on the same subject throughout.
     */
    it('re-selecting an unselected inspected topic keeps the same marker (SF-17 INV-9)', () => {
      const harness = mountIdentityStep();
      const pill = chipBody(harness, PREDEFINED);
      const selection = () =>
        harness.elementFor(PREDEFINED).querySelector<HTMLElement>('button[aria-pressed]')!;

      act(() => {
        pill.focus();
      });
      fireEvent.click(selection());
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([PREDEFINED]);

      fireEvent.click(selection());
      const topic = harness
        .identity()
        .claimTopics.find((candidate) => candidate.id === FIXTURE_PREDEFINED_TOPIC.id)!;
      expect(topic).not.toHaveProperty('selected');
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([PREDEFINED]);
    });

    it('the mirror — an inspected custom chip keeps its marker, because it exists', () => {
      const harness = mountIdentityStep();
      fireEvent.click(chipBody(harness, CUSTOM));
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([CUSTOM]);
    });

    it('never more than one marked element, after each of a sequence of clicks', () => {
      const harness = mountIdentityStep();
      const targets: readonly ConfigAnchorKey[] = [
        PREDEFINED,
        CUSTOM,
        ISSUER_A,
        ISSUER_B,
        ISSUER_A_TOPICS,
      ];

      for (const anchor of targets) {
        fireEvent.click(harness.elementFor(anchor));
        expect(harness.marked().length, `two markers after clicking ${anchor}`).toBeLessThanOrEqual(
          1
        );
      }
    });

    /**
     * INV-2's premise, checked rather than assumed: every rendered
     * `ConfigAnchorKey` is unique in the markup. Without it, "one slot" would
     * still permit two marked elements.
     */
    it('every rendered anchor key is unique in the step', () => {
      const harness = mountIdentityStep();
      const keys = [
        ...harness.container.querySelectorAll<HTMLElement>(`[${CONFIG_ANCHOR_ATTR}]`),
      ].map((element) => element.getAttribute(CONFIG_ANCHOR_ATTR));

      expect(keys.length).toBeGreaterThan(5);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('a scope change drops the marker outright (INV-23)', () => {
      const harness = mountIdentityStep();
      fireEvent.click(harness.elementFor(ISSUER_A));
      expect(harness.marked()).toHaveLength(1);

      harness.setScope('0-draft-compliance');
      expect(harness.marked()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // INV-4 — only the two adopted kinds render a marker
  // -------------------------------------------------------------------------
  /**
   * The per-issuer topic pill group's anchor *can* become the subject and has no
   * marked carrier, by decision. Someone reading the absence as a bug and adding
   * `aria-current` to the row would make the row announce itself as current while
   * the column describes its claim-topic list — INV-1's violation, introduced by
   * a well-meant repair inside a superseded file.
   */
  it('a nested pill group becomes the subject with no marked carrier (INV-4, INV-21)', () => {
    const harness = mountIdentityStep();
    const group = harness.elementFor(ISSUER_A_TOPICS);
    const pill = group.querySelector<HTMLElement>('button')!;

    fireEvent.click(pill);

    // Nothing is marked — not the group, and not the enclosing row.
    expect(harness.marked()).toEqual([]);
    // …and the enclosing row is specifically not the subject: clicking the row
    // background afterwards is what changes the answer.
    fireEvent.click(harness.elementFor(ISSUER_A));
    expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([ISSUER_A]);
  });

  // -------------------------------------------------------------------------
  // INV-3 / INV-36 — the marker's shape, and its single carrier
  // -------------------------------------------------------------------------
  describe('expresses inspection as aria-current plus one ring (INV-3, INV-36)', () => {
    it.each([
      ['a custom chip', CUSTOM],
      ['an issuer row', ISSUER_A],
    ])('%s: the value is literally "true", on the anchor-carrying element', (_what, anchor) => {
      const harness = mountIdentityStep();
      fireEvent.click(harness.elementFor(anchor));

      const marked = harness.marked();
      expect(marked).toHaveLength(1);
      expect(marked[0]!.getAttribute('aria-current')).toBe('true');
      expect(harness.anchorOf(marked[0]!)).toBe(anchor);
    });

    /**
     * One truth, one carrier. Two carriers can disagree after any edit — the same
     * argument that makes *moving* the issuer anchor beat duplicating it (INV-6).
     */
    it('the chip’s inner button carries no aria-current', () => {
      const harness = mountIdentityStep();
      fireEvent.click(chipBody(harness, CUSTOM));

      const wrapper = harness.elementFor(CUSTOM);
      for (const button of wrapper.querySelectorAll('button')) {
        expect(button.hasAttribute('aria-current')).toBe(false);
      }
    });

    /**
     * The cue is an **outline** change, so it survives a monochrome render — the
     * same non-colour discipline SF-11 INV-15 took. A user with a colour-vision
     * difference must still be able to tell which of fifteen chips the column is
     * describing.
     */
    it.each([
      ['a custom chip', CUSTOM],
      ['an issuer row', ISSUER_A],
    ])('%s: the cue is a ring, not colour alone', (_what, anchor) => {
      const harness = mountIdentityStep();
      const before = harness.elementFor(anchor).className;
      fireEvent.click(harness.elementFor(anchor));
      const after = harness.elementFor(anchor).className;

      expect(after).not.toBe(before);
      expect(after).toContain('ring-1');
      expect(after).toContain('ring-primary');
      // Exactly one ring utility, so the marker cannot become two competing cues.
      expect(after.match(/\bring-\d\b/g) ?? []).toHaveLength(1);
    });

    /**
     * The chip's offset, and why it is not decoration: a custom chip is always
     * `selected`, which already paints `border-primary`, so an unoffset ring
     * lands immediately outside that border in the same hue and reads as a
     * doubled edge rather than a distinct state. `ring-offset-background` and not
     * a bare offset — `--tw-ring-offset-color` defaults to white, so without the
     * token the gap is a white notch in dark mode.
     */
    it('the chip’s ring is offset, with the background token; the row’s is not', () => {
      const harness = mountIdentityStep();
      fireEvent.click(chipBody(harness, CUSTOM));
      const chip = harness.elementFor(CUSTOM).className;
      expect(chip).toContain('ring-offset-1');
      expect(chip).toContain('ring-offset-background');

      fireEvent.click(harness.elementFor(ISSUER_A));
      expect(harness.elementFor(ISSUER_A).className).not.toContain('ring-offset');
    });
  });

  // -------------------------------------------------------------------------
  // INV-5 / INV-6 — the rendered structure
  // -------------------------------------------------------------------------
  describe('leaves the rendered structure intact (INV-5, INV-6)', () => {
    /**
     * The obvious "simplification" — a `<button>` with no handler looks dead, so
     * it becomes a `<span>` — would drop the custom chip out of the tab order and
     * make custom topics keyboard-unreachable. Silently: nothing behavioural
     * would notice, and the guarded-markup diff is the only other place it would
     * show.
     */
    it('a custom chip with no onClick is still a <button>, and still a tab stop', () => {
      const harness = mountIdentityStep();
      const wrapper = harness.elementFor(CUSTOM);

      expect(wrapper.localName).toBe('span');
      const body = wrapper.querySelector('button')!;
      expect(body.localName).toBe('BUTTON'.toLowerCase());
      expect(body.getAttribute('type')).toBe('button');
      expect(collectFocusable(wrapper)).toContain(body);
    });

    it('the chip renders wrapper, body, selection control, and a labelled remove button (SF-17)', () => {
      const harness = mountIdentityStep();
      const wrapper = harness.elementFor(CUSTOM);
      const buttons = [...wrapper.querySelectorAll('button')];

      // SF-14 INV-5 structure (body + ×) is superseded for three-affordance:
      // selection control sits between body and × (SF-17 INV-3 / INV-5).
      expect(buttons).toHaveLength(3);
      expect(buttons[1]!.getAttribute('aria-pressed')).toBe('true');
      expect(buttons[2]!.getAttribute('aria-label')).toBe(`Remove ${FIXTURE_CUSTOM_TOPIC.name}`);
    });

    /**
     * The anchor is **moved** onto the row, never duplicated onto both the row
     * and its `×`. Two attributes could drift apart in a later edit — the row
     * keeping `issuer|<addr>` while the `×` is re-keyed by index — and inspection
     * and removal would then disagree about which issuer is meant: the user
     * inspects row 2, presses its `×`, and row 1 disappears.
     */
    it('the issuer row carries its anchor on exactly one element', () => {
      const harness = mountIdentityStep();
      const row = harness.elementFor(ISSUER_A);

      expect(
        harness.container.querySelectorAll(`[${CONFIG_ANCHOR_ATTR}="${ISSUER_A}"]`)
      ).toHaveLength(1);
      // And nothing inside the row re-declares it.
      expect(row.querySelectorAll(`[${CONFIG_ANCHOR_ATTR}="${ISSUER_A}"]`)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // INV-20 — removal does not clear; the read side drops it
  // -------------------------------------------------------------------------
  it('removing the inspected issuer leaves no marker, with no store write (INV-20)', () => {
    const harness = mountIdentityStep();
    fireEvent.click(harness.elementFor(ISSUER_A));
    expect(harness.marked()).toHaveLength(1);

    const remove = harness
      .elementFor(ISSUER_A)
      .querySelector<HTMLElement>('button.size-7, button[class*="size-7"]');
    fireEvent.click(remove ?? harness.elementFor(ISSUER_A).querySelectorAll('button')[0]!);

    expect(harness.identity().trustedIssuers.map((issuer) => issuer.address)).not.toContain(
      FIXTURE_ISSUER_A
    );
    expect(harness.marked()).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // INV-34 / INV-35 — the keyboard route, with no new tab stop
  // -------------------------------------------------------------------------
  describe('is reachable and selectable without a pointer, adding no tab stop (INV-34, INV-35)', () => {
    /**
     * A programmatic `.focus()` fires a bubbling `focusin`, and here it lands on
     * a genuine `<button>` — so Research's Q1b trap (happy-dom focusing an element
     * with no `tabindex` where a real browser does not) does not apply to this
     * assertion.
     */
    it('focusing a custom chip’s body selects it', () => {
      const harness = mountIdentityStep();
      act(() => {
        chipBody(harness, CUSTOM).focus();
      });
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([CUSTOM]);
    });

    it('focusing a control inside an issuer row selects the row, by the outward walk', () => {
      const harness = mountIdentityStep();
      const control = harness.elementFor(ISSUER_A).querySelectorAll<HTMLElement>('button')[0]!;
      act(() => {
        control.focus();
      });
      expect(harness.marked().map((element) => harness.anchorOf(element))).toEqual([ISSUER_A]);
    });

    /**
     * The issuer row gains **no** tab stop: it is a `<div>` with no `role` and no
     * `tabindex`, so it does not enter `FOCUSABLE_SELECTOR`'s set. Adding
     * `tabIndex={-1}` would insert nothing into the tab order but invites the
     * next hand to write `tabIndex={0}`, which puts every issuer row in the tab
     * order and makes traversing a long list strictly worse.
     */
    it('the issuer row is not focusable and carries no role', () => {
      const harness = mountIdentityStep();
      const row = harness.elementFor(ISSUER_A);

      expect(row.localName).toBe('div');
      expect(row.hasAttribute('role')).toBe(false);
      expect(row.hasAttribute('tabindex')).toBe(false);
      expect(collectFocusable(harness.container)).not.toContain(row);
    });

    it('the marked state adds no focusable element anywhere in the step', () => {
      const harness = mountIdentityStep();
      const before = collectFocusable(harness.container).length;

      fireEvent.click(harness.elementFor(ISSUER_A));
      fireEvent.click(chipBody(harness, CUSTOM));

      expect(collectFocusable(harness.container)).toHaveLength(before);
    });
  });

  // -------------------------------------------------------------------------
  // INV-37 — every interactive element keeps an accessible name
  // -------------------------------------------------------------------------
  /**
   * `TrustedIssuersSection`'s `×` has **no** `aria-label` today. That is a real
   * pre-existing gap, recorded at INV-37 and deliberately **not fixed here** —
   * folding it into a superseded file would put an unrelated change under a
   * supersession reason that does not cover it. This test therefore asserts what
   * SF-14 is responsible for: the chip's label is intact, and the unit introduces
   * no *new* unnamed control.
   */
  it('the chip’s remove button keeps its accessible name (INV-37)', () => {
    const harness = mountIdentityStep();
    const removes = [...harness.container.querySelectorAll('button[aria-label^="Remove "]')];
    expect(removes.length).toBeGreaterThan(0);
    for (const button of removes) {
      expect(button.getAttribute('aria-label')!.length).toBeGreaterThan('Remove '.length);
    }
  });

  // -------------------------------------------------------------------------
  // INV-13 — the same step, with no provider, is inert and throws nothing
  // -------------------------------------------------------------------------
  /**
   * `anchoredComponents.test.tsx`, `renderStep` and the 25-file markup guard all
   * render these components with no provider. A throwing hook would take all
   * three down; this is that property stated for the two adopted components
   * directly.
   */
  it('the step renders inert with no provider above it (INV-13)', () => {
    const draft = fixtureDraft();
    const metadata = stellarEcosystemMetadata();

    let result!: RenderResult;
    expect(() => {
      result = render(
        <CopyProvider targetId={STELLAR_TARGET_ID}>
          <TooltipProvider delayDuration={200}>
            <IdentityStep
              identity={draft.identityVerification}
              maxTrustedIssuers={metadata.limits.maxTrustedIssuers}
              identityControlsMeta={metadata.identityControls}
              onUpdate={() => {}}
            />
          </TooltipProvider>
        </CopyProvider>
      );
    }).not.toThrow();

    const anchor = result.container.querySelector<HTMLElement>(
      `[${CONFIG_ANCHOR_ATTR}="${ISSUER_A}"]`
    )!;
    fireEvent.click(anchor);
    act(() => {
      anchor.querySelector<HTMLElement>('button')!.focus();
    });

    expect(result.container.querySelectorAll('[aria-current]')).toHaveLength(0);
    result.unmount();
  });
});
