import { useCallback, useState } from 'react';

import {
  readCodePreviewPersistence,
  writeCodePreviewHeight,
  writeCodePreviewOpen,
  writeCodePreviewTreeVisible,
} from '../previewPersistence';

export function useCodePreviewPersistence(): {
  open: boolean;
  height: number;
  treeVisible: boolean;
  setOpen: (open: boolean) => void;
  setHeight: (height: number) => void;
  setTreeVisible: (visible: boolean) => void;
} {
  const [state, setState] = useState(readCodePreviewPersistence);

  const setOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, open }));
    writeCodePreviewOpen(open);
  }, []);

  const setHeight = useCallback((height: number) => {
    setState((prev) => ({ ...prev, height }));
    writeCodePreviewHeight(height);
  }, []);

  const setTreeVisible = useCallback((treeVisible: boolean) => {
    setState((prev) => ({ ...prev, treeVisible }));
    writeCodePreviewTreeVisible(treeVisible);
  }, []);

  return {
    open: state.open,
    height: state.height,
    treeVisible: state.treeVisible,
    setOpen,
    setHeight,
    setTreeVisible,
  };
}
