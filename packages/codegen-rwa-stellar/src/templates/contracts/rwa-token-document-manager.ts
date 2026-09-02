import type { ConfigPath, PatchSink } from '@openzeppelin/codegen-core';

import { rwaTokenMarkers } from './rwa-token-markers';

/**
 * Generate the optional DocumentManager implementation block.
 */
function buildDocumentManagerImpl(documentManagerGuard: string): string {
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
 *
 * All three edits exist because the extension is enabled, so all three carry
 * `enabledPaths`. The impl block additionally carries the paths of the role
 * that produced its access guard — the guard attribute is observed by the
 * caller and handed in, never recomputed here (INV-24).
 */
export function addDocumentManagerSupport(
  sink: PatchSink,
  documentManagerGuard: string,
  enabledPaths: readonly ConfigPath[],
  guardPaths: readonly ConfigPath[]
): void {
  sink.replaceExact(
    rwaTokenMarkers.sdkImportMembers,
    '    contract, contractimpl, symbol_short, Address, BytesN, Env, MuxedAddress, String, Symbol, Vec,\n',
    enabledPaths
  );

  sink.insertAfterExact(
    rwaTokenMarkers.tokenImport,
    `
use stellar_tokens::rwa::extensions::doc_manager::{
    self as doc_manager, Document, DocumentManager,
};
`,
    enabledPaths
  );

  sink.insertBeforeExact(
    rwaTokenMarkers.accessControlImpl,
    `\n${buildDocumentManagerImpl(documentManagerGuard)}\n\n`,
    [...enabledPaths, ...guardPaths]
  );
}
