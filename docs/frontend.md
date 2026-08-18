# The React app — `src/features/`, `src/state/`

The frontend is a Vite + React + TypeScript SPA. The engine lives in
`src/core/` (see `docs/engine.md`); the UI mirrors the five tabs one-to-one in
`src/features/`. State is a single normalized reducer in `src/state/` — no
store library.

## State — `src/state/`

- **`AppStateContext.tsx`** — React context + provider. Components read
  `state` and dispatch actions; no prop drilling. On mount it sweeps the
  legacy `relay_session_backup_v1` key, silently auto-loads the profile for
  the detected domain (via `RESTORE_SESSION`), and auto-saves config-slice
  changes to the current domain's profile (debounced 500 ms). The old
  mount-restore of the global session backup is gone.
- **`reducer.ts`** — pure reducer over the `AppState` shape in `types.ts`
  (documented in `docs/architecture.md`). The only place state mutates.
- **`actions.ts`** — typed action creators.
- **`selectors.ts`** — all derived data: article statuses, counts, the
  filtered/sorted visible list, mappings. Derived data is never stored, so a
  mapping change instantly reflows every article status.
- **`session.ts`** — the portable site-data format (`SiteDataBackup`: taxonomy
  tables, term mappings, conversion settings) with `createSiteDataBackup` /
  `restoreSiteDataBackup`. Used by the Import tab's Export/Import JSON buttons
  and by the per-site profile store.
- **`siteProfiles.ts`** — the per-site auto-save/load store. One record per
  old-site domain under the `relay_site_v1_<domain>` localStorage key, each a
  `SiteProfile` = `{ version, domain, savedAt, data }`. Exports
  `listSiteProfiles`, `loadSiteProfile`, `saveSiteProfile`,
  `deleteSiteProfile`, `renameSiteProfile`, and `domainForState` (which
  resolves the effective domain from `source.siteUrl` first, then
  `ui.sourceDomain`).
- **`mappingTransitions.ts`** — helpers for moving mappings between states
  (e.g. when new-site tables change).
- **`unsavedChanges.ts`** — a tiny pub/sub bridge for the "would a reload
  discard work?" question. Article overrides live in global state (read via
  the `hasSessionUnsavedWork` selector), but the drawer's unsaved edit draft
  is component-local `useArticleDraft` state — the drawer reports it here
  (`reportDraftDirty`) and the guard subscribes (`subscribeDraftDirty`). No
  context or provider; the signal is transient and has one consumer.

The reducer + selectors are unit-tested directly against the engine's output
types; components get light smoke tests.

## The shell — `src/App.tsx`

Renders the header and switches between the five tabs by `state.ui.activeTab`.
It also mounts `useImageHealthCheck` (from `features/import`) and
`useUnsavedChangesWarning` (from `state/`) at the top level deliberately:
tabs unmount when you switch away, and both effects must survive navigating
between tabs (the health check must keep running after leaving Import; the
`beforeunload` guard must stay armed on whichever tab is active).

## The five tabs

### Import — `src/features/import/`

Three ways in:

1. **WXR file** — drag & drop onto the dropzone; parsed via
   `core/wxr/parseWxr.ts` (see `docs/engine.md`).
2. **Fetch from site** — enter the old site's URL; `core/site/fetchSite.ts`
   probes for WP REST and falls back to RSS, with optional date filtering.
   Uses the proxy's `/api/fetch` route. The URL input is a combobox: on
   focus it lists saved-site profiles from `localStorage`
   (`state/siteProfiles.ts`, most recent first), filtered as you type;
   arrow keys navigate, Enter or click picks one (filling the URL), Escape
   closes.
3. **Sample export** — loads the bundled WPBakery fixture so the whole pipeline
   can be exercised without a real file.

Also on this tab: the source-domain field (used by media resolution and the
health check; editable when the import carries no `siteUrl`, and it doubles as
the key the profile store saves under), the live-fetch checkbox for media
resolution, and the portable site-data Export/Import JSON buttons (taxonomy
tables, term mappings, conversion settings — reusable across a different WXR
import). `useImageHealthCheck` (mounted from `App.tsx`) drives the post-import
image health check through the proxy's `/api/image-check` and writes
`verified: 'ok' | 'broken'` onto each `MediaResolution`.

### Mappings — `src/features/mappings/`

The old-site term tables vs. the new-site taxonomies. Suggestions come from
`core/mappings/suggestTerms.ts` and render with their confidence score;
accepting / changing / clearing one marks the mapping `user`-owned so it is
never overwritten by recomputation. New-site tables can be typed in or pasted
as JSON (there is no new-site sync — the app handles no credentials).

### Settings — `src/features/settings/`

Edit `ConversionSettings` (`src/types/domain.ts`). The preview pane runs
`core/gutenberg/writeBlocks.ts` on a fixture IR tree — the same function the
build uses — so what you see is what exports.

### Articles — `src/features/articles/`

- **`ArticlesTab.tsx`** — filter/sort the derived list (status, media count,
  warnings), open articles, exclude / flag for review.
- **`ArticleDrawer.tsx`** — the review drawer. Three preview modes in
  `state.ui.previewMode`: **before** (original content), **after** (converted
  Gutenberg), **edit** (an editable view of the Gutenberg, saved to
  `editedHtml`). Saving an edit means the build emits that stored markup
  verbatim; "Revert" re-runs the conversion.
- **`ArticlePreviewPane.tsx`** — the rendered preview (styled to match the old
  site's WordPress look via `.wp-preview` rules in `src/theme/index.css`).
  Navigation pills (Previous / Next) sit in the drawer's top bar; scroll
  position resets automatically when the article changes
  (`useScrollManagement.ts`).
- **`useArticleDraft.ts`** — edit-buffer handling for the drawer.
- **`useDrawerNavigationGuard.ts`** — confirm before discarding unsaved edits.
- **`useDrawerShortcuts.ts`** — drawer keyboard shortcuts on top of the
  arrow-key navigation the guard already wires: `Ctrl/Cmd+S` save (when
  dirty), `I` toggle include, `R` toggle review, `Escape` close. Editable
  fields are skipped so typing in the HTML editor isn't hijacked.
- **`ArticleSidebar.tsx`** — article metadata, include/flag toggles, and a
  save/close footer. An "Edit article" button in the metadata panel switches
  the preview to Edit mode.
- **`useFeaturedImage.ts`** — featured-image resolution for the drawer.
- **`DiscardConfirmDialog.tsx`** — the unsaved-changes modal.

### Build & Export — `src/features/build/`

Preflight summary, run the build (`core/build/runBuild.ts`), watch progress
(server-driven chunking so Cancel stays responsive), review the report, and
download the generated WXR as a Blob. Build history entries record article
count + size (real bytes, since the report holds the actual WXR string).

### Saved sites drawer — `src/features/sites/`

Every site's taxonomies, mappings, and settings auto-save by domain. The
header shows the detected domain (or "Sites" before one is known) as a pill
that opens `SitesDrawer.tsx`: search through saved profiles, edit a profile's
domain, export it as JSON, import a saved-site file, or delete a profile.
There's no Load action — profiles restore silently when an import for their
domain is detected.

## Shared UI and theme

- **`src/ui/`** — `Header.tsx` (app header, including the detected-domain pill
  that opens the saved-sites drawer), `Modal.tsx`, `Badge.tsx` (status chips).
  Small, file-per-component.
- **`src/theme/`** — `tokens.ts` (frozen design values), `index.css` (the
  `.wp-preview` styles that make converted content look like a real WordPress
  post), `index.ts` (import side effects).

## Cross-cutting patterns

- **Never-throw client network calls.** `mediaClient.ts` and the site
  fetchers return typed `{ ok: true, … } | { ok: false, reason }` results
  instead of throwing, so callers distinguish "proxy refused this URL" (400)
  from "old site unreachable" (502/504) without try/catch everywhere.
- **Injected fetch.** Every module that needs the network takes a `fetch`-like
  function as a parameter; components pass the real one, tests pass stubs. This
  is what keeps `core/` pure.
- **Derived, not stored.** Article statuses and counts live in selectors, never
  in state. The per-site profile keeps the decisions (mappings, tables,
  settings) that survive reload; article edits and resolved media are
  session-only and rebuild on demand.
- **Reload guard.** `useUnsavedChangesWarning` (mounted in `App.tsx`) arms a
  `beforeunload` handler whenever a reload would discard real work: a manual
  article override (exclude/include, review flag, saved edit) via the
  `hasSessionUnsavedWork` selector, or an unsaved drawer draft via the
  `unsavedChanges` bridge. Auto-exclusions are recomputed on load and never
  trigger it.
