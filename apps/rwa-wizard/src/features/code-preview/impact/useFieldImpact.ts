import { useEffect, useState, type FocusEvent } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ConfigPath } from '../../wizard/config-path';
import { useFocusedConfigPath } from '../../wizard/focused-path';
import { useInspectedConfigPath } from '../../wizard/inspected-anchor';
import type { CodePreviewProvenance } from '../provenanceState';
import { toFieldImpactView, type FieldImpactView } from './fieldImpactView';
import { resolveImpactSubject } from './impactSubject';

/** Handlers the column spreads on its root element to implement the AS-3 latch. */
export interface FieldImpactLatchProps {
  readonly onPointerDownCapture: () => void;
  readonly onFocus: () => void;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
}

/**
 * The AS-3 latch: whether the user is inside the column, and what the column was
 * saying when they reached for it.
 *
 * **One piece of state and not two, deliberately.** `hasFocus` alone was enough
 * until a location that *resolves but does not exist yet* proved otherwise: the
 * reach nulls `livePath` while `inspectedPath` is already null, so there has to
 * be something to fall back to. Keeping the answer in the same slot as the flag
 * means the two can never disagree about whether the latch is armed, and it
 * keeps this hook at exactly one `useState` — a property the source scan pins.
 *
 * `config` is the draft the answer was resolved against, compared by reference
 * and never read into. It is what makes "no stored index outlives a draft
 * mutation" true in **form** and not merely in spirit: SF-13's INV-20 scan found
 * four draft mutations that fire from effects rather than from a control, so a
 * draft *can* be replaced mid-reach, and a `ConfigPath` carries indices that
 * would then name a different item. On a replacement the held answer is dropped
 * rather than trusted.
 */
interface ColumnLatch {
  readonly hasFocus: boolean;
  readonly answer: ConfigPath | null;
  /**
   * The draft in force when the latch was **armed**, captured by the arm
   * handlers and compared by reference at read time. Never read into.
   *
   * Captured at arm time rather than stored alongside each remembered answer,
   * and that is a performance property rather than a style choice: keeping the
   * draft out of the remembering path means an ordinary edit — which replaces
   * the draft object on every keystroke without moving which path is focused —
   * writes no state and costs the column no extra render. Storing it with the
   * answer made every draft change cost two renders instead of one, which
   * `PreviewImpactColumn`'s memo test caught.
   */
  readonly armedConfig: RWAConfig | null;
}

const LATCH_IDLE: ColumnLatch = { hasFocus: false, answer: null, armedConfig: null };

/**
 * Whether focus is inside the drawer's preview chrome.
 *
 * Covers:
 * - `.rwa-code-preview` — code pane / tree / impact body (SF-14 code-pane hold)
 * - `.rwa-code-preview-sheet` — kit header tools + Close (outside the inner row)
 * - `[data-rwa-preview-chrome]` — Radix dock-menu portal (leaves the sheet)
 *
 * The column latch covers pointer/focus into the impact rail; chrome focus was
 * left out for the code pane first, then for the dock dropdown — clause 1
 * treated those as "a live control that writes nothing" and wiped a resolvable
 * subject to `not-a-field`. Read off `document.activeElement` only after SF-12
 * has already re-rendered this hook for that focus move — the same gate as
 * `live.hasFocusedElement`, so the two cannot disagree about whether anything
 * is focused.
 */
function isPreviewChromeFocus(): boolean {
  const el = document.activeElement;
  if (!(el instanceof Element) || !el.isConnected || el.localName === 'body') return false;
  return (
    el.closest('.rwa-code-preview, .rwa-code-preview-sheet, [data-rwa-preview-chrome]') !== null
  );
}

/**
 * Arm the latch. Idempotent, so a focus move *between* rows inside the column
 * costs no render — React bails out when the updater returns `prev`.
 *
 * It captures nothing: by the time the user reaches the column the answer is
 * usually **already** gone, because tabbing there passes through controls that
 * write no config and clause 1 empties the column on the way. The answer is
 * maintained continuously by the effect in the hook instead. Getting this wrong
 * is what the layout probe caught: an arm-time capture looks right in a
 * browser-free test that focuses the control and then reaches straight into the
 * column, and fails on a real Tab walk, which passes through the code pane.
 */
const armLatch =
  (config: RWAConfig) =>
  (prev: ColumnLatch): ColumnLatch =>
    prev.hasFocus ? prev : { ...prev, hasFocus: true, armedConfig: config };

/** Release the latch, keeping the remembered answer — it is inert while unarmed. */
const releaseLatch = (prev: ColumnLatch): ColumnLatch =>
  prev.hasFocus ? { ...prev, hasFocus: false } : prev;

/**
 * Remember an answer the column actually rendered.
 *
 * A value comparison on a string union, so an edit that leaves the focused
 * control where it is returns `prev`, React bails out, and nothing re-renders.
 */
const rememberAnswer =
  (answer: ConfigPath) =>
  (prev: ColumnLatch): ColumnLatch =>
    prev.answer === answer ? prev : { ...prev, answer };

export interface FieldImpactBinding {
  readonly view: FieldImpactView;
  /**
   * Spread on the column's root element. Implements AS-3: while the user is
   * interacting with the column, it keeps describing the field it was
   * describing when they reached for it.
   */
  readonly latchProps: FieldImpactLatchProps;
}

/**
 * The column's data binding: SF-12's focus hook, the inspected subject, the
 * AS-3 latch, and the view.
 *
 * SF-12's hook is mounted **here** rather than in `WizardPage` on purpose. Up
 * there, a focus change anywhere in the app would re-render the whole wizard
 * form; down here it re-renders one 260px region. SF-12 also warns that the
 * object it returns is a fresh identity on every render, so this destructures
 * it and depends on the two primitives — never on the object.
 *
 * ## What replaced the held field, and why keeping both would have been wrong
 *
 * This hook used to hold `HeldField = { path, identity }` — a latched
 * `ConfigPath` stamped with the generate key of the draft it was resolved
 * against — plus a render-phase `setHeld` to keep it current. All of it is gone.
 *
 * The stamp existed because the latch **stored a resolved path**, and a path
 * carries array indices the draft can shift underneath it. The subject stores an
 * *anchor* instead, which carries only draft-independent identity and is
 * re-resolved against the live draft on every render — so there is no stored
 * index to go stale and nothing left to stamp. The property the stamp enforced
 * is not dropped, it is made structural: after any draft mutation the subject
 * names the same-identity item or nothing, never a different item. INV-25.
 *
 * Two consequences worth naming, because both read as regressions and neither
 * is. First, the render-phase state write is gone with it, so the
 * "Too many re-renders" hazard its convergence argument guarded against is
 * unreachable rather than merely unlikely (INV-29). Second, keeping the held
 * path *alongside* the subject would have been actively wrong: after an add, the
 * held path is the Add button's draft path — one slot past the item just created
 * — while the subject is the created item. Any priority that lets the held path
 * win reintroduces the defect inside the change that fixes it, and there is no
 * ordering of two overlapping caches that beats having one.
 *
 * ## What clause 4 brought back, and what it did not
 *
 * A latch over the *rendered answer* is back, scoped to one uninterrupted reach
 * into the column — see `ColumnLatch` above. It is worth being exact about why
 * that is not the held field returning:
 *
 * - `held` was consulted **whenever the live path was null**, so it competed with
 *   the subject and, after an add, held the Add button's pending path one slot
 *   past the created item. `latch.answer` is consulted only while the user is
 *   physically inside the column, and only after the subject and live focus have
 *   both come up empty.
 * - `held` needed a generate-key stamp because it outlived arbitrary draft
 *   mutations. `latch.answer` is dropped on any draft replacement by reference
 *   comparison, which is cheaper than a stamp and does not depend on a hash
 *   covering the right fields.
 * - `held` was written **during render**. This is written from the three latch
 *   handlers only, so the "Too many re-renders" hazard stays structurally absent.
 *
 * The subject remains the primary answer; clause 4 is a floor under the one case
 * where both live sources go quiet *because* of the user's own reach.
 *
 * `columnHasFocus` keeps its three invalidation inputs and its three handlers;
 * they now write a `ColumnLatch` rather than a boolean, and the arm handlers
 * capture the answer at the same instant.
 */
export function useFieldImpact(
  config: RWAConfig,
  provenance: CodePreviewProvenance | null
): FieldImpactBinding {
  const live = useFocusedConfigPath(config);
  const inspectedPath = useInspectedConfigPath(config);
  const [latch, setLatch] = useState<ColumnLatch>(LATCH_IDLE);

  // Code pane / tree / sheet-tool / dock-menu focus is reach without arming the
  // column latch: the remembered answer still backs pending locations (clause 4),
  // and the draft stamp applies only while the column latch itself is armed.
  const previewChromeHasFocus = live.hasFocusedElement && isPreviewChromeFocus();
  const reachHasFocus = latch.hasFocus || previewChromeHasFocus;
  const heldAnswer = !reachHasFocus
    ? null
    : latch.hasFocus && latch.armedConfig !== config
      ? null
      : previewChromeHasFocus &&
          !latch.hasFocus &&
          latch.armedConfig !== null &&
          latch.armedConfig !== config
        ? null
        : latch.answer;

  useEffect(() => {
    if (!previewChromeHasFocus || latch.hasFocus || latch.answer === null) {
      return;
    }
    if (latch.armedConfig !== null && latch.armedConfig !== config) {
      setLatch((prev) => ({ ...prev, answer: null, armedConfig: null }));
      return;
    }
    setLatch((prev) => (prev.armedConfig === config ? prev : { ...prev, armedConfig: config }));
  }, [previewChromeHasFocus, latch.hasFocus, latch.answer, latch.armedConfig, config]);

  const subjectInput = {
    inspectedPath,
    livePath: live.path,
    liveHasFocus: live.hasFocusedElement,
    columnHasFocus: reachHasFocus,
  };

  // What the column would say with nothing remembered — the honest answer, and
  // the only thing worth remembering. Computing it through the same function
  // with `heldAnswer: null` keeps one rule rather than two that can drift.
  const unheldPath = resolveImpactSubject({ ...subjectInput, heldAnswer: null });

  const path = resolveImpactSubject({ ...subjectInput, heldAnswer });

  // The fourth write, and the only one outside a handler. It runs after commit,
  // never during render, so the "Too many re-renders" hazard stays structurally
  // absent. It never overwrites a remembered answer with nothing: the whole
  // point is to survive the controls that write no config which the user tabs
  // through on the way to the column.
  useEffect(() => {
    if (unheldPath === null) return;
    setLatch(rememberAnswer(unheldPath));
  }, [unheldPath]);

  const latchProps: FieldImpactLatchProps = {
    // Capture-phase pointer press, which runs BEFORE any focus change. Without
    // it, a browser that does not focus a `<button>` on mousedown — or an
    // unlucky interleaving of `focusin` against React's synthetic `onFocus` —
    // renders one frame of `no-focus`: the rows vanish and reappear under the
    // cursor at the exact instant the user is reaching for one, and the click
    // may land on a different row than they aimed at. INV-16.
    onPointerDownCapture: () => setLatch(armLatch(config)),
    onFocus: () => setLatch(armLatch(config)),
    onBlur: (event) => {
      // Plain `contains`, never `containsComposed`: the column renders no
      // shadow root, and a `relatedTarget` inside the file tree's shadow root
      // is retargeted to its host — which is outside the column, so the latch
      // releases, which is the right answer. A composed walk would either
      // flicker or freeze the column on a stale field while the user browses a
      // different file. INV-17.
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setLatch(releaseLatch);
      }
    },
  };

  return {
    view: toFieldImpactView({
      provenance,
      path,
      hasFocusedElement: live.hasFocusedElement,
      config,
    }),
    latchProps,
  };
}
