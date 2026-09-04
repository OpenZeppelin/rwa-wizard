/**
 * SF-10 — where a mark may be authored in this package, and what authoring one
 * is allowed to change.
 * INV-7 (Stellar shape), INV-27 (Stellar half), INV-28 (emitter equivalence),
 * INV-32.
 * Category: Request/Response Contract + Performance, Scalability & Re-usability.
 *
 * The static assertions here are stronger than INV-32's wording allows for, and
 * deliberately: Code Draft's `emitDisplay` primitive reduced the number of
 * places in this package that can write a mark from three to ONE, so the
 * assertion is "only inside `emitDisplay`" rather than "only in this file".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { LineSink, ProvenanceEntry, ProvenanceResult } from '@openzeppelin/codegen-core';
import { createLineBuilder, createProvenanceCollector } from '@openzeppelin/codegen-core';

import {
  emitDisplay,
  emitEcho,
  emitSection,
  emitSubsection,
  shellEcho,
  shellSection,
  shellSubsection,
} from '../../src/templates/scripts/deploy-sh-helpers';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_DIR = join(PACKAGE_ROOT, 'src');
const HELPERS = join(SRC_DIR, 'templates', 'scripts', 'deploy-sh-helpers.ts');

/** Every `.ts` file under `src/`, with comments stripped so JSDoc never counts as code. */
function sourceFiles(): { path: string; code: string; text: string }[] {
  const found: { path: string; code: string; text: string }[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ts')) {
        const text = readFileSync(full, 'utf8');
        found.push({
          path: relative(PACKAGE_ROOT, full),
          text,
          code: text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''),
        });
      }
    }
  };
  walk(SRC_DIR);
  return found;
}

/** The body of a top-level `export function <name>(...)`, up to its column-0 `}`. */
function functionBody(code: string, name: string): string {
  const start = code.indexOf(`export function ${name}(`);
  if (start === -1) throw new Error(`${name} not found`);
  const end = code.indexOf('\n}', start);
  if (end === -1) throw new Error(`${name} has no closing brace`);
  return code.slice(start, end + 2);
}

describe('INV-32 — marks are authored in exactly one place', () => {
  it('the literal `secondary` occurs only in `deploy-sh-helpers.ts`', () => {
    for (const { path, code } of sourceFiles()) {
      if (path.endsWith('deploy-sh-helpers.ts')) continue;
      expect(code, `${path} mentions secondary`).not.toMatch(/secondary/i);
    }
  });

  it('and within that file, only inside `emitDisplay`', () => {
    // Tighter than the invariant's wording, and true because the three emitters
    // now delegate to one primitive. A mark that cannot be attached to a
    // formatter cannot travel from one; a mark written in exactly one function
    // cannot travel at all.
    const code = readFileSync(HELPERS, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const occurrences = [...code.matchAll(/secondary/gi)];
    expect(occurrences.length).toBeGreaterThan(0);

    const body = functionBody(code, 'emitDisplay');
    for (const match of occurrences) {
      const line =
        code
          .slice(0, match.index ?? 0)
          .split('\n')
          .pop() ?? '';
      expect(body.includes(line.trim()), `outside emitDisplay: ${line.trim()}`).toBe(true);
    }
    // Exactly one executable mark-writing statement in the whole package.
    expect([...code.matchAll(/\{\s*secondary:\s*true\s*\}/g)]).toHaveLength(1);
  });

  it('the pure formatters gained nothing — same signatures, no emission', () => {
    expectTypeOf(shellEcho).toEqualTypeOf<(msg: string) => string>();
    expectTypeOf(shellSection).toEqualTypeOf<(title: string) => string[]>();
    expectTypeOf(shellSubsection).toEqualTypeOf<(title: string) => string[]>();

    const code = readFileSync(HELPERS, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    for (const name of ['shellEcho', 'shellSection', 'shellSubsection']) {
      const body = functionBody(code, name);
      expect(body, `${name} emits`).not.toMatch(/\bsink\b/);
      expect(body, `${name} knows about significance`).not.toMatch(/secondary/i);
    }
  });

  it('the emitters take a sink and return void — one site, not two calls', () => {
    expectTypeOf(emitEcho).parameter(0).toEqualTypeOf<LineSink>();
    expectTypeOf(emitSection).parameter(0).toEqualTypeOf<LineSink>();
    expectTypeOf(emitSubsection).parameter(0).toEqualTypeOf<LineSink>();
    expectTypeOf(emitDisplay).parameter(0).toEqualTypeOf<LineSink>();
    expectTypeOf(emitEcho).returns.toEqualTypeOf<void>();
    expectTypeOf(emitSection).returns.toEqualTypeOf<void>();
    expectTypeOf(emitSubsection).returns.toEqualTypeOf<void>();
    expectTypeOf(emitDisplay).returns.toEqualTypeOf<void>();
  });
});

describe('INV-27 — no `src/` file in this package classifies its own output', () => {
  it('nothing in `src/` imports or re-implements the display grammar', () => {
    for (const { path, code } of sourceFiles()) {
      expect(code, `${path} classifies`).not.toMatch(
        /isDisplayLine|isDisplayOnlyRange|isDisplay\b/
      );
      expect(code, `${path} imports the grammar`).not.toMatch(/display-grammar/);
    }
  });

  it('`display-grammar.ts` is imported by nothing outside `__tests__/`', () => {
    for (const { path, text } of sourceFiles()) {
      expect(text, path).not.toContain('display-grammar');
    }
  });
});

/* ------------------------------------------------------------------ *
 * INV-28 / INV-7 — the sugar changed no attribution
 * ------------------------------------------------------------------ */

interface Cfg {
  readonly token: { readonly name: string };
}
const CFG: Cfg = { token: { name: 'Alpha' } };
const FILE = 'scripts/deploy.sh';

/** Drive one emission through `run` and return both the text and the entries. */
function record(run: (sink: LineSink) => void): {
  text: string;
  entries: readonly ProvenanceEntry[];
} {
  const collector = createProvenanceCollector(CFG, { enabled: true });
  let text = '';
  collector.record(FILE, (scope) => {
    const builder = createLineBuilder(scope);
    run(builder);
    text = builder.text();
  });
  const result = collector.result() as ProvenanceResult;
  return { text, entries: result.files[FILE]?.entries ?? [] };
}

const withoutMarks = (entries: readonly ProvenanceEntry[]): readonly ProvenanceEntry[] =>
  entries.map((entry) => {
    if (entry.kind !== 'range' || entry.secondaryPaths === undefined) return entry;
    const { secondaryPaths: _dropped, ...rest } = entry;
    return rest;
  });

describe('INV-28 — each emitter emits exactly what the raw formatter + sink call did', () => {
  const PATHS = ['compliance.modules[0].moduleId'];

  const CASES: ReadonlyArray<
    readonly [string, (sink: LineSink) => void, (sink: LineSink) => void]
  > = [
    [
      'emitEcho',
      (sink) => emitEcho(sink, '  Network:        futurenet', PATHS),
      (sink) => sink.line(shellEcho('  Network:        futurenet'), PATHS),
    ],
    [
      'emitSection',
      (sink) => emitSection(sink, 'Deploying Alpha (ALP)', PATHS),
      (sink) => sink.lines(shellSection('Deploying Alpha (ALP)'), PATHS),
    ],
    [
      'emitSubsection',
      (sink) => emitSubsection(sink, 'Compliance Module Wiring (2 modules)', PATHS),
      (sink) => sink.lines(shellSubsection('Compliance Module Wiring (2 modules)'), PATHS),
    ],
    [
      'emitDisplay',
      (sink) => emitDisplay(sink, ['echo ""', 'echo "  Summary"'], PATHS),
      (sink) => sink.lines(['echo ""', 'echo "  Summary"'], PATHS),
    ],
  ];

  it.each(CASES)('%s emits identical bytes', (_name, emitted, raw) => {
    expect(record(emitted).text).toBe(record(raw).text);
  });

  it.each(CASES)('%s records the identical range set and paths', (_name, emitted, raw) => {
    // The failure this catches is the one the goldens cannot see: replacing a
    // raw `sink.lines(formatter(t), paths)` with an emitter that drops the
    // `extraPaths` forwarding, or splits one emission into two. Bytes identical,
    // range set different, a field silently short one site.
    expect(withoutMarks(record(emitted).entries)).toStrictEqual(record(raw).entries);
  });

  it.each(CASES)('%s marks the range it records, and marks it fully', (_name, emitted) => {
    const ranges = record(emitted).entries.filter((entry) => entry.kind === 'range');
    expect(ranges).toHaveLength(1);
    expect(ranges[0]?.secondaryPaths).toEqual(ranges[0]?.paths);
  });

  it('the six-site shape: an explicit attribution reaches both members', () => {
    const { entries } = record((sink) => {
      emitSubsection(sink, 'Claim Topics (2)', [
        'identityVerification.claimTopics[0].id',
        'identityVerification.claimTopics[1].id',
      ]);
    });
    const range = entries.find((entry) => entry.kind === 'range');
    expect(range?.paths).toEqual([
      'identityVerification.claimTopics[0].id',
      'identityVerification.claimTopics[1].id',
    ]);
    expect(range?.secondaryPaths).toEqual(range?.paths);
  });

  it('an emitter attributing nothing records nothing — a mark on a pathless emission marks nothing', () => {
    // The `Deploy Signer:` / `Admin:` / `Manager:` echoes are display-only too,
    // but attribute nothing and so record no range. Code Draft marked only the
    // ranges the oracle named; this pins that the unmarked ones are unmarked
    // because there is nothing there, not because they were missed.
    const { entries } = record((sink) => {
      emitEcho(sink, '  Deploy Signer:  $SOURCE_ACCOUNT');
    });
    expect(entries.filter((entry) => entry.kind === 'range')).toHaveLength(0);
  });
});
