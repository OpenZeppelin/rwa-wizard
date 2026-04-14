import { describe, expect, it } from 'vitest';

import { createMinimalConfig } from '../helpers/config';
import { generateRwaTokenContract } from '../../src/templates/contracts/rwa-token';

describe('RWA Token Contract Template', () => {
  it('keeps the upstream contract struct and trait implementations', () => {
    const output = generateRwaTokenContract(createMinimalConfig());

    expect(output).toContain('pub struct RWATokenContract;');
    expect(output).toContain('impl Pausable for RWATokenContract');
    expect(output).toContain('impl FungibleToken for RWATokenContract');
    expect(output).toContain('impl RWAToken for RWATokenContract');
    expect(output).toContain('impl AccessControl for RWATokenContract');
  });

  it('uses the upstream constructor shape with compliance wiring', () => {
    const output = generateRwaTokenContract(createMinimalConfig());

    expect(output).toContain('pub fn __constructor(');
    expect(output).toContain('admin: Address,');
    expect(output).toContain('manager: Address,');
    expect(output).toContain('compliance: Address,');
    expect(output).toContain('identity_verifier: Address,');
    expect(output).not.toContain('initial_supply: i128');
    expect(output).not.toContain('Base::mint(');
    expect(output).toContain('RWA::set_compliance(e, &compliance);');
    expect(output).toContain('RWA::set_identity_verifier(e, &identity_verifier);');
  });

  it('patches the upstream metadata decimals from config', () => {
    const output = generateRwaTokenContract(
      createMinimalConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 7,
          documentManager: { enabled: false },
        },
      })
    );

    expect(output).toContain('Base::set_metadata(e, 7, name, symbol)');
  });

  it('retains the manager role grant even when no additional roles are configured', () => {
    const output = generateRwaTokenContract(createMinimalConfig());

    expect(output).toContain('const MANAGER_ROLE: Symbol = symbol_short!("manager");');
    expect(output).toContain('grant_role_no_auth(e, &manager, &MANAGER_ROLE, &admin);');
  });

  it('adds extra role constants, constructor args, and grants for configured roles', () => {
    const output = generateRwaTokenContract(
      createMinimalConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER...' },
          roles: [{ name: 'Custom Role', addresses: ['GCCUSTOM...'] }],
        },
      })
    );

    expect(output).toContain('const CUSTOMROL_ROLE: Symbol = symbol_short!("customrol");');
    expect(output).toContain('customrol: Address,');
    expect(output).toContain(
      'grant_role_no_auth(e, &customrol, &CUSTOMROL_ROLE, &admin);'
    );
  });

  it('includes DocumentManager support only when enabled', () => {
    const enabledOutput = generateRwaTokenContract(
      createMinimalConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          documentManager: { enabled: true },
        },
      })
    );
    expect(enabledOutput).toContain('impl DocumentManager for RWATokenContract');
    expect(enabledOutput).toContain('BytesN');

    const disabledOutput = generateRwaTokenContract(createMinimalConfig());
    expect(disabledOutput).not.toContain('DocumentManager');
  });

  it('keeps ownership-model-specific admin resolution out of the template itself', () => {
    const output = generateRwaTokenContract(
      createMinimalConfig({
        accessControl: {
          ownership: { type: 'multi-sig', address: 'GCMULTISIG...' },
          roles: [],
        },
      })
    );

    expect(output).toContain('admin: Address,');
    expect(output).not.toContain('GCMULTISIG');
  });
});
