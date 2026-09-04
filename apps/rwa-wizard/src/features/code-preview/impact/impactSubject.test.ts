import { describe, expect, it } from 'vitest';

import {
  availableProvenance,
  mixedGroups,
  unsupportedProvenance,
} from '../../../test/helpers/impactHarness';
import {
  findTokenAcross,
  readScannedSources,
  type ScannedSource,
} from '../../../test/helpers/sourceScan';
import type { ConfigPath } from '../../wizard/config-path';
import { toFieldImpactView } from './fieldImpactView';
import { resolveImpactSubject, type ImpactSubjectInput } from './impactSubject';

/**
 * SF-14 INV-22 (`resolveImpactSubject`'s three clauses, in order, over four
 * inputs), INV-31 (the subject is orthogonal to the four provenance states, and
 * `hasFocusedElement` is never invented) and INV-32 (the fourth reachable input
 * state is the AS-2 case).
 *
 * **The entire argument for a pure seam lives in the table below.** Research
 * measured that disabling the focused button fires *no* `focusout` in happy-dom
 * and leaves `activeElement` on it, so row 3 — the reported AS-2 defect — is
 * **not reproducible in this suite at all**. It is assertable only because
 * `resolveImpactSubject` is a pure function of four values, so the row is a
 * table entry rather than a focus simulation. Nothing here claims to reproduce
 * the defect.
 */

const P = 'token.name' as ConfigPath;
const PENDING_SLOT = 'identityVerification.trustedIssuers[2]' as ConfigPath;
const CREATED = 'identityVerification.trustedIssuers[1]' as ConfigPath;
const STALE = 'identityVerification.claimTopics[0]' as ConfigPath;
const NEW_STEP_CONTROL = 'compliance.modules[0]' as ConfigPath;

interface Row {
  readonly n: number;
  readonly situation: string;
  readonly input: ImpactSubjectInput;
  readonly expected: ConfigPath | null;
}

/**
 * All twelve rows of INV-22's case table, transcribed. Each `#` matches the
 * invariant's numbering so a disagreement between the document and the code has
 * one obvious place to be resolved.
 */
const ROWS: readonly Row[] = [
  {
    n: 1,
    situation: 'the inspected control also has focus',
    input: {
      inspectedPath: P,
      livePath: P,
      liveHasFocus: true,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: P,
  },
  {
    n: 2,
    situation: 'include-identity-support has focus — a live control that writes nothing',
    input: {
      inspectedPath: STALE,
      livePath: null,
      liveHasFocus: true,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: null,
  },
  {
    n: 3,
    situation: 'the Add button disabled itself; focus is on <body> — AS-2',
    input: {
      inspectedPath: CREATED,
      livePath: null,
      liveHasFocus: false,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: CREATED,
  },
  {
    n: 4,
    situation: 'the user clicked into the column — AS-3',
    input: {
      inspectedPath: STALE,
      livePath: null,
      liveHasFocus: true,
      columnHasFocus: true,
      heldAnswer: null,
    },
    expected: STALE,
  },
  {
    n: 5,
    situation: 'the user tabbed into the column',
    input: {
      inspectedPath: STALE,
      livePath: null,
      liveHasFocus: true,
      columnHasFocus: true,
      heldAnswer: null,
    },
    expected: STALE,
  },
  {
    n: 6,
    situation: 'the address input has focus after an add — AS-2 with repeat entry',
    input: {
      inspectedPath: CREATED,
      livePath: PENDING_SLOT,
      liveHasFocus: true,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: CREATED,
  },
  {
    n: 7,
    situation: 'the address input has focus, nothing inspected — unchanged from today',
    input: {
      inspectedPath: null,
      livePath: PENDING_SLOT,
      liveHasFocus: true,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: PENDING_SLOT,
  },
  {
    n: 8,
    situation: 'a custom chip’s body was clicked, browser that focuses on click — AS-1',
    input: {
      inspectedPath: P,
      livePath: P,
      liveHasFocus: true,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: P,
  },
  {
    n: 8,
    situation: 'a custom chip’s body was clicked, browser that does not — AS-1 on Safari',
    input: {
      inspectedPath: P,
      livePath: null,
      liveHasFocus: false,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: P,
  },
  {
    n: 9,
    situation: 'the inspected item was removed and focus went with it',
    input: {
      inspectedPath: null,
      livePath: null,
      liveHasFocus: false,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: null,
  },
  {
    n: 10,
    situation: 'a predefined pill was deselected; focus stays on it — unchanged from today',
    input: {
      inspectedPath: null,
      livePath: PENDING_SLOT,
      liveHasFocus: true,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: PENDING_SLOT,
  },
  {
    n: 11,
    situation: 'the drawer just opened, nothing touched',
    input: {
      inspectedPath: null,
      livePath: null,
      liveHasFocus: false,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: null,
  },
  {
    n: 12,
    situation: 'the user changed step — the scope token dropped the subject, a control resolves',
    input: {
      inspectedPath: null,
      livePath: NEW_STEP_CONTROL,
      liveHasFocus: true,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: NEW_STEP_CONTROL,
  },
  {
    n: 12,
    situation: 'the user changed step — the scope token dropped the subject, nothing resolves',
    input: {
      inspectedPath: null,
      livePath: null,
      liveHasFocus: false,
      columnHasFocus: false,
      heldAnswer: null,
    },
    expected: null,
  },
];

describe('resolveImpactSubject — the twelve-row case table (INV-22)', () => {
  it.each(ROWS)('row $n — $situation', ({ input, expected }) => {
    expect(resolveImpactSubject(input)).toBe(expected);
  });

  it('covers all twelve rows', () => {
    expect(new Set(ROWS.map((row) => row.n))).toEqual(
      new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    );
    // Row 8's "✔ or ✘" pairs are correlated, not free; both correlated cases are
    // present, and so are row 12's two arms.
    expect(ROWS.filter((row) => row.n === 8)).toHaveLength(2);
    expect(ROWS.filter((row) => row.n === 12)).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // The clauses, isolated
  // -------------------------------------------------------------------------
  describe('clause 1 — a live control that writes nothing, outside the column, wins', () => {
    it('clears the subject when focus is outside the column', () => {
      expect(
        resolveImpactSubject({
          inspectedPath: P,
          livePath: null,
          liveHasFocus: true,
          columnHasFocus: false,
          heldAnswer: null,
        })
      ).toBeNull();
    });

    /**
     * **The `!columnHasFocus` restriction is load-bearing.** A control *inside*
     * the column also writes nothing, so without it the latch would clear the
     * moment the user reached for a row — rows 4 and 5, and SF-13's AS-3 broken
     * by the clause meant to keep the column honest.
     */
    it('is restricted to focus outside the column — rows 4 and 5', () => {
      expect(
        resolveImpactSubject({
          inspectedPath: P,
          livePath: null,
          liveHasFocus: true,
          columnHasFocus: true,
          heldAnswer: null,
        })
      ).toBe(P);
    });

    it('needs live focus — no focus at all is row 3, not clause 1', () => {
      expect(
        resolveImpactSubject({
          inspectedPath: P,
          livePath: null,
          liveHasFocus: false,
          columnHasFocus: false,
          heldAnswer: null,
        })
      ).toBe(P);
    });

    it('needs a null live path — a resolving control does not trigger it', () => {
      expect(
        resolveImpactSubject({
          inspectedPath: P,
          livePath: PENDING_SLOT,
          liveHasFocus: true,
          columnHasFocus: false,
          heldAnswer: null,
        })
      ).toBe(P);
    });
  });

  describe('clause 2 — otherwise the subject, whatever focus is doing', () => {
    it.each([
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ])(
      'a non-null subject with a non-null live path wins for liveHasFocus=%s columnHasFocus=%s',
      (liveHasFocus, columnHasFocus) => {
        expect(
          resolveImpactSubject({
            inspectedPath: P,
            livePath: PENDING_SLOT,
            liveHasFocus,
            columnHasFocus,
            heldAnswer: null,
          })
        ).toBe(P);
      }
    );
  });

  describe('clause 3 — otherwise live focus’s own answer', () => {
    /**
     * **Clause 3 is why SF-14 changes no behaviour for a control with nothing
     * inspected, and it is a correction to the design rather than a
     * transcription of it.** The design's rule returned `null` whenever the
     * subject was null, and `toFieldImpactView` splits on `hasFocusedElement` —
     * so with focus on the Claim Issuer Contract Address input, which resolves to
     * `identityVerification.trustedIssuers[n]`, it would have rendered
     * `not-a-field`: *"this control affects no generated code"*, which is flatly
     * false. Falling back to `livePath` restores today's answer exactly.
     */
    it('falls back to the live path when nothing is inspected', () => {
      expect(
        resolveImpactSubject({
          inspectedPath: null,
          livePath: PENDING_SLOT,
          liveHasFocus: true,
          columnHasFocus: false,
          heldAnswer: null,
        })
      ).toBe(PENDING_SLOT);
    });

    it('falls back to null when the live path is null and there is no focus', () => {
      expect(
        resolveImpactSubject({
          inspectedPath: null,
          livePath: null,
          liveHasFocus: false,
          columnHasFocus: false,
          heldAnswer: null,
        })
      ).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Purity and the input space
  // -------------------------------------------------------------------------
  describe('is a pure function of exactly five inputs', () => {
    it('two calls with the same input agree, and nothing is retained between them', () => {
      const input: ImpactSubjectInput = {
        inspectedPath: P,
        livePath: null,
        liveHasFocus: false,
        columnHasFocus: false,
        heldAnswer: null,
      };
      expect(resolveImpactSubject(input)).toBe(resolveImpactSubject(input));

      // A different input immediately afterwards is answered on its own terms.
      expect(
        resolveImpactSubject({
          inspectedPath: null,
          livePath: null,
          liveHasFocus: true,
          columnHasFocus: false,
          heldAnswer: null,
        })
      ).toBeNull();
      expect(resolveImpactSubject(input)).toBe(P);
    });

    /**
     * Every boolean combination against the path shapes, now across **three**
     * path-valued inputs rather than two: total, never `undefined`, and always
     * one of the paths it was given or `null`. The function may never invent an
     * answer it was not handed.
     *
     * Clause 4 widened this space from 36 to 108, and widening it is the point —
     * `heldAnswer` is a third source the result may legitimately come from, so
     * leaving it out of the enumeration would let clause 4 return anything at all
     * without this test noticing.
     */
    it('never returns a path it was not given, over the whole input space', () => {
      const paths = [null, P, PENDING_SLOT] as const;
      let seen = 0;
      for (const inspectedPath of paths) {
        for (const livePath of paths) {
          for (const heldAnswer of paths) {
            for (const liveHasFocus of [true, false]) {
              for (const columnHasFocus of [true, false]) {
                const result = resolveImpactSubject({
                  inspectedPath,
                  livePath,
                  liveHasFocus,
                  columnHasFocus,
                  heldAnswer,
                });
                expect(
                  result === null ||
                    result === inspectedPath ||
                    result === livePath ||
                    result === heldAnswer
                ).toBe(true);
                expect(result).not.toBeUndefined();
                seen += 1;
              }
            }
          }
        }
      }
      expect(seen).toBe(108);
    });

    /**
     * `heldAnswer` is inert unless the user is inside the column. Asserted over
     * the whole space rather than at a sample, because the clause that consults
     * it is one ternary and the failure — a held answer leaking into an ordinary
     * focus change — would look exactly like the stale-latch behaviour SF-14 was
     * built to remove.
     */
    it('never consults the held answer while the column does not have focus', () => {
      const paths = [null, P, PENDING_SLOT] as const;
      for (const inspectedPath of paths) {
        for (const livePath of paths) {
          for (const liveHasFocus of [true, false]) {
            const base = {
              inspectedPath,
              livePath,
              liveHasFocus,
              columnHasFocus: false,
              heldAnswer: null,
            };
            const withHeld = resolveImpactSubject({ ...base, heldAnswer: PENDING_SLOT });
            const withoutHeld = resolveImpactSubject({ ...base, heldAnswer: null });
            expect(withHeld).toBe(withoutHeld);
          }
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// INV-31 / INV-32 — the seam to the view
// ---------------------------------------------------------------------------

describe('the subject is orthogonal to the provenance states (INV-31)', () => {
  /**
   * `no-preview` and `unsupported` still precede every field state. Someone
   * "fixing" the newly-reachable input state by making the view consult the
   * subject would break the branch order that AS-5 depends on.
   */
  it('no-preview wins over a subject', () => {
    expect(toFieldImpactView({ provenance: null, path: P, hasFocusedElement: false })).toEqual({
      kind: 'no-preview',
    });
  });

  it('unsupported wins over a subject', () => {
    expect(
      toFieldImpactView({
        provenance: unsupportedProvenance(),
        path: P,
        hasFocusedElement: false,
      })
    ).toEqual({ kind: 'unsupported' });
  });

  /**
   * **`hasFocusedElement` is never invented.** Deriving it as
   * `liveHasFocus || inspectedPath !== null` to make row 3's view "look right"
   * would have the column claim something has focus when nothing does — a lie in
   * the one direction this initiative has consistently refused — and would also
   * make `not-a-field` unreachable, since a null path with a subject cannot
   * occur.
   */
  it('a subject with no live focus is honest about both facts', () => {
    // Nothing inspected, focus on a control that resolves to nothing.
    expect(
      toFieldImpactView({
        provenance: availableProvenance(mixedGroups()).provenance,
        path: null,
        hasFocusedElement: true,
      })
    ).toEqual({ kind: 'not-a-field' });

    // …and the same view input with no focus is the other state, so the split
    // this invariant protects is live rather than notional.
    expect(
      toFieldImpactView({
        provenance: availableProvenance(mixedGroups()).provenance,
        path: null,
        hasFocusedElement: false,
      })
    ).toEqual({ kind: 'no-focus' });
  });
});

describe('the previously-unreachable input state is the AS-2 case (INV-32)', () => {
  /**
   * `{ path: non-null, hasFocusedElement: false }` was documented unreachable by
   * SF-12's contract and is now exactly AS-2: the Add button disabled itself and
   * focus went to `<body>` while the subject names the created item.
   * `toFieldImpactView` is already total over it and treats the path as the
   * stronger evidence, which is the wanted behaviour — **no logic change**.
   */
  it('a subject path with no focused element renders groups, not no-focus', () => {
    const view = toFieldImpactView({
      provenance: availableProvenance(mixedGroups()).provenance,
      path: CREATED,
      hasFocusedElement: false,
    });
    expect(view.kind).toBe('groups');
    expect(view.kind === 'groups' && view.path).toBe(CREATED);
    expect(view.kind === 'groups' && view.groups.length).toBeGreaterThan(0);
  });

  /**
   * The four reachable states of `FieldImpactInput`, enumerated so the widening
   * from three is a checked fact. The fourth is the row above.
   */
  it('all four input states are reachable and distinct', () => {
    const provenance = availableProvenance(mixedGroups()).provenance;
    const kinds = [
      toFieldImpactView({ provenance, path: null, hasFocusedElement: false }).kind,
      toFieldImpactView({ provenance, path: null, hasFocusedElement: true }).kind,
      toFieldImpactView({ provenance, path: P, hasFocusedElement: true }).kind,
      toFieldImpactView({ provenance, path: P, hasFocusedElement: false }).kind,
    ];
    expect(kinds).toEqual(['no-focus', 'not-a-field', 'groups', 'groups']);
  });
});

// ---------------------------------------------------------------------------
// INV-31's source clause
// ---------------------------------------------------------------------------

describe('impactSubject imports nothing from the provenance layer (INV-31)', () => {
  const sources: readonly ScannedSource[] = readScannedSources([
    'src/features/code-preview/impact/impactSubject.ts',
    'src/features/code-preview/impact/useFieldImpact.ts',
  ]);

  it('the scan read both modules', () => {
    expect(sources).toHaveLength(2);
    for (const source of sources) expect(source.stripped).toContain('export');
  });

  it.each(['provenanceState', 'services/preview', 'groupFieldProvenance'])(
    'impactSubject.ts does not reference `%s`',
    (token) => {
      const subject = sources.find((source) => source.path.endsWith('impactSubject.ts'))!;
      expect(subject.stripped).not.toContain(token);
    }
  );

  /**
   * `hasFocusedElement` is passed through **verbatim** — the single reference in
   * the hook is `live.hasFocusedElement`, never a derivation. A scan, because the
   * derivation that would break this (`liveHasFocus || inspectedPath !== null`)
   * is a one-line edit that every behavioural test above would still pass for
   * every case *except* the one nobody would write.
   */
  it('useFieldImpact passes hasFocusedElement through verbatim', () => {
    const hook = sources.find((source) => source.path.endsWith('useFieldImpact.ts'))!;
    expect(hook.stripped).toContain('hasFocusedElement: live.hasFocusedElement');
    expect(hook.stripped).not.toMatch(/hasFocusedElement:\s*live\.hasFocusedElement\s*\|\|/);
  });

  /**
   * INV-29's source clause: no state setter outside an event handler. The
   * render-phase `setHeld` is deleted and nothing render-phase replaces it; the
   * only setter left is inside `latchProps`' three handlers.
   *
   * **Restated for clause 4, and every property it pinned still holds.** The
   * latch now carries the answer the column was rendering when the user reached
   * for it, so the state is a `ColumnLatch` rather than a bare boolean and the
   * setter is `setLatch`. What did *not* change is what this test is actually
   * about: still exactly **one** `useState`, every setter call site inside a
   * handler or a post-commit effect, still no render-phase write, and still no
   * `setHeld` / `HeldField`. The held answer deliberately did **not** become a
   * second `useState` or a `useRef` — a ref is banned outright by the INV-21 scan
   * above, and a second state slot could disagree with the flag about whether the
   * latch is armed.
   *
   * **Restated again for the draft stamp.** The latch now also carries the draft
   * it was armed against (`armedConfig`), maintained by a second effect that
   * clears a stale stamp and stamps the current one. That adds two setter call
   * sites, both post-commit, and a second `useEffect`. The pinned property is
   * unchanged: six writes, three in handlers and three in effects, none in the
   * render body.
   */
  it('useFieldImpact holds one piece of state and sets it only from handlers or effects (INV-29)', () => {
    const hook = sources.find((source) => source.path.endsWith('useFieldImpact.ts'))!;
    expect(hook.stripped.match(/useState\s*[<(]/g) ?? []).toHaveLength(1);
    expect(findTokenAcross([hook], 'setHeld')).toEqual([]);
    expect(findTokenAcross([hook], 'HeldField')).toEqual([]);
    // Three handler writes plus three effect writes: the remembered answer, the
    // stale-stamp clear and the stamp itself. Six — "no setter outside a
    // handler" was the wrong shape of the rule; the property that matters is
    // **no setter during render**, which is what makes the "Too many re-renders"
    // hazard structurally absent.
    const setters = hook.stripped.match(/setLatch\(/g) ?? [];
    expect(setters).toHaveLength(6);

    // Exactly two effects, and the three effect writes live inside them. A
    // `setLatch` that drifted out of an effect would re-introduce exactly the
    // render-phase update SF-14 deleted, and would still leave the count at 6 —
    // which is why the remainder is checked below rather than the total.
    const effectShape = /useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g;
    const effects = hook.stripped.match(effectShape) ?? [];
    expect(effects, 'the hook must hold exactly two effects').toHaveLength(2);
    expect(hook.stripped.match(/useEffect\(/g) ?? []).toHaveLength(2);
    const stampEffect = effects.find((effect) => effect.includes('armedConfig: null'))!;
    const rememberEffect = effects.find((effect) => effect.includes('setLatch(rememberAnswer('))!;
    expect(stampEffect).toBeDefined();
    expect(rememberEffect).toBeDefined();
    expect(stampEffect.match(/setLatch\(/g) ?? []).toHaveLength(2);
    expect(rememberEffect.match(/setLatch\(/g) ?? []).toHaveLength(1);

    // With the effects removed, every remaining write is one of the three
    // handlers — nothing is left loose in the render body.
    const outsideEffects = hook.stripped.replace(effectShape, '');
    expect(outsideEffects.match(/setLatch\(/g) ?? []).toHaveLength(3);
    expect(
      outsideEffects.match(/onPointerDownCapture: \(\) => setLatch\(armLatch\(config\)\)/g) ?? []
    ).toHaveLength(1);
    expect(
      outsideEffects.match(/onFocus: \(\) => setLatch\(armLatch\(config\)\)/g) ?? []
    ).toHaveLength(1);
    expect(outsideEffects).toMatch(
      /onBlur: \(event\) => \{[\s\S]*?if \(!event\.currentTarget\.contains\(event\.relatedTarget\)\) \{\s*setLatch\(releaseLatch\);/
    );
  });

  /**
   * The remembered answer must not be re-written on an ordinary draft edit.
   *
   * `PreviewImpactColumn`'s memo test caught this as a doubled render per
   * keystroke: storing the draft *alongside* each remembered answer made the
   * effect write on every config change. The draft is captured at **arm** time
   * instead, so the remembering path compares only a string. Asserted in source
   * because the tidy-up that undoes it — "keep the config next to the answer it
   * belongs to" — reads as an improvement.
   */
  it('the remembered answer does not depend on the draft (render cost)', () => {
    const hook = sources.find((source) => source.path.endsWith('useFieldImpact.ts'))!;
    expect(hook.stripped).toMatch(/rememberAnswer\s*=\s*\(answer: ConfigPath\)/);
    expect(hook.stripped).toContain('}, [unheldPath]);');
    expect(hook.stripped).toContain('armedConfig: config');
  });

  /**
   * Clause 4's held answer is guarded against a draft replacement, structurally.
   *
   * The value held is a resolved `ConfigPath`, which carries array indices — the
   * exact thing SF-13 needed a generate-key stamp for. The guard here is cheaper
   * and stronger: the draft the answer was resolved against is held beside it and
   * compared by reference, so a whole-config replacement mid-reach drops the
   * answer instead of letting it name a different item. Asserted in source
   * because it is one `&&` that a tidy-up would read as redundant.
   */
  it('the held answer is dropped when the draft is replaced (clause 4 staleness)', () => {
    const hook = sources.find((source) => source.path.endsWith('useFieldImpact.ts'))!;
    // Column-latch arm still stamps the draft; preview-chrome reach consults the
    // remembered answer without that stamp (resolvable subjects cover the common
    // case; pending locations keep the last rendered path).
    expect(hook.stripped).toContain('latch.armedConfig !== config');
    expect(hook.stripped).toContain('previewChromeHasFocus');
    expect(hook.stripped).toContain('reachHasFocus');
    expect(hook.stripped).toContain('.rwa-code-preview');
    expect(hook.stripped).toContain('.rwa-code-preview-sheet');
    expect(hook.stripped).toContain('data-rwa-preview-chrome');
  });
});
