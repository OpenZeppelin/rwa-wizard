/**
 * The display grammar — test-owned, and deliberately so (INV-27).
 *
 * The generator never inspects the text it emits: significance is DECLARED at
 * the emission by the template author. This classifier is the independent
 * second opinion, and that independence is the whole reason the AS-4 assertion
 * is an oracle rather than a restatement of the declaration — the same reason
 * SF-3's determination oracle is one. The moment a `src/` file classifies its
 * own output, the oracle compares the grammar against itself and can no longer
 * fail.
 *
 * It is shell-specific and must never be applied outside `.sh`: run over
 * `contract.rs` it reads `#[only_admin]` as a comment, and over `README.md` the
 * title line that literally carries the token name. The boundedness assertion
 * outside `.sh` therefore uses no grammar at all.
 */

/** A line holding nothing. */
const BLANK = /^\s*$/;

/** A line whose command is `echo`. `echoes "x"` is not one. */
const ECHO = /^\s*echo(\s|$)/;

/**
 * A line that can only print.
 *
 * **There is no comment clause, and there must not be one.** Measured across
 * every golden fixture, `#!/bin/bash` is the only comment line inside any
 * recorded `.sh` range — and it is attributed to the deployment target and the
 * initial supply, because it is the file's first emission and absorbs the
 * pending window. A comment clause would therefore buy zero true positives at
 * the cost of one false demotion of a determining range.
 */
export const isDisplayLine = (line: string): boolean => BLANK.test(line) || ECHO.test(line);

/**
 * Conjunctive, not "contains an echo": one determining line makes the whole
 * range determining. A range holding a `stellar contract deploy`, an
 * assignment, a `cat >` or an `exit` is determining no matter how many echoes
 * surround it. An empty slice is not display-only.
 */
export const isDisplayOnlyRange = (lines: readonly string[]): boolean =>
  lines.length > 0 && lines.every(isDisplayLine);
