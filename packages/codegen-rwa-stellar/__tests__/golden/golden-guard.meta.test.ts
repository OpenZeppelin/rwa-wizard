/**
 * SF-4 AS-2 / AS-3 — does the guard actually fail when a byte moves?
 *
 * The code stage verified this by hand. This file makes it executable: each
 * scenario copies the committed goldens to a scratch directory, damages the copy
 * in one specific way, runs the real `golden-output.test.ts` against the copy
 * (via `RWA_STELLAR_GOLDENS_DIR`) and asserts on the JSON report — which tests
 * failed, that nothing else did, and what the copy looks like afterwards. The
 * committed goldens are never touched.
 *
 * Scenarios run sequentially and write the vitest JSON report to a scratch file
 * so stdout truncation under full-suite load cannot flake parsing (B-11).
 */
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(HERE, '..', '..');
const COMMITTED_GOLDENS = join(HERE, '__goldens__');
const GUARD_FILE = '__tests__/golden/golden-output.test.ts';
const VITEST_BIN = join(PACKAGE_ROOT, '..', '..', 'node_modules', 'vitest', 'vitest.mjs');

/** A sampled golden that exists on both paths and has a plain-text body. */
const SAMPLE = { path: 'generate', fixture: 'baseline', file: 'README.md' } as const;
const SAMPLE_TITLE = `${SAMPLE.file} is byte-identical to its golden`;
const SAMPLE_SUITE = ['golden output · generate', 'baseline'];

interface AssertionResult {
  readonly ancestorTitles: readonly string[];
  readonly title: string;
  readonly status: 'passed' | 'failed' | 'skipped' | 'pending' | 'todo' | 'disabled';
  readonly failureMessages: readonly string[];
}

interface JsonReport {
  readonly success: boolean;
  readonly numTotalTests: number;
  readonly numFailedTests: number;
  readonly testResults: readonly { readonly assertionResults: readonly AssertionResult[] }[];
}

interface GuardRun {
  readonly report: JsonReport;
  readonly failed: readonly AssertionResult[];
  readonly goldens: string;
}

const scratchDirs: string[] = [];

afterAll(() => {
  for (const dir of scratchDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function copyGoldens(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rwa-goldens-'));
  scratchDirs.push(dir);
  cpSync(COMMITTED_GOLDENS, dir, { recursive: true });
  return dir;
}

function golden(dir: string, path: string, fixture: string, file: string): string {
  return join(dir, path, fixture, file);
}

function manifest(dir: string, path: string, fixture: string): string {
  return join(dir, path, `${fixture}.manifest.txt`);
}

async function runGuard(
  goldens: string,
  options: { readonly ci?: boolean; readonly update?: boolean } = {}
): Promise<GuardRun> {
  const env: NodeJS.ProcessEnv = { ...process.env, RWA_STELLAR_GOLDENS_DIR: goldens };
  // Do not inherit the parent vitest's identity or the real CI flag.
  for (const key of Object.keys(env)) {
    if (key.startsWith('VITEST') || key === 'CI') {
      delete env[key];
    }
  }
  if (options.ci === true) {
    env.CI = 'true';
  }
  const args = [VITEST_BIN, 'run', GUARD_FILE, '--reporter=json', '--root', PACKAGE_ROOT];
  if (options.update === true) {
    args.push('-u');
  }

  const reportFile = join(tmpdir(), `rwa-golden-guard-${randomBytes(8).toString('hex')}.json`);
  args.push(`--outputFile=${reportFile}`);

  await new Promise<void>((resolvePromise, reject) => {
    execFile(
      process.execPath,
      args,
      { cwd: PACKAGE_ROOT, env, maxBuffer: 64 * 1024 * 1024 },
      (error) => {
        // A failing guard exits 1; that is the outcome under test, not an error.
        if (error !== null && typeof error.code !== 'number') {
          reject(new Error(`vitest did not run: ${error.message}`));
          return;
        }
        resolvePromise();
      }
    );
  });

  if (!existsSync(reportFile)) {
    throw new Error(`vitest did not write JSON report to ${reportFile}`);
  }
  const report = JSON.parse(readFileSync(reportFile, 'utf8')) as JsonReport;
  rmSync(reportFile, { force: true });
  const failed = report.testResults
    .flatMap((file) => file.assertionResults)
    .filter((result) => result.status === 'failed');
  return { report, failed, goldens };
}

function expectOnlyFailures(
  run: GuardRun,
  expected: readonly { suite: readonly string[]; title: string }[]
): void {
  const actual = run.failed.map((f) => [...f.ancestorTitles, f.title].join(' > ')).sort();
  expect(actual).toEqual(expected.map((e) => [...e.suite, e.title].join(' > ')).sort());
  expect(run.report.success).toBe(false);
  expect(run.report.numFailedTests).toBe(expected.length);
}

let control: GuardRun | undefined;
async function controlRun(): Promise<GuardRun> {
  control ??= await runGuard(copyGoldens());
  return control;
}

describe('golden guard against a scratch copy (AS-2, AS-3)', () => {
  it('control: an untouched copy passes every test (proves the override is honoured)', async () => {
    const run = await controlRun();
    expect(run.failed).toEqual([]);
    expect(run.report.success).toBe(true);
    // Sanity: the guard actually ran the full matrix, not an empty file.
    expect(run.report.numTotalTests).toBeGreaterThan(800);
  });

  it('one substituted byte fails exactly the file and fixture it belongs to', async () => {
    const dir = copyGoldens();
    const target = golden(dir, SAMPLE.path, SAMPLE.fixture, SAMPLE.file);
    const original = readFileSync(target, 'utf8');
    const mid = Math.floor(original.length / 2);
    const mutated = `${original.slice(0, mid)}${original[mid] === 'x' ? 'y' : 'x'}${original.slice(mid + 1)}`;
    expect(mutated).not.toBe(original);
    expect(mutated.length).toBe(original.length);
    writeFileSync(target, mutated);

    const run = await runGuard(dir);
    expectOnlyFailures(run, [{ suite: SAMPLE_SUITE, title: SAMPLE_TITLE }]);
    expect(run.failed[0]?.failureMessages.join('\n')).toContain('Snapshot');
  });

  it('a mismatch does not rewrite the golden (AS-3)', async () => {
    const dir = copyGoldens();
    const target = golden(dir, SAMPLE.path, SAMPLE.fixture, SAMPLE.file);
    const mutated = `${readFileSync(target, 'utf8')}drift`;
    writeFileSync(target, mutated);

    await runGuard(dir);
    expect(readFileSync(target, 'utf8')).toBe(mutated);
  });

  it('a trailing newline is a byte and fails', async () => {
    const dir = copyGoldens();
    const target = golden(dir, SAMPLE.path, SAMPLE.fixture, SAMPLE.file);
    writeFileSync(target, `${readFileSync(target, 'utf8')}\n`);

    expectOnlyFailures(await runGuard(dir), [{ suite: SAMPLE_SUITE, title: SAMPLE_TITLE }]);
  });

  it('trailing whitespace on a line is a byte and fails', async () => {
    const dir = copyGoldens();
    const target = golden(dir, SAMPLE.path, SAMPLE.fixture, SAMPLE.file);
    const original = readFileSync(target, 'utf8');
    const firstNewline = original.indexOf('\n');
    expect(firstNewline).toBeGreaterThan(0);
    writeFileSync(target, `${original.slice(0, firstNewline)} ${original.slice(firstNewline)}`);

    expectOnlyFailures(await runGuard(dir), [{ suite: SAMPLE_SUITE, title: SAMPLE_TITLE }]);
  });

  it('a truncated (empty) golden fails', async () => {
    const dir = copyGoldens();
    writeFileSync(golden(dir, SAMPLE.path, SAMPLE.fixture, SAMPLE.file), '');

    expectOnlyFailures(await runGuard(dir), [{ suite: SAMPLE_SUITE, title: SAMPLE_TITLE }]);
  });

  it('a golden that switched to CRLF is accepted — pinned vitest behaviour, mitigated by .gitattributes', async () => {
    // @vitest/snapshot normalises a CRLF golden against LF output before comparing.
    // This is a documented weakness of the guard, not a feature: `.gitattributes`
    // marks `__goldens__` `-text` so a checkout can never introduce CRLF. Pin the
    // behaviour so a vitest upgrade that changes it is noticed.
    const dir = copyGoldens();
    const target = golden(dir, SAMPLE.path, SAMPLE.fixture, SAMPLE.file);
    const original = readFileSync(target, 'utf8');
    expect(original).not.toContain('\r\n');
    writeFileSync(target, original.split('\n').join('\r\n'));

    const run = await runGuard(dir);
    expect(run.failed).toEqual([]);
  });

  it('two drifted files in different fixtures are both reported by name', async () => {
    const dir = copyGoldens();
    const second = {
      path: 'generate-with-identity-support',
      fixture: 'compliance-all-modules',
      file: 'README.md',
    } as const;
    for (const t of [SAMPLE, second]) {
      const target = golden(dir, t.path, t.fixture, t.file);
      writeFileSync(target, `${readFileSync(target, 'utf8')}!`);
    }

    expectOnlyFailures(await runGuard(dir), [
      { suite: SAMPLE_SUITE, title: SAMPLE_TITLE },
      {
        suite: [`golden output · ${second.path}`, second.fixture],
        title: `${second.file} is byte-identical to its golden`,
      },
    ]);
  });

  it('a manifest missing an emitted file fails the file-set test (a new emitted file would look like this)', async () => {
    const dir = copyGoldens();
    const target = manifest(dir, SAMPLE.path, SAMPLE.fixture);
    const lines = readFileSync(target, 'utf8').split('\n');
    expect(lines).toContain(SAMPLE.file);
    writeFileSync(target, `${lines.filter((line) => line !== SAMPLE.file).join('\n')}`);

    expectOnlyFailures(await runGuard(dir), [
      { suite: SAMPLE_SUITE, title: 'emits the recorded file set' },
    ]);
  });

  it('a manifest listing a file the generator does not emit fails the file-set test (a removed emitted file would look like this)', async () => {
    const dir = copyGoldens();
    const target = manifest(dir, SAMPLE.path, SAMPLE.fixture);
    writeFileSync(target, `${readFileSync(target, 'utf8')}contracts/removed.rs\n`);

    expectOnlyFailures(await runGuard(dir), [
      { suite: SAMPLE_SUITE, title: 'emits the recorded file set' },
    ]);
  });

  it('a golden directory for a fixture that no longer exists fails the orphan test', async () => {
    const dir = copyGoldens();
    mkdirSync(join(dir, SAMPLE.path, 'stale-fixture'));
    writeFileSync(join(dir, SAMPLE.path, 'stale-fixture', 'README.md'), 'stale');

    const run = await runGuard(dir);
    expectOnlyFailures(run, [
      {
        suite: [`golden output · ${SAMPLE.path}`],
        title: 'has no golden directory or manifest for a fixture that no longer exists',
      },
    ]);
    expect(run.failed[0]?.failureMessages.join('\n')).toContain('stale-fixture');
  });

  it('a golden file the generator no longer emits fails the stale-golden test', async () => {
    const dir = copyGoldens();
    const stale = golden(dir, SAMPLE.path, SAMPLE.fixture, 'contracts/no-longer-emitted.rs');
    mkdirSync(dirname(stale), { recursive: true });
    writeFileSync(stale, 'stale');

    const run = await runGuard(dir);
    expectOnlyFailures(run, [
      {
        suite: [`golden output · ${SAMPLE.path}`],
        title: 'has no golden file that the generator no longer emits',
      },
    ]);
    expect(run.failed[0]?.failureMessages.join('\n')).toContain('no-longer-emitted.rs');
  });

  it('under CI a missing golden fails instead of being written (AS-3)', async () => {
    const dir = copyGoldens();
    const target = golden(dir, SAMPLE.path, SAMPLE.fixture, SAMPLE.file);
    rmSync(target);

    const run = await runGuard(dir, { ci: true });
    expectOnlyFailures(run, [{ suite: SAMPLE_SUITE, title: SAMPLE_TITLE }]);
    expect(existsSync(target)).toBe(false);
  });

  it('outside CI a missing golden fails and is NOT written — the former local-only soft spot is closed', async () => {
    // Locally, vitest's default update mode would recreate a deleted golden from
    // the generator's current output and pass. The guard refuses that: only an
    // explicit update run may create a golden, so a deletion landing together
    // with an output change cannot go green on a developer's machine.
    const dir = copyGoldens();
    const target = golden(dir, SAMPLE.path, SAMPLE.fixture, SAMPLE.file);
    rmSync(target);

    const run = await runGuard(dir);
    expectOnlyFailures(run, [{ suite: SAMPLE_SUITE, title: SAMPLE_TITLE }]);
    expect(existsSync(target)).toBe(false);
  });

  it('the update run rewrites a drifted golden to the current output and goes green (AS-3)', async () => {
    const dir = copyGoldens();
    const target = golden(dir, SAMPLE.path, SAMPLE.fixture, SAMPLE.file);
    const committed = readFileSync(target, 'utf8');
    writeFileSync(target, `${committed}drift`);

    const run = await runGuard(dir, { update: true });
    expect(run.failed).toEqual([]);
    expect(readFileSync(target, 'utf8')).toBe(committed);
  });

  it('the update run never touches the committed goldens directory', async () => {
    // All scenarios above write to scratch copies; assert the committed tree is
    // still the pristine baseline the control run started from.
    await controlRun();
    const target = golden(COMMITTED_GOLDENS, SAMPLE.path, SAMPLE.fixture, SAMPLE.file);
    const control = readFileSync(
      golden(await controlRun().then((r) => r.goldens), SAMPLE.path, SAMPLE.fixture, SAMPLE.file),
      'utf8'
    );
    expect(readFileSync(target, 'utf8')).toBe(control);
  });
});
