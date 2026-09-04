#!/usr/bin/env vite-node
/**
 * Regenerate the AS-5 step-markup baseline (INV-6 clause 3).
 *
 * The baseline is the evidence behind the dev's own guarantee that the guarded
 * files differ from HEAD by added identifying attributes and nothing else. That
 * makes casual regeneration the whole risk: add the anchors first, watch the
 * test go red, run this script, and the guard is now a copy of the thing it is
 * supposed to be checking.
 *
 * So this script **refuses to write** when any guarded file already carries a
 * permitted-new prop, and exits non-zero naming the file and element. The
 * baseline must be generated — and reviewed, and committed — before the first
 * anchor lands. Clause 1 of INV-6 keeps the second half honest without git: the
 * baseline records anchors rather than filtering them, so one that was written
 * late says so out loud.
 *
 * Run with `pnpm --filter rwa-wizard baseline:step-markup`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

import {
  fingerprintSource,
  findAnchorProps,
} from '../src/features/wizard/focused-path/stepMarkupFingerprint.ts';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The guarded set, as globs. Wider than "the step files" on purpose: the three
 *  shared components render step controls and gain props here, so holding them
 *  to the same rule closes the obvious way to evade it. */
const GUARDED_GLOBS = [
  'src/features/wizard/steps/**/*.tsx',
  'src/components/shared/SelectableCard.tsx',
  'src/components/shared/TogglePill.tsx',
  'src/components/shared/TopicToggleGroup.tsx',
];

const BASELINE_PATH = join(
  APP_ROOT,
  'src/features/wizard/focused-path/__fixtures__/stepMarkup.baseline.json'
);

function guardedFiles() {
  const seen = new Set();
  for (const pattern of GUARDED_GLOBS) {
    for (const match of globSync(pattern, { cwd: APP_ROOT })) {
      seen.add(match.split('\\').join('/'));
    }
  }
  return [...seen].sort();
}

function main() {
  const files = guardedFiles();
  if (files.length === 0) {
    console.error('[baseline:step-markup] no guarded files matched; refusing to write an empty baseline');
    process.exit(1);
  }

  const fingerprints = {};
  for (const file of files) {
    const sourceText = readFileSync(join(APP_ROOT, file), 'utf8');
    fingerprints[file] = fingerprintSource(file, sourceText);
  }

  const baseline = { globs: GUARDED_GLOBS, fileCount: files.length, files: fingerprints };

  const anchors = findAnchorProps(baseline);
  if (anchors.length > 0) {
    console.error(
      `[baseline:step-markup] REFUSING TO WRITE: ${anchors.length} anchor prop(s) already in the guarded set.\n` +
        'The baseline must be generated before any anchor lands, or it proves nothing (INV-6).\n' +
        anchors.map((a) => `  ${a.file}: <${a.tag} ${a.prop}>`).join('\n')
    );
    process.exit(1);
  }

  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
  console.log(
    `[baseline:step-markup] wrote ${files.length} file fingerprints to ${relative(APP_ROOT, BASELINE_PATH)}`
  );
}

main();
