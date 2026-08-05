import { useEffect, useRef } from 'react';

/**
 * Minimal accessibility wiring shared by every modal/dialog: Escape closes it,
 * focus moves into the dialog on open, and returns to the trigger on close.
 * Not a full focus trap — Tab still leaves the dialog — but covers the two
 * gaps (no keyboard dismiss, no focus management) present across the app's modals.
 */
export function useDialogA11y<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    containerRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, onClose]);

  return containerRef;
}
