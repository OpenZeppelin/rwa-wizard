import { describe, expect, it } from 'vitest';

import {
  getEcosystemMetadata,
  serializeStellarComplianceHookForCli,
  STELLAR_ADMIN_CONTROLS,
  STELLAR_COMPLIANCE_HOOKS,
  STELLAR_IDENTITY_CONTROLS,
  STELLAR_MAX_MODULES_PER_HOOK,
  STELLAR_MAX_TRUSTED_ISSUERS,
  STELLAR_OPERATOR_ROLES,
} from '../src/ecosystem-metadata';

describe('STELLAR_ADMIN_CONTROLS', () => {
  it('contains 3 controls (burnable, mintable, pausable)', () => {
    expect(STELLAR_ADMIN_CONTROLS).toHaveLength(3);
    const ids = STELLAR_ADMIN_CONTROLS.map((c) => c.id);
    expect(ids).toEqual(['burnable', 'mintable', 'pausable']);
  });

  it('marks all as locked for Stellar', () => {
    for (const ctrl of STELLAR_ADMIN_CONTROLS) {
      expect(ctrl.locked).toBe(true);
    }
  });

  it('defaults all to true for Stellar', () => {
    for (const ctrl of STELLAR_ADMIN_CONTROLS) {
      expect(ctrl.defaultValue).toBe(true);
    }
  });

  it('has non-empty names', () => {
    for (const ctrl of STELLAR_ADMIN_CONTROLS) {
      expect(ctrl.name.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('STELLAR_IDENTITY_CONTROLS', () => {
  it('contains 4 controls', () => {
    expect(STELLAR_IDENTITY_CONTROLS).toHaveLength(4);
    const ids = STELLAR_IDENTITY_CONTROLS.map((c) => c.id);
    expect(ids).toEqual(['addressFreezing', 'partialTokenFreezing', 'recovery', 'forcedTransfers']);
  });

  it('marks all as locked for Stellar', () => {
    for (const ctrl of STELLAR_IDENTITY_CONTROLS) {
      expect(ctrl.locked).toBe(true);
    }
  });

  it('defaults all to true for Stellar', () => {
    for (const ctrl of STELLAR_IDENTITY_CONTROLS) {
      expect(ctrl.defaultValue).toBe(true);
    }
  });

  it('has non-empty names', () => {
    for (const ctrl of STELLAR_IDENTITY_CONTROLS) {
      expect(ctrl.name.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('STELLAR_OPERATOR_ROLES', () => {
  it('contains 10 predefined roles', () => {
    expect(STELLAR_OPERATOR_ROLES).toHaveLength(10);
  });

  it('has unique ids', () => {
    const ids = STELLAR_OPERATOR_ROLES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has non-empty names and no embedded UI copy', () => {
    for (const role of STELLAR_OPERATOR_ROLES) {
      expect(role.name.trim().length).toBeGreaterThan(0);
      expect(role).not.toHaveProperty('description');
    }
  });

  it('includes the document-manager role', () => {
    expect(STELLAR_OPERATOR_ROLES.find((r) => r.id === 'document-manager')).toBeDefined();
  });
});

describe('STELLAR_COMPLIANCE_HOOKS', () => {
  it('contains metadata for all 5 hooks', () => {
    expect(STELLAR_COMPLIANCE_HOOKS).toHaveLength(5);
  });

  it('has unique hook values', () => {
    const hooks = STELLAR_COMPLIANCE_HOOKS.map((m) => m.hook);
    expect(new Set(hooks).size).toBe(hooks.length);
  });

  it('covers the expected hook names', () => {
    const hooks = STELLAR_COMPLIANCE_HOOKS.map((m) => m.hook);
    expect(hooks).toEqual(['canTransfer', 'canCreate', 'transferred', 'created', 'destroyed']);
  });

  it('has non-empty display names and no embedded UI copy', () => {
    for (const meta of STELLAR_COMPLIANCE_HOOKS) {
      expect(meta.displayName.trim().length).toBeGreaterThan(0);
      expect(meta).not.toHaveProperty('description');
    }
  });

  it('serializes hook ids to the contract CLI enum case names', () => {
    expect(serializeStellarComplianceHookForCli('canTransfer')).toBe('CanTransfer');
    expect(serializeStellarComplianceHookForCli('canCreate')).toBe('CanCreate');
    expect(serializeStellarComplianceHookForCli('transferred')).toBe('Transferred');
    expect(serializeStellarComplianceHookForCli('created')).toBe('Created');
    expect(serializeStellarComplianceHookForCli('destroyed')).toBe('Destroyed');
  });
});

describe('limit constants', () => {
  it('STELLAR_MAX_MODULES_PER_HOOK is reasonable', () => {
    expect(STELLAR_MAX_MODULES_PER_HOOK).toBeGreaterThanOrEqual(1);
    expect(STELLAR_MAX_MODULES_PER_HOOK).toBeLessThanOrEqual(100);
  });

  it('STELLAR_MAX_TRUSTED_ISSUERS is reasonable', () => {
    expect(STELLAR_MAX_TRUSTED_ISSUERS).toBeGreaterThanOrEqual(1);
    expect(STELLAR_MAX_TRUSTED_ISSUERS).toBeLessThanOrEqual(200);
  });
});

describe('getEcosystemMetadata()', () => {
  it('returns all administrative controls', () => {
    const meta = getEcosystemMetadata();
    expect(meta.administrativeControls).toBe(STELLAR_ADMIN_CONTROLS);
  });

  it('returns all identity controls', () => {
    const meta = getEcosystemMetadata();
    expect(meta.identityControls).toBe(STELLAR_IDENTITY_CONTROLS);
  });

  it('returns all operator roles', () => {
    const meta = getEcosystemMetadata();
    expect(meta.operatorRoles).toBe(STELLAR_OPERATOR_ROLES);
  });

  it('returns all compliance hooks', () => {
    const meta = getEcosystemMetadata();
    expect(meta.complianceHooks).toBe(STELLAR_COMPLIANCE_HOOKS);
  });

  it('returns limits matching individual constants', () => {
    const meta = getEcosystemMetadata();
    expect(meta.limits.maxModulesPerHook).toBe(STELLAR_MAX_MODULES_PER_HOOK);
    expect(meta.limits.maxTrustedIssuers).toBe(STELLAR_MAX_TRUSTED_ISSUERS);
  });
});
