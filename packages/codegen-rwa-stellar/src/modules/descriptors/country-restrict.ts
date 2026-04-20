import { PR_651 } from './review-urls';
import {
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalNumericCountryCodes,
  serializeNumericArray,
} from './shared';

export const countryRestrictModule = defineComplianceModuleDescriptor({
  id: 'country-restrict',
  name: 'Country Restriction',
  requiredHooks: ['canTransfer'],
  crateName: 'country-restrict',
  review: { state: 'under-review', prUrl: PR_651 },
  configFields: [
    {
      key: 'restrictedCountries',
      label: 'Restricted Countries',
      type: 'string[]',
      required: false,
      placeholder: 'e.g. US, KP',
    },
  ],
  deployment: {
    requiresIdentityRegistryStorage: true,
    getConfigurationInvocations(selection) {
      const countriesToRestrict = getOptionalNumericCountryCodes(selection, 'restrictedCountries');
      return countriesToRestrict.length > 0
        ? [
            createModuleInvocation(
              'batch_restrict_countries',
              `--token "$RWA_TOKEN_ADDRESS" --countries ${serializeNumericArray(countriesToRestrict)}`
            ),
          ]
        : [];
    },
  },
});
