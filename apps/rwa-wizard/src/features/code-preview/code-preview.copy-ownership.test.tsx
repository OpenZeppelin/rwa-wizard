import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type ReactElement } from 'react';

import { coreCopy, type ChainCopy } from '@openzeppelin/rwa-wizard-copy';

import { CodePreviewDrawer } from './components/CodePreviewDrawer';

import { CopyContext } from '../../app/providers/CopyContext';

const FILES = { 'README.md': '# readme', 'src/lib.rs': 'pub fn main() {}' };
const SELECTED = 'src/lib.rs';

/**
 * Every notice resolves to its own id, so a rendered string can be traced back
 * to the dictionary entry it came from — and a string the component wrote
 * itself is visibly not one of them.
 */
function sentinelCopy(): ChainCopy {
  return {
    ...coreCopy,
    notice: (id: string) => ({ id: `notice.${id}`, description: `COPY::${id}` }),
  };
}

function renderDrawer(copy: ChainCopy): ReactElement {
  return (
    <CopyContext.Provider value={copy}>
      <CodePreviewDrawer
        open
        onOpenChange={() => {}}
        height={480}
        onHeightChange={() => {}}
        sheetId="copy-ownership-sheet"
        phase={{
          kind: 'ready',
          files: FILES,
          configHash: 'hash',
          substitutedKeys: [],
          changedPaths: [],
        }}
        selectedPath={SELECTED}
        onSelectedPathChange={() => {}}
        files={FILES}
        changedPaths={[]}
        substitutedKeys={[]}
        errorMessages={undefined}
        sourceRevision={null}
      />
    </CopyContext.Provider>
  );
}

/**
 * Constitution: user-visible strings belong to `@openzeppelin/rwa-wizard-copy`,
 * and an accessible name is user-visible — it is simply the only copy some
 * users ever get. These three were written into the components (two directly,
 * one by leaving `closeLabel` unset so the kit's own default answered), so a
 * copy edit could not reach them. Overriding the dictionary is what
 * distinguishes a routed string from a literal that happens to read the same.
 */
describe('code preview copy ownership', () => {
  it('takes the file tree, source pane and close labels from the dictionary', async () => {
    render(renderDrawer(sentinelCopy()));

    await waitFor(() => {
      expect(screen.getByLabelText('COPY::code-preview.file-tree-label')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('COPY::code-preview.source-label')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'COPY::code-preview.close' }),
      'an unset closeLabel leaves the kit announcing its own default'
    ).toBeInTheDocument();
  });

  it('names the selected file in the source pane label', async () => {
    render(renderDrawer(coreCopy));

    await waitFor(() => {
      expect(screen.getByLabelText(`${SELECTED} source code`)).toBeInTheDocument();
    });
  });
});
