import { insertAfterExact, insertBeforeExact, replaceExact } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { rwaTokenMarkers } from './rwa-token-markers';
import { buildDocumentManagerAccessAttribute } from './rwa-token-roles';

/**
 * Generate the optional DocumentManager implementation block.
 */
function buildDocumentManagerImpl(config: RWAConfig): string {
  const documentManagerGuard = buildDocumentManagerAccessAttribute(config);

  return `#[contractimpl]
impl DocumentManager for RWATokenContract {
    fn get_document(e: &Env, name: BytesN<32>) -> Document {
        doc_manager::get_document(e, &name)
    }

${documentManagerGuard}
    fn set_document(
        e: &Env,
        name: BytesN<32>,
        uri: String,
        document_hash: BytesN<32>,
        operator: Address,
    ) {
        let _ = &operator;
        doc_manager::set_document(e, &name, &uri, &document_hash);
    }

${documentManagerGuard}
    fn remove_document(e: &Env, name: BytesN<32>, operator: Address) {
        let _ = &operator;
        doc_manager::remove_document(e, &name);
    }

    fn get_documents(e: &Env, bucket_index: u32) -> Vec<(BytesN<32>, Document)> {
        doc_manager::get_documents(e, bucket_index)
    }
}`;
}

/**
 * Inject the DocumentManager extension imports and implementation.
 */
export function addDocumentManagerSupport(source: string, config: RWAConfig): string {
  let patched = replaceExact(
    source,
    rwaTokenMarkers.sdkImportMembers,
    '    contract, contractimpl, symbol_short, Address, BytesN, Env, MuxedAddress, String, Symbol, Vec,\n'
  );

  patched = insertAfterExact(
    patched,
    rwaTokenMarkers.tokenImport,
    `
use stellar_tokens::rwa::extensions::doc_manager::{
    self as doc_manager, Document, DocumentManager,
};
`
  );

  return insertBeforeExact(
    patched,
    rwaTokenMarkers.accessControlImpl,
    `\n${buildDocumentManagerImpl(config)}\n\n`
  );
}
