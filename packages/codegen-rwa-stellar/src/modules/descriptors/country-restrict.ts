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
  description: 'Blocks transfers to holders from restricted countries',
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
      hint: 'ISO 3166-1 alpha-2 country codes to restrict (configured post-deploy via IRS)',
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
