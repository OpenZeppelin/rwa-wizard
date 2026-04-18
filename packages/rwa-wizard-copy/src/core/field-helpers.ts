import type { ConceptDictionary } from '../types';

/**
 * Form field helper text — the small muted paragraphs rendered under form
 * inputs. Field ids are namespaced by the form they live in
 * (`fieldHelper.<form>.<field>`) and are stable UX anchors.
 *
 * Values that depend on runtime constants (e.g. a max-length configured in
 * `@openzeppelin/rwa-config`) use `{placeholder}` tokens which the call site
 * substitutes via `formatCopy`. This keeps the copy dictionary independent
 * of validation constants while still producing a single source of truth.
 */
export const FIELD_HELPERS_COPY: ConceptDictionary = {
  'fieldHelper.token.name': {
    id: 'fieldHelper.token.name',
    description: 'Human-readable name of the asset. Up to {maxLength} characters.',
  },
  'fieldHelper.token.symbol': {
    id: 'fieldHelper.token.symbol',
    description: 'Short ticker shown in wallets and explorers. Up to {maxLength} characters.',
  },
  'fieldHelper.token.decimals': {
    id: 'fieldHelper.token.decimals',
    description:
      'Number of fractional digits the token supports. Pick the convention of your target ecosystem (commonly 18 on ERC-3643 deployments).',
  },
  'fieldHelper.token.initial-supply': {
    id: 'fieldHelper.token.initial-supply',
    description:
      'Tokens minted to the deployer at construction. Recipients still need a verified ONCHAINID — leave blank to mint later via the minting role.',
  },
  'fieldHelper.document-manager.enabled': {
    id: 'fieldHelper.document-manager.enabled',
    description:
      'When enabled, the contract exposes document read/write/remove entry points, gated by the document-manager role you assign in Access Control.',
  },
  'fieldHelper.trusted-issuer.address': {
    id: 'fieldHelper.trusted-issuer.address',
    description:
      'Paste the Claim Issuer contract address (not the issuer’s EOA/wallet). New issuers start permitted for every claim topic you configured above — you can narrow this per issuer below.',
  },
  'fieldHelper.owner-address.single-owner': {
    id: 'fieldHelper.owner-address.single-owner',
    title: 'Owner Address',
    description:
      'Receives the admin role at deployment. Can grant, revoke, and rotate every other operator role. Use a hardware-backed or custodied account for production.',
  },
  'fieldHelper.owner-address.multi-sig': {
    id: 'fieldHelper.owner-address.multi-sig',
    title: 'Multi-Sig Contract Address',
    description:
      'Address of the already-deployed multi-sig contract. It becomes admin, and every role change has to pass the wallet’s signer threshold.',
  },
  'fieldHelper.owner-address.dao': {
    id: 'fieldHelper.owner-address.dao',
    title: 'DAO Contract Address',
    description:
      'Address of the already-deployed governance contract (Governor, SCF, etc.). It becomes admin, and role changes execute as governance proposals.',
  },
} as const;
