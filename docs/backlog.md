# Relay Backlog

Living list of candidate work. Items are unordered; pick what you want and move each into a dated plan under `docs/superpowers/plans/` when started.

## Local storage / session

- [ ] **Autosave polish** — prompt/UI to restore the saved session, a way to clear it, and an "autosaved at HH:MM" indicator. (Autosave itself already exists: `src/state/session.ts` `saveToLocalStorage` — debounced 500 ms — plus restore-on-mount in `src/state/AppStateContext.tsx`, covering mappings, tables, settings, article overrides, media resolutions.)
- [ ] **Scope the localStorage backup to the source** — key by WXR filename / fetch URL + date so loading a different import doesn't resurrect the previous import's stale mappings/tables.
- [ ] **Persist UI prefs** — active tab, article sort/filter, panel widths — in localStorage.

## Editing / safety

- [ ] **Undo/redo** for article edits and term mappings (history stack in the reducer).
- [ ] **`beforeunload` "unsaved changes" warning** when the drawer/session has dirty edits.
- [ ] **Batch article actions** — exclude/include selected, mark all reviewed, reset auto-exclusions.
- [ ] **Keyboard shortcuts** — save, prev/next article, toggle include, start build.

## Import / fetch

- [ ] **Resume interrupted live-site fetches** — persist page/offset in the backup so a reload can continue.
- [ ] **Duplicate-detection on re-import** — warn when a postId already exists in state.
- [ ] **Import summary report** — per-category mapped/dropped counts plus dropped-term list, exportable as text/CSV.

## Articles / UI

- [ ] **Bypass the duplicate-slug constraint** — the reducer auto-excludes articles sharing a slug at load (`reducer.ts` LOAD_SOURCE). The user may manually re-include one, but `generateWxr.ts:81` emits `wp:post_name` verbatim, so two included articles with the same slug would produce an invalid WXR. Fix: dedupe/sanitize `wp:post_name` at export (e.g. WordPress-style `-2`, `-3` suffixing) whenever a manually re-included article collides.
- [ ] **Edit the preview panel in the rendered Gutenberg view** — replace the raw-HTML `<textarea>` in `ArticlePreviewPane.tsx` (Edit mode, line ~263) with direct contenteditable/block editing on the "After" preview that writes back to the article draft.
- [ ] **Pagination or windowed list** for the Articles tab when the source has thousands of posts.
- [ ] **Accessibility pass** on the article drawer + import flow (focus trap, aria labels, focus after open/close).
- [ ] **Dark mode** theme.

## Server

- [ ] **Structured request/error logging + `/health` endpoint** so proxy failures are diagnosable.