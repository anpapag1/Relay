# The React app — `src/features/`, `src/state/`

The frontend is a Vite + React + TypeScript SPA. The engine lives in
`src/core/` (see `docs/engine.md`); the UI mirrors the five tabs one-to-one in
`src/features/`. State is a single normalized reducer in `src/state/` — no
store library.

## State — `src/state/`

- **`AppStateContext.tsx`** — React context + provider. Components read
  `state` and dispatch actions; no prop drilling.
- **`reducer.ts`** — pure reducer over the `AppState` shape in `types.ts`
  (documented in `docs/architecture.md`). The only place state mutates.
- **`actions.ts`** — typed action creators.
- **`selectors.ts`** — all derived data: article statuses, counts, the
  filtered/sorted visible list, mappings. Derived data is never stored, so a
  mapping change instantly reflows every article status.
- **`session.ts`** — the session backup format (export/restore as JSON,
  `version`-tagged) and autosave to `localStorage`.
- **`mappingTransitions.ts`** — helpers for moving mappings between states
  (e.g. when new-site tables change).

The reducer + selectors are unit-tested directly against the engine's output
types; components get light smoke tests.

## The shell — `src/App.tsx`

Renders the header and switches between the five tabs by `state.ui.activeTab`.
It also mounts `useImageHealthCheck` (from `features/import`) at the top level
deliberately: tabs unmount when you switch away, and the health check must
survive navigating away from the Import tab (and run on page reloads that
restore straight into another tab).

## The five tabs

### Import — `src/features/import/`

Three ways in:

1. **WXR file** — drag & drop onto the dropzone; parsed via
   `core/wxr/parseWxr.ts` (see `docs/engine.md`).
2. **Fetch from site** — enter the old site's URL; `core/site/fetchSite.ts`
   probes for WP REST and falls back to RSS, with optional date filtering.
   Uses the proxy's `/api/fetch` route.
3. **Sample export** — loads the bundled WPBakery fixture so the whole pipeline
   can be exercised without a real file.

Also on this tab: the source-domain field (used by media resolution and the
health check), the live-fetch checkbox for media resolution, and the session
backup export/restore. `useImageHealthCheck` (mounted from `App.tsx`) drives
the post-import image health check through the proxy's `/api/image-check` and
writes `verified: 'ok' | 'broken'` onto each `MediaResolution`.

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
- **`useFeaturedImage.ts`** — featured-image resolution for the drawer.
- **`DiscardConfirmDialog.tsx`** — the unsaved-changes modal.

### Build & Export — `src/features/build/`

Preflight summary, run the build (`core/build/runBuild.ts`), watch progress
(server-driven chunking so Cancel stays responsive), review the report, and
download the generated WXR as a Blob. Build history entries record article
count + size (real bytes, since the report holds the actual WXR string).

## Shared UI and theme

- **`src/ui/`** — `Header.tsx` (app header), `Modal.tsx`, `Badge.tsx` (status
  chips). Small, file-per-component.
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
  in state. The session backup stores decisions (mappings, edits, exclusions,
  resolved media), not derived values.