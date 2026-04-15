export const rwaTokenMarkers = {
  sdkImportMembers:
    '    contract, contractimpl, symbol_short, Address, Env, MuxedAddress, String, Symbol, Vec,\n',
  tokenImport: `use stellar_tokens::{
    fungible::{Base, FungibleToken},
    rwa::{RWAToken, RWA},
};
`,
  roleConstant: 'const MANAGER_ROLE: Symbol = symbol_short!("manager");',
  metadataLine: '        Base::set_metadata(e, 7, name, symbol);',
  identityVerifierParam: '        identity_verifier: Address,\n',
  managerRoleGrant:
    '        access_control::grant_role_no_auth(e, &manager, &MANAGER_ROLE, &admin);\n',
  adminGuard: '    #[only_admin]',
  managerGuard: '    #[only_role(operator, "manager")]',
  accessControlImpl: '#[contractimpl(contracttrait)]\nimpl AccessControl for RWATokenContract {}\n',
} as const;
