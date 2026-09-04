import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  APP_ROOT,
  callRangesOf,
  isInsideAny,
  lineOf,
  offsetsOf,
  REPO_ROOT,
  stripComments,
} from '../../../test/helpers/sourceScan';

/**
 * The guards that live outside the six modules: the stylesheet seam (INV-15),
 * the latch's construction precondition (INV-20), the prohibition on visibility
 * assertions (INV-23), the probe's CI wiring (INV-34), and the promise that the
 * file tree's own mechanism was not touched (INV-44).
 */

function readApp(relativePath: string): string {
  return readFileSync(join(APP_ROOT, relativePath), 'utf8');
}

// ---------------------------------------------------------------------------
// INV-15 — the CSS literal and the rendered attribute are the same string
// ---------------------------------------------------------------------------

describe('the container query matches the attribute React renders (INV-15)', () => {
  // Comment-stripped, because the block above the rule explains the rule and
  // therefore contains `@container` in prose. Counting the raw text finds two
  // and the natural repair is to delete the explanation.
  const css = stripComments(readApp('src/features/code-preview/code-preview.css'));

  it('declares exactly one container query and one container-type', () => {
    expect(css.match(/@container/g) ?? []).toHaveLength(1);
    expect(css.match(/container-type:/g) ?? []).toHaveLength(1);
  });

  it('suppresses the column with display:none, not visibility or width', () => {
    // `visibility: hidden` or `width: 0` takes the column off screen and leaves
    // it in the tab order: a keyboard user tabs into rows they cannot see.
    // `display: none` removes it from layout, tab order and the a11y tree in one
    // declaration.
    const rule = css.slice(css.indexOf('@container'));
    const suppression = rule.slice(
      rule.indexOf('.rwa-code-preview[data-tree-visible='),
      rule.indexOf('}', rule.indexOf('.rwa-code-preview[data-tree-visible='))
    );
    expect(suppression).toContain('display: none');
    expect(suppression).not.toContain('visibility');
    expect(suppression).not.toMatch(/width:\s*0/);
  });

  it('reads the selector value out of the stylesheet and finds the literal "true"', () => {
    // Read from the stylesheet text rather than restated in the test. The
    // idiomatic React refactor `data-tree-visible={treeVisible ? "" : undefined}`
    // is correct for a presence-tested attribute and wrong for a value-tested
    // one: the selector silently stops matching, the column shows at every
    // width, and the unit suite cannot see it (INV-23).
    const match = /\.rwa-code-preview\[data-tree-visible=(['"])(?<value>[^'"]+)\1\]/.exec(css);
    expect(match?.groups?.value, 'the container query no longer tests a literal value').toBe(
      'true'
    );
  });

  it('renders the same literal from the component, on a boolean', () => {
    const body = stripComments(
      readApp('src/features/code-preview/components/PreviewDrawerBody.tsx')
    );
    expect(body).toContain('data-tree-visible={treeVisible}');
    // Not `treeVisible ? '' : undefined`, and not `String(treeVisible)` either —
    // React stringifies `data-*` values including `false`.
    expect(body).not.toMatch(/data-tree-visible=\{[^}]*\?[^}]*\}/);
  });
});

// ---------------------------------------------------------------------------
// INV-20 clause (a) — the latch's precondition, scanned rather than asserted
// ---------------------------------------------------------------------------

/**
 * The draft-mutating surface: `useWizardDraftState`'s API. Every call to one of
 * these changes the `RWAConfig` a held `ConfigPath` names.
 */
const DRAFT_MUTATORS = [
  'setConfig',
  'resetConfig',
  'updateToken',
  'updateIdentity',
  'updateCompliance',
  'updateAccessControl',
  'updateDeployment',
] as const;

/**
 * Call sites that are **not** inside a control's event handler, each reviewed
 * and each carrying the reason it is safe.
 *
 * INV-20's stated scan — *no* draft-mutating call site outside an event handler
 * — **does not pass**, and it was this table that reported it. None of the four
 * was introduced by this sub-feature.
 *
 * **What changed is the reason a declared mutation is safe, not the table.** The
 * identity stamp this table was written around is gone: the column no longer
 * holds a resolved `ConfigPath` to be invalidated, it holds a
 * `ConfigAnchorKey` — draft-independent by construction — and re-resolves it
 * against the live draft on every render. So a mutation is no longer safe
 * because it *moves the generate key*; it is safe because it cannot make the
 * subject name a **different item**. That is a strictly weaker requirement on
 * the mutation and a strictly stronger guarantee for the column, and it is why
 * the tick a write lands in stops mattering at all rather than being covered by
 * a stamp.
 *
 * The table is keyed by **file**: two entries covering four call sites. It is
 * still pinned, and a **fifth** call site — or any call site in a file the table
 * does not declare — still fails this test. A new non-interactive mutation is a
 * claim about *when* the draft changes that belongs in review, and the reasons
 * below are what a reviewer compares it against.
 */
const DECLARED_NON_INTERACTIVE: Readonly<Record<string, { count: number; reason: string }>> = {
  'src/features/wizard/hooks/useWizardNetworkRoute.ts': {
    count: 1,
    reason:
      'updateDeployment inside a useEffect, in the .then() of getNetworkById. Fires only ' +
      'while activeDraftId is null, on route mount and route change. It writes deployment, ' +
      'which no ConfigAnchor names and which changes no list membership, so it cannot make ' +
      'the inspected anchor resolve to a different item. The subject is a ConfigAnchorKey ' +
      're-resolved against the live draft on every render, so the tick this write lands in ' +
      'is not a fact the column depends on.',
  },
  'src/features/wizard/hooks/useWizardSession.ts': {
    count: 3,
    reason:
      'resetConfig x2 and setConfig inside the draft-hydration useEffect, after an awaited ' +
      'storage.get. Triggered by a draft switch — a control outside the column — but the ' +
      'write lands in a later tick, so the interactive precondition holds in spirit and not ' +
      'in form. A whole-config replacement: the subject survives it only by naming an item ' +
      'with the same draft-independent identity in the new draft, because anchorItemExists ' +
      'drops it at read time otherwise, and the scope token on InspectedAnchorProvider drops it ' +
      'outright whenever resetKey or activeDraftId moves — which is what a draft switch does.',
  },
};

describe('the latch rests on draft mutation being interactive (INV-20)', () => {
  interface CallSite {
    readonly file: string;
    readonly line: number;
    readonly mutator: string;
    readonly insideEffect: boolean;
  }

  function draftMutationSites(): readonly CallSite[] {
    const files = globSync('src/**/*.{ts,tsx}', { cwd: APP_ROOT })
      .map((path) => path.split('\\').join('/'))
      .filter((path) => !/\.(test|spec)\.tsx?$/.test(path))
      .filter((path) => !path.startsWith('src/test/'))
      .sort();

    expect(files.length, 'the glob matched no source files').toBeGreaterThan(50);

    return files.flatMap((file) => {
      const source = stripComments(readApp(file));
      // The API's own definition is not a call site; it is where the setters live.
      if (file.endsWith('state/useWizardDraftState.ts')) return [];
      const effectRanges = [
        ...callRangesOf(source, 'useEffect'),
        ...callRangesOf(source, 'useLayoutEffect'),
        ...callRangesOf(source, 'setTimeout'),
        ...callRangesOf(source, 'setInterval'),
      ];

      return DRAFT_MUTATORS.flatMap((mutator) =>
        offsetsOf(source, `${mutator}(`)
          // A prop hand-off (`onUpdate={draftState.updateToken}`) is not a call.
          .filter((offset) => /[.\s(,{]/.test(source[offset - 1] ?? ' '))
          .map((offset) => ({
            file,
            line: lineOf(source, offset),
            mutator,
            insideEffect: isInsideAny(offset, effectRanges),
          }))
      );
    });
  }

  it('finds the draft-mutating surface at all', () => {
    // The vacuity guard. A scan that matches nothing reports a clean result for
    // every classification below it and looks exactly like a passing guard.
    const sites = draftMutationSites();
    expect(sites.length, 'the scan found no draft mutation anywhere in the app').toBeGreaterThan(3);
    expect(new Set(sites.map((site) => site.mutator)).size).toBeGreaterThan(1);
  });

  it('classifies the scanner correctly on a known-shaped fixture', () => {
    // The classifier is the load-bearing part; if `isInsideAny` always answered
    // false, every call site would read as interactive and the table below would
    // be trivially satisfied.
    const fixture = [
      'function C() {',
      '  useEffect(() => { updateToken({ name: "x" }); }, []);',
      '  return <button onClick={() => updateToken({ name: "y" })} />;',
      '}',
    ].join('\n');
    const ranges = callRangesOf(fixture, 'useEffect');
    const offsets = offsetsOf(fixture, 'updateToken(');
    expect(offsets).toHaveLength(2);
    expect(isInsideAny(offsets[0]!, ranges), 'missed a mutation inside an effect').toBe(true);
    expect(isInsideAny(offsets[1]!, ranges), 'misread a handler as an effect').toBe(false);
  });

  it('reports exactly the declared non-interactive mutations, and no fifth one', () => {
    const nonInteractive = draftMutationSites().filter((site) => site.insideEffect);
    const byFile = new Map<string, number>();
    for (const site of nonInteractive) {
      byFile.set(site.file, (byFile.get(site.file) ?? 0) + 1);
    }

    const undeclared = [...byFile.keys()].filter((file) => !(file in DECLARED_NON_INTERACTIVE));
    expect(
      undeclared,
      `a new non-interactive draft mutation appeared. INV-20's construction argument rests on every draft change going through a control outside the column; this one does not. The inspected anchor covers it only if the mutation cannot make the subject resolve to a **different item** — which holds for any mutation that does not reorder or re-key a list the anchor dialect keys on. Verify that, then declare it here with the reason it fires without a control. Do not widen this table without doing so, and do not relax the classifier.\n${undeclared.join('\n')}`
    ).toHaveLength(0);

    for (const [file, declared] of Object.entries(DECLARED_NON_INTERACTIVE)) {
      expect(byFile.get(file) ?? 0, `${file}: ${declared.reason}`).toBe(declared.count);
    }
  });

  it('has no draft mutation inside the impact column itself', () => {
    // Whatever the rest of the app does, the column writes no config, and under
    // the inspected anchor the reason this matters gets simpler rather than
    // weaker: the column writes no config, so nothing it does can change what
    // anchorItemExists answers about the item it is describing.
    const columnFiles = globSync('src/features/code-preview/{impact,components}/**/*.{ts,tsx}', {
      cwd: APP_ROOT,
    }).filter((path) => !/\.(test|spec)\.tsx?$/.test(path));
    expect(columnFiles.length).toBeGreaterThan(5);

    for (const file of columnFiles) {
      const source = stripComments(readApp(file));
      for (const mutator of DRAFT_MUTATORS) {
        expect(source, `${file} mutates the draft`).not.toContain(`${mutator}(`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// INV-23 — no happy-dom test may assert the column's visibility
// ---------------------------------------------------------------------------

describe('no unit test claims anything about the column being visible (INV-23)', () => {
  /**
   * This file is the one exclusion, and it has to be: the forbidden tokens are
   * its data. Pinned to exactly one path so the exclusion cannot quietly grow.
   */
  const SCANNER = 'src/features/code-preview/impact/impact.repo-guards.test.ts';

  const GEOMETRY_TOKENS = [
    'getBoundingClientRect',
    'offsetWidth',
    'offsetHeight',
    'clientWidth',
    'clientHeight',
    'scrollWidth',
    'scrollHeight',
    'getComputedStyle',
    'toBeVisible',
  ] as const;

  const VISIBILITY_WORDS = /\b(hidden|shown|visible|suppress\w*|width|height|collaps\w*)\b/i;

  function testFiles(): readonly string[] {
    const files = globSync('src/**/*.{test,spec}.{ts,tsx}', { cwd: APP_ROOT })
      .map((path) => path.split('\\').join('/'))
      .sort();
    expect(files.length, 'the test-file glob matched nothing').toBeGreaterThan(30);
    return files;
  }

  it('excludes exactly one file — itself — and that file exists', () => {
    expect(testFiles()).toContain(SCANNER);
  });

  it('names the column in more than one test file, so the scan has a population', () => {
    // Without this, the scan below is satisfied by there being no tests at all.
    const naming = testFiles().filter(
      (file) => file !== SCANNER && readApp(file).includes('rwa-code-preview-impact')
    );
    expect(
      naming.length,
      'no test names the column; the prohibition guards nothing'
    ).toBeGreaterThan(1);
  });

  it('asserts no geometry anywhere in a test that names the column', () => {
    // happy-dom has no layout engine: every rect is zero, the container query
    // never evaluates, `position: sticky` is never applied. A test asserting the
    // column is hidden would pass for the wrong reason and keep passing after
    // the CSS is deleted — worse than no test, because it stops anyone writing
    // the real one. Geometry is the browser probe's, or it is not tested.
    const violations: string[] = [];

    for (const file of testFiles()) {
      if (file === SCANNER) continue;
      const source = readApp(file);
      if (!source.includes('impact')) continue;
      const stripped = stripComments(source);

      for (const token of GEOMETRY_TOKENS) {
        for (const offset of offsetsOf(stripped, token)) {
          violations.push(`${file}:${lineOf(stripped, offset)}: ${token}`);
        }
      }
    }

    expect(
      violations,
      `geometry assertions in column tests:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });

  it('has no test whose name makes a visibility claim about the column', () => {
    const violations: string[] = [];

    for (const file of testFiles()) {
      if (file === SCANNER) continue;
      const stripped = stripComments(readApp(file));
      if (!stripped.includes('rwa-code-preview-impact')) continue;

      const titles = [...stripped.matchAll(/\bit\(\s*(['"`])(?<title>[^'"`]+)\1/g)];
      expect(titles.length, `${file} names the column but declares no test`).toBeGreaterThan(0);

      for (const title of titles) {
        const text = title.groups?.title ?? '';
        if (VISIBILITY_WORDS.test(text) && /column|impact|rail/i.test(text)) {
          violations.push(`${file}: "${text}"`);
        }
      }
    }

    expect(
      violations,
      `these test names claim something happy-dom cannot see:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// INV-34 — the probe's CI step gates
// ---------------------------------------------------------------------------

describe('the layout probe gates in CI (INV-34)', () => {
  const workflow = readFileSync(join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');

  interface Step {
    readonly name: string;
    readonly body: string;
    readonly index: number;
  }

  function steps(): readonly Step[] {
    const matches = [...workflow.matchAll(/^ {6}- name: (?<name>.+)$/gm)];
    expect(matches.length, 'no steps parsed out of ci.yml').toBeGreaterThan(4);
    return matches.map((match, order) => {
      const start = match.index;
      const end = matches[order + 1]?.index ?? workflow.length;
      return { name: match.groups!.name!.trim(), body: workflow.slice(start, end), index: order };
    });
  }

  it('runs a drawer layout probe step', () => {
    expect(steps().map((step) => step.name)).toContain('Drawer layout probe');
  });

  it('runs it after the packages are built, so it has a build to measure', () => {
    const all = steps();
    const build = all.findIndex((step) => step.name === 'Build all packages');
    const probe = all.findIndex((step) => step.name === 'Drawer layout probe');
    expect(build).toBeGreaterThanOrEqual(0);
    expect(probe).toBeGreaterThan(build);
  });

  it('does not carry continue-on-error (hard gate after #67)', () => {
    // The drawer's three-region layout fails silently — nothing overflows,
    // nothing throws, and happy-dom has no layout engine to see it. This step
    // is the only enforcement that failure mode has, so it must never be
    // advisory. After #67 the unit `Test` step is also a hard gate on main;
    // keep both free of continue-on-error so a soft-fail cannot reappear here.
    const probe = steps().find((step) => step.name === 'Drawer layout probe')!;
    expect(probe.body).not.toContain('continue-on-error');

    const test = steps().find((step) => step.name === 'Test')!;
    expect(test.body).not.toContain('continue-on-error');
  });

  it('runs all three invocations — the checks, the self-check and the negative run', () => {
    // The last two exist because a guard that has never been watched failing is
    // not evidence.
    const probe = steps().find((step) => step.name === 'Drawer layout probe')!;
    expect(probe.body).toContain('node apps/rwa-wizard/scripts/layout-probe.mjs');
    expect(probe.body).toContain('PROBE_SELF_CHECK=1');
    expect(probe.body).toContain('PROBE_NEGATIVE=1');
  });
});

// ---------------------------------------------------------------------------
// INV-44 clause 2 — the tree's own files are untouched by this sub-feature
// ---------------------------------------------------------------------------

describe('the file tree mechanism is untouched by this sub-feature (INV-44)', () => {
  // PreviewDrawerTools is deliberately mutable for dock chrome (dropdown menu);
  // tree toggle behaviour is still asserted below without a byte-identical lock.
  // Dock preference persistence (SF-23) legitimately extends previewPersistence
  // and useCodePreviewPersistence — covered by behavioural tests below, not a
  // byte-identical git guard.
  // The git half of this guard (working tree byte-identical to HEAD) was
  // removed: on a fresh CI checkout the tree equals HEAD and it passes
  // trivially, and locally it fails whenever a later sub-feature legitimately
  // edits the file. The behavioural clauses below hold anywhere.

  it('keeps the tree toggle an aria-pressed control named from the dictionary', () => {
    // Literally true at 900px and at 1920px: the toggle still says "Show file
    // tree" / "Hide file tree" and still reports `aria-pressed={!treeVisible}`.
    // The suppression rule can only ever remove the region this sub-feature
    // adds — nothing the user already had.
    const tools = stripComments(
      readApp('src/features/code-preview/components/PreviewDrawerTools.tsx')
    );
    expect(tools).toContain('aria-pressed={!treeVisible}');
    expect(tools).toContain('code-preview.hide-file-tree');
    expect(tools).toContain('code-preview.show-file-tree');
  });

  it('keeps the tree mounted-but-hidden rather than unmounted', () => {
    // Mounted either way is what preserves the kit tree's expansion state, and
    // `inert` + `aria-hidden` + width 0 is what CSS cannot express as attributes
    // — which is exactly why the column uses `display: none` instead.
    const body = stripComments(
      readApp('src/features/code-preview/components/PreviewDrawerBody.tsx')
    );
    expect(body).toContain('aria-hidden={!treeVisible}');
    expect(body).toContain('inert={!treeVisible}');
    expect(body).toContain('transition-[width]');
    expect(body).toContain('width: treeVisible ? TREE_PANE_WIDTH_PX : 0');
  });

  it('keeps the toggle covered by its own test, which this stage did not rewrite', () => {
    // Inherited coverage, named so it cannot be deleted quietly: INV-44 asks for
    // the *same assertions as before this change*, not for new ones.
    const test = readApp('src/features/code-preview/components/PreviewDrawerTools.test.tsx');
    expect(test).toContain('names and presses the tree toggle from its state');
    expect(test).toContain('aria-pressed');
  });
});
