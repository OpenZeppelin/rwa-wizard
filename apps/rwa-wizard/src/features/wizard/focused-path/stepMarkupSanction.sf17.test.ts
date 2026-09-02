/**
 * SF-17 INV-24 / INV-25 — second markup supersession handshake.
 *
 * Complements `stepMarkupSanction.sf14.test.ts` (which pins TrustedIssuers stays
 * SF-14) with the SF-17-owned half: TogglePill + TopicToggleGroup declarations,
 * decidedOn, two-key agreement, and PERMITTED_NEW_PROPS freeze.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  PERMITTED_NEW_PROPS,
  type StepMarkupBaseline,
  type SupersededMarkupRecord,
} from './stepMarkupFingerprint';
import { checkTwoKeyAgreement } from './stepMarkupGuard';
import {
  MARKUP_SUPERSESSIONS,
  PERMITTED_PROP_DECISIONS,
  type MarkupSupersession,
} from './stepMarkupSanction';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

const baseline = JSON.parse(
  readFileSync(join(MODULE_DIR, '__fixtures__/stepMarkup.baseline.json'), 'utf8')
) as StepMarkupBaseline;

const superseded = JSON.parse(
  readFileSync(join(MODULE_DIR, '__fixtures__/stepMarkup.superseded.json'), 'utf8')
) as SupersededMarkupRecord;

const SF17_FILES = [
  'src/components/shared/TogglePill.tsx',
  'src/components/shared/TopicToggleGroup.tsx',
] as const;

describe('SF-17 INV-24 — second supersession of TogglePill + TopicToggleGroup', () => {
  it('declares both files as replaces-baseline authorised by SF-17', () => {
    for (const file of SF17_FILES) {
      const entry = MARKUP_SUPERSESSIONS.find((candidate) => candidate.file === file);
      expect(entry, `${file} missing from MARKUP_SUPERSESSIONS`).toBeDefined();
      expect(entry!.kind).toBe('replaces-baseline');
      expect(entry!.authorisedBy).toBe('SF-17');
      expect(entry!.decidedOn).toBe('2026-09-02');
      expect(entry!.anchorDelta).toBe(0);
      expect(entry!.introducesFirstAnchor).toBe(false);
      expect(entry!.reason.length).toBeGreaterThanOrEqual(40);
      expect(entry!.reason.toLowerCase()).toMatch(/affordance|selection|inspect/);
    }
  });

  it('decidedOn is strictly later than the prior SF-14 day (STALE_ADOPTION)', () => {
    for (const file of SF17_FILES) {
      const entry = MARKUP_SUPERSESSIONS.find((candidate) => candidate.file === file)!;
      expect(entry.decidedOn > '2026-08-31').toBe(true);
    }
  });

  it('two-key agreement holds for the live declaration and superseded record', () => {
    const mismatches = checkTwoKeyAgreement(MARKUP_SUPERSESSIONS, superseded);
    expect(mismatches).toEqual([]);
  });

  it('ClaimTopicsSection is not in the supersession set (NO_DIVERGENCE expectation)', () => {
    expect(
      MARKUP_SUPERSESSIONS.some(
        (entry) => entry.file === 'src/features/wizard/steps/identity/ClaimTopicsSection.tsx'
      )
    ).toBe(false);
    expect(
      baseline.files['src/features/wizard/steps/identity/ClaimTopicsSection.tsx']
    ).toBeDefined();
  });

  it('PERMITTED_NEW_PROPS / PERMITTED_PROP_DECISIONS are not widened for SF-17', () => {
    expect([...PERMITTED_NEW_PROPS]).toEqual(['data-config-anchor', 'configAnchor']);
    expect(PERMITTED_NEW_PROPS).not.toContain('onToggleSelection');
    expect(PERMITTED_NEW_PROPS).not.toContain('aria-pressed');
    expect(PERMITTED_PROP_DECISIONS.every((d) => d.authorisedBy !== 'SF-17')).toBe(true);
  });

  it('reason names the three-affordance split and inspected-conjunction removal', () => {
    const pill = MARKUP_SUPERSESSIONS.find(
      (entry) => entry.file === 'src/components/shared/TogglePill.tsx'
    )!;
    expect(pill.reason).toMatch(/three affordances|selection control/i);
    expect(pill.reason).toMatch(/selected|inspect/i);
  });
});

describe('SF-17 INV-25 — TrustedIssuersSection SF-14 supersession stays put', () => {
  it('authorisedBy remains SF-14 and is not overwritten to SF-17', () => {
    const entry = MARKUP_SUPERSESSIONS.find(
      (candidate) =>
        candidate.file === 'src/features/wizard/steps/identity/TrustedIssuersSection.tsx'
    );
    expect(entry).toBeDefined();
    expect(entry!.authorisedBy).toBe('SF-14');
    expect(entry!.decidedOn).toBe('2026-09-02');
  });

  it('SF-14 owns five entries (TrustedIssuers plus four post-core); SF-17 owns the other two', () => {
    const byAuthor = MARKUP_SUPERSESSIONS.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.authorisedBy] = (acc[entry.authorisedBy] ?? 0) + 1;
      return acc;
    }, {});
    expect(byAuthor['SF-14']).toBe(5);
    expect(byAuthor['SF-17']).toBe(2);
  });
});

/** Compile-time shape pin — declaration rows stay MarkupSupersession. */
const _typePin: readonly MarkupSupersession[] = MARKUP_SUPERSESSIONS;
void _typePin;
