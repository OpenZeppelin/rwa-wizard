import { describe, expect, it } from 'vitest';

import { getContractsLibraryRepositoryUrl } from '../src/contracts-library-meta';
import { getCodegenInfoBlurb, STELLAR_SEP_0057_CONTRACT_TYPES_URL } from '../src/codegen-info-blurb';

describe('getCodegenInfoBlurb', () => {
  it('returns title, description, and links including contracts repo and SEP-0057', () => {
    const blurb = getCodegenInfoBlurb();
    expect(blurb.title.length).toBeGreaterThan(0);
    expect(blurb.description).toMatch(/ERC-3643/);
    expect(blurb.links).toHaveLength(2);

    const contractsLink = blurb.links.find((l) => l.href === getContractsLibraryRepositoryUrl());
    expect(contractsLink?.label).toBeTruthy();

    const sepLink = blurb.links.find((l) => l.href === STELLAR_SEP_0057_CONTRACT_TYPES_URL);
    expect(sepLink?.label).toMatch(/SEP-0057/);
  });
});
