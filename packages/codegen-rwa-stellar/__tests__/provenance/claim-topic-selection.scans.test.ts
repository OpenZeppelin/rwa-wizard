/**
 * SF-16 — committed source scans for the properties that have no runtime
 * witness on this stage alone.
 *
 * INV-2, INV-5, INV-17, INV-29, INV-32, INV-33, INV-35. Each scan strips
 * comments before matching: every module documents the invariant it satisfies,
 * so a raw-source scan fails on the documentation and the natural repair is to
 * delete the sentence that explains the shape.
 *
 * For every absence asserted here, a partner case watches the guard fail —
 * inserts the forbidden token into a synthetic buffer and asserts the finder
 * reports it. Six hollow absence guards have already shipped green on this
 * initiative while the exact feature they banned was live.
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { GENERATE_PATHS, topicUnselectedConfig } from './helpers';

const HERE = dirname(fileURLToPath(import.meta.url));
const STELLAR_ROOT = join(HERE, '../..');
const REPO_ROOT = join(STELLAR_ROOT, '../..');

/** Strip `//` and `/* *\/` comments; leave string / template literals intact. */
function stripComments(source: string): string {
  let out = '';
  let index = 0;
  let quote: string | null = null;

  while (index < source.length) {
    const char = source[index]!;
    const next = source[index + 1];

    if (quote !== null) {
      if (char === '\\') {
        out += char + (source[index + 1] ?? '');
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      out += char;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      out += char;
      index += 1;
      continue;
    }

    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') out += '\n';
        index += 1;
      }
      index += 2;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

interface Scanned {
  readonly path: string;
  readonly raw: string;
  readonly stripped: string;
}

function walkTsFiles(absoluteDir: string, options: { includeTests?: boolean } = {}): readonly string[] {
  const includeTests = options.includeTests ?? true;
  const out: string[] = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const full = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') {
        continue;
      }
      out.push(...walkTsFiles(full, options));
      continue;
    }
    if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith('.d.ts') &&
      (includeTests || (!entry.name.includes('.test.') && !entry.name.includes('.spec.')))
    ) {
      out.push(full);
    }
  }
  return out;
}

function readScanned(absolutePaths: readonly string[], root: string): readonly Scanned[] {
  return absolutePaths.map((absolute) => {
    const stats = statSync(absolute);
    if (!stats.isFile() || stats.size === 0) {
      throw new Error(`source scan: ${absolute} is missing or empty`);
    }
    const raw = readFileSync(absolute, 'utf8');
    return { path: relative(root, absolute), raw, stripped: stripComments(raw) };
  });
}

function findToken(sources: readonly Scanned[], token: string | RegExp): readonly string[] {
  return sources.flatMap((source) =>
    source.stripped
      .split('\n')
      .map((line, offset) => ({ line, number: offset + 1 }))
      .filter((entry) =>
        typeof token === 'string' ? entry.line.includes(token) : token.test(entry.line)
      )
      .map((entry) => `${source.path}:${entry.number}: ${entry.line.trim()}`)
  );
}

const CONFIG_SRC = readScanned(walkTsFiles(join(REPO_ROOT, 'packages/config/src')), REPO_ROOT);
const COMMON_SRC = readScanned(
  walkTsFiles(join(REPO_ROOT, 'packages/codegen-rwa-common/src')),
  REPO_ROOT
);
const STELLAR_SRC = readScanned(
  walkTsFiles(join(REPO_ROOT, 'packages/codegen-rwa-stellar/src')),
  REPO_ROOT
);
const STELLAR_TEMPLATES = readScanned(
  walkTsFiles(join(REPO_ROOT, 'packages/codegen-rwa-stellar/src/templates')),
  REPO_ROOT
);
const APP_SRC = readScanned(walkTsFiles(join(REPO_ROOT, 'apps/rwa-wizard/src')), REPO_ROOT);
/** Production-only wizard sources — INV-35 cares about runtime writers, not fixtures. */
const APP_PRODUCTION_SRC = readScanned(
  walkTsFiles(join(REPO_ROOT, 'apps/rwa-wizard/src'), { includeTests: false }),
  REPO_ROOT
);

const ALL_SRC = [...CONFIG_SRC, ...COMMON_SRC, ...STELLAR_SRC, ...APP_PRODUCTION_SRC];

it('the scan corpus is non-empty on every root, so an empty walk cannot look green', () => {
  // A sweep over zero files reports no offenders and looks exactly like a
  // clean result. Two suites on this initiative have shipped that way.
  expect(CONFIG_SRC.length).toBeGreaterThan(0);
  expect(COMMON_SRC.length).toBeGreaterThan(0);
  expect(STELLAR_SRC.length).toBeGreaterThan(0);
  expect(STELLAR_TEMPLATES.length).toBeGreaterThan(0);
  expect(APP_PRODUCTION_SRC.length).toBeGreaterThan(50);
  // APP_SRC still includes tests; keep it larger than production so the filter is not vacuous.
  expect(APP_SRC.length).toBeGreaterThan(APP_PRODUCTION_SRC.length);
});

/* ------------------------------------------------------------------ *
 * INV-2 — one definition of ClaimTopic.selected
 * ------------------------------------------------------------------ */

describe('INV-2 — exactly one file inspects ClaimTopic.selected', () => {
  it('topic.selected / .selected reads land only in packages/config/src/claim-topics.ts', () => {
    // Property access on a claim topic. Comments are stripped; string
    // literals that name the field in docs stay, so we match the code forms
    // that would be a second definition: `topic.selected`, `t.selected`, and
    // the destructuring `selected:` of a topic shape in executable code is
    // covered by INV-35's write scan for the app.
    const hits = findToken(ALL_SRC, /\b(?:topic|t|claimTopic)\.selected\b/);
    expect(hits).toEqual([
      'packages/config/src/claim-topics.ts:26: return topic.selected !== false;',
    ]);
  });

  it('and the finder is not vacuous: a second inline read is reported', () => {
    const synthetic: Scanned = {
      path: 'synthetic.ts',
      raw: 'if (topic.selected === true) return;',
      stripped: 'if (topic.selected === true) return;',
    };
    expect(findToken([synthetic], /\b(?:topic|t|claimTopic)\.selected\b/)).toEqual([
      'synthetic.ts:1: if (topic.selected === true) return;',
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * INV-5 — no claimTopicCount; no counted for-loop over claim topics
 * ------------------------------------------------------------------ */

describe('INV-5 — claimTopicCount is gone; loops iterate indices', () => {
  it('claimTopicCount appears nowhere under packages/codegen-rwa-stellar/src', () => {
    expect(findToken(STELLAR_SRC, 'claimTopicCount')).toEqual([]);
  });

  it('claim-topic emission blocks use `for (const index of …)`, not a counted for', () => {
    const postDeploy = STELLAR_SRC.find((s) =>
      s.path.endsWith('templates/scripts/deploy-sh-post-deploy.ts')
    );
    const demoMint = STELLAR_SRC.find((s) =>
      s.path.endsWith('templates/scripts/bootstrap-demo-mint-sh.ts')
    );
    expect(postDeploy, 'deploy-sh-post-deploy.ts must be in the corpus').toBeDefined();
    expect(demoMint, 'bootstrap-demo-mint-sh.ts must be in the corpus').toBeDefined();

    // The claim-topic loop: `for (const index of moduleAttribution.claimTopicIndices)`.
    expect(postDeploy!.stripped).toMatch(
      /for \(const index of moduleAttribution\.claimTopicIndices\)/
    );
    expect(postDeploy!.stripped).not.toMatch(
      /for \(let index = 0; index < moduleAttribution\.claimTopic/
    );

    // Demo-mint's allow_key loop iterates the selected-index local, never
    // `topicIds.length` as a bound into `claimTopics`.
    expect(demoMint!.stripped).toMatch(/for \(const index of [a-zA-Z.]+\)/);
    expect(demoMint!.stripped).not.toMatch(/for \(let \w+ = 0; \w+ < \w*topicIds\.length/);
  });

  it('and the finder reports claimTopicCount when present', () => {
    const synthetic: Scanned = {
      path: 'synthetic.ts',
      raw: 'const n = attribution.claimTopicCount;',
      stripped: 'const n = attribution.claimTopicCount;',
    };
    expect(findToken([synthetic], 'claimTopicCount')).toEqual([
      'synthetic.ts:1: const n = attribution.claimTopicCount;',
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * INV-17 — no isCustom branch in any template
 * ------------------------------------------------------------------ */

describe('INV-17 — no isCustom in templates; projection is uniform', () => {
  it('isCustom appears in no file under packages/codegen-rwa-stellar/src/templates', () => {
    expect(findToken(STELLAR_TEMPLATES, 'isCustom')).toEqual([]);
  });

  it('and a template that branched on isCustom would be reported', () => {
    const synthetic: Scanned = {
      path: 'templates/scripts/evil.ts',
      raw: 'if (topic.isCustom === false) continue;',
      stripped: 'if (topic.isCustom === false) continue;',
    };
    expect(findToken([synthetic], 'isCustom')).toEqual([
      'templates/scripts/evil.ts:1: if (topic.isCustom === false) continue;',
    ]);
  });

  it('behaviourally: flipping isCustom alone does not change generated bytes', () => {
    const withFlag = topicUnselectedConfig();
    const withoutFlag = {
      ...withFlag,
      identityVerification: {
        ...withFlag.identityVerification,
        claimTopics: withFlag.identityVerification.claimTopics.map((topic) => {
          const { isCustom: _drop, ...rest } = topic;
          return rest;
        }),
      },
    };

    for (const path of GENERATE_PATHS) {
      const left = path.run(withFlag).files;
      const right = path.run(withoutFlag).files;
      // config.json may differ if isCustom was serialised; every other file
      // must not — the chain projection does not know where a definition came from.
      const names = new Set([...Object.keys(left), ...Object.keys(right)]);
      const differing: string[] = [];
      for (const name of names) {
        if (name === 'config.json') continue;
        if (left[name] !== right[name]) differing.push(name);
      }
      expect(differing, path.name).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ *
 * INV-29 — no new dependency
 * ------------------------------------------------------------------ */

describe('INV-29 — no new dependency, no new package', () => {
  it('SF-16’s three packages gain no dependency entries in package.json', () => {
    // The branch carries unrelated package.json edits (scripts, lockfile). This
    // scan pins the dependencies / peerDependencies / devDependencies blocks of
    // the three packages SF-16 touches, against what `git show HEAD:` would be
    // too broad for — instead: the claim-topics modules import only what their
    // packages already declared.
    const configPkg = JSON.parse(
      readFileSync(join(REPO_ROOT, 'packages/config/package.json'), 'utf8')
    ) as { dependencies?: Record<string, string>; name: string };
    const commonPkg = JSON.parse(
      readFileSync(join(REPO_ROOT, 'packages/codegen-rwa-common/package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };
    const stellarPkg = JSON.parse(
      readFileSync(join(REPO_ROOT, 'packages/codegen-rwa-stellar/package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };

    // claim-topics.ts in config has zero imports of third-party packages.
    const configClaim = CONFIG_SRC.find((s) => s.path.endsWith('config/src/claim-topics.ts'));
    expect(configClaim).toBeDefined();
    expect(configClaim!.stripped).not.toMatch(/from ['"](?!\.)/);

    // common's claim-topics imports only @openzeppelin/rwa-config.
    const commonClaim = COMMON_SRC.find((s) =>
      s.path.endsWith('codegen-rwa-common/src/claim-topics.ts')
    );
    expect(commonClaim).toBeDefined();
    const commonImports = [...commonClaim!.stripped.matchAll(/from ['"]([^'"]+)['"]/g)].map(
      (match) => match[1]
    );
    expect(commonImports).toEqual(['@openzeppelin/rwa-config']);

    // No new package directory was created for this feature.
    expect(configPkg.name).toBe('@openzeppelin/rwa-config');
    expect(Object.keys(commonPkg.dependencies ?? {})).toContain('@openzeppelin/rwa-config');
    expect(Object.keys(stellarPkg.dependencies ?? {})).toContain(
      '@openzeppelin/codegen-rwa-common'
    );
  });

  it('git status over package.json shows no dependency-block churn for SF-16’s files', () => {
    // `test:goldens:update` on stellar's package.json is a scripts-key add from
    // earlier on the branch, not a dependency. Pin that the dependencies
    // objects themselves are untouched in the working tree diff.
    const diff = execSync(
      'git diff -- packages/config/package.json packages/codegen-rwa-common/package.json packages/codegen-rwa-stellar/package.json',
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      }
    );
    expect(diff).not.toMatch(/^\+.*"dependencies"/m);
    expect(diff).not.toMatch(/^\+[+-].*"(dependencies|peerDependencies|devDependencies)":/m);
    // Any added dependency line inside those blocks would look like `+    "foo":`.
    const addedDepLines = diff
      .split('\n')
      .filter((line) => /^\+\s+"[^"]+":\s+"[^"]+"/.test(line) && !line.includes('test:goldens'));
    expect(addedDepLines).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * INV-32 / INV-33 — placement and chain-agnosticism
 * ------------------------------------------------------------------ */

describe('INV-32 / INV-33 — placement and chain-agnostic helpers', () => {
  it('isClaimTopicSelected is exported from rwa-config and NOT re-exported from common', () => {
    const configIndex = CONFIG_SRC.find((s) => s.path.endsWith('config/src/index.ts'));
    const commonIndex = COMMON_SRC.find((s) => s.path.endsWith('codegen-rwa-common/src/index.ts'));
    expect(configIndex).toBeDefined();
    expect(commonIndex).toBeDefined();

    expect(configIndex!.stripped).toMatch(/isClaimTopicSelected/);
    expect(commonIndex!.stripped).not.toMatch(/isClaimTopicSelected/);
  });

  it('rwa-config imports nothing from a codegen package', () => {
    const offenders = findToken(CONFIG_SRC, /from ['"]@openzeppelin\/codegen-/);
    expect(offenders).toEqual([]);
  });

  it('codegen-rwa-common/src/claim-topics.ts imports only @openzeppelin/rwa-config', () => {
    const module = COMMON_SRC.find((s) =>
      s.path.endsWith('codegen-rwa-common/src/claim-topics.ts')
    );
    expect(module).toBeDefined();
    const imports = [...module!.stripped.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports).toEqual(['@openzeppelin/rwa-config']);
  });

  it('and mentions no chain name, no stellar, no CLI vocabulary', () => {
    const module = COMMON_SRC.find((s) =>
      s.path.endsWith('codegen-rwa-common/src/claim-topics.ts')
    );
    expect(module).toBeDefined();
    for (const token of ['stellar', 'soroban', 'stellar-cli', 'soroban-cli', 'evm', 'solidity']) {
      expect(findToken([module!], new RegExp(token, 'i')), token).toEqual([]);
    }
  });

  it('and the chain-name finder reports a hit when present', () => {
    const synthetic: Scanned = {
      path: 'claim-topics.ts',
      raw: 'return `[${ids.join(",")}]`; // stellar CLI form',
      stripped: 'return `[${ids.join(",")}]`; ',
    };
    // After strip the comment is gone — so plant it in code.
    const coded: Scanned = {
      path: 'claim-topics.ts',
      raw: "const stellarForm = '[' + ids.join(',') + ']';",
      stripped: "const stellarForm = '[' + ids.join(',') + ']';",
    };
    expect(findToken([coded], /stellar/i)).toEqual([
      "claim-topics.ts:1: const stellarForm = '[' + ids.join(',') + ']';",
    ]);
    expect(synthetic.stripped.includes('stellar')).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * INV-35 — closed by SF-17: exactly one wizard producer of selected: false
 * ------------------------------------------------------------------ */

describe('INV-35 — sole producer of selected: false is ClaimTopicsSection (SF-17)', () => {
  it('exactly one selected: false write appears under apps/rwa-wizard/src (production)', () => {
    // SF-16 deferred the producer to SF-17. SF-17 INV-10 closes it: the
    // selection control's unselectTopic helper is the only writer. Test fixtures
    // may author `selected: false` freely — they are not producers.
    const hits = findToken(APP_PRODUCTION_SRC, /selected:\s*false\b/);
    expect(hits).toEqual([
      'apps/rwa-wizard/src/features/wizard/steps/identity/ClaimTopicsSection.tsx:22: return topics.map((topic) => (topic.id === topicId ? { ...topic, selected: false } : topic));',
    ]);
  });

  it('and no assignment to a topic’s selected field appears either', () => {
    const hits = findToken(APP_PRODUCTION_SRC, /\.selected\s*=\s*false\b/);
    expect(hits).toEqual([]);
  });

  it('and both finders report a planted second write', () => {
    const planted: Scanned = {
      path: 'ExtraWriter.tsx',
      raw: 'return { ...topic, selected: false };\ntopic.selected = false;',
      stripped: 'return { ...topic, selected: false };\ntopic.selected = false;',
    };
    expect(findToken([planted], /selected:\s*false\b/)).toEqual([
      'ExtraWriter.tsx:1: return { ...topic, selected: false };',
    ]);
    expect(findToken([planted], /\.selected\s*=\s*false\b/)).toEqual([
      'ExtraWriter.tsx:2: topic.selected = false;',
    ]);
  });
});
