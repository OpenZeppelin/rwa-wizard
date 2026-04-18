import type { ConceptDictionary } from '../types';
import { ADMIN_CONTROLS_COPY } from './admin-controls';
import { COMPLIANCE_HOOKS_COPY } from './compliance-hooks';
import { COMPLIANCE_MODULES_COPY } from './compliance-modules';
import { FIELD_HELPERS_COPY } from './field-helpers';
import { IDENTITY_CONTROLS_COPY } from './identity-controls';
import { NOTICES_COPY } from './notices';
import { OPERATOR_ROLES_COPY } from './operator-roles';
import { OWNERSHIP_MODELS_COPY } from './ownership-models';
import { SECTIONS_COPY } from './sections';
import { TARGETS_COPY } from './targets';
import { VERIFICATION_APPROACHES_COPY } from './verification-approaches';
import { WIZARD_STEPS_COPY } from './wizard-steps';

/**
 * The merged chain-neutral core dictionary. Per-category dictionaries are
 * authored in their own files for editorial ergonomics; consumers see a
 * single flat lookup.
 */
export const CORE_DICT: ConceptDictionary = {
  ...ADMIN_CONTROLS_COPY,
  ...IDENTITY_CONTROLS_COPY,
  ...OPERATOR_ROLES_COPY,
  ...COMPLIANCE_HOOKS_COPY,
  ...COMPLIANCE_MODULES_COPY,
  ...OWNERSHIP_MODELS_COPY,
  ...VERIFICATION_APPROACHES_COPY,
  ...WIZARD_STEPS_COPY,
  ...SECTIONS_COPY,
  ...FIELD_HELPERS_COPY,
  ...NOTICES_COPY,
  ...TARGETS_COPY,
} as const;

export {
  ADMIN_CONTROLS_COPY,
  COMPLIANCE_HOOKS_COPY,
  COMPLIANCE_MODULES_COPY,
  FIELD_HELPERS_COPY,
  IDENTITY_CONTROLS_COPY,
  NOTICES_COPY,
  OPERATOR_ROLES_COPY,
  OWNERSHIP_MODELS_COPY,
  SECTIONS_COPY,
  TARGETS_COPY,
  VERIFICATION_APPROACHES_COPY,
  WIZARD_STEPS_COPY,
};
