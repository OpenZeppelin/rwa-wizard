import { useCopy } from '../../app/providers/useCopy';

/** Joins address-list field copy for the active target at call sites. */
export function useAddressListFieldCopy() {
  const copy = useCopy();
  return {
    placeholder: copy.fieldHelper('address-list.placeholder').description,
    bulkPlaceholder: copy.fieldHelper('address-list.bulk-placeholder').description,
    formatHint: copy.fieldHelper('address-list.format').description,
  };
}
