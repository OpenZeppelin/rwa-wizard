import { useCallback, useState } from 'react';

import type { CodePreviewDockPosition } from '../dockPosition';
import {
  readCodePreviewPersistence,
  writeCodePreviewDock,
  writeCodePreviewHeight,
  writeCodePreviewOpen,
  writeCodePreviewTreeVisible,
  writeCodePreviewWidth,
} from '../previewPersistence';

export function useCodePreviewPersistence(): {
  open: boolean;
  height: number;
  width: number;
  treeVisible: boolean;
  dockPosition: CodePreviewDockPosition;
  setOpen: (open: boolean) => void;
  setHeight: (height: number) => void;
  setWidth: (width: number) => void;
  setTreeVisible: (visible: boolean) => void;
  setDockPosition: (dockPosition: CodePreviewDockPosition) => void;
} {
  const [state, setState] = useState(readCodePreviewPersistence);

  const setOpen = useCallback((open: boolean) => {
    setState((prev) => {
      if (prev.open === open) {
        return prev;
      }
      writeCodePreviewOpen(open);
      return { ...prev, open };
    });
  }, []);

  const setHeight = useCallback((height: number) => {
    setState((prev) => ({ ...prev, height }));
    writeCodePreviewHeight(height);
  }, []);

  const setWidth = useCallback((width: number) => {
    setState((prev) => ({ ...prev, width }));
    writeCodePreviewWidth(width);
  }, []);

  const setTreeVisible = useCallback((treeVisible: boolean) => {
    setState((prev) => ({ ...prev, treeVisible }));
    writeCodePreviewTreeVisible(treeVisible);
  }, []);

  const setDockPosition = useCallback((dockPosition: CodePreviewDockPosition) => {
    setState((prev) => ({ ...prev, dockPosition }));
    writeCodePreviewDock(dockPosition);
  }, []);

  return {
    open: state.open,
    height: state.height,
    width: state.width,
    treeVisible: state.treeVisible,
    dockPosition: state.dockPosition,
    setOpen,
    setHeight,
    setWidth,
    setTreeVisible,
    setDockPosition,
  };
}
