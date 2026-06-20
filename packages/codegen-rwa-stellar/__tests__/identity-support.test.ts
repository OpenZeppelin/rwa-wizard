import { describe, expect, it } from 'vitest';

import { createValidConfig } from './helpers/config';

import {
  generateIdentitySupportFiles,
  generateWithIdentitySupport,
} from '../src/templates/identity-support';

describe('identity support templates', () => {
  it('emits upstream claim issuer, identity, and sign-claim helper files', () => {
    const support = generateIdentitySupportFiles();
    const paths = Object.keys(support.files);

    expect(paths).toContain('contracts/claim-issuer/src/contract.rs');
    expect(paths).toContain('contracts/claim-issuer/src/lib.rs');
    expect(paths).toContain('contracts/claim-issuer/Cargo.toml');
    expect(paths).toContain('contracts/identity/src/contract.rs');
    expect(paths).toContain('contracts/identity/src/lib.rs');
    expect(paths).toContain('contracts/identity/Cargo.toml');
    expect(paths).toContain('tools/sign-claim/src/main.rs');
    expect(paths).toContain('tools/sign-claim/Cargo.toml');
    expect(support.workspaceMembers).toEqual(['contracts/claim-issuer', 'contracts/identity']);
    expect(support.workspaceExcludes).toEqual(['tools/sign-claim']);
  });

  it('can compose identity support into a generated RWA project', () => {
    const result = generateWithIdentitySupport(createValidConfig());
    const cargoToml = result.files['Cargo.toml'] as string;
    const identityRegistryStorage = result.files[
      'contracts/identity-registry-storage/src/contract.rs'
    ] as string;

    expect(result.files).toHaveProperty('contracts/claim-issuer/src/contract.rs');
    expect(result.files).toHaveProperty('contracts/identity/src/contract.rs');
    expect(result.files).toHaveProperty('tools/sign-claim/src/main.rs');
    expect(cargoToml).toContain('"contracts/claim-issuer"');
    expect(cargoToml).toContain('"contracts/identity"');
    expect(cargoToml).toContain('exclude = [\n    "tools/sign-claim",\n]');
    expect(cargoToml).toContain('ed25519-dalek = "2.1.1"');
    expect(identityRegistryStorage).toContain('pub fn get_country_data_entries(');
    expect(identityRegistryStorage).toContain('entry.into_val(e)');
    expect(identityRegistryStorage).toContain('pub fn add_identity_country_data(');
    expect(identityRegistryStorage).toContain('initial_profiles: Vec<CountryData>');
  });

  it('regenerates README and deploy.sh for identity-support exports', () => {
    const result = generateWithIdentitySupport(createValidConfig());
    const readme = result.files['README.md'] as string;
    const deploySh = result.files['scripts/deploy.sh'] as string;

    expect(readme).toContain('does **not** deploy or wire them automatically');
    expect(readme).toContain('### Example / dev-only contracts');
    expect(readme).toContain('IdentityClaims');
    expect(readme).toContain('rwa_claim_issuer_example.wasm');
    expect(readme).toContain('Preflight validates only the');
    expect(readme).not.toContain('does not currently scaffold the upstream');

    expect(deploySh).toContain('example claim-issuer and identity crates');
    expect(deploySh).not.toContain('does not scaffold claim-issuer or per-holder');
  });
});
