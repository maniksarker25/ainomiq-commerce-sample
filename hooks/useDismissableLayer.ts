'use client';

import { useEffect, useRef, type RefObject } from 'react';

type DismissableTarget = RefObject<Element | null> | (() => Element | null | undefined);

function resolveTarget(target: DismissableTarget) {
  return typeof target === 'function' ? target() : target.current;
}

export function useDismissableLayer(
  open: boolean,
  onDismiss: () => void,
  targets: DismissableTarget[],
) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open) return;

    function isInsideLayer(event: Event) {
      const target = event.target;
      if (!(target instanceof Node)) return false;
      return targets.some(item => {
        const node = resolveTarget(item);
        return Boolean(node && node.contains(target));
      });
    }

    function closeOnOutsidePointer(event: Event) {
      if (isInsideLayer(event)) return;
      onDismissRef.current();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismissRef.current();
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, targets]);
}
