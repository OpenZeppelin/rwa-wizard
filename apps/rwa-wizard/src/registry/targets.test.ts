import { describe, expect, it } from 'vitest';

import { getTarget, listTargets } from './targets';

describe('targets registry', () => {
  describe('listTargets', () => {
    it('returns a deterministic ordered array', () => {
      const first = listTargets();
      const second = listTargets();
      expect(first).toEqual(second);
      expect(first.map((t) => t.id)).toEqual(['stellar', 'evm']);
    });

    it('only includes entries with showInUI = true', () => {
      const targets = listTargets();
      for (const t of targets) {
        expect(t.showInUI).toBe(true);
      }
    });

    it('marks stellar as enabled', () => {
      const stellar = listTargets().find((t) => t.id === 'stellar');
      expect(stellar).toBeDefined();
      expect(stellar!.enabled).toBe(true);
    });

    it('marks evm as visible-disabled with a label', () => {
      const evm = listTargets().find((t) => t.id === 'evm');
      expect(evm).toBeDefined();
      expect(evm!.enabled).toBe(false);
      expect(evm!.showInUI).toBe(true);
      expect(evm!.disabledLabel).toBe('Coming Soon');
    });

    it('returns entries with all required fields', () => {
      for (const t of listTargets()) {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(typeof t.enabled).toBe('boolean');
        expect(typeof t.showInUI).toBe('boolean');
        expect(t.packageName).toBeTruthy();
      }
    });
  });

  describe('getTarget', () => {
    it('returns a known target by id', () => {
      const stellar = getTarget('stellar');
      expect(stellar).toBeDefined();
      expect(stellar!.id).toBe('stellar');
    });

    it('returns undefined for unknown target', () => {
      expect(getTarget('unknown-chain')).toBeUndefined();
    });

    it('returns undefined for targets with showInUI = false', () => {
      const hidden = getTarget('some-hidden-target');
      expect(hidden).toBeUndefined();
    });
  });
});
