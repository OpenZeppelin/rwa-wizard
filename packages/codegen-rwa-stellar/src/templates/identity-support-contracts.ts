export const IDENTITY_SUPPORT_CONTRACTS = [
  {
    id: 'claim-issuer',
    crateName: 'rwa-claim-issuer-example',
    dirPath: 'contracts/claim-issuer',
    displayName: 'Claim Issuer',
  },
  {
    id: 'identity',
    crateName: 'rwa-identity-example',
    dirPath: 'contracts/identity',
    displayName: 'Identity',
  },
] as const;

export const SIGN_CLAIM_TOOL = {
  id: 'sign-claim',
  dirPath: 'tools/sign-claim',
  displayName: 'Sign Claim',
} as const;
