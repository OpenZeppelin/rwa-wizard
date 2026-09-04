import { describe, expect, it } from 'vitest';

import {
  findTokenAcross,
  readScannedSources,
  stripComments,
  type ScannedSource,
} from '../../../test/helpers/sourceScan';

/**
 * The absence scans: the invariants whose enforcement is that a construct does
 * not exist. INV-6, INV-7, INV-8, INV-13, INV-17, INV-21, INV-39, INV-40,
 * INV-42 and INV-45.
 *
 * **Comments are stripped first, and that is load-bearing rather than tidy.**
 * Every comment in these modules states the invariant the code below it
 * satisfies, so each contains the token its own scan forbids — `fieldImpactView`
 * says "never throws", `PreviewImpactRow` says "no roving tabindex",
 * `useFieldImpact` says "never `containsComposed`". A scan over raw source fails
 * on all three, and the obvious repair is to delete the sentence that explains
 * why the code is shaped that way: the scan would then have cost the codebase
 * the only record of the property it exists to protect.
 *
 * **And the scans must be shown to have read something.** Code Draft's first
 * attempt passed a quoted shell variable to `grep`, read no files at all, and
 * printed "none" for every category — indistinguishable from a clean result.
 * The block below therefore pins the file count, the byte lengths, and three
 * known comment-borne tokens that must survive in `raw` and vanish in
 * `stripped`. If the stripper ever returns nothing, those three fail loudly
 * instead of every scan passing quietly.
 */

const IMPACT_MODULES = [
  'src/features/code-preview/impact/splitPath.ts',
  'src/features/code-preview/impact/fieldImpactView.ts',
  'src/features/code-preview/impact/useFieldImpact.ts',
  'src/features/code-preview/impact/firstRangedSite.ts',
  'src/features/code-preview/impact/index.ts',
  'src/features/code-preview/components/PreviewImpactColumn.tsx',
  'src/features/code-preview/components/PreviewImpactRow.tsx',
] as const;

const COMPONENTS = IMPACT_MODULES.filter((path) => path.endsWith('.tsx'));

const sources = readScannedSources(IMPACT_MODULES);
const componentSources = readScannedSources(COMPONENTS);

function sourceFor(suffix: string): ScannedSource {
  const found = sources.find((source) => source.path.endsWith(suffix));
  if (!found) throw new Error(`no scanned source ends with ${suffix}`);
  return found;
}

describe('impact source scans', () => {
  // -------------------------------------------------------------------------
  // The scans' own preconditions. These run first, on purpose.
  // -------------------------------------------------------------------------
  describe('the scan reads what it claims to read', () => {
    it('reads exactly the seven modules this sub-feature owns', () => {
      expect(sources).toHaveLength(7);
      expect(sources.map((source) => source.path)).toEqual([...IMPACT_MODULES]);
    });

    it('reads a non-trivial amount of each of them', () => {
      for (const source of sources) {
        expect(source.raw.length, `${source.path} is empty`).toBeGreaterThan(200);
        expect(source.stripped.trim().length, `${source.path} stripped to nothing`).toBeGreaterThan(
          50
        );
        expect(source.stripped, `${source.path} lost its code`).toContain('export');
      }
    });

    it('strips comments without stripping code — the three tokens that prove it', () => {
      // These are the exact three the code draft measured: real prose in a
      // comment, containing the token a scan below forbids.
      const cases = [
        { file: 'fieldImpactView.ts', token: 'throws' },
        { file: 'PreviewImpactRow.tsx', token: 'tabindex' },
        { file: 'useFieldImpact.ts', token: 'containsComposed' },
      ] as const;

      for (const { file, token } of cases) {
        const source = sourceFor(file);
        expect(source.raw, `${file} no longer documents "${token}"`).toContain(token);
        expect(
          source.stripped,
          `the stripper left the comment token "${token}" in ${file}, so its scan is testing prose`
        ).not.toContain(token);
      }
    });

    it('keeps string literals that look like comments', () => {
      const fixture = [
        'const url = "https://example.com/a//b";',
        "const glob = '/* not a comment */';",
        '// a real comment',
        '/* another */ const kept = 1;',
      ].join('\n');
      const stripped = stripComments(fixture);
      expect(stripped).toContain('https://example.com/a//b');
      expect(stripped).toContain('/* not a comment */');
      expect(stripped).not.toContain('a real comment');
      expect(stripped).not.toContain('another');
      expect(stripped).toContain('const kept = 1;');
    });

    it('preserves line numbering across a block comment', () => {
      const stripped = stripComments('const a = 1;\n/* one\ntwo\nthree */\nconst b = 2;');
      expect(stripped.split('\n')).toHaveLength(5);
      expect(stripped.split('\n')[4]).toBe('const b = 2;');
    });
  });

  // -------------------------------------------------------------------------
  // INV-39 / INV-40 / INV-13 / INV-17 / INV-21 — the absences
  // -------------------------------------------------------------------------
  describe('contains none of the constructs the invariants forbid', () => {
    const forbidden: readonly (readonly [string, readonly string[], string])[] = [
      [
        'INV-39: no error handling of its own — the absence is the mechanism',
        ['try {', 'catch', 'throw ', 'new Error(', 'logger.', 'console.'],
        'AS-5 "nothing throws or logs" is a property of the code, not of a catch',
      ],
      [
        'INV-40: no timer, no debounce, no transition state',
        ['setTimeout', 'setInterval', 'requestAnimationFrame', 'debounce'],
        'each would be a fourth timing input to enumerate, and would delay AS-4 past the commit it is specified for',
      ],
      [
        'INV-13: no persistence of any kind',
        ['localStorage', 'sessionStorage', 'ui-storage', 'previewPersistence', 'indexedDB'],
        'a fourth key needs a default, a migration and a versioning story',
      ],
      [
        'INV-17: plain Node.contains, never the composed walk',
        ['containsComposed'],
        'a relatedTarget inside the tree shadow root is retargeted to its host, which is outside the column',
      ],
      [
        'INV-42: no roving tabindex machinery',
        ['aria-activedescendant', 'onKeyDown', 'onKeyUp', 'onKeyPress', 'roving'],
        'AS-7 asks for reachable and activatable, not for a listbox',
      ],
      [
        'INV-45: the column never resizes the sheet',
        ['maximize', 'setMaximized', 'onHeightChange'],
        'auto-growing the drawer on activation is the failure that withdrew the first two attempts at this affordance',
      ],
      [
        'INV-8 / INV-6: no branch on text, extension or path spelling',
        ['.endsWith(', '.startsWith(', '.match(', 'toLowerCase(', 'includes('],
        'significance is a property of the query, not of the line; file hiding is the seam’s',
      ],
      [
        'INV-6: no branch on the generator-reported file kind',
        ['group.kind', "kind === 'docs'", "kind === 'source'", "kind === 'provenance'"],
        'a second hiding rule diverges from the seam the day a generator adds a kind',
      ],
    ];

    for (const [label, tokens, why] of forbidden) {
      it(label, () => {
        for (const token of tokens) {
          const hits = findTokenAcross(sources, token);
          expect(hits, `${token} — ${why}\n${hits.join('\n')}`).toHaveLength(0);
        }
      });
    }

    it('INV-8: partitions on a single significance comparison and nothing else', () => {
      const view = sourceFor('fieldImpactView.ts');
      const comparisons = findTokenAcross([view], 'significance ===');
      expect(comparisons).toHaveLength(1);
      expect(comparisons[0]).toContain("significance === 'secondary'");
    });

    it('INV-6: drops the file kind from the view type, so the column cannot branch on it', () => {
      // The strongest form of the prohibition: `ImpactGroupView` has no `kind`
      // member at all, so a second hiding rule is not merely absent, it is
      // unrepresentable without changing the type first.
      const view = sourceFor('fieldImpactView.ts');
      const declaration = view.stripped.slice(
        view.stripped.indexOf('interface ImpactGroupView'),
        view.stripped.indexOf('interface IndexedRow')
      );
      expect(declaration.length).toBeGreaterThan(50);
      expect(declaration, 'ImpactGroupView grew a kind member').not.toMatch(/\bkind\b/);
    });

    it('INV-6: has no filter on the group array', () => {
      const view = sourceFor('fieldImpactView.ts');
      expect(findTokenAcross([view], 'groups.filter')).toHaveLength(0);
      expect(findTokenAcross([view], '.slice(')).toHaveLength(0);
      expect(findTokenAcross([view], 'new Set(')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // INV-21 — exactly one memo, and it is the permitted one
  // -------------------------------------------------------------------------
  describe('has exactly one memo, cache or skip key (INV-21 / SF-21 INV-16)', () => {
    it('memo appears once, on the column, and useMemo/useCallback nowhere', () => {
      // The cheapest way to honour a rule about memo keys is to have no key to
      // get wrong. `toFieldImpactView` and `toImpactGroups` are deliberately
      // unmemoised; a second memo would be a second set of inputs to enumerate.
      const memoHits = findTokenAcross(sources, 'memo(');
      expect(memoHits, memoHits.join('\n')).toHaveLength(1);
      expect(memoHits[0]).toContain('PreviewImpactColumnImpl');

      for (const token of ['useMemo', 'useCallback', 'useReducer']) {
        const hits = findTokenAcross(sources, token);
        expect(hits, `${token} is a second cache to keep correct\n${hits.join('\n')}`).toHaveLength(
          0
        );
      }

      // useRef is banned under `impact/` (pure helpers). The column may hold a
      // one-shot open-edge ref for SF-21 INV-12; that is not a cache.
      const impactOnly = sources.filter((source) => source.path.includes('/impact/'));
      expect(
        findTokenAcross(impactOnly, 'useRef'),
        'useRef under impact/ is a second cache to keep correct'
      ).toHaveLength(0);
    });

    it('uses the default shallow comparator — no custom areEqual', () => {
      expect(findTokenAcross(sources, 'areEqual')).toHaveLength(0);
      const column = sourceFor('PreviewImpactColumn.tsx');
      expect(column.stripped).toMatch(/memo\(\s*PreviewImpactColumnImpl\s*\)/);
    });
  });

  // -------------------------------------------------------------------------
  // INV-42 — at most one tabIndex, valued 0, on the column root
  // -------------------------------------------------------------------------
  describe('carries exactly one tab stop in source (INV-42)', () => {
    it('is one tabIndex, valued 0, and it is in the column, not the row', () => {
      // The scan changed shape when the tab stop was added: the old form — no
      // `tabIndex` anywhere — would now fail on the single attribute that makes
      // the column reachable at all. A single static stop on the root is not the
      // roving-composite hazard the original scan was written against; it is the
      // only thing that delivers INV-42's purpose.
      const hits = findTokenAcross(componentSources, 'tabIndex');
      expect(hits, `expected exactly one tab stop, found:\n${hits.join('\n')}`).toHaveLength(1);
      expect(hits[0]).toContain('PreviewImpactColumn.tsx');
      expect(hits[0]).toContain('tabIndex={0}');
      expect(findTokenAcross(componentSources, 'tabIndex={-1}')).toHaveLength(0);
    });

    it('places it on the column root, before the first child element', () => {
      const column = sourceFor('PreviewImpactColumn.tsx');
      const openingTag = column.stripped.slice(
        column.stripped.indexOf('<section'),
        column.stripped.indexOf('<h3')
      );
      expect(openingTag, 'the tab stop is not inside the <section> opening tag').toContain(
        'tabIndex={0}'
      );
    });

    it('renders each row as a real button, not a div with a click handler', () => {
      const row = sourceFor('PreviewImpactRow.tsx');
      expect(row.stripped).toContain('<button');
      expect(row.stripped).toContain('type="button"');
      expect(findTokenAcross([row], 'role="button"')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // INV-7 — no minimum height anywhere on the column
  // -------------------------------------------------------------------------
  describe('gives the column no minimum height (INV-7)', () => {
    it('uses only min-h-0, never a positive min-height utility', () => {
      const column = sourceFor('PreviewImpactColumn.tsx');
      const minHeights = (column.stripped.match(/min-h-[\w[\]./%-]+/g) ?? []).filter(
        (utility) => utility !== 'min-h-0'
      );
      expect(
        minHeights,
        `a minimum height pushes the sheet body into scrolling: ${minHeights}`
      ).toHaveLength(0);
      expect(column.stripped).toContain('min-h-0 flex-1 overflow-y-auto');
    });

    it('keeps the header a sibling of the scroller, not a child of it', () => {
      const column = sourceFor('PreviewImpactColumn.tsx');
      const headerAt = column.stripped.indexOf('rwa-code-preview-impact-field');
      const scrollerAt = column.stripped.indexOf('rwa-code-preview-impact-scroll');
      expect(headerAt).toBeGreaterThan(0);
      expect(headerAt, 'the header moved inside the scroller').toBeLessThan(scrollerAt);
    });
  });

  // -------------------------------------------------------------------------
  // INV-38 — no hard-coded user-visible string
  // -------------------------------------------------------------------------
  it('writes no user-visible string of its own (INV-38)', () => {
    for (const source of componentSources) {
      const jsxText = source.stripped.match(/>\s*[A-Z][a-z]+ [a-z]/g) ?? [];
      expect(jsxText, `${source.path} renders literal prose: ${jsxText.join(', ')}`).toHaveLength(
        0
      );
    }
    expect(findTokenAcross(componentSources, 'copy.notice(').length).toBeGreaterThan(5);
  });

  // -------------------------------------------------------------------------
  // SF-21 absences — INV-14 / INV-20 / INV-22 / INV-3
  // -------------------------------------------------------------------------
  describe('SF-21 auto-select absences (INV-3, INV-14, INV-20, INV-22)', () => {
    it('INV-22: no listbox / aria-selected / activedescendant on impact markup', () => {
      for (const token of [
        'role="listbox"',
        'role="option"',
        'aria-selected',
        'aria-activedescendant',
      ]) {
        const hits = findTokenAcross(componentSources, token);
        expect(
          hits,
          `${token} would promote rows to a composite widget\n${hits.join('\n')}`
        ).toHaveLength(0);
      }
    });

    it('INV-20: auto-select path never calls .focus(', () => {
      // Focus theft would dump the user into the drawer on every field focus.
      const column = sourceFor('PreviewImpactColumn.tsx');
      const hits = findTokenAcross([column], '.focus(');
      expect(hits, `auto-select must not move DOM focus\n${hits.join('\n')}`).toHaveLength(0);
    });

    it('INV-14: column never forces the drawer open', () => {
      const column = sourceFor('PreviewImpactColumn.tsx');
      for (const token of ['setOpen(', 'setMaximized(', 'persistence.open', 'open: true']) {
        const hits = findTokenAcross([column], token);
        expect(
          hits,
          `SF-21 must not auto-open the drawer (${token})\n${hits.join('\n')}`
        ).toHaveLength(0);
      }
    });

    it('INV-3: SF-21 introduces no new copy.notice ids', () => {
      // Existing SF-13 ids are fine; a new "auto-selected" badge would violate
      // copy ownership. Assert the only notice ids in the column/row are known.
      const known = [
        'code-preview.impact.region',
        'code-preview.impact.secondary-group',
        'code-preview.impact.no-preview',
        'code-preview.impact.unsupported',
        'code-preview.impact.no-focus',
        'code-preview.impact.not-a-field',
        'code-preview.impact.pending',
        'code-preview.impact.uncreated',
        'code-preview.impact.empty',
        'code-preview.impact.row-label',
        'code-preview.impact.row-file',
        'code-preview.impact.row-created',
        'code-preview.impact.row-line',
        'code-preview.impact.row-range',
      ];
      const noticeHits = findTokenAcross(componentSources, "copy.notice('");
      for (const hit of noticeHits) {
        const match = hit.match(/copy\.notice\('([^']+)'\)/);
        expect(match, `unparseable notice call: ${hit}`).not.toBeNull();
        expect(known, `new copy id from SF-21: ${match![1]}`).toContain(match![1]);
      }
    });

    it('INV-21 chrome uses aria-current, not aria-selected', () => {
      const row = sourceFor('PreviewImpactRow.tsx');
      expect(row.stripped).toContain('aria-current');
      expect(findTokenAcross([row], 'aria-selected')).toHaveLength(0);
    });
  });
});
