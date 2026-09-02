/**
 * SF-17 — call-site partition, SF-14 preservation, and absence pins
 * (INV-15–16, INV-18–21).
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  APP_ROOT,
  findToken,
  findTokenAcross,
  readScannedSources,
  REPO_ROOT,
} from '../../../test/helpers/sourceScan';

const TOUCHED = [
  'src/components/shared/TogglePill.tsx',
  'src/components/shared/TopicToggleGroup.tsx',
  'src/features/wizard/steps/identity/ClaimTopicsSection.tsx',
  'src/features/wizard/focused-path/stepMarkupSanction.ts',
  'src/features/wizard/focused-path/stepMarkupGuard.ts',
] as const;

function walkProductionTs(absoluteDir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const full = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'test' ||
        entry.name === '__fixtures__'
      ) {
        continue;
      }
      out.push(...walkProductionTs(full));
      continue;
    }
    if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith('.d.ts') &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.')
    ) {
      out.push(full);
    }
  }
  return out;
}

function relativeFromApp(absolute: string): string {
  return absolute.slice(APP_ROOT.length + 1);
}

/** Every `<TogglePill` JSX open in production sources under apps/rwa-wizard/src. */
function enumerateTogglePillUsages(): readonly { path: string; snippet: string }[] {
  const files = walkProductionTs(join(APP_ROOT, 'src'));
  const hits: { path: string; snippet: string }[] = [];
  for (const absolute of files) {
    const raw = readFileSync(absolute, 'utf8');
    const path = relativeFromApp(absolute);
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i]!.includes('<TogglePill')) continue;
      // Collect through the matching `/>` or `</TogglePill>` for attribute inspection.
      let block = lines[i]!;
      let j = i;
      while (j < lines.length - 1 && !block.includes('/>') && !block.includes('</TogglePill>')) {
        j += 1;
        block += `\n${lines[j]!}`;
      }
      hits.push({ path, snippet: block });
    }
  }
  return hits;
}

describe('SF-17 INV-16 — call-site mode partition is exhaustive', () => {
  it('exactly three production TogglePill groups match the mode table', () => {
    const usages = enumerateTogglePillUsages();
    expect(
      usages.map((u) => u.path).sort(),
      'INV-16: unexpected TogglePill call site — update the partition table'
    ).toEqual(
      [
        'src/components/shared/TopicToggleGroup.tsx',
        'src/components/shared/TopicToggleGroup.tsx',
        'src/features/wizard/steps/identity/TrustedIssuersSection.tsx',
      ].sort()
    );

    const topicUsages = usages.filter((u) => u.path.includes('TopicToggleGroup'));
    const issuerUsages = usages.filter((u) => u.path.includes('TrustedIssuersSection'));

    for (const usage of topicUsages) {
      expect(usage.snippet).toMatch(/onToggleSelection=/);
      expect(usage.snippet).not.toMatch(/\bonClick=/);
    }
    // Custom chip is the one that also passes onRemove.
    expect(topicUsages.some((u) => /onRemove=/.test(u.snippet))).toBe(true);
    expect(topicUsages.some((u) => !/onRemove=/.test(u.snippet))).toBe(true);

    for (const usage of issuerUsages) {
      expect(usage.snippet).toMatch(/\bonClick=/);
      expect(usage.snippet).not.toMatch(/onToggleSelection=/);
      expect(usage.snippet).not.toMatch(/onRemove=/);
      expect(usage.snippet).not.toMatch(/configAnchor=/);
    }
  });
});

describe('SF-17 INV-15 — issuer permitted-topic pills stay pure-toggle', () => {
  it('TrustedIssuersSection never passes onToggleSelection', () => {
    const [source] = readScannedSources([
      'src/features/wizard/steps/identity/TrustedIssuersSection.tsx',
    ]);
    expect(findToken(source!, 'onToggleSelection')).toEqual([]);
  });
});

describe('SF-17 INV-18 — SF-14 interaction rules preserved', () => {
  it('no tabIndex / aria-selected / role="option" in superseded chip files', () => {
    const sources = readScannedSources([
      'src/components/shared/TogglePill.tsx',
      'src/components/shared/TopicToggleGroup.tsx',
    ]);
    expect(findTokenAcross(sources, 'tabIndex')).toEqual([]);
    expect(findTokenAcross(sources, 'tabindex')).toEqual([]);
    expect(findTokenAcross(sources, 'aria-selected')).toEqual([]);
    expect(findTokenAcross(sources, 'role="option"')).toEqual([]);
  });

  it('no new document.addEventListener outside inspected-anchor/', () => {
    const sources = readScannedSources([
      'src/components/shared/TogglePill.tsx',
      'src/components/shared/TopicToggleGroup.tsx',
      'src/features/wizard/steps/identity/ClaimTopicsSection.tsx',
    ]);
    expect(findTokenAcross(sources, 'document.addEventListener')).toEqual([]);
  });
});

describe('SF-17 INV-19 / INV-20 — no memo, cache, async, or persistence', () => {
  it('touched production files introduce no useMemo / useCallback cache / compiler skip', () => {
    // ClaimTopicsSection already used useCallback before SF-17 — pin that the
    // *new* selection helpers are plain functions, and TogglePill/TopicToggleGroup
    // gain no new memoisation. Scan TogglePill (new surface) for absence.
    const [pill] = readScannedSources(['src/components/shared/TogglePill.tsx']);
    expect(findToken(pill!, 'useMemo')).toEqual([]);
    expect(findToken(pill!, 'useCallback')).toEqual([]);
    expect(findToken(pill!, 'useMemoCache')).toEqual([]);
    expect(findToken(pill!, 'react-compiler')).toEqual([]);
  });

  it('touched files introduce no fetch / setTimeout / localStorage / IndexedDB', () => {
    const sources = readScannedSources([...TOUCHED]);
    for (const token of [
      'fetch(',
      'setTimeout(',
      'localStorage',
      'indexedDB',
      'IndexedDB',
    ] as const) {
      expect(findTokenAcross(sources, token), token).toEqual([]);
    }
  });
});

describe('SF-17 INV-21 — goldens OID and generator boundary untouched', () => {
  it('SF-17 UI files do not import codegen packages', () => {
    const sources = readScannedSources([
      'src/components/shared/TogglePill.tsx',
      'src/components/shared/TopicToggleGroup.tsx',
      'src/features/wizard/steps/identity/ClaimTopicsSection.tsx',
    ]);
    expect(findTokenAcross(sources, '@openzeppelin/codegen-')).toEqual([]);
    expect(findTokenAcross(sources, 'codegen-rwa-')).toEqual([]);
  });

  it('goldens tree OID remains 87435932e175ea8c0b616c0d5c8a62a87e0b0ae5 when present', () => {
    const goldens = join(REPO_ROOT, 'packages/codegen-rwa-stellar/__goldens__');
    try {
      if (!statSync(goldens).isDirectory()) return;
    } catch {
      // Package may relocate goldens; absence is not an SF-17 regression.
      return;
    }
    const oid = execSync('git rev-parse HEAD:packages/codegen-rwa-stellar/__goldens__', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
    expect(oid).toBe('87435932e175ea8c0b616c0d5c8a62a87e0b0ae5');
  });
});
