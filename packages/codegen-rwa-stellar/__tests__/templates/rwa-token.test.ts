import { describe, expect, it } from 'vitest';

import { generateRwaTokenContract } from '../../src/templates/contracts/rwa-token';
import { createMinimalConfig } from '../helpers/config';

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
          decimals: 18,
          documentManager: { enabled: false },
        },
      })
    );

    expect(output).toContain('Base::set_metadata(e, 18, name, symbol)');
    expect(output).not.toContain('Base::set_metadata(e, 7, name, symbol)');
  });

  it('retains the manager role grant even when no additional roles are configured', () => {
    const output = generateRwaTokenContract(createMinimalConfig());

    expect(output).toContain('const MANAGER_ROLE: Symbol = symbol_short!("manager");');
    expect(output).toContain('grant_role_no_auth(e, &manager, &MANAGER_ROLE, &admin);');
  });

  it('adds extra role constants, vector constructor args, and grants for configured roles', () => {
    const output = generateRwaTokenContract(
      createMinimalConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER...' },
          roles: [{ name: 'Custom Role', addresses: ['GCCUSTOM1...', 'GCCUSTOM2...'] }],
        },
      })
    );

    expect(output).toContain('const CUSTOMROL_ROLE: Symbol = symbol_short!("customrol");');
    expect(output).toContain('customrol: Vec<Address>,');
    expect(output).toContain(
      'fn grant_role_members(e: &Env, accounts: Vec<Address>, role: &Symbol, admin: &Address) {'
    );
    expect(output).toContain('grant_role_members(e, customrol, &CUSTOMROL_ROLE, &admin);');
  });

  it('uses semantic role guards when specialized roles are configured', () => {
    const output = generateRwaTokenContract(
      createMinimalConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          documentManager: { enabled: true },
        },
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER...' },
          roles: [
            { name: 'minter', addresses: ['GCMINTER...'] },
            { name: 'burner', addresses: ['GCBURNER...'] },
            { name: 'pauser', addresses: ['GCPAUSER...'] },
            { name: 'document-manager', addresses: ['GCDOCS...'] },
          ],
        },
      })
    );

    expect(output).toContain('#[only_role(operator, "minter")]');
    expect(output).toContain('#[only_role(operator, "burner")]');
    expect(output).toContain('#[only_role(_caller, "pauser")]');
    expect(output).toContain('#[only_role(operator, "documentm")]');
    expect(output).toContain('use stellar_macros::{only_admin, only_role};');
  });

  it('falls back to admin guards when no specialized role is configured', () => {
    const output = generateRwaTokenContract(
      createMinimalConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          documentManager: { enabled: true },
        },
      })
    );

    expect(output).toContain(
      '#[only_admin]\n    fn mint(e: &Env, to: Address, amount: i128, operator: Address) {'
    );
    expect(output).toContain(
      '#[only_admin]\n    fn mint(e: &Env, to: Address, amount: i128, operator: Address) {\n        let _ = &operator;'
    );
    expect(output).toContain(
      '#[only_admin]\n    fn forced_transfer(e: &Env, from: Address, to: Address, amount: i128, operator: Address) {'
    );
    expect(output).toContain('use stellar_macros::only_admin;');
    expect(output).not.toContain('use stellar_macros::{only_admin, only_role};');
    expect(output).toContain('#[only_admin]\n    fn set_document(');
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
    expect(enabledOutput).toContain('let _ = &operator;\n        doc_manager::set_document');

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
