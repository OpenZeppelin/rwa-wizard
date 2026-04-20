import { PR_651 } from './review-urls';
import {
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalNumericCountryCodes,
  serializeNumericArray,
} from './shared';

export const countryAllowModule = defineComplianceModuleDescriptor({
  id: 'country-allow',
  name: 'Country Allow-list',
  requiredHooks: ['canTransfer'],
  crateName: 'country-allow',
  review: { state: 'under-review', prUrl: PR_651 },
  configFields: [
    {
      key: 'allowedCountries',
      label: 'Allowed Countries',
      type: 'string[]',
      required: false,
      placeholder: 'e.g. CH, SG',
    },
  ],
  deployment: {
    requiresIdentityRegistryStorage: true,
    getConfigurationInvocations(selection) {
      const countriesToAllow = getOptionalNumericCountryCodes(selection, 'allowedCountries');
      return countriesToAllow.length > 0
        ? [
            createModuleInvocation(
              'batch_allow_countries',
              `--token "$RWA_TOKEN_ADDRESS" --countries ${serializeNumericArray(countriesToAllow)}`
            ),
          ]
        : [];
    },
  },
});
