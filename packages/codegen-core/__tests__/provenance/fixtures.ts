/**
 * Shared fixtures for the provenance suite.
 *
 * The config type is deliberately NOT `RWAConfig` (INV-30): the capability is a
 * chain-agnostic brick and the synthetic generator below adopts it through the
 * public collector API only, the way a generator in another package would.
 */
import { computeConfigHash, stableJsonStringify } from '../../src/determinism';
import { createFile, mergeFileTrees } from '../../src/file-tree';
import { createProvenanceCollector } from '../../src/provenance/provenance-collector';
import type {
  GenerateOptions,
  GenerationResult,
  Generator,
  ValidationResult,
} from '../../src/types';

// ---------------------------------------------------------------------------
// Synthetic config — every value class the recorder distinguishes (INV-1, INV-4)
// ---------------------------------------------------------------------------

export interface Member {
  readonly id: string;
  readonly address: string;
  readonly weight: number;
}

export type Ownership =
  | { readonly type: 'single'; readonly ownerAddress: string }
  | { readonly type: 'shared'; readonly holders: readonly string[] };

export interface SyntheticConfig {
  settings: {
    name: string;
    symbol: string;
    decimals: number;
    emptyString: string;
    flagOff: boolean;
    zero: number;
    nothing: null;
    explicitUndefined: undefined;
    optional?: string;
    nested: { deep: { leaf: string } };
    emptyObject: Record<string, never>;
  };
  members: Member[];
  emptyList: string[];
  ownership: Ownership;
  modules: Array<{ moduleId: string; config?: Record<string, unknown> }>;
  locked: { a: string; b: string };
  // Non-plain values: returned raw, never wrapped (INV-1)
  createdAt: Date;
  bytes: Uint8Array;
  lookup: Map<string, number>;
  tags: Set<string>;
  compute: (x: number) => number;
  instance: Counter;
}

export class Counter {
  count = 0;
  increment(): number {
    this.count += 1;
    return this.count;
  }
}

export function createSyntheticConfig(): SyntheticConfig {
  return {
    settings: {
      name: 'Alpha',
      symbol: 'ALP',
      decimals: 7,
      emptyString: '',
      flagOff: false,
      zero: 0,
      nothing: null,
      explicitUndefined: undefined,
      nested: { deep: { leaf: 'leaf-value' } },
      emptyObject: {},
    },
    members: [
      { id: 'm0', address: 'ADDR0', weight: 1 },
      { id: 'm1', address: 'ADDR1', weight: 2 },
    ],
    emptyList: [],
    ownership: { type: 'single', ownerAddress: 'OWNER' },
    modules: [
      { moduleId: 'limit', config: { maxBalance: 100, 'weird.key': 'w', '': 'empty', 名前: 'n' } },
      { moduleId: 'plain' },
    ],
    locked: { a: 'LOCKED-A', b: 'LOCKED-B' },
    createdAt: new Date(0),
    bytes: new Uint8Array([1, 2, 3]),
    lookup: new Map([['k', 1]]),
    tags: new Set(['t']),
    compute: (x) => x * 2,
    instance: new Counter(),
  };
}

/** The JSON-representable subset, for serialisation and hashing assertions (INV-3, INV-26). */
export interface JsonConfig {
  settings: {
    name: string;
    symbol: string;
    decimals: number;
    emptyString: string;
    flagOff: boolean;
    zero: number;
    nothing: null;
    optional?: string;
    nested: { deep: { leaf: string } };
    emptyObject: Record<string, never>;
  };
  members: Member[];
  emptyList: string[];
  ownership: Ownership;
  modules: Array<{ moduleId: string; config?: Record<string, unknown> }>;
}

export function createJsonConfig(): JsonConfig {
  const full = createSyntheticConfig();
  const { explicitUndefined: _dropped, ...settings } = full.settings;
  return {
    settings,
    members: full.members,
    emptyList: full.emptyList,
    ownership: full.ownership,
    modules: full.modules,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively freeze every plain object and array reachable from `value` (INV-26). */
export function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  if (Object.isFrozen(value)) return value;
  const proto: unknown = Object.getPrototypeOf(value);
  // Only plain objects and arrays freeze; typed arrays, Map, Set, Date, class
  // instances are returned raw by the recorder anyway (INV-1) and cannot all be frozen.
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return value;
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(Reflect.get(value, key));
  }
  return value;
}

/** Byte equality across a whole file tree — string equality or element-wise `Uint8Array` equality (INV-2). */
export function expectSameBytes(
  a: Record<string, string | Uint8Array>,
  b: Record<string, string | Uint8Array>
): string[] {
  const problems: string[] = [];
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.join('\n') !== keysB.join('\n')) {
    problems.push(`file sets differ: [${keysA.join(', ')}] vs [${keysB.join(', ')}]`);
    return problems;
  }
  for (const key of keysA) {
    const left = a[key];
    const right = b[key];
    if (typeof left === 'string' || typeof right === 'string') {
      if (left !== right) problems.push(`${key}: text differs`);
      continue;
    }
    if (left === undefined || right === undefined) {
      problems.push(`${key}: missing on one side`);
      continue;
    }
    if (left.length !== right.length || left.some((byte, i) => byte !== right[i])) {
      problems.push(`${key}: bytes differ`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Synthetic generator — exercises every D7 trap-table row through the collector
// ---------------------------------------------------------------------------

export const SYNTHETIC_FILES = {
  main: 'src/main.txt',
  members: 'src/members.txt',
  ownership: 'src/ownership.txt',
  modules: 'src/modules.txt',
  configJson: 'config.json',
  readme: 'README.txt',
  optionalNote: 'NOTE.txt',
  binary: 'assets/blob.bin',
} as const;

export interface SyntheticGenerateOptions extends GenerateOptions {
  /** Second generate path: re-emits `README.txt` with extra content, mirroring an identity-support variant. */
  variant?: boolean;
}

/**
 * A generator honouring the capability exactly as Design § Integration patterns
 * prescribes: validation and hashing on the RAW config (attribute to nothing),
 * every emitted file inside its own `createFile` scope, `observe` for a
 * config-dependent existence decision, `addRange` for a ranged attribution.
 */
export class SyntheticGenerator implements Generator<SyntheticConfig> {
  readonly name = 'synthetic-provenance-generator';
  readonly version = '0.0.1';
  /** Raw-config reads performed by the generator outside any scope (INV-15 fixture). */
  rawReadsPerformed = 0;

  validate(config: SyntheticConfig): ValidationResult {
    // Raw read: locked controls are consulted here, never through a view.
    const errors =
      config.locked.a.length === 0
        ? [{ field: 'locked.a', code: 'REQUIRED_FIELD', message: 'locked.a must not be empty' }]
        : [];
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  generate(config: SyntheticConfig, options?: SyntheticGenerateOptions): GenerationResult {
    const validation = this.validate(config);
    if (!validation.valid) throw new Error('Invalid config');
    this.rawReadsPerformed += 1;

    const collector = createProvenanceCollector(config, {
      enabled: options?.recordProvenance === true,
    });

    // Every value class, absent keys, optional chaining, discriminant + variant member (INV-1/4/29)
    const main = collector.createFile(SYNTHETIC_FILES.main, ({ config: c, addRange }) => {
      const lines = [
        `name=${c.settings.name}`,
        `symbol=${c.settings.symbol}`,
        `decimals=${c.settings.decimals}`,
        `empty=${JSON.stringify(c.settings.emptyString)}`,
        `flag=${String(c.settings.flagOff)}`,
        `zero=${c.settings.zero}`,
        `nothing=${String(c.settings.nothing)}`,
        `undef=${String(c.settings.explicitUndefined)}`,
        `optional=${c.settings.optional ?? '<unset>'}`,
        `leaf=${c.settings.nested?.deep?.leaf ?? '<none>'}`,
        `date=${c.createdAt.toISOString()}`,
        `bytes=${c.bytes.length}`,
        `lookup=${c.lookup.get('k') ?? -1}`,
        `tags=${c.tags.has('t') ? 'y' : 'n'}`,
        `compute=${c.compute(21)}`,
        `instanceCount=${c.instance.count}`,
        `isArray=${Array.isArray(c.members)}`,
        `settingsKeys=${Object.keys(c.settings).join(',')}`,
        `hasSymbol=${'symbol' in c.settings}`,
      ];
      addRange({ start: 1, end: 2 }, ['settings.name', 'settings.symbol']);
      return lines.join('\n');
    });

    // Array reads: length, index, for…of, map, spread, empty array (INV-5)
    const members = collector.createFile(SYNTHETIC_FILES.members, ({ config: c }) => {
      const out = [`count=${c.members.length}`, `first=${c.members[0]?.address ?? '<none>'}`];
      for (const member of c.members) out.push(`each=${member.id}`);
      out.push(`weights=${c.members.map((m) => m.weight).join('+')}`);
      out.push(`spread=${[...c.members].length}`);
      out.push(`emptyLen=${c.emptyList.length}`);
      out.push(`emptyJoined=${c.emptyList.join(',')}`);
      out.push(
        `sliced=${c.members
          .slice(1)
          .map((m) => m.id)
          .join(',')}`
      );
      return out.join('\n');
    });

    // Discriminated union (INV-29)
    const ownership = collector.createFile(SYNTHETIC_FILES.ownership, ({ config: c }) => {
      switch (c.ownership.type) {
        case 'single':
          return `owner=${c.ownership.ownerAddress}`;
        case 'shared':
          return `holders=${c.ownership.holders.join(',')}`;
      }
    });

    // Dynamic keys, unrepresentable keys, unicode keys (INV-24, INV-29)
    const modules = collector.createFile(SYNTHETIC_FILES.modules, ({ config: c }) => {
      const out: string[] = [];
      for (const [index, mod] of c.modules.entries()) {
        out.push(`${index}:${mod.moduleId}`);
        out.push(`  max=${String(mod.config?.['maxBalance'])}`);
        out.push(`  weird=${String(mod.config?.['weird.key'])}`);
        out.push(`  empty=${String(mod.config?.[''])}`);
        out.push(`  unicode=${String(mod.config?.['名前'])}`);
        out.push(`  keys=${Object.keys(mod.config ?? {}).join('|')}`);
      }
      return out.join('\n');
    });

    // Whole-config serialisation through the view (INV-3): config.json legitimately reads everything.
    const configJson = collector.createFile(SYNTHETIC_FILES.configJson, ({ config: c }) =>
      JSON.stringify(
        {
          settings: c.settings,
          members: c.members,
          emptyList: c.emptyList,
          ownership: c.ownership,
          modules: c.modules,
        },
        null,
        2
      )
    );

    // Existence decided by config: observe → createdBy (INV-28)
    const decision = collector.observe((c) => c.modules.some((m) => m.moduleId === 'limit'));
    const optionalNote = decision.value
      ? collector.createFile(
          SYNTHETIC_FILES.optionalNote,
          ({ config: c }) => `limit module present for ${c.settings.name}`,
          { createdBy: decision.paths }
        )
      : {};

    // Binary content (INV-2 byte equality on Uint8Array)
    const binary = collector.createFile(
      SYNTHETIC_FILES.binary,
      ({ config: c }) => new Uint8Array([c.settings.decimals, c.members.length, c.bytes[0] ?? 0])
    );

    let readme = collector.createFile(
      SYNTHETIC_FILES.readme,
      ({ config: c }) => `# ${c.settings.name}\n\nSymbol: ${c.settings.symbol}\n`
    );
    if (options?.variant === true) {
      // Second generate path: re-emit README (INV-18 replace-wholesale in a real flow)
      readme = collector.createFile(
        SYNTHETIC_FILES.readme,
        ({ config: c }) =>
          `# ${c.settings.name}\n\nSymbol: ${c.settings.symbol}\nDecimals: ${c.settings.decimals}\n`
      );
    }

    const files = mergeFileTrees(
      main,
      members,
      ownership,
      modules,
      configJson,
      optionalNote,
      binary,
      readme,
      // A file emitted OUTSIDE any scope — must be absent from provenance (INV-11)
      createFile('UNRECORDED.txt', 'not recorded')
    );

    const provenance = collector.result();
    const result: GenerationResult = {
      files,
      metadata: {
        generatorName: this.name,
        generatorVersion: this.version,
        generatedAt: '1970-01-01T00:00:00.000Z',
        fileCount: Object.keys(files).length,
        // Hash on the raw config: attributes to nothing (INV-15)
        configHash: computeConfigHash(stableJsonStringify(toHashable(config))),
      },
    };
    return provenance === undefined ? result : { ...result, provenance };
  }
}

function toHashable(config: SyntheticConfig): JsonConfig {
  const { explicitUndefined: _dropped, ...settings } = config.settings;
  return {
    settings,
    members: config.members,
    emptyList: config.emptyList,
    ownership: config.ownership,
    modules: config.modules,
  };
}
