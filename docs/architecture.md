# Architecture

Read this first. It is the map the rest of the docs hang off.

## The two pieces

Relay is two pieces that share one origin in production:

```
┌─ src/   the client ─────────────────────────────────────────────────┐
│  Vite + React + TypeScript (strict). The UI *and* the conversion     │
│  engine both run in the browser. Stateless besides localStorage.     │
└──────────────────────────────────────────────────────────────────────┘
┌─ server/   the proxy ────────────────────────────────────────────────┐
│  A tiny zero-dependency Node HTTP server. Exists for exactly one     │
│  thing: fetching the old site on the client's behalf (a browser      │
│  cannot do cross-origin fetches). Never proxies media bytes.         │
└──────────────────────────────────────────────────────────────────────┘
```

Why a server at all: a WXR export often carries incomplete or zero
`wp:attachment_url` entries, so an `<img src>` in post content may have nothing
in the export to match against. Recovering that requires fetching the old site,
which a browser cannot do cross-origin. The proxy covers exactly that gap — and
the "fetch from site" import path and image health checks reuse it.

## Code layout rules

Three rules make the codebase traceable; everything else follows from them.

1. **`src/core/` is the engine and knows nothing about React.** No component,
   state, or UI imports. Data in, data out. `src/core/media/mediaClient.ts` is
   the single exception that touches the network, and it takes a `fetch`-like
   function as a parameter rather than reaching for a global — so every other
   core module stays pure and testable with a stub.
2. **`src/features/<tab>/` mirrors the UI one-to-one.** Five tabs, five
   folders, same names. "Where is the Mappings screen?" has exactly one answer.
3. **One exported component per file, named after the file.** No barrel files
   that hide origins. A file passing ~200 lines is a signal to split.

```
Relay/
├─ README.md            quick start + doc index
├─ Dockerfile           multi-stage single-container build
├─ bitbucket-pipelines.yml
├─ server/              ── the only non-client code ──
│  ├─ src/index.ts         HTTP entry point: 3 API routes + SPA static serving
│  ├─ src/fetchPageMedia.ts  fetch a URL → og:image + <img src> + file links
│  ├─ src/checkImage.ts      HEAD/GET one image URL → { ok, status, reason }
│  ├─ src/fetchUrl.ts        raw passthrough of an old-site body (16MB cap)
│  ├─ src/guard.ts           SSRF mitigation (resolved-IP private check)
│  ├─ src/rawRequest.ts      shared low-level HTTP fetch (timeout, size cap)
│  └─ src/cache.ts           in-memory, TTL'd, per-URL
└─ src/
   ├─ main.tsx
   ├─ App.tsx            shell only: header, tab switch, image-health hook
   ├─ types/domain.ts    the domain model shared by core, state and UI
   ├─ core/                        ── engine, zero React ──
   │  ├─ wxr/            parseWxr · generateWxr · xml (escaping/CDATA)
   │  ├─ site/           fetchSite (REST→RSS fallback) · probeSite · mapToParseResult
   │  │                  fetchRestPosts/Taxonomies/Media · fetchFeedPosts · cleanSiteContent
   │  ├─ builders/       detectBuilder · types (BuilderReader) · index (registry)
   │  │                  plainHtml/ · wpbakery/ · elementor/ · divi/ · shortcode/tokenize
   │  ├─ ir/             nodes.ts        ← the contract every reader produces
   │  ├─ gutenberg/      writeBlocks.ts  ← the ONLY place Settings apply
   │  │                  blocks/  paragraph heading list quote image gallery
   │  │                           button file video separator spacer columns table raw
   │  ├─ media/          resolveMedia (attachment index first, live fallback)
   │  │                  mediaClient (the only file that talks to the proxy)
   │  │                  attachmentIndex · verifyImages · resolveFeaturedImage …
   │  ├─ mappings/       suggestTerms · similarity · applyMappings · reconcileOldTables
   │  ├─ build/          runBuild · collectMediaRefs · resolveTerms
   │  └─ utils/          concurrencyLimit · decodeHtmlEntities
   ├─ state/            AppStateContext · reducer · actions · selectors · session
   ├─ features/
   │  ├─ import/        ImportTab · useImageHealthCheck · sampleWxr
   │  ├─ mappings/      MappingsTab
   │  ├─ settings/      SettingsTab
   │  ├─ articles/      ArticlesTab · ArticleDrawer · ArticlePreviewPane
   │  │                 ArticleSidebar · useArticleDraft · useScrollManagement …
   │  └─ build/         BuildTab
   ├─ ui/               Header · Modal · Badge
   └─ theme/            tokens · index.css
```

Tests sit beside their source as `*.test.ts(x)`. See `docs/testing.md`.

## State model

State lives in one reducer (`src/state/`) and is normalized — no store library.
The shape is in `src/state/types.ts`:

```
AppState
├─ ui:        activeTab, selectedArticleId, previewMode, modals, pickers
├─ source:    ParseResult | null       // parsed export / live fetch
├─ target:    new-site taxonomies (pasted JSON or typed)
├─ oldTables: old-site term tables from the source
├─ mappings:  Record<oldTermId, TermMapping>   // origin: 'suggested' | 'user'
├─ settings:  ConversionSettings
├─ articles:  Record<articleId, ArticleOverride>  // { excluded, editedHtml, manualReview }
├─ media:     { resolved: Record<srcUrl, MediaResolution>, probing: string[] }
├─ build:     { running, progress, log, cancelled, done, error, report, history }
├─ builderId / builderConfidence:   // detected page builder + match %
```

Derived data is never stored. Article status (`ready` / `review` / `edited` /
`excluded_auto` / `excluded_manual`), counts, and the filtered/sorted visible
list are computed in `selectors.ts` from `source` + `mappings` + `articles`.
Because status is derived, a mapping change instantly reflows every article's
status with no synchronization code to get wrong.

Two deliberate choices:

- **`excluded_auto` is decided once at parse time** — duplicate slug or empty
  content. The reason string is stored on the override. The user can override.
- **`editedHtml` holds converted Gutenberg output, not source markup.** Saving
  the drawer's editor stores Gutenberg. During a build, an article with
  `editedHtml` bypasses the reader/writer entirely and its stored markup is
  emitted as-is — that is what makes "Revert" meaningful (re-run conversion,
  discard the edit).

The session backup (`state/session.ts`) stores *decisions* — mappings, manual
exclusions, edits, resolved media — not derived statuses, which recompute on
restore. The format carries a `version` field.

## Data flow

```
.wxml file ─ parseWxr ─┐
old site   ─ fetchSite ─┴→ source (read-only ParseResult)
                                  ↓
        user actions → reducer → state → selectors → components
                                  ↓
   build: snapshot(source, mappings, settings, articles)
        → detectBuilder → reader → IR → writeBlocks → generateWxr → Blob
```

The Settings preview calls `writeBlocks` on a fixture IR tree — the same
function the build uses — so preview and output cannot disagree.

`media.resolved` memoizes every URL the engine has already accounted for, so a
rebuild, a settings change, or reopening the drawer never re-fetches the old
site. It is part of the session backup.

## The conversion pipeline

1. **Parse / fetch** — `core/wxr/parseWxr.ts` (uploaded file) or
   `core/site/fetchSite.ts` (live REST/RSS). Both produce the same
   `ParseResult` in `types/domain.ts`.
2. **Detect builder** — `core/builders/detectBuilder.ts` scores every reader
   across all posts and picks a winner (WPBakery / Elementor / Divi / Plain
   HTML). The user can override via a select.
3. **Read** — the chosen builder's reader turns each article's content into an
   IR tree (`core/ir/nodes.ts`). Unrecognized markup becomes a `raw` node with
   a note — never silently dropped.
4. **Write** — `core/gutenberg/writeBlocks.ts` turns IR nodes into Gutenberg
   block markup. This is the only module that reads `settings`.
5. **Generate** — `core/wxr/generateWxr.ts` emits a real WXR (channel header,
   `wp:wxr_version 1.2`, category/tag elements from the mappings, one `<item>`
   per article with CDATA-wrapped converted content).

Each of these is covered in depth in `docs/engine.md`.

## Env vars and commands

| Variable | Where | Meaning |
|---|---|---|
| `PORT` | `server/` | Proxy listen port (default `8787` in dev, `8080` in the container) |
| `STATIC_DIR` | `server/` | Directory holding the built SPA (default `dist`) |

Commands are in `README.md`. The `npm run build` script is `tsc -b && vite
build` (the root tsconfig is `noEmit`, so `tsc -b` typechecks only). The server
builds with `tsc -p tsconfig.json` in its own workspace.