import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OPENZEPPELIN_X_URL, RWA_WIZARD_GITHUB_URL, SidebarNavIcons } from '../SidebarNavIcons';

describe('SidebarNavIcons', () => {
  it('links to the RWA Wizard GitHub repo and OpenZeppelin on X in new tabs', () => {
    render(<SidebarNavIcons />);

    const github = screen.getByRole('link', { name: 'View on GitHub' });
    expect(github).toHaveAttribute('href', RWA_WIZARD_GITHUB_URL);
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noopener noreferrer');

    const x = screen.getByRole('link', { name: 'Follow on X' });
    expect(x).toHaveAttribute('href', OPENZEPPELIN_X_URL);
    expect(x).toHaveAttribute('target', '_blank');
    expect(x).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
