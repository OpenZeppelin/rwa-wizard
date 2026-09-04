/**
 * `scripts/deploy.sh` — the file the design calls a judgment checkpoint.
 *
 * It hoisted seven config bindings before its first emission, so every one of
 * them would have drained onto the shebang. Acceptance here is the complete set
 * of DISJOINT content-bearing sites, not one broad range (INV-35), and strict
 * sibling isolation between compliance modules (INV-34).
 */
import { describe, expect, it } from 'vitest';

import { createValidConfig } from '../helpers/config';

import {
  GENERATE_PATHS,
  entriesOf,
  generateRecorded,
  rangeEntries,
  rangesForPath,
  sliceRange,
  textOf,
} from './helpers';

const DEPLOY = 'scripts/deploy.sh';

const twoModules = createValidConfig({
  token: { name: 'Acme Real Estate Token', symbol: 'ACME', initialSupply: '5000' },
  compliance: {
    modules: [
      { moduleId: 'country-allow', config: { allowedCountries: ['CH'] } },
      { moduleId: 'max-balance', config: { maxBalance: 50_000 } },
    ],
  },
});

describe.each(GENERATE_PATHS)('$name — deploy.sh attribution', (path) => {
  // INV-35: the hoisted reads must not have landed on the script preamble.
  it('never attributes the shebang, `set -e`, or a blank line', () => {
    const { files, provenance } = generateRecorded(path, twoModules);
    const lines = textOf(files, DEPLOY).split('\n');

    const offenders = rangeEntries(provenance, DEPLOY).filter((entry) => {
      const first = lines[entry.range.start - 1] ?? '';
      const last = lines[entry.range.end - 1] ?? '';
      return (
        first === '#!/bin/bash' ||
        first === 'set -e' ||
        first.trim() === '' ||
        last.trim() === ''
      );
    });

    expect(offenders).toEqual([]);
  });

  // INV-33: the admin address lands on the ADMIN assignment, not somewhere near it.
  it('points the ownership address at the ADMIN assignment', () => {
    const { files, provenance } = generateRecorded(path, twoModules);
    const script = textOf(files, DEPLOY);

    const attributed = rangesForPath(
      provenance,
      DEPLOY,
      'accessControl.ownership.ownerAddress'
    ).flatMap((range) => sliceRange(script, range));

    expect(attributed.some((line) => line.startsWith('ADMIN="'))).toBe(true);
    // INV-34: it must not have swallowed the MANAGER line, which roles shape.
    expect(attributed.some((line) => line.startsWith('MANAGER="'))).toBe(false);
  });

  // INV-33 + INV-35: token name and symbol get their own content-bearing sites.
  it('gives the token name a site that contains it', () => {
    const { files, provenance } = generateRecorded(path, twoModules);
    const script = textOf(files, DEPLOY);

    const ranges = rangesForPath(provenance, DEPLOY, 'token.name');
    expect(ranges.length).toBeGreaterThan(0);

    const attributed = ranges.flatMap((range) => sliceRange(script, range));
    expect(attributed.some((line) => line.includes('Acme Real Estate Token'))).toBe(true);
  });

  /**
   * INV-34, the assertion that actually catches a widened range: a compliance
   * module's ranges must never contain a SIBLING module's configured value.
   * This is what failed before the deployment and post-deploy helpers were split
   * per site — one 140-line range carried modules, claim topics and issuers
   * together.
   */
  it('keeps each compliance module clear of its sibling’s configured value', () => {
    const { files, provenance } = generateRecorded(path, twoModules);
    const script = textOf(files, DEPLOY);

    const countryAllowRanges = rangesForPath(
      provenance,
      DEPLOY,
      'compliance.modules[0].config.allowedCountries'
    );
    expect(countryAllowRanges.length).toBeGreaterThan(0);

    for (const range of countryAllowRanges) {
      const body = sliceRange(script, range);
      expect(body.some((line) => line.includes('50000'))).toBe(false);
    }

    const maxBalanceRanges = rangesForPath(
      provenance,
      DEPLOY,
      'compliance.modules[1].config.maxBalance'
    );
    expect(maxBalanceRanges.length).toBeGreaterThan(0);
    expect(
      maxBalanceRanges.some((range) =>
        sliceRange(script, range).some((line) => line.includes('50000'))
      )
    ).toBe(true);
  });

  /**
   * The WASM preflight depends on which crates get deployed — module ids and the
   * fixed token crate. It contains no token name and no role, and must not claim
   * them: resolving crate names used to build the whole token descriptor.
   */
  it('does not attribute the token name or roles to the WASM preflight block', () => {
    const { files, provenance } = generateRecorded(path, twoModules);
    const script = textOf(files, DEPLOY);

    const preflight = rangeEntries(provenance, DEPLOY).filter((entry) =>
      sliceRange(script, entry.range).some((line) => line.includes('verify_wasm_artifacts'))
    );
    expect(preflight.length).toBeGreaterThan(0);

    for (const entry of preflight) {
      expect(entry.paths).not.toContain('token.name');
      expect(entry.paths).not.toContain('token.symbol');
      expect(entry.paths.some((p) => p.startsWith('accessControl.'))).toBe(false);
    }
  });

  // INV-33: claim topics and trusted issuers are separate fields with separate sites.
  it('separates claim topics from trusted issuers', () => {
    const { files, provenance } = generateRecorded(path, twoModules);
    const script = textOf(files, DEPLOY);

    const topicRanges = rangesForPath(provenance, DEPLOY, 'identityVerification.claimTopics[0].id');
    expect(topicRanges.length).toBeGreaterThan(0);

    for (const range of topicRanges) {
      expect(sliceRange(script, range).some((line) => line.includes('add_trusted_issuer'))).toBe(
        false
      );
    }
  });

  // INV-34: a field the script does not read matches nothing on it.
  it('does not claim a field the script never reads', () => {
    const { provenance } = generateRecorded(path, twoModules);

    const claimed = entriesOf(provenance, DEPLOY).flatMap((entry) => entry.paths);
    expect(claimed.some((p) => p.startsWith('token.administrativeControls'))).toBe(false);
  });
});
