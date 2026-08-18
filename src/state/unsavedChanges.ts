type Listener = (dirty: boolean) => void;

let draftDirty = false;
const listeners = new Set<Listener>();

/** The article drawer's unsaved-edit state is component-local
 * (`useArticleDraft.isDirty`), so it can't be read from global state where
 * the `beforeunload` guard lives. This tiny pub/sub is the bridge: the
 * drawer reports its draft dirtiness here, and the guard (mounted in
 * `App.tsx`) subscribes. Kept deliberately state-free — no context, no
 * provider, just a module — because the signal is transient and only one
 * consumer needs it. */
export function reportDraftDirty(dirty: boolean): void {
  if (dirty === draftDirty) return;
  draftDirty = dirty;
  for (const listener of listeners) listener(draftDirty);
}

export function subscribeDraftDirty(listener: Listener): () => void {
  listeners.add(listener);
  listener(draftDirty);
  return () => {
    listeners.delete(listener);
  };
}

export function isDraftDirty(): boolean {
  return draftDirty;
}