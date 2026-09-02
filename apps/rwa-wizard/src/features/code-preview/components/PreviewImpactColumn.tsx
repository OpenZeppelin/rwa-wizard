import {
  Braces,
  CircleDashed,
  FileCode2,
  FileMinus2,
  HelpCircle,
  Loader2,
  MessageSquareQuote,
  MousePointerClick,
} from 'lucide-react';
import {
  Fragment,
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';
import { EmptyState } from '@openzeppelin/ui-components';

import { useCopy } from '../../../app/providers/useCopy';
import type { FieldProvenanceRow } from '../../../services/preview';
import type { ConfigPath } from '../../wizard/config-path';
import type { RevealInPreview } from '../CodePreviewRevealContext';
import {
  firstRangedSite,
  humaniseConfigPath,
  resolveActiveRangedSite,
  resolveActiveSite,
  splitDirectory,
  useFieldImpact,
  type ActiveImpactSite,
  type FieldImpactView,
  type ImpactGroupView,
  type RangedImpactSite,
} from '../impact';
import { revealTargetFor } from '../impact/revealTargetFor';
import type { CodePreviewProvenance } from '../provenanceState';
import { PreviewImpactRow } from './PreviewImpactRow';

interface PreviewImpactColumnProps {
  /** The live draft. SF-12's resolution is a function of the focused element AND the draft. */
  readonly config: RWAConfig;
  /** `useCodePreview().provenance`; `null` when the target has no codegen service. */
  readonly provenance: CodePreviewProvenance | null;
  /** `useCodePreview().revealInPreview`; `null` disables activation without hiding rows. */
  readonly onReveal: RevealInPreview | null;
  /**
   * `preview.persistence.open` (or the drawer's `open` prop).
   * Auto-select and open-transition re-issue run only while true (AS-2 / INV-9).
   */
  readonly drawerOpen: boolean;
}

/**
 * A range activation that could not be satisfied against the tree on screen,
 * because a newer one was already on its way.
 *
 * Identified by **what the user pointed at** — the field, the file, and the
 * row's position in that file's unpartitioned row list — never by the line
 * range itself. The range is the one thing that does not survive a
 * regeneration; the site does.
 */
interface DeferredRange {
  /** The config path the column was describing. Re-checked before re-issuing. */
  readonly configPath: ConfigPath;
  /** The generated file the row named. */
  readonly filePath: string;
  /** `IndexedRow.rowIndex` — the position in the file's full, unpartitioned rows. */
  readonly rowIndex: number;
}

function PreviewImpactColumnImpl(props: PreviewImpactColumnProps): ReactElement {
  const { config, provenance, onReveal, drawerOpen } = props;
  const copy = useCopy();
  const id = useId();
  const { view, latchProps } = useFieldImpact(config, provenance);
  // Asked once and bound once. Both the sr-only heading and the header glyph's
  // tooltip come from this entry, and a second `copy.notice` call for the same
  // id would be a second dictionary lookup per render for no gain.
  const region = copy.notice('code-preview.impact.region');

  const path = 'path' in view ? view.path : null;
  const subject = path === null ? null : humaniseConfigPath(path);

  // A refresh is in flight. True for the narrowed `pending` too, so the one
  // state that still tears down to a placeholder is announced the same way as
  // the many that no longer do.
  const refreshing = view.kind === 'groups' ? view.stale : view.kind === 'pending';

  // ---------------------------------------------------------------------
  // The dead click, closed.
  //
  // Keeping the rows through a refresh (INV-35) created a window that could not
  // exist before it: rows on screen, clickable, while a newer tree is already
  // in flight. A reveal issued in that window is stamped with the on-screen
  // tree's generate key and is then dropped by SF-9 INV-4 row 4 the moment the
  // new tree lands — correct in isolation, and a **silent no-op** to the user,
  // which is strictly worse than the flicker it replaced.
  //
  // So the click is split. The **file** is revealed immediately — a path
  // survives a regeneration untouched (SF-9 INV-4 row 5 keeps it whenever it is
  // still in the tree), so the user gets the pane on the right file with no
  // delay. The **range** is held and re-issued once, from the freshly rendered
  // rows, on the first render where the tree is no longer stale.
  // ---------------------------------------------------------------------
  const [deferred, setDeferred] = useState<DeferredRange | null>(null);

  /**
   * Instance-local selection chrome + preserve-within-subject gate (INV-6,
   * INV-11). Never persisted (INV-18). Survives drawer close so open-transition
   * can re-issue (INV-12).
   */
  const [activeSite, setActiveSite] = useState<ActiveImpactSite | null>(null);

  /** Previous `drawerOpen` — detects false→true for INV-12 without a timer. */
  const prevDrawerOpenRef = useRef(drawerOpen);

  // Deliberately NOT `useCallback`. INV-16's scan forbids one under `impact/`,
  // and a stable identity buys nothing here: `ImpactGroup` is not memoised.
  const deferRange = (filePath: string, rowIndex: number): void => {
    if (path === null) return;
    setDeferred({ configPath: path, filePath, rowIndex });
  };

  /**
   * Shared activation for click and auto-select (INV-8 / D-2). Writes
   * `activeSite`, then either defers the range under staleness or reveals now.
   */
  const activateSite = (filePath: string, rowIndex: number, row: FieldProvenanceRow): void => {
    if (path === null || onReveal === null) return;
    setActiveSite({ configPath: path, filePath, rowIndex, rowKind: row.kind });

    const stale = view.kind === 'groups' && view.stale;
    if (stale && row.kind === 'range') {
      onReveal({ path: filePath });
      deferRange(filePath, rowIndex);
      return;
    }
    onReveal(revealTargetFor(filePath, row));
  };

  const activateRangedSite = (site: RangedImpactSite): void => {
    activateSite(site.filePath, site.rowIndex, {
      kind: 'range',
      range: site.range,
      significance: 'primary',
    });
  };

  useEffect(() => {
    if (deferred === null || onReveal === null) return;
    // Still waiting: another tree is on its way, so re-issuing now would only
    // produce a second doomed reveal.
    if (view.kind !== 'groups' || view.stale) return;

    setDeferred(null);

    // The field moved on. The row index names a position in *that* field's row
    // list, so applying it to another field's would reveal an unrelated site —
    // silently, and plausibly.
    if (view.path !== deferred.configPath) return;

    const group = view.groups.find((candidate) => candidate.path === deferred.filePath);
    if (group === undefined) return;

    const entry =
      group.primary.find((indexed) => indexed.rowIndex === deferred.rowIndex) ??
      group.secondary.find((indexed) => indexed.rowIndex === deferred.rowIndex);

    // The site is gone from the new tree, or it is no longer a range. Nothing to
    // reveal, and nothing synthesised in its place (AS-2, INV-19).
    if (entry === undefined || entry.row.kind !== 'range') return;

    onReveal({ path: deferred.filePath, range: entry.row.range });
  }, [deferred, view, onReveal]);

  // ---------------------------------------------------------------------
  // SF-21 auto-select / open-transition (INV-9…12).
  //
  // Same path as a click (`activateSite`). Preserve within subject (INV-11).
  // Re-issue on drawer open edge (INV-12). Never opens the drawer (INV-14).
  // ---------------------------------------------------------------------
  useEffect(() => {
    const opening = drawerOpen && !prevDrawerOpenRef.current;
    prevDrawerOpenRef.current = drawerOpen;

    // INV-9: all three must hold.
    if (!drawerOpen || onReveal === null || view.kind !== 'groups') return;

    const subjectPath = view.path;

    if (activeSite?.configPath === subjectPath) {
      if (activeSite.rowKind !== 'range') {
        const resolved = resolveActiveSite(view.groups, activeSite);
        if (resolved !== null) {
          if (opening) {
            onReveal(revealTargetFor(resolved.filePath, resolved.row));
          }
          return;
        }
        // Preserved file/created site gone — fall through to first ranged (INV-11c).
      } else {
        // Always resolve before preserving: a same-subject refresh can drop the
        // site while the drawer stays open (INV-11c). Only skip re-assert when
        // the site still exists; re-issue only on the open edge (INV-12).
        const resolved = resolveActiveRangedSite(view.groups, activeSite);
        if (resolved !== null) {
          if (opening) {
            activateRangedSite(resolved);
          }
          return;
        }
        // Preserved site gone — fall through to first (INV-11c).
      }
    }

    const first = firstRangedSite(view.groups);
    if (first === null) {
      // INV-10 / INV-6: clear chrome that belonged to another path or a dead site.
      if (activeSite !== null) {
        setActiveSite(null);
      }
      return;
    }

    activateRangedSite(first);
    // activateSite / setActiveSite intentionally omitted from deps: including
    // them would re-enter after every activation. The gate above
    // (`activeSite.configPath === subjectPath`) is the "already fired" token
    // (INV-11); `opening` covers the open edge once per false→true.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- INV-11 / INV-17
  }, [drawerOpen, view, onReveal, activeSite]);

  const isRowActive = (filePath: string, rowIndex: number): boolean =>
    activeSite !== null &&
    path !== null &&
    activeSite.configPath === path &&
    activeSite.filePath === filePath &&
    activeSite.rowIndex === rowIndex;

  return (
    <section
      className="rwa-code-preview-impact flex min-h-0 shrink-0 flex-col"
      // The quiet signal, and both halves of it are deliberately non-displacing:
      // `aria-busy` adds no node and is not announced as a change, and the data
      // attribute drives a CSS opacity fade with a 400ms delay, so a
      // regeneration that finishes at the ordinary speed changes nothing on
      // screen at all. Neither can alter the column's height or replace its
      // content — which is the whole point, because this flag flips on every
      // keystroke.
      aria-busy={refreshing}
      data-impact-stale={refreshing}
      // The accessible name concatenates the sr-only heading and the visible
      // field element, so it is never empty — the heading is present in all
      // seven kinds — and when a field is described the name reads "Field
      // impact Access control · Roles 1 · Addresses". One source, no duplicated
      // copy: the visible field name and the accessible name are the same node,
      // so they cannot disagree. INV-41.
      aria-labelledby={`${id}-title ${id}-field`}
      // ONE static tab stop, on the column root, and the only thing that makes
      // the column keyboard-reachable at all (INV-42).
      tabIndex={0}
      {...latchProps}
    >
      <h3 id={`${id}-title`} className="sr-only">
        {region.title}
      </h3>
      <p className="rwa-code-preview-impact-field" title={path ?? undefined}>
        {subject === null ? null : (
          <span
            className="rwa-code-preview-impact-caption inline-flex shrink-0"
            title={region.description}
          >
            <Braces className="size-3" aria-hidden />
          </span>
        )}
        <span
          id={`${id}-field`}
          className="rwa-code-preview-impact-subject flex min-w-0 items-baseline"
        >
          {subject === null || subject.context === '' ? null : (
            <span className="rwa-code-preview-impact-context min-w-0 truncate">
              {subject.context}
            </span>
          )}
          <span className="rwa-code-preview-impact-field-name min-w-0 truncate">
            {subject?.field}
          </span>
        </span>
      </p>

      <div className="rwa-code-preview-impact-scroll min-h-0 flex-1 overflow-y-auto">
        {view.kind === 'groups' ? (
          view.groups.map((group) => (
            <ImpactGroup
              key={group.path}
              group={group}
              onReveal={onReveal}
              activateSite={activateSite}
              isRowActive={isRowActive}
            />
          ))
        ) : (
          <EmptyState
            size="small"
            className="rwa-code-preview-impact-resting"
            {...restingCopy(view, copy)}
            icon={RESTING_ICON[view.kind]}
          />
        )}
      </div>
    </section>
  );
}

function ImpactGroup(props: {
  readonly group: ImpactGroupView;
  readonly onReveal: RevealInPreview | null;
  readonly activateSite: (filePath: string, rowIndex: number, row: FieldProvenanceRow) => void;
  readonly isRowActive: (filePath: string, rowIndex: number) => boolean;
}): ReactElement {
  const { group, onReveal, activateSite, isRowActive } = props;
  const copy = useCopy();
  const secondary = copy.notice('code-preview.impact.secondary-group');
  const directory = splitDirectory(group.directory);

  const bindActivate = (rowIndex: number, row: FieldProvenanceRow): (() => void) | null => {
    if (onReveal === null) return null;
    return () => {
      activateSite(group.path, rowIndex, row);
    };
  };

  return (
    <Fragment>
      <h4 className="rwa-code-preview-impact-file sticky top-0 z-10" title={group.path}>
        {group.directory ? (
          <span className="rwa-code-preview-impact-dir">
            {directory.head === '' ? null : (
              <span className="rwa-code-preview-impact-dir-head min-w-0 truncate">
                {directory.head}
              </span>
            )}
            <span className="rwa-code-preview-impact-dir-tail min-w-0 truncate">
              {directory.tail}
            </span>
          </span>
        ) : null}
        <span className="rwa-code-preview-impact-leaf block truncate">{group.leaf}</span>
      </h4>

      <ul>
        {group.primary.map(({ row, rowIndex }) => (
          <PreviewImpactRow
            key={`${group.path}#${rowIndex}`}
            path={group.path}
            row={row}
            secondary={false}
            onActivate={bindActivate(rowIndex, row)}
            active={isRowActive(group.path, rowIndex)}
          />
        ))}
      </ul>

      {group.secondary.length > 0 ? (
        <Fragment>
          <h5 className="rwa-code-preview-impact-secondary" title={secondary.description}>
            <MessageSquareQuote className="size-3 shrink-0" aria-hidden />
            {secondary.title}
          </h5>
          <ul>
            {group.secondary.map(({ row, rowIndex }) => (
              <PreviewImpactRow
                key={`${group.path}#${rowIndex}`}
                path={group.path}
                row={row}
                secondary
                onActivate={bindActivate(rowIndex, row)}
                active={isRowActive(group.path, rowIndex)}
              />
            ))}
          </ul>
        </Fragment>
      ) : null}
    </Fragment>
  );
}

/**
 * One glyph per resting state, keyed by the same discriminant the copy is.
 *
 * A `Record` over the six kinds rather than a `switch`: adding a seventh resting
 * kind fails `tsc` here as well as at `restingCopy`, so a state cannot arrive
 * with copy and no icon. `pending` reuses the drawer's own spinner, which is
 * what `code-preview.generating` already shows for the same fact.
 */
const RESTING_ICON: Record<Exclude<FieldImpactView, { kind: 'groups' }>['kind'], ReactNode> = {
  'no-preview': <FileCode2 aria-hidden />,
  unsupported: <HelpCircle aria-hidden />,
  'no-focus': <MousePointerClick aria-hidden />,
  'not-a-field': <CircleDashed aria-hidden />,
  pending: <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />,
  uncreated: <CircleDashed aria-hidden />,
  empty: <FileMinus2 aria-hidden />,
};

/**
 * Copy for the six resting states.
 *
 * Exhaustive with a `never` arm, so a seventh resting kind fails `tsc` here
 * rather than falling through to a blank 260px rail that looks exactly like a
 * layout bug. `EmptyState` requires both `title` and `description`, so a state
 * with half its copy does not compile either. INV-2, INV-36.
 */
function restingCopy(
  view: Exclude<FieldImpactView, { kind: 'groups' }>,
  copy: ReturnType<typeof useCopy>
): { readonly title: string; readonly description: string } {
  const entry = (id: string): { title: string; description: string } => {
    const notice = copy.notice(id);
    return { title: notice.title ?? '', description: notice.description };
  };

  switch (view.kind) {
    case 'no-preview':
      return entry('code-preview.impact.no-preview');
    case 'unsupported':
      return entry('code-preview.impact.unsupported');
    case 'no-focus':
      return entry('code-preview.impact.no-focus');
    case 'not-a-field':
      return entry('code-preview.impact.not-a-field');
    case 'pending':
      return entry('code-preview.impact.pending');
    case 'uncreated':
      return entry('code-preview.impact.uncreated');
    case 'empty':
      return entry('code-preview.impact.empty');
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

/**
 * Memoised for the same reason `PreviewCodePane` is: the sheet re-renders on
 * every `pointermove` of a height drag while none of these props change, and
 * each unmemoised render would run a seam lookup linear in the provenance size
 * at 60Hz — a drag that stutters, with the cause looking like the code pane's
 * problem.
 *
 * The props interface is closed at four (SF-21 INV-16, amending SF-13 INV-21),
 * all of them stable across such a render: `provenance` is `useMemo`d on
 * `[provenanceState, liveIdentity]`, `revealInPreview` is a `useCallback`,
 * `config` only changes on an edit, and `drawerOpen` is a boolean primitive.
 * Default shallow comparator, no custom `areEqual`.
 */
export const PreviewImpactColumn = memo(PreviewImpactColumnImpl);
