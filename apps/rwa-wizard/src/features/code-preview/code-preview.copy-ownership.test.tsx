import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ReactElement } from 'react';

import { coreCopy, NOTICES_COPY, type ChainCopy } from '@openzeppelin/rwa-wizard-copy';

import { CodePreviewDrawer } from './components/CodePreviewDrawer';
import { PreviewDrawerTools } from './components/PreviewDrawerTools';
import { PreviewImpactColumn } from './components/PreviewImpactColumn';

import { CopyContext } from '../../app/providers/CopyContext';
import { makeConfig } from '../../test/fixtures/wizardFixtures';
import {
  availableProvenance,
  createdRow,
  fileRow,
  group,
  mixedGroups,
  rangeRow,
  TEST_IDENTITY,
  unsupportedProvenance,
} from '../../test/helpers/impactHarness';
import { CONFIG_ANCHOR_ATTR, roleAnchor, tokenAnchor } from '../wizard/focused-path';
import type { CodePreviewProvenance } from './provenanceState';

const FILES = { 'README.md': '# readme', 'src/lib.rs': 'pub fn main() {}' };
const SELECTED = 'src/lib.rs';

/**
 * Every notice resolves to its own id, so a rendered string can be traced back
 * to the dictionary entry it came from — and a string the component wrote
 * itself is visibly not one of them.
 */
function sentinelCopy(): ChainCopy {
  return {
    ...coreCopy,
    notice: (id: string) => ({ id: `notice.${id}`, description: `COPY::${id}` }),
  };
}

function renderDrawer(copy: ChainCopy): ReactElement {
  return (
    <CopyContext.Provider value={copy}>
      <CodePreviewDrawer
        open
        onOpenChange={() => {}}
        dockPosition="bottom"
        size={480}
        maxSize={900}
        onSizeChange={() => {}}
        sheetId="copy-ownership-sheet"
        phase={{
          kind: 'ready',
          files: FILES,
          configHash: 'hash',
          substitutedKeys: [],
          changedPaths: [],
          generateKey: 'hash|identity:0|service:test',
        }}
        selectedPath={SELECTED}
        onSelectedPathChange={() => {}}
        files={FILES}
        changedPaths={[]}
        substitutedKeys={[]}
        errorMessages={undefined}
        sourceRevision={null}
        importLinks={null}
        config={makeConfig()}
        provenance={null}
        onReveal={null}
      />
    </CopyContext.Provider>
  );
}

/**
 * Constitution: user-visible strings belong to `@openzeppelin/rwa-wizard-copy`,
 * and an accessible name is user-visible — it is simply the only copy some
 * users ever get. These three were written into the components (two directly,
 * one by leaving `closeLabel` unset so the kit's own default answered), so a
 * copy edit could not reach them. Overriding the dictionary is what
 * distinguishes a routed string from a literal that happens to read the same.
 */
describe('code preview copy ownership', () => {
  it('takes the file tree, source pane and close labels from the dictionary', async () => {
    render(renderDrawer(sentinelCopy()));

    await waitFor(() => {
      expect(screen.getByLabelText('COPY::code-preview.file-tree-label')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('COPY::code-preview.source-label')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'COPY::code-preview.close' }),
      'an unset closeLabel leaves the kit announcing its own default'
    ).toBeInTheDocument();
  });

  it('routes dock control labels through the copy package (INV-23)', () => {
    render(
      <CopyContext.Provider value={sentinelCopy()}>
        <PreviewDrawerTools
          treeVisible
          onToggleTree={() => {}}
          maximized={false}
          onToggleMaximize={() => {}}
          dockPosition="bottom"
          onDockPositionChange={() => {}}
          onCycleDock={() => {}}
        />
      </CopyContext.Provider>
    );
    expect(
      screen.getByRole('button', { name: 'COPY::code-preview.dock-position' }),
      'INV-23: dock trigger accessible name must resolve from the dock-position notice key'
    ).toBeInTheDocument();
  });

  it('names the selected file in the source pane label', async () => {
    render(renderDrawer(coreCopy));

    await waitFor(() => {
      expect(screen.getByLabelText(`${SELECTED} source code`)).toBeInTheDocument();
    });
  });
});

/**
 * INV-38, extended to the column rather than worked around.
 *
 * Every string this sub-feature adds is a `notice.code-preview.impact.*` entry:
 * the region's accessible-name heading, the six resting states' titles and
 * descriptions, the secondary-group heading, and the four row labels — plus the
 * row's `aria-label`, because an accessible name is user-visible. It is simply
 * the only copy some users ever get, and for a row whose whole content is
 * "Lines 12-18" it is the entire message.
 *
 * The test compares the **rendered** id set against the dictionary's own
 * `impact.*` keys, so a new id that no assertion names is a gap the test itself
 * surfaces instead of a gap that ships.
 */
describe('field-impact column copy ownership (INV-38)', () => {
  /** Every `impact.*` id the dictionary declares, as the component would ask for it. */
  function declaredImpactIds(): readonly string[] {
    return Object.keys(NOTICES_COPY)
      .filter((key) => key.startsWith('notice.code-preview.impact.'))
      .map((key) => key.replace(/^notice\./, ''))
      .sort();
  }

  interface Recorder {
    readonly copy: ChainCopy;
    readonly asked: Set<string>;
  }

  function recordingSentinel(): Recorder {
    const asked = new Set<string>();
    return {
      asked,
      copy: {
        ...coreCopy,
        notice: (id: string) => {
          asked.add(id);
          // Both halves are sentinels, not just the description: the region's
          // sr-only heading and every `EmptyState` title are titles, and a
          // sentinel that leaves them undefined renders them empty and drops
          // them out of the scan — the accessible name would go unchecked in the
          // exact place it matters most.
          return { id: `notice.${id}`, title: `COPY::${id}`, description: `COPY::${id}` };
        },
      },
    };
  }

  function renderColumn(
    recorder: Recorder,
    provenance: CodePreviewProvenance | null
  ): ReactElement {
    return (
      <CopyContext.Provider value={recorder.copy}>
        <input data-testid="field-a" {...{ [CONFIG_ANCHOR_ATTR]: tokenAnchor('name') }} />
        <PreviewImpactColumn
          config={makeConfig()}
          provenance={provenance}
          onReveal={vi.fn()}
          drawerOpen={false}
        />
      </CopyContext.Provider>
    );
  }

  it('declares fourteen impact ids in the dictionary', () => {
    // The population this test partitions. Without it, every assertion below is
    // satisfied by a dictionary that declares nothing.
    expect(declaredImpactIds()).toHaveLength(14);
  });

  it('renders every visible string and every accessible name from the dictionary', () => {
    const recorder = recordingSentinel();
    const rich = availableProvenance([
      group('contracts/rwa-token/src/contract.rs', [
        rangeRow(12, 18),
        rangeRow(20, 20),
        fileRow(),
        createdRow(),
        rangeRow(41, 47, 'secondary'),
      ]),
    ]).provenance;

    const view = render(renderColumn(recorder, rich));
    act(() => {
      view.getByTestId('field-a').focus();
    });

    const column = view.container.querySelector<HTMLElement>('.rwa-code-preview-impact')!;

    // Every rendered text node is a sentinel. A string the component wrote
    // itself is visibly not one of them.
    // The header renders the focused config path and each file heading renders
    // its own leaf and directory. Those are data — the config schema the user is
    // editing, and the paths the generator reported — not prose, and routing
    // them through the copy package would be the mistake in the other direction.
    //
    // The header's two entries are the humanised halves of `token.name`
    // (`humaniseConfigPath`, a pure function of the path): the same data, spelled
    // for a reader instead of for a compiler. It is still the path, so it is
    // still exempt — what is NOT exempt, and is asserted below, is the
    // "Generated from" caption beside it, which is authored prose and resolves
    // from the dictionary like every other sentence here.
    // Two entries per two-part string: the header renders `context` + `field`,
    // and the file heading renders the directory as `head` + `/tail` so it can
    // lose its middle rather than its end. Both splits are pure functions of the
    // same data, so every fragment here is still the path.
    const DATA_TEXT = new Set(['Token ·', 'Name', 'contract.rs', 'contracts/rwa-token', '/src']);

    // Every text node, not every childless element. The old form missed any
    // string sharing its element with a glyph — the "Mentions" heading now does,
    // and it went silently unchecked the moment the icon landed beside it. A
    // tree walk cannot develop that hole: an `<svg>` contributes no text nodes,
    // so the population is exactly the strings a reader sees.
    const walker = document.createTreeWalker(column, NodeFilter.SHOW_TEXT);
    const texts: string[] = [];
    while (walker.nextNode() !== null) {
      const text = walker.currentNode.textContent?.trim() ?? '';
      if (text.length > 0 && !DATA_TEXT.has(text)) texts.push(text);
    }

    // The population, computed from the DOM rather than guessed: one string per
    // row, plus the sr-only region heading and the secondary-group heading. A
    // fixture that stops rendering rows would otherwise satisfy the loop below
    // by having nothing to iterate.
    const rowCount = column.querySelectorAll('li > button').length;
    expect(rowCount).toBe(5);
    expect(texts.length).toBeGreaterThanOrEqual(rowCount + 2);

    for (const text of texts) {
      expect(text, `"${text}" is not routed through the copy package`).toMatch(
        /^COPY::code-preview\.impact\./
      );
    }

    for (const row of column.querySelectorAll('li > button')) {
      expect(row.getAttribute('aria-label')).toBe('COPY::code-preview.impact.row-label');
    }
  });

  it('asks for every impact id the dictionary declares, across all eight kinds', () => {
    // The coverage half: a new id that no state renders would be declared and
    // never asked for, which is how a string quietly stops being reachable.
    const recorder = recordingSentinel();
    const states: readonly (readonly [CodePreviewProvenance | null, boolean])[] = [
      [null, false],
      [{ state: { kind: 'none' }, liveIdentity: null }, false],
      [unsupportedProvenance(), false],
      [availableProvenance(mixedGroups()).provenance, false],
      [availableProvenance([]).provenance, true],
      [
        // `pending` is now the stale-AND-empty corner: a stale identity with
        // rows to keep renders `groups`, not the placeholder.
        availableProvenance([], { identity: TEST_IDENTITY, liveIdentity: 'moved' }).provenance,
        true,
      ],
      [
        availableProvenance([
          group('a.rs', [
            rangeRow(1, 4),
            rangeRow(9, 9),
            fileRow(),
            createdRow(),
            rangeRow(20, 22, 'secondary'),
          ]),
        ]).provenance,
        true,
      ],
    ];

    for (const [provenance, needsFocus] of states) {
      const view = render(renderColumn(recorder, provenance));
      if (needsFocus) {
        act(() => {
          view.getByTestId('field-a').focus();
        });
      }
      view.unmount();
    }

    // `not-a-field` is the one state no provenance shape can produce: it needs a
    // real control that writes no config location to hold focus.
    const notAField = render(renderColumn(recorder, availableProvenance(mixedGroups()).provenance));
    const inert = document.createElement('button');
    notAField.container.appendChild(inert);
    act(() => {
      inert.focus();
    });
    notAField.unmount();

    // `uncreated`: a resolvable anchor whose slot the draft does not hold yet —
    // an operator role with no addresses resolves to `accessControl.roles[0]`.
    const uncreated = render(
      <CopyContext.Provider value={recorder.copy}>
        <div {...{ [CONFIG_ANCHOR_ATTR]: roleAnchor('Manager') }}>
          <input data-testid="pending-role" />
        </div>
        <PreviewImpactColumn
          config={makeConfig({ accessControl: { ...makeConfig().accessControl, roles: [] } })}
          provenance={availableProvenance(mixedGroups()).provenance}
          onReveal={vi.fn()}
          drawerOpen={false}
        />
      </CopyContext.Provider>
    );
    act(() => {
      uncreated.getByTestId('pending-role').focus();
    });
    uncreated.unmount();

    const missing = declaredImpactIds().filter((id) => !recorder.asked.has(id));
    expect(
      missing,
      `these impact copy ids are declared but never rendered by any state: ${missing.join(', ')}`
    ).toHaveLength(0);
  });
});
