import type { MockGapRecord } from '../../types/wizard';

/**
 * Registry of temporary mock-backed gaps (data-model MockGapRecord).
 * Used when the real generator API is not yet available; each gap is documented
 * for replacement when the real integration ships.
 */
const GAPS: MockGapRecord[] = [
  {
    id: 'stellar-generate-zip-fallback',
    targetId: 'stellar',
    capability: 'generateZip',
    mockBehavior: 'Returns a minimal ZIP with README when real package fails or is unavailable',
    replacementTrigger:
      '@openzeppelin/codegen-rwa-stellar generateZip available and used by default',
    owner: 'T014',
  },
];

const byId = new Map(GAPS.map((g) => [g.id, g]));
const byTarget = new Map<string, MockGapRecord[]>();
for (const g of GAPS) {
  const list = byTarget.get(g.targetId) ?? [];
  list.push(g);
  byTarget.set(g.targetId, list);
}

export function getMockGapsForTarget(targetId: string): MockGapRecord[] {
  return byTarget.get(targetId) ?? [];
}

export function getMockGap(id: string): MockGapRecord | undefined {
  return byId.get(id);
}

export function getAllMockGaps(): MockGapRecord[] {
  return [...GAPS];
}
