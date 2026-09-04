/**
 * INV-14 (the guard's fixture table), INV-15 (one implementation, run by
 * `pnpm lint` and by vitest), INV-27 (reports name identifiers, never values),
 * INV-28 (the rule is chain-agnostic — its fixtures use `FixtureConfig`).
 * Category: Error Semantics.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import tsParser from '@typescript-eslint/parser';
import { ESLint, Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const PLUGIN_PATH = join(REPO_ROOT, '.eslint', 'plugin-provenance.cjs');

interface RulePlugin {
  readonly rules: Record<string, unknown>;
}
interface FlatConfigBlock {
  readonly files?: readonly string[];
  readonly plugins?: Record<string, RulePlugin>;
  readonly rules?: Record<string, unknown>;
}

const plugin = require(PLUGIN_PATH) as RulePlugin;
const linter = new Linter({ configType: 'flat' });

/** The 20-line harness a generator package copies to run the guard from its own suite. */
function lint(
  code: string,
  configTypes: readonly string[] = ['FixtureConfig']
): Linter.LintMessage[] {
  return linter.verify(
    code,
    [
      {
        files: ['**/*.ts'],
        languageOptions: {
          parser: tsParser as Linter.Parser,
          parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
        },
        plugins: { provenance: plugin as never },
        rules: { 'provenance/no-early-config-read': ['error', { configTypes: [...configTypes] }] },
      },
    ],
    { filename: 'src/templates/fixture.ts' }
  );
}

const ids = (messages: Linter.LintMessage[]): string[] =>
  messages.map((message) => `${message.messageId ?? ''}@${message.line}`);

// ---------------------------------------------------------------------------
// Positives — each must produce exactly the named report
// ---------------------------------------------------------------------------

describe('INV-14 positives', () => {
  it('the hoist shape: four config-derived consts, an emission, later uses', () => {
    const messages = lint(`
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const target = resolve(b.config.deployment.target);
        const admin = getAdmin(b.config);
        const manager = getManager(b.config);
        const crates = getCrates(b.config);
        b.line('#!/bin/bash');
        b.line(\`TARGET="\${target}"\`);
        b.line(\`ADMIN="\${admin}"\`);
        b.line(\`MANAGER="\${manager}"\`);
        b.lines(crates);
        return b.text();
      }
    `);
    expect(ids(messages)).toEqual(['earlyRead@4', 'earlyRead@5', 'earlyRead@6', 'earlyRead@7']);
    expect(messages[0]?.message).toContain('"target"');
    expect(messages[0]?.message).toContain('observe');
  });

  it('a destructured hoist', () => {
    const messages = lint(`
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const { name } = b.config.token;
        b.line('#!/bin/bash');
        b.line(name);
        return b.text();
      }
    `);
    expect(ids(messages)).toEqual(['earlyRead@4']);
  });

  it('a hoist laundered through a helper call', () => {
    const messages = lint(`
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const value = helper(b.config);
        b.line('x');
        b.line(value);
        return b.text();
      }
    `);
    expect(ids(messages)).toEqual(['earlyRead@4']);
  });

  it('a plain alias of a config sub-object', () => {
    const messages = lint(`
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const token = b.config.token;
        b.line('x');
        b.line(token.name);
        return b.text();
      }
    `);
    expect(ids(messages)).toEqual(['earlyRead@4']);
  });

  it('transitive taint through a second binding', () => {
    const messages = lint(`
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const first = b.config.token;
        const second = derive(first);
        b.line('x');
        b.line(second);
        return b.text();
      }
    `);
    // `first` is used only on line 5, before the emission — the crossing is `second`'s.
    expect(ids(messages)).toEqual(['earlyRead@5']);
  });

  it('a tainted binding referenced only in a condition after an emission (Open Q2)', () => {
    const messages = lint(`
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const flag = b.config.token.paused;
        b.line('x');
        if (flag) {
          b.line('paused');
        }
        return b.text();
      }
    `);
    expect(ids(messages)).toEqual(['earlyRead@4']);
  });

  it('an emission inside a branch counts as intervening', () => {
    const messages = lint(`
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const value = b.config.token.name;
        if (other) {
          b.line('x');
        }
        b.line(value);
        return b.text();
      }
    `);
    expect(ids(messages)).toEqual(['earlyRead@4']);
  });

  it('a hoist inside a helper that takes the config type and a sink', () => {
    const messages = lint(`
      function section(cfg: FixtureConfig, sink: LineSink): void {
        const admin = getAdmin(cfg);
        sink.line('header');
        sink.line(admin);
      }
    `);
    expect(ids(messages)).toEqual(['earlyRead@3']);
  });

  it('the same helper with configTypes: [] produces nothing (the option is an input)', () => {
    const code = `
      function section(cfg: FixtureConfig, sink: LineSink): void {
        const admin = getAdmin(cfg);
        sink.line('header');
        sink.line(admin);
      }
    `;
    expect(ids(lint(code, []))).toEqual([]);
    expect(ids(lint(code))).toEqual(['earlyRead@3']);
  });

  it('an observed value used in an emission without its paths', () => {
    const messages = lint(`
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const admin = b.observe((c) => getAdmin(c));
        b.line(\`ADMIN="\${admin.value}"\`);
        return b.text();
      }
    `);
    expect(ids(messages)).toEqual(['observedValueWithoutPaths@5']);
    expect(messages[0]?.message).toContain('admin.value');
    expect(messages[0]?.message).toContain('admin.paths');
  });

  it('a config read above the builder', () => {
    const messages = lint(`
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const target = resolve(scope.config.deployment.target);
        const b = createLineBuilder(scope);
        b.line(target);
        return b.text();
      }
    `);
    expect(ids(messages)).toEqual(['configReadBeforeBuilder@3']);
  });

  /**
   * A helper handed the builder emits through it, so the call is a boundary even
   * though no emit method is named at the call site. This shape was asserted as a
   * NEGATIVE until it was found in the wild: `rwa-token.ts` delegates every edit
   * to `applyRwaTokenPatches(patcher, ...)`, so before this the file presented no
   * boundary at all and nothing hoisted above the delegation could be reported.
   */
  it('a call that hands the builder to a helper is an intervening emission', () => {
    const messages = lint(`
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const name = b.config.token.name;
        const render = (sink: LineSink): void => { sink.line('other'); };
        render(b);
        return b.text() + name;
      }
    `);
    expect(ids(messages)).toEqual(['earlyRead@4']);
  });

  it('a patch template that delegates every edit to a helper', () => {
    const messages = lint(`
      function patch(scope: ProvenanceScope<FixtureConfig>, upstream: string): string {
        const p = createPatchBuilder(scope, upstream);
        const decimals = p.config.token.decimals;
        applyPatches(p, p.config);
        p.replaceExact('c', String(decimals));
        return p.text();
      }
    `);
    expect(ids(messages)).toEqual(['earlyRead@4']);
  });

  it('a patch builder is recognised exactly like a line builder', () => {
    const messages = lint(`
      function patch(scope: ProvenanceScope<FixtureConfig>, upstream: string): string {
        const p = createPatchBuilder(scope, upstream);
        const decimals = p.config.token.decimals;
        p.replaceExact('a', 'b');
        p.replaceExact('c', String(decimals));
        return p.text();
      }
    `);
    expect(ids(messages)).toEqual(['earlyRead@4']);
  });
});

// ---------------------------------------------------------------------------
// Negatives — zero reports
// ---------------------------------------------------------------------------

describe('INV-14 negatives', () => {
  it.each([
    [
      'inline reads used immediately',
      `
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        b.line(\`name=\${b.config.token.name}\`);
        b.line(\`symbol=\${b.config.token.symbol}\`);
        return b.text();
      }
    `,
    ],
    [
      'observe with .value and .paths in the same call',
      `
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const admin = b.observe((c) => getAdmin(c));
        b.line('#!/bin/bash');
        b.line(\`ADMIN="\${admin.value}"\`, admin.paths);
        return b.text();
      }
    `,
    ],
    [
      'a loop-head binding used across emissions',
      `
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        for (const module of b.config.compliance.modules) {
          b.line('---');
          b.line(module.moduleId);
        }
        return b.text();
      }
    `,
    ],
    [
      'a callback parameter used across emissions',
      `
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        b.config.members.forEach((member) => {
          b.line('---');
          b.line(member.address);
        });
        return b.text();
      }
    `,
    ],
    [
      'a tainted binding declared after the last emission',
      `
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        b.line('x');
        const trailing = b.config.token.name;
        return b.text() + trailing;
      }
    `,
    ],
    [
      'a tainted binding used only before the first emission',
      `
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const name = b.config.token.name;
        const upper = name.toUpperCase();
        b.line(upper);
        return b.text();
      }
    `,
    ],
    [
      // The `tokenGuards` shape: one observe per method guard, collected by `map`.
      // The binding holds `Observed` values that carry their own paths, so it is
      // not config-derived even though the callback reads config — and the arrow
      // parameter shares its name with the file-level config parameter.
      'observe calls nested inside an initialiser do not taint the binding',
      `
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const guards = SIGNATURES.map((sig) =>
          b.observe((config) => buildGuard(config, sig))
        );
        emitAll(b, guards);
        b.line('trailer', guards.flatMap((guard) => guard.paths));
        return b.text();
      }
      export function render(config: FixtureConfig): string {
        return build(createScope(config));
      }
    `,
    ],
    [
      'a call that passes no builder is not an emission',
      `
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const name = b.config.token.name;
        const decorated = decorate(name);
        b.line(decorated);
        return b.text();
      }
    `,
    ],
    [
      'a file with no builder and no config parameter — the rule is inert',
      `
      export function buildSection(config: SomethingElse): string[] {
        const admin = getAdmin(config);
        const lines: string[] = [];
        lines.push('header');
        lines.push(admin);
        return lines;
      }
    `,
    ],
  ])('%s', (_name, code) => {
    expect(ids(lint(code))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// INV-15 / INV-27 / INV-28 — one implementation, no values in reports
// ---------------------------------------------------------------------------

describe('INV-15 — one rule, wired into pnpm lint', () => {
  // Spawning a real ESLint over the repo config is the only thing that shows the
  // guard actually fires, so the cost stays. The bound is deliberately loose:
  // ~1.0s alone, ~2.4s under a full root `pnpm test`, and up to 9s reported on a
  // contended box. Contention only ever adds time, so this is set against the
  // worst case rather than the measured one — an over-generous bound costs a few
  // idle seconds only when the test genuinely hangs, while a snug one costs a red
  // build on a busy machine (this is the second fixed-threshold flake on this
  // initiative). It does not weaken the assertion: the rule's cost is bounded by
  // INV-25's tests, not by this timeout.
  it(
    'the real repo lint config rejects a hoist and the formatted failure names the template',
    { timeout: 60_000 },
    async () => {
      const eslint = new ESLint({ cwd: REPO_ROOT });
      const templatePath = join(
        REPO_ROOT,
        'packages',
        'codegen-rwa-stellar',
        'src',
        'templates',
        'provenance-guard-tripwire.ts'
      );
      const results = await eslint.lintText(
        `
        function build(scope: ProvenanceScope<RWAConfig>): string {
          const b = createLineBuilder(scope);
          const symbol = b.config.token.symbol;
          b.line('# generated');
          b.line(symbol);
          return b.text();
        }
      `,
        { filePath: templatePath }
      );

      expect(results).toHaveLength(1);
      const guardMessages =
        results[0]?.messages.filter(
          (message) => message.ruleId === 'provenance/no-early-config-read'
        ) ?? [];
      expect(guardMessages.map((message) => message.messageId)).toEqual(['earlyRead']);
      const formatted = await (await eslint.loadFormatter('stylish')).format(results);
      expect(formatted).toContain('provenance-guard-tripwire.ts');
      expect(formatted).toContain('provenance/no-early-config-read');
      expect(formatted).toContain('"symbol"');
    }
  );

  it('eslint.config.cjs registers the same plugin object for every codegen package src', () => {
    const config = require(join(REPO_ROOT, 'eslint.config.cjs')) as FlatConfigBlock[];
    const block = config.find(
      (entry) =>
        entry.rules !== undefined &&
        Object.prototype.hasOwnProperty.call(entry.rules, 'provenance/no-early-config-read')
    );
    expect(block).toBeDefined();
    expect(block?.files).toEqual(['packages/codegen-*/src/**/*.ts']);
    expect(block?.rules?.['provenance/no-early-config-read']).toEqual([
      'error',
      { configTypes: ['RWAConfig'] },
    ]);
    // the very object this suite lints with — one implementation, not two
    expect(block?.plugins?.['provenance']).toBe(plugin);
  });

  it('an unknown option fails config validation rather than being ignored', () => {
    expect(() =>
      linter.verify(
        'const x = 1;',
        [
          {
            files: ['**/*.ts'],
            plugins: { provenance: plugin as never },
            rules: { 'provenance/no-early-config-read': ['error', { unknownOption: true }] },
          },
        ],
        { filename: 'src/templates/fixture.ts' }
      )
    ).toThrow();
  });

  it('reports name identifiers and lines, never config values', () => {
    const messages = lint(`
      function build(scope: ProvenanceScope<FixtureConfig>): string {
        const b = createLineBuilder(scope);
        const admin = pick(b.config, 'SECRET-LITERAL');
        b.line('x');
        b.line(admin);
        return b.text();
      }
    `);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).not.toContain('SECRET-LITERAL');
  });

  it('the rule file names no chain, package or config type', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const source = readFileSync(
      join(REPO_ROOT, '.eslint', 'rules', 'no-early-config-read.cjs'),
      'utf8'
    );
    for (const word of ['stellar', 'soroban', 'evm', 'RWAConfig', 'wizard']) {
      expect(source.includes(word), `rule contains "${word}"`).toBe(false);
    }
    expect(source).not.toMatch(/\bconsole\./);
  });
});
