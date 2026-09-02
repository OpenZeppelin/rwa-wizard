#!/usr/bin/env vite-node
/**
 * Adopt a sanctioned re-baseline for the guarded step markup (SF-15).
 *
 * A re-baseline is two documents that must agree. This script writes the second
 * one — and only ever that one. `stepMarkup.baseline.json` is opened read-only,
 * for the divergence check, and there is no flag, no option and no code path
 * from here to writing it. That is the structural answer to "not a flag that
 * makes the refusal disappear": the generator keeps refusing, keeps its test,
 * and gains nothing.
 *
 * Every decision this script makes is `validateSanction`'s. It does I/O and
 * printing and decides nothing, so all eleven refusals are unit-testable without
 * spawning a process.
 *
 * Run with `pnpm --filter @openzeppelin/rwa-wizard-app supersede:step-markup`.
 */
import { createHash } from 'node:crypto';
import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fingerprintSource } from '../src/features/wizard/focused-path/stepMarkupFingerprint.ts';
import {
  parseSupersededRecord,
  summariseAdoption,
  validateSanction,
} from '../src/features/wizard/focused-path/stepMarkupGuard.ts';

const DEFAULT_APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The tree this run operates on, and the script's **only** argument.
 *
 * It exists for one reason: with the shipped declaration empty the command
 * always refuses, and a refusing run never reaches the write path — so a write
 * path nobody has ever executed would be a write path nobody has checked. N7
 * points this at a temporary tree and watches a *successful* run.
 *
 * It moves the **root**, never a file name. Every path below is derived from it
 * with a constant basename, so no value of it aims the writer at a baseline,
 * and the baseline is opened read-only under whichever root is in force. N7
 * re-hashes that baseline afterwards. A test asserts this is the only flag the
 * script recognises, so a second one cannot arrive quietly.
 *
 * An argument rather than an environment variable on purpose: `vite.config.ts`
 * defines `'process.env': {}` as a browser polyfill for the wallet SDKs, and
 * vite-node applies the same define — so `process.env.ANYTHING` in a script run
 * this way is rewritten to `undefined` at transform time and every read fails
 * *silently*, falling back to its default. `process.argv` is untouched by it.
 */
function rootFromArgv() {
  const at = process.argv.indexOf('--root');
  if (at === -1) return DEFAULT_APP_ROOT;
  return process.argv[at + 1] ?? DEFAULT_APP_ROOT;
}

const APP_ROOT = rootFromArgv();

const GUARD_DIR = join(APP_ROOT, 'src/features/wizard/focused-path');
const SEALED_BASELINE = join(GUARD_DIR, '__fixtures__/stepMarkup.baseline.json');
const RECORD_PATH = join(GUARD_DIR, '__fixtures__/stepMarkup.superseded.json');
const DECLARATIONS_MODULE = join(GUARD_DIR, 'stepMarkupSanction.ts');

/**
 * The guarded set has one definition at run time: the globs recorded inside the
 * sealed baseline. A copy of the generator's list here would agree by
 * coincidence, and the day somebody narrowed the copy while debugging a path
 * issue the refusal would start firing on a legitimate declaration.
 */
function guardedFiles(baseline) {
  const seen = new Set();
  for (const pattern of baseline.globs) {
    for (const match of globSync(pattern, { cwd: APP_ROOT })) {
      seen.add(match.split('\\').join('/'));
    }
  }
  return [...seen].sort();
}

function printRefusals(refusals) {
  for (const refusal of refusals) {
    // A stable machine line, then human detail. Tests parse the code with an
    // anchored pattern and compare the parsed set — never a substring.
    console.error(`REFUSED ${refusal.code}`);
    console.error(`  ${refusal.detail}`);
  }
}

async function main() {
  const baseline = JSON.parse(readFileSync(SEALED_BASELINE, 'utf8'));
  const files = guardedFiles(baseline);

  const parsed = parseSupersededRecord(readFileSync(RECORD_PATH, 'utf8'));
  if ('refusals' in parsed) {
    printRefusals(parsed.refusals);
    process.exit(1);
  }

  const { MARKUP_SUPERSESSIONS: declarations } = await import(
    pathToFileURL(DECLARATIONS_MODULE).href
  );

  const current = {};
  for (const declaration of declarations) {
    if (!files.includes(declaration.file)) continue;
    const sourceText = readFileSync(join(APP_ROOT, declaration.file), 'utf8');
    current[declaration.file] = fingerprintSource(declaration.file, sourceText);
  }

  // Validate fully, then write. A refusing run leaves the record byte-identical:
  // a partial adoption nobody approved would be compared against by the next
  // run's divergence and staleness checks as though it had been reviewed.
  const refusals = validateSanction({
    declarations,
    guardedFiles: files,
    baseline,
    record: parsed.record,
    current,
  });

  if (refusals.length > 0) {
    printRefusals(refusals);
    process.exit(1);
  }

  const entries = declarations
    .map((declaration) => {
      const fingerprint = current[declaration.file];
      // INV-27: the stored summary recomputes from the *sealed baseline* and the
      // recorded fingerprint — not from a prior supersession. A second adoption
      // (SF-17) must still leave a summary a structure test can recompute
      // against the seal alone.
      const baselineFingerprint = baseline.files[declaration.file] ?? [];

      // Built field by field rather than spread, so the key order in the JSON is
      // the same for every entry however the declaration literal was written —
      // a re-run with nothing changed must produce identical bytes. Each field
      // still has exactly one origin: the declaration.
      return {
        file: declaration.file,
        kind: declaration.kind,
        authorisedBy: declaration.authorisedBy,
        decidedOn: declaration.decidedOn,
        reason: declaration.reason,
        components: declaration.components,
        anchorDelta: declaration.anchorDelta,
        introducesFirstAnchor: declaration.introducesFirstAnchor,
        adopted: summariseAdoption(baselineFingerprint, fingerprint),
        fingerprint,
      };
    })
    .sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0));

  writeFileSync(RECORD_PATH, `${JSON.stringify({ entries }, null, 2)}\n`, 'utf8');

  for (const entry of entries) {
    const priorFingerprint =
      parsed.record.entries.find((candidate) => candidate.file === entry.file)?.fingerprint ??
      baseline.files[entry.file] ??
      [];
    const incremental = summariseAdoption(priorFingerprint, entry.fingerprint);
    const { elementsBefore, elementsAfter, tagsAdded, tagsRemoved, valuesChanged } = incremental;
    console.log(
      `[supersede:step-markup] ${entry.file}: ${elementsBefore} -> ${elementsAfter} elements, ` +
        `+[${tagsAdded.join(' ')}] -[${tagsRemoved.join(' ')}], ${valuesChanged} value(s) changed`
    );
  }

  const digest = createHash('sha256').update(readFileSync(SEALED_BASELINE)).digest('hex');
  console.log(`[supersede:step-markup] wrote ${entries.length} entr(ies); baseline ${digest}`);
}

await main();
