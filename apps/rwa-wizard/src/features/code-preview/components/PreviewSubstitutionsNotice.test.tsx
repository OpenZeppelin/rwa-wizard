import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PreviewSubstitutionsNotice } from './PreviewSubstitutionsNotice';

describe('PreviewSubstitutionsNotice (INV-2)', () => {
  it('lists every substituted key verbatim', () => {
    const keys = ['token.name', 'token.symbol', 'accessControl.ownership.ownerAddress'] as const;

    render(<PreviewSubstitutionsNotice substitutedKeys={keys} />);

    expect(screen.getByText(/Preview placeholders \(not in your draft\):/i)).toBeInTheDocument();
    for (const key of keys) {
      expect(screen.getByText(new RegExp(key.replace(/\./g, '\\.')))).toBeInTheDocument();
    }
    expect(
      screen.getByText(/token\.name, token\.symbol, accessControl\.ownership\.ownerAddress/)
    ).toBeInTheDocument();
  });

  it('renders nothing when substitutedKeys is empty', () => {
    const { container } = render(<PreviewSubstitutionsNotice substitutedKeys={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
