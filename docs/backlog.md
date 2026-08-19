# Relay Backlog

## Local storage / session

- [x] **Scope the localStorage backup to the source** — done via per-site profiles: one record per old-site domain (`relay_site_v1_<domain>`), auto-loaded silently and auto-saved (debounced 500 ms). Loading a different import no longer resurrects the previous import's stale mappings/tables.

## Editing / safety

- [x] **`beforeunload` "unsaved changes" warning** when the drawer/session has dirty edits. Done: `useUnsavedChangesWarning` (mounted in `App.tsx`) arms a `beforeunload` handler while the session holds manual article work (`hasSessionUnsavedWork` selector — excludes/includes, review flags, saved edits) or the drawer has an unsaved draft (reported via the `unsavedChanges.ts` pub/sub bridge). Auto-exclusions recompute on load and don't trigger it.
- [ ] **Batch article actions** — exclude/include selected, mark all reviewed, reset auto-exclusions.
- [x] **Keyboard shortcuts** — save, toggle include, toggle reviewed, next/prev article, etc. Done: arrow-key prev/next already existed (drawer guard); added `Ctrl/Cmd+S` save (when dirty), `I` toggle include, `R` toggle review, `Escape` close via `useDrawerShortcuts`, skipping editable fields so typing in the HTML editor is untouched.

## Articles / UI

- [x] **Bypass the duplicate-slug constraint** — the reducer auto-excludes articles sharing a slug at load (`reducer.ts` LOAD_SOURCE). The user may manually re-include one, but `generateWxr.ts:81` emits `wp:post_name` verbatim, so two included articles with the same slug would produce an invalid WXR. Done: `generateWxr` now dedupes `wp:post_name` at export — first article keeps the slug, later collisions get WordPress-style `-2`/`-3` suffixes, skipping suffixes already taken by a natural slug.
- [ ] **Edit the preview panel in the rendered Gutenberg view** — simple direct editing of the "After" preview, with changes written back to the article draft. This would include simple inline editing of headings, paragraphs, lists, and deleting empty paragraphs besides the existing 'Edit' mode textarea. The current implementation uses a raw `<textarea>` for the "After" preview, which is not ideal for user experience. The goal is to allow users to edit the content directly in the rendered view, making it more intuitive and efficient.
- [x] **Add edit button on article metadata** — done: an "Edit metadata" button in the metadata panel of the article sidebar turns the title and published-date fields into inline inputs; saving stores `title`/`postDate` overrides used by the build and derived articles. (Scope decision: author stays fixed at `migration` in exports.)
- [ ] **Pagination or windowed list** for the Articles tab when the source has thousands of posts.
- [x] **Clear text input button** — add a clear button to the search input in the Articles tab. Done: an inline `×` button appears inside the search field when it has text; clicking it empties the query.
- [ ] **Dark mode** theme.

## Server

- [x] **Structured request/error logging + `/health` endpoint** — every request logs a JSON line to stdout (`{ts, level, event, method, path, status, durationMs}`); upstream failures add a `proxy_failed` warn with `route`/`target`/`status`/`reason`; unexpected handler throws become `handler_error` errors + JSON 500. `GET /health` returns `{status: 'ok', uptime}` for the container HEALTHCHECK.

## Fix

- [x] **Fix edit metadata button** — done: the metadata panel's "Edit article" button now edits the article's metadata (title + published date) inline instead of switching the preview to Edit mode. `UPDATE_ARTICLE_METADATA` stores the overrides; `runBuild`'s `toExportArticle` and the derived articles both honour them. Scope decision: author editing was left out — the export attributes every post to the fixed `migration` author (see `runBuild.ts`), so editing it would have had no effect on the WXR.