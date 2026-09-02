import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { StepMarkupBaseline } from './stepMarkupFingerprint';
import { countAnchorProps, fingerprintSource, PERMITTED_NEW_PROPS } from './stepMarkupFingerprint';
import { MARKUP_SUPERSESSIONS } from './stepMarkupSanction';

/**
 * SF-14 INV-38 — the re-baseline handshake, asserted from **SF-14's side**,
 * after SF-17 replaced the TogglePill + TopicToggleGroup entries.
 *
 * SF-17 INV-25: TrustedIssuersSection's SF-14 supersession stays put. TogglePill
 * and TopicToggleGroup are authorised by SF-17; SelectableCard, OperatorRolesSection
 * and DocumentManagerSection extend SF-14's inspected-anchor markup supersessions.
 */

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(MODULE_DIR, '../../../..');

const baseline = JSON.parse(
  readFileSync(join(MODULE_DIR, '__fixtures__/stepMarkup.baseline.json'), 'utf8')
) as StepMarkupBaseline;

const SF14_RETAINED = 'src/features/wizard/steps/identity/TrustedIssuersSection.tsx' as const;

const SF17_FILES = [
  'src/components/shared/TogglePill.tsx',
  'src/components/shared/TopicToggleGroup.tsx',
] as const;

const SF14_POST_CORE = [
  'src/components/shared/SelectableCard.tsx',
  'src/features/wizard/steps/access-control/OperatorRolesSection.tsx',
  'src/features/wizard/steps/compliance/ModuleConfigPanel.tsx',
  'src/features/wizard/steps/asset/DocumentManagerSection.tsx',
] as const;

const ALL_DECLARED = [...SF17_FILES, SF14_RETAINED, ...SF14_POST_CORE] as const;

const ZERO_DELTA_FILES = [
  ...SF17_FILES,
  SF14_RETAINED,
  'src/components/shared/SelectableCard.tsx',
  'src/features/wizard/steps/access-control/OperatorRolesSection.tsx',
  'src/features/wizard/steps/compliance/ModuleConfigPanel.tsx',
] as const;

const EXPECTED_ANCHOR_COUNTS: Readonly<Record<(typeof ZERO_DELTA_FILES)[number], number>> = {
  'src/components/shared/TogglePill.tsx': 1,
  'src/components/shared/TopicToggleGroup.tsx': 3,
  [SF14_RETAINED]: 3,
  'src/components/shared/SelectableCard.tsx': 1,
  'src/features/wizard/steps/access-control/OperatorRolesSection.tsx': 1,
  // The panel's `data-config-anchor` plus SF-12's one permitted `id` on AddressListField.
  'src/features/wizard/steps/compliance/ModuleConfigPanel.tsx': 2,
};

describe('SF-14’s markup supersessions (INV-38), after SF-17', () => {
  it('declares exactly the seven superseded files, and no others', () => {
    const declared = MARKUP_SUPERSESSIONS.map((entry) => entry.file).sort();
    expect(declared).toEqual([...ALL_DECLARED].sort());
  });

  it('TrustedIssuersSection remains replaces-baseline, authorised by SF-14 (INV-25)', () => {
    const entry = MARKUP_SUPERSESSIONS.find((candidate) => candidate.file === SF14_RETAINED);
    expect(entry, `${SF14_RETAINED} is not declared`).toBeDefined();
    expect(entry!.kind).toBe('replaces-baseline');
    expect(entry!.authorisedBy).toBe('SF-14');
    expect(entry!.decidedOn).toBe('2026-09-02');
  });

  it('TogglePill and TopicToggleGroup are no longer authorised by SF-14', () => {
    for (const file of SF17_FILES) {
      const entry = MARKUP_SUPERSESSIONS.find((candidate) => candidate.file === file);
      expect(entry, `${file} is not declared`).toBeDefined();
      expect(entry!.authorisedBy).toBe('SF-17');
      expect(entry!.decidedOn).toBe('2026-09-02');
    }
  });

  it('SelectableCard, OperatorRolesSection, ModuleConfigPanel and DocumentManagerSection are authorised by SF-14', () => {
    for (const file of SF14_POST_CORE) {
      const entry = MARKUP_SUPERSESSIONS.find((candidate) => candidate.file === file);
      expect(entry, `${file} is not declared`).toBeDefined();
      expect(entry!.authorisedBy).toBe('SF-14');
    }
  });

  it('leaves `first-record` unexercised, and every superseded file is in the baseline', () => {
    expect(MARKUP_SUPERSESSIONS.filter((entry) => entry.kind === 'first-record')).toEqual([]);
    for (const file of ALL_DECLARED) {
      expect(baseline.files[file], `${file} is missing from the baseline`).toBeDefined();
    }
  });

  it.each(ZERO_DELTA_FILES)('%s declares anchorDelta 0 and introducesFirstAnchor false', (file) => {
    const entry = MARKUP_SUPERSESSIONS.find((candidate) => candidate.file === file)!;
    expect(entry.anchorDelta).toBe(0);
    expect(entry.introducesFirstAnchor).toBe(false);
  });

  it('DocumentManagerSection declares the first anchor on the asset step', () => {
    const entry = MARKUP_SUPERSESSIONS.find(
      (candidate) => candidate.file === 'src/features/wizard/steps/asset/DocumentManagerSection.tsx'
    )!;
    expect(entry.anchorDelta).toBe(1);
    expect(entry.introducesFirstAnchor).toBe(true);
  });

  it.each(ZERO_DELTA_FILES)('%s still measures the SF-14 anchor count (delta 0 held)', (file) => {
    const sourceText = readFileSync(join(APP_ROOT, file), 'utf8');
    const current = countAnchorProps(fingerprintSource(file, sourceText));
    const before = countAnchorProps(baseline.files[file]!);
    expect(current - before).toBe(0);
    expect(current).toBe(EXPECTED_ANCHOR_COUNTS[file]);
  });

  it('adds nothing to PERMITTED_NEW_PROPS', () => {
    // aria-current / onToggleSelection live inside re-frozen files; widening
    // the permitted list would widen it globally for all 25 guarded files.
    expect(PERMITTED_NEW_PROPS).not.toContain('aria-current');
    expect(PERMITTED_NEW_PROPS).not.toContain('onToggleSelection');
    expect(PERMITTED_NEW_PROPS).not.toContain('aria-pressed');
  });
});
