/**
 * INV-30 — the display grammar itself, pinned.
 *
 * The oracle is only as good as its second opinion. If the grammar silently
 * regains a clause the biconditional keeps passing while meaning something
 * else, so the classifier gets its own table — and the negative cells carry the
 * reason the clause was left out, so a later contributor "completing" the
 * grammar breaks a test that argues back.
 */
import { describe, expect, it } from 'vitest';

import { isDisplayLine, isDisplayOnlyRange } from './display-grammar';

describe('INV-30 — `isDisplayLine` accepts exactly BLANK | ECHO', () => {
  const DISPLAY: readonly [string, string][] = [
    ['', 'the empty line'],
    ['   ', 'whitespace only'],
    ['\t', 'a tab only'],
    ['echo "x"', 'the ordinary echo'],
    ['  echo "x"', 'an indented echo'],
    ['echo', 'a bare echo with no argument'],
    ['  echo', 'an indented bare echo'],
    ["echo 'raw'", 'a single-quoted echo'],
    ['echo ""', 'the spacer echo the section formatters emit'],
  ];

  it.each(DISPLAY)('%j is display — %s', (line) => {
    expect(isDisplayLine(line)).toBe(true);
  });

  const NOT_DISPLAY: readonly [string, string][] = [
    [
      '#!/bin/bash',
      'THE comment clause case. Measured across every golden fixture this is the ' +
        'only comment line inside any recorded `.sh` range, and it is attributed to ' +
        'the deployment target and the initial supply because it absorbs the pending ' +
        'window. A comment clause buys zero true positives and costs exactly one ' +
        'false demotion of a determining range.',
    ],
    ['# heading', 'a Markdown heading — the README title carries the token name'],
    ['    #[only_admin]', 'a Rust attribute — 8 contract.rs ranges open with one'],
    ['echoes "x"', 'a command that merely starts with the letters e-c-h-o'],
    ['echo_all "x"', 'the same, with an underscore'],
    ['stellar contract deploy \\', 'the determining line this whole feature protects'],
    ['ADMIN="GCEXAMPLEOWNER"', 'an assignment'],
    ['exit 1', 'control flow'],
    ['cat > deployment.json <<EOF', 'a heredoc opener'],
    ['  ECHO "x"', 'the shell is case-sensitive'],
  ];

  it.each(NOT_DISPLAY)('%j is NOT display — %s', (line) => {
    expect(isDisplayLine(line)).toBe(false);
  });

  it('there is no comment clause in the source, and its absence is documented', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'display-grammar.ts'),
      'utf8'
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // Exactly two regexes reach the predicate.
    expect([...code.matchAll(/=\s*\/\^/g)]).toHaveLength(2);
    expect(code).not.toMatch(/COMMENT/);
    expect(code).not.toMatch(/#/);
    // And the prose says why, so the test above is not the only warning.
    expect(source).toMatch(/no comment clause/i);
  });
});

describe('INV-30 — `isDisplayOnlyRange` is conjunctive', () => {
  it('one determining line makes the whole range determining', () => {
    expect(isDisplayOnlyRange(['echo "a"', 'stellar contract deploy'])).toBe(false);
    expect(isDisplayOnlyRange(['stellar contract deploy', 'echo "a"'])).toBe(false);
    expect(isDisplayOnlyRange(['echo "a"', 'echo "b"', 'ADMIN="x"', 'echo "c"'])).toBe(false);
  });

  it('an empty slice is not display-only', () => {
    // A range that covers nothing has nothing to display; treating it as display
    // would make the forward direction demand a mark on an empty range.
    expect(isDisplayOnlyRange([])).toBe(false);
  });

  it('echoes and blanks together are display-only', () => {
    expect(isDisplayOnlyRange(['echo "a"', ''])).toBe(true);
    expect(isDisplayOnlyRange(['', 'echo ""', 'echo "  Heading"', 'echo ""'])).toBe(true);
    expect(isDisplayOnlyRange(['echo "a"'])).toBe(true);
  });

  it('the two known grammar limitations fail LOUDLY, in opposite directions', () => {
    // A heredoc body line beginning with `echo` would read as display; measured,
    // no recorded range is all-heredoc, so this shape does not occur. An echo
    // carrying a redirection or a command substitution would read as display
    // too. Both are recorded here as *known* rather than guarded against,
    // because adding a clause to pre-empt them re-opens the D7 mistake in a new
    // place — and the biconditional cannot fail open: a false positive breaks
    // the forward direction, a false negative the reverse.
    expect(isDisplayOnlyRange(['echo "not really a command"'])).toBe(true);
    expect(isDisplayOnlyRange(['echo "$(stellar contract deploy)"'])).toBe(true);
    expect(isDisplayOnlyRange(['echo x > file'])).toBe(true);
  });
});
