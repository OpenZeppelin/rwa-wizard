import { coreCopy, type ChainCopy } from '@openzeppelin/rwa-wizard-copy';

import type { CodePreviewProvenance, PreviewProvenanceState } from '../../features/code-preview';
import type { FieldImpactView } from '../../features/code-preview/impact';
import type { ConfigPath } from '../../features/wizard/config-path';
import type {
  FieldProvenanceResult,
  FieldProvenanceRow,
  FileProvenanceGroup,
} from '../../services/preview';

// ---------------------------------------------------------------------------
// Row and group fixtures
// ---------------------------------------------------------------------------

export function rangeRow(
  startLine: number,
  endLine: number,
  significance: 'primary' | 'secondary' = 'primary'
): FieldProvenanceRow {
  return { kind: 'range', range: { startLine, endLine }, significance };
}

export function fileRow(): FieldProvenanceRow {
  return { kind: 'file', significance: 'primary' };
}

export function createdRow(): FieldProvenanceRow {
  return { kind: 'created', significance: 'primary' };
}

export function group(path: string, rows: readonly FieldProvenanceRow[]): FileProvenanceGroup {
  return { path, kind: 'unknown', rows };
}

/**
 * The measured worst case, at the shape Code Draft recorded against the real
 * Stellar generator: 22 rows over two files, 20 in one, **all primary**.
 *
 * All-primary is the load-bearing half. A presentation that reads well *because*
 * it splits would fail exactly on the busiest field, and the failure would look
 * like a design choice rather than a bug (INV-3).
 */
export function tallGroups(): readonly FileProvenanceGroup[] {
  const many = Array.from({ length: 20 }, (_, index) => rangeRow(index * 3 + 1, index * 3 + 2));
  return [
    group('contracts/rwa-token/src/contract.rs', many),
    group('scripts/deploy.sh', [rangeRow(12, 18), rangeRow(41, 47)]),
  ];
}

/**
 * The mixed shape: one file, four sites, two of them secondary — `token.symbol`
 * as Research measured it. This is the only shape in which INV-5's key collision
 * reproduces, which is why it is not the shape anyone reaches for first.
 */
export function mixedGroups(): readonly FileProvenanceGroup[] {
  return [
    group('scripts/deploy.sh', [
      rangeRow(12, 18),
      rangeRow(20, 20, 'secondary'),
      rangeRow(41, 47),
      rangeRow(52, 55, 'secondary'),
    ]),
  ];
}

// ---------------------------------------------------------------------------
// Provenance doubles
// ---------------------------------------------------------------------------

export interface ProvenanceDouble {
  readonly provenance: CodePreviewProvenance;
  /** Every path `lookup` was asked about, in call order. One entry per evaluation. */
  readonly lookups: string[];
}

export const TEST_IDENTITY = 'hash|identity:0|service:test';

/**
 * An `available` provenance over a fixed group set, with a counting `lookup`.
 *
 * `lookups` is the harness's render counter as well as its call counter: the
 * view calls `lookup` exactly once per evaluation that reaches row 6 (INV-11),
 * so its length grows by exactly one per column render that resolves a field.
 * That is what lets the memo assertions count renders through a public seam
 * instead of instrumenting the component.
 */
export function availableProvenance(
  groups: readonly FileProvenanceGroup[],
  options: { readonly identity?: string; readonly liveIdentity?: string | null } = {}
): ProvenanceDouble {
  const identity = options.identity ?? TEST_IDENTITY;
  const lookups: string[] = [];
  const state: PreviewProvenanceState = {
    kind: 'available',
    identity,
    lookup: (path: ConfigPath): FieldProvenanceResult => {
      lookups.push(path);
      return { identity, path, groups };
    },
  };
  return {
    provenance: {
      state,
      liveIdentity: options.liveIdentity === undefined ? identity : options.liveIdentity,
    },
    lookups,
  };
}

export function unsupportedProvenance(identity = TEST_IDENTITY): CodePreviewProvenance {
  return { state: { kind: 'unsupported', identity }, liveIdentity: identity };
}

export function noneProvenance(): CodePreviewProvenance {
  return { state: { kind: 'none' }, liveIdentity: null };
}

// ---------------------------------------------------------------------------
// The render-recording subscriber
// ---------------------------------------------------------------------------

/** One committed column render, as the column itself reported it while rendering. */
export interface ColumnRenderRecord {
  readonly kind: FieldImpactView['kind'];
  /** The path the view resolved, for the two kinds that reach the seam. */
  readonly path: string | null;
}

const RESTING_KIND_BY_ID: Readonly<Record<string, FieldImpactView['kind']>> = {
  'code-preview.impact.no-preview': 'no-preview',
  'code-preview.impact.unsupported': 'unsupported',
  'code-preview.impact.no-focus': 'no-focus',
  'code-preview.impact.not-a-field': 'not-a-field',
  'code-preview.impact.pending': 'pending',
  'code-preview.impact.uncreated': 'uncreated',
  'code-preview.impact.empty': 'empty',
};

const REGION_ID = 'code-preview.impact.region';

interface MutableRecord {
  kind: FieldImpactView['kind'];
  path: string | null;
}

export interface ColumnRecorder {
  /** Pass as the `CopyContext` value. Real strings, plus a record per render. */
  readonly copy: ChainCopy;
  /** Wrap a provenance double's `lookups` array so resolved paths land on the record. */
  readonly watch: (double: ProvenanceDouble) => CodePreviewProvenance;
  /** Committed renders in order. `groups` is the kind of a render that asked no resting copy. */
  readonly records: () => readonly ColumnRenderRecord[];
  readonly reset: () => void;
}

/**
 * Records every view the column *renders*, not the one it ends on.
 *
 * A "final state" assertion cannot see an intermediate frame, and three of the
 * four invariants this serves — INV-16, INV-35, INV-40 — are entirely about
 * intermediate frames: a single commit in which the rows vanish under the user's
 * cursor is the failure, and it is invisible to anything that looks only at the
 * settled DOM.
 *
 * It records from **inside** the render, through two seams the column already
 * uses: `copy.notice(...)`, which the region heading calls once per render and
 * the resting states call once more with their own id, and `lookup(path)`, which
 * runs once per evaluation that resolves a field. No component is instrumented,
 * mocked or wrapped, so the harness cannot drift from what the column does.
 *
 * **The two seams fire in a fixed order, and the harness has to respect it.**
 * `useFieldImpact` runs before the JSX is evaluated, so `lookup` is called
 * *ahead* of the region heading's `notice`. Attributing the lookup to the record
 * that is open when it arrives puts every resolved path on the previous frame —
 * an off-by-one that reports the right paths in the wrong order and reads as a
 * passing test. The path is therefore buffered and consumed by the `notice` that
 * opens the frame it belongs to.
 *
 * A render that asks for the region heading and no resting copy is a `groups`
 * render — the only kind that renders a list instead of an `EmptyState`.
 */
export function createColumnRecorder(): ColumnRecorder {
  let records: MutableRecord[] = [];
  let pendingPath: string | null = null;

  const copy: ChainCopy = {
    ...coreCopy,
    notice: (id: string) => {
      if (id === REGION_ID) {
        records.push({ kind: 'groups', path: pendingPath });
        pendingPath = null;
      } else {
        const kind = RESTING_KIND_BY_ID[id];
        const current = records[records.length - 1];
        if (kind !== undefined && current !== undefined) current.kind = kind;
      }
      return coreCopy.notice(id);
    },
  };

  return {
    copy,
    watch: (double) => {
      const state = double.provenance.state;
      if (state.kind !== 'available') return double.provenance;
      return {
        ...double.provenance,
        state: {
          ...state,
          lookup: (path: ConfigPath) => {
            pendingPath = path;
            return state.lookup(path);
          },
        },
      };
    },
    records: () => records.map((record) => ({ kind: record.kind, path: record.path })),
    reset: () => {
      records = [];
      pendingPath = null;
    },
  };
}
