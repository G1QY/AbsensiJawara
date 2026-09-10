import { useEffect, useRef } from 'react';
import { registerModal } from './modalHistory';

export function useModalHistory(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let release: (() => void) | undefined;
    // StrictMode mounts effects twice. Register only the surviving effect.
    queueMicrotask(() => {
      if (!cancelled) release = registerModal(() => close.current());
    });
    return () => { cancelled = true; release?.(); };
  }, [open]);
}
