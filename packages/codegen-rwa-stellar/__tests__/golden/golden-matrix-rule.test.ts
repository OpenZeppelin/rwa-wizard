/**
 * SF-4 AS-1 — the fixture matrix's own correctness.
 *
 * The matrix rule ("each variant changes exactly one top-level dimension") is
 * enforced in `golden-output.test.ts` through `dimensionsDifferingFromBaseline`.
 * That check is only as good as the helper, so this file pins the helper's
 * negatives with fabricated fixtures, and pins the two assumptions the guard
 * makes about the generator: output is deterministic, and every emitted file is
 * text. If either broke, the guard would go flaky or silently skip files.
 */
import { describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { generate, generateWithIdentitySupport, validate } from '../../src/index';
import { createValidConfig } from '../helpers/config';
import {
  BASELINE_FIXTURE_NAME,
  CONFIG_DIMENSIONS,
  dimensionsDifferingFromBaseline,
  GOLDEN_FIXTURES,
  PREVIEW_FILLED_EMPTY_DRAFT_FIXTURE_NAME,
} from './fixtures';

const baseline = { config: createValidConfig() };

describe('matrix rule helper (AS-1)', () => {
  it('reports nothing for a variant identical to the baseline', () => {
    expect(dimensionsDifferingFromBaseline({ config: createValidConfig() }, baseline)).toEqual([]);
  });

  it.each(CONFIG_DIMENSIONS)('reports exactly %s when only that dimension moves', (dimension) => {
    const config = createValidConfig();
    const moved: RWAConfig = { ...config, [dimension]: mutate(config[dimension]) };
    expect(dimensionsDifferingFromBaseline({ config: moved }, baseline)).toEqual([dimension]);
  });

  it('reports every moved dimension, in CONFIG_DIMENSIONS order, when two move', () => {
    const config = createValidConfig();
    const moved: RWAConfig = {
      ...config,
      deployment: mutate(config.deployment),
      token: mutate(config.token),
    };
    expect(dimensionsDifferingFromBaseline({ config: moved }, baseline)).toEqual([
      'token',
      'deployment',
    ]);
  });

  it('treats a nested single-field change as a move of its top-level dimension', () => {
    const config = createValidConfig();
    const moved: RWAConfig = {
      ...config,
      token: { ...config.token, decimals: config.token.decimals + 1 },
    };
    expect(dimensionsDifferingFromBaseline({ config: moved }, baseline)).toEqual(['token']);
  });

  it('does not treat key order as a difference', () => {
    const config = createValidConfig();
    const reordered: RWAConfig = {
      ...config,
      token: Object.fromEntries(Object.entries(config.token).reverse()) as RWAConfig['token'],
    };
    expect(dimensionsDifferingFromBaseline({ config: reordered }, baseline)).toEqual([]);
  });

  it('covers every top-level RWAConfig key in CONFIG_DIMENSIONS', () => {
    // A new top-level key that no fixture varies would be unguarded; make the
    // list itself fail first so the fixture author sees it.
    const topLevel = Object.keys(createValidConfig()).sort();
    expect([...CONFIG_DIMENSIONS].sort()).toEqual(topLevel);
  });
});

describe('whole-config fixtures (AS-1)', () => {
  it('only the baseline and the preview-filled empty draft have varies = null', () => {
    const wholeConfig = GOLDEN_FIXTURES.filter((f) => f.varies === null).map((f) => f.name);
    expect(wholeConfig.sort()).toEqual(
      [BASELINE_FIXTURE_NAME, PREVIEW_FILLED_EMPTY_DRAFT_FIXTURE_NAME].sort()
    );
  });

  it('the preview-filled empty draft is not a single-axis variant of the baseline', () => {
    // If it ever collapses onto the baseline on all but one dimension it should be
    // declared as a variant, not a whole-config fixture.
    const preview = GOLDEN_FIXTURES.find((f) => f.name === PREVIEW_FILLED_EMPTY_DRAFT_FIXTURE_NAME);
    expect(preview).toBeDefined();
    if (preview === undefined) return;
    expect(dimensionsDifferingFromBaseline(preview, baseline).length).toBeGreaterThan(1);
  });

  it('every fixture passes validation (both generate paths share validate())', () => {
    for (const fixture of GOLDEN_FIXTURES) {
      const result = validate(fixture.config);
      expect(result.valid, `${fixture.name}: ${JSON.stringify(result.errors)}`).toBe(true);
    }
  });
});

describe('guard preconditions', () => {
  it.each(GOLDEN_FIXTURES.map((f) => [f.name, f] as const))(
    '%s generates byte-identical output on two consecutive runs',
    (_name, fixture) => {
      for (const run of [generate, generateWithIdentitySupport]) {
        const first = run(fixture.config).files;
        const second = run(fixture.config).files;
        expect(Object.keys(second).sort()).toEqual(Object.keys(first).sort());
        for (const [path, content] of Object.entries(first)) {
          expect(second[path], `${run.name}: ${path}`).toBe(content);
        }
      }
    }
  );

  it('emits only string contents, so no file falls outside the text guard', () => {
    for (const fixture of GOLDEN_FIXTURES) {
      for (const run of [generate, generateWithIdentitySupport]) {
        for (const [path, content] of Object.entries(run(fixture.config).files)) {
          expect(typeof content, `${run.name}/${fixture.name}/${path}`).toBe('string');
        }
      }
    }
  });

  it('emits at least one file per fixture on each path', () => {
    for (const fixture of GOLDEN_FIXTURES) {
      expect(Object.keys(generate(fixture.config).files).length, fixture.name).toBeGreaterThan(0);
      expect(
        Object.keys(generateWithIdentitySupport(fixture.config).files).length,
        fixture.name
      ).toBeGreaterThan(0);
    }
  });
});

/** Return a structurally different value of the same shape (adds a marker key). */
function mutate<T extends object>(value: T): T {
  return { ...value, __moved: true } as T;
}
