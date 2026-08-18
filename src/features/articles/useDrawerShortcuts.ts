import { useEffect } from 'react';

export interface UseDrawerShortcutsArgs {
  enabled: boolean;
  isDirty: boolean;
  onSave: () => void;
  onToggleInclude: () => void;
  onToggleManualReview: () => void;
  onClose: () => void;
}

/** Extra drawer keyboard shortcuts on top of the arrow-key navigation the
 * navigation guard already wires up:
 *   Ctrl/Cmd+S — save the current draft (only when dirty)
 *   I          — toggle include/exclude
 *   R          — toggle the manual-review flag
 *   Escape     — close the drawer (goes through the dirty guard)
 * Editable fields are skipped so typing in the HTML editor isn't hijacked. */
export function useDrawerShortcuts({
  enabled,
  isDirty,
  onSave,
  onToggleInclude,
  onToggleManualReview,
  onClose,
}: UseDrawerShortcutsArgs): void {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const tag = active?.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (isEditable && !(e.ctrlKey || e.metaKey)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (isDirty) onSave();
        return;
      }
      if (isEditable) return;
      const key = e.key.toLowerCase();
      if (key === 'i') onToggleInclude();
      else if (key === 'r') onToggleManualReview();
      else if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, isDirty, onSave, onToggleInclude, onToggleManualReview, onClose]);
}