import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `code-preview.css` scopes a hand-copied `highlight.js/styles/atom-one-dark.css`
 * under `.rwa-code-preview-code` (CSS cannot scope an `@import`). This test diffs
 * the copy against the real stylesheet the kit depends on, so the two cannot drift.
 */

const SCOPE = '.rwa-code-preview-code';

type RuleMap = ReadonlyMap<string, string>;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalizeSelectors(selectors: string): string {
  return selectors
    .split(',')
    .map((selector) => selector.trim().replace(/\s+/g, ' '))
    .join(',');
}

function normalizeDeclarations(body: string): string {
  return body
    .split(';')
    .map((declaration) =>
      declaration
        .trim()
        .replace(/\s*:\s*/, ':')
        .replace(/\s+/g, ' ')
    )
    .filter(Boolean)
    .sort()
    .join(';');
}

/** Flat `selector-list → declarations` map. Enough for these two flat stylesheets. */
function parseRules(css: string): RuleMap {
  const rules = new Map<string, string>();
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of stripComments(css).matchAll(pattern)) {
    const selectors = normalizeSelectors(match[1] ?? '');
    const declarations = normalizeDeclarations(match[2] ?? '');
    rules.set(selectors, declarations);
  }
  return rules;
}

function scopeSelectors(selectors: string): string {
  return selectors
    .split(',')
    .map((selector) => `${SCOPE} ${selector}`)
    .join(',');
}

function resolveKitAtomOneDark(): string {
  // highlight.js is a dependency of the kit, not of the app, so resolve it from
  // the kit's own location (pnpm keeps it a sibling of the kit's real path).
  const appRequire = createRequire(import.meta.url);
  const kitEntry = appRequire.resolve('@openzeppelin/ui-components');
  return createRequire(kitEntry).resolve('highlight.js/styles/atom-one-dark.css');
}

const here = path.dirname(fileURLToPath(import.meta.url));
const wizardTheme = parseRules(readFileSync(path.join(here, 'code-preview.css'), 'utf8'));
const atomOneDark = parseRules(readFileSync(resolveKitAtomOneDark(), 'utf8'));

describe('code-preview.css Atom One Dark copy', () => {
  const colourRules = [...atomOneDark.entries()].filter(([selectors]) =>
    selectors.startsWith('.hljs')
  );

  it('covers every colour rule of the real stylesheet', () => {
    expect(colourRules.length).toBeGreaterThan(10);
  });

  it.each(colourRules)('matches `%s` verbatim under the preview scope', (selectors, decls) => {
    expect(wizardTheme.get(scopeSelectors(selectors))).toBe(decls);
  });

  it('does not carry any unscoped hljs rule', () => {
    for (const selectors of wizardTheme.keys()) {
      for (const selector of selectors.split(',')) {
        if (selector.includes('.hljs')) {
          expect(selector.startsWith(`${SCOPE} `)).toBe(true);
        }
      }
    }
  });
});
