import { describe, expect, it } from 'vitest';

import type { ConfigPath } from '../../wizard/config-path';
import { humaniseConfigPath } from './humaniseConfigPath';

/**
 * Parity coverage for the header's path formatter, mirroring `splitPath`'s.
 *
 * The two are the same kind of unit and are read together in the header: one
 * formats the generated file path, the other the config path, and both keep
 * their last segment whole because it is the segment the reader is looking for.
 *
 * Written by Code Draft rather than left to Tests because the module is new and
 * its sibling already has a file here; Tests owns extending it against INV-41
 * and the copy-ownership boundary.
 */
describe('humaniseConfigPath', () => {
  const at = (path: string) => humaniseConfigPath(path as ConfigPath);

  it('renders a depth-1 path as the field alone, with no dangling separator', () => {
    expect(at('token')).toEqual({ context: '', field: 'Token' });
  });

  it('splits the common two-segment shape', () => {
    expect(at('token.name')).toEqual({ context: 'Token · ', field: 'Name' });
  });

  it('spaces camel case into sentence case rather than title case', () => {
    expect(at('token.initialSupply').field).toBe('Initial supply');
    expect(at('accessControl.ownership').context).toBe('Access control · ');
  });

  it('presents an array index 1-based, as its own segment', () => {
    expect(at('accessControl.roles[0].addresses')).toEqual({
      context: 'Access control · Roles 1 · ',
      field: 'Addresses',
    });
  });

  it('keeps the deepest field whole, however deep the path', () => {
    expect(at('compliance.modules[2].config.maxHolders').field).toBe('Max holders');
  });

  it('treats a trailing index as the field itself', () => {
    expect(at('compliance.modules[1]')).toEqual({ context: 'Compliance · ', field: 'Modules 2' });
  });

  it('is total: degenerate inputs yield a value rather than throwing', () => {
    // Defensive, in the same spirit as `splitPath`'s trailing-slash case. No
    // SF-6 builder produces either shape.
    expect(() => at('')).not.toThrow();
    expect(at('')).toEqual({ context: '', field: '' });
    expect(at('token..name')).toEqual({ context: 'Token · ', field: 'Name' });
  });
});
