import { useEffect, useState } from 'react';
import { useAppState } from './AppStateContext';
import { hasSessionUnsavedWork } from './selectors';
import { subscribeDraftDirty } from './unsavedChanges';

/** Registers a `beforeunload` guard so the browser asks before discarding
 * work on reload/close. Mounted in `App.tsx` (AppContent) so it survives
 * tab switches. Warns when either:
 *  - the session has article overrides the user actually made (manual
 *    excludes/includes, manual review flags, saved edits) — all session-only
 *    and gone on reload; or
 *  - the open article drawer has an unsaved edit draft (reported through the
 *    `unsavedChanges` bridge, since that state is component-local).
 * Config (mappings, settings, target tables) auto-saves per site, so it's
 * not "lost work" and never triggers the guard. */
export function useUnsavedChangesWarning(): void {
  const { state } = useAppState();
  const [draftDirty, setDraftDirty] = useState(false);

  useEffect(() => subscribeDraftDirty(setDraftDirty), []);

  const sessionDirty = hasSessionUnsavedWork(state);

  useEffect(() => {
    if (!sessionDirty && !draftDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sessionDirty, draftDirty]);
}