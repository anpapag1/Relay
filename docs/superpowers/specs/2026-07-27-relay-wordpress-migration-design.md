# Relay — WordPress Migration Tool — Design Spec

> **Note:** plan mode restricts writes to this file. On approval, the first implementation
> step is to copy this spec to `docs/superpowers/specs/2026-07-27-relay-wordpress-migration-design.md`,
> `git init` the project at `C:\Projects\Relay`, and commit it.

**Date:** 2026-07-27

---

## 1. Context

`Relay.dc.html` (1,507 lines) and `support.js` were imported from the Claude Design project
*WordPress content migration tool*. The `.dc.html` is a declarative template (`{{ }}` bindings,
`sc-if` / `sc-for`) plus a 641-line logic script, rendered by the `dc-runtime` in `support.js`.

It is a complete, high-fidelity UX spec for a five-tab workflow —
**Import → Mappings → Settings → Articles → Build & Export** — but its core is simulated:

| Prototype behaviour | Reality |
|---|---|
| `beginImport()` | 1.1 s timer, loads 8 hard-coded `SAMPLE_ARTICLES` / 3 `SAMPLE_TAXONOMIES`. No file is read. |
| Builder detection | Hard-coded `builderConfidence: 87`. |
| `startBuild()` | 350 ms `setInterval` logging fabricated lines. |
| `downloadFile()` | Emits the literal string `<!-- Mock WXR export -->`. |
| Settings "After" preview | Hand-drawn approximation (`afterPreviewParts()`), unrelated to any real transform. |

Already genuine in the prototype: taxonomy mapping UI, conversion settings, article
filter/sort/edit, session backup export/restore, all modals and the article drawer.

**Goal:** a real, runnable tool at `C:\Projects\Relay` that reproduces the design's UI faithfully
and replaces every simulated part with a working engine — real WXR parsing, real page-builder
detection, real markup → Gutenberg conversion driven by the Settings, and real WXR generation.

This project is the generalized successor to `C:\Projects\__Scripts\wp-migration-tool`, a working
but single-purpose tool hardwired to one specific migration (dad.gr → cityportal-dad, WPBakery
only, a hand-curated 77-category seed table, hardcoded taxonomy domain names). Relay exists so the
same company can run *any* future WordPress-to-Gutenberg migration regardless of which page
builder the old site used. The reference tool is read-only source material, never edited.

The UI and the conversion engine are client-side. One capability cannot be: resolving media that
the export does not describe. A WXR file often carries incomplete `wp:attachment_url` entries —
some exports contain no attachment items at all — so an `<img src>` in post content may have
nothing in the export to match against. Recovering those requires fetching the old site
cross-origin, which a browser cannot do. A **minimal proxy server** covers exactly that gap and
nothing else (§5.7).

## 2. Decisions

| Decision | Value | Rationale |
|---|---|---|
| Audience | Reusable in-house tool | Handles varied exports gracefully with clear reporting; not hardened for arbitrary public users. |
| Stack | Vite + React + TypeScript (strict), plus a minimal Node proxy | The UI and engine are client-side; a thin server exists solely to fetch old-site media cross-origin. |
| Builders | All four convert | WPBakery, Elementor, Divi, Plain HTML. |
| Coverage depth | Common elements + logged fallback | Unrecognised markup preserved as `raw` and reported, never silently dropped. |
| Scale | Up to a few hundred posts | Main-thread chunked parse, in-memory state, `localStorage` autosave. No worker, no IndexedDB. |
| New-site sync | **Dropped** | WP REST from a browser needs CORS on the target. New-site taxonomies come from pasted JSON. **The app handles no credentials at all.** |
| Old-site media | **Live fetch via proxy, as a fallback** | Many WXR exports carry incomplete or zero `wp:attachment_url` items, leaving nothing to match against. Attachment matching is tried first; a live fetch fills the gaps. |
| Term suggestions | Generic name similarity | Dice coefficient over old vs. new term names, above a threshold. No per-site mapping tables. |
| Engine shape | Reader → IR → Writer | Settings logic exists once; preview shares the writer; new builders are additive. |
| Theme props | Frozen at defaults | `#4F46E5` / `comfortable` / `soft`. They were design-tool knobs, not product features. |
| State | `useReducer` + context, normalized | No extra dependency; normalization removes the deep-update pain that motivates a store library. |

## 3. Structure

Three rules make the codebase traceable; everything else follows from them.

1. **`core/` is the engine and knows nothing about React.** No component, state, or UI imports.
   Data in, data out. An ESLint boundary rule fails the build if this is violated.
   `core/media/mediaClient.ts` is the single exception that touches the network, and it takes a
   `fetch`-like function as a parameter rather than reaching for a global — so every other core
   module stays pure, and media resolution is testable with a stub.
2. **`features/<tab>/` mirrors the UI one-to-one.** Five tabs, five folders, same names.
   "Where is the Mappings screen?" has exactly one answer.
3. **One exported component per file, named after the file.** No barrel files that hide origins.
   A file passing ~200 lines is a signal to split.

```
Relay/
├─ design/              Relay.dc.html, support.js   (imported spec, read-only reference)
├─ docs/                architecture.md · adding-a-builder.md · media-proxy.md
│                       superpowers/specs/2026-07-27-relay-wordpress-migration-design.md
├─ server/              ── the only non-client code ──
│  ├─ index.ts          Node HTTP server (~100 lines), one route
│  ├─ fetchPageMedia.ts fetch a URL, return og:image + <img src> + file links
│  ├─ guard.ts          host allowlist, private-IP denial, size/time caps
│  └─ cache.ts          in-memory, TTL'd, so a rebuild doesn't re-hit the old site
└─ src/
   ├─ main.tsx
   ├─ App.tsx           shell only: header, tab switch, modals
   │
   ├─ core/                        ── engine, zero React ──
   │  ├─ wxr/           parseWxr · readItem · generateWxr · xml
   │  ├─ builders/      detectBuilder · types (BuilderReader) · index (registry)
   │  │                 plainHtml/ · wpbakery/ · elementor/ · divi/
   │  ├─ ir/            nodes.ts   ← the contract every reader produces
   │  ├─ gutenberg/     writeBlocks.ts  ← the ONLY place Settings apply
   │  │                 blocks/  paragraph · heading · list · quote · image · gallery
   │  │                          button · file · video · separator · spacer · columns · raw
   │  ├─ shortcode/     tokenize.ts
   │  ├─ media/         resolveMedia.ts   ← attachment index first, proxy fallback
   │  │                 mediaClient.ts    ← the only file that talks to the proxy
   │  ├─ mappings/      applyMappings.ts · suggestTerms.ts · similarity.ts
   │  └─ build/         runBuild.ts
   │
   ├─ state/            AppStateContext · reducer · actions · selectors · session
   │
   ├─ features/
   │  ├─ import/        ImportTab · Dropzone · ImportSummaryCards · SiteDataPanel · TermTableEditor
   │  │                 (SiteDataPanel keeps the design's Old/New tabs and its JSON
   │  │                  export/paste-restore; the sync mode and its credential fields
   │  │                  are removed entirely)
   │  ├─ mappings/      MappingsTab · TaxonomyCard · TermRow · DestinationPicker
   │  │                 (TermRow renders the suggested destination and its confidence;
   │  │                  accepting, changing or clearing it marks the mapping user-owned)
   │  ├─ settings/      SettingsTab · ConversionControls · ConversionPreview
   │  ├─ articles/      ArticlesTab · ArticleFilters · ArticleTable · ArticleDrawer
   │  └─ build/         BuildTab · PreflightSummary · ProblemCheck · BuildRunner · BuildReport · BuildHistory
   │
   ├─ ui/               Button · Card · Modal · Toggle · Select · Chip · StatusBadge · AppHeader · TabBar
   ├─ theme/            tokens.ts (frozen design values) · styles.ts (shared recipes)
   └─ types/            domain.ts
```

Tests sit beside their source as `*.test.ts`; fixtures in `tests/fixtures/`.
`docs/architecture.md` is the map read first.

## 4. State and data flow

```ts
interface AppState {
  ui:       { activeTab, selectedArticleId, previewMode, modals, pickers }
  source:   ParseResult | null        // parsed export — written once, then read-only
  target:   { tables: Record<TableId, TermTable> }   // new-site taxonomies (pasted JSON / typed)
  mappings: Record<TermId, TermMapping>              // each carries origin: 'suggested' | 'user'
  settings: Settings
  articles: Record<ArticleId, ArticleOverride>       // { excluded, reason, editedHtml }
  media:    { resolved: Record<SrcUrl, MediaResolution>, probing: SrcUrl[] }
  build:    { running, progress, log, cancelled, done, report, history }
}
```

`media.resolved` memoises every URL the engine has already accounted for — whether matched in the
export or recovered through the proxy — so a rebuild, a settings change, or reopening the drawer
never re-fetches the old site. It is part of the session backup.

**Derived data is never stored.** Article status, ready/review/excluded counts, every filter
chip's number, and the filtered-sorted visible list are computed in `selectors.ts` from
`source` + `mappings` + `articles`. The prototype stores status as a literal, which is why
excluding a taxonomy term there changes nothing. Deriving it means a mapping change instantly
reflows every article's status with no synchronisation code to get wrong.

Status values: `ready` · `review` (unresolved media or a term with no mapping) ·
`edited` (has `editedHtml`) · `excluded_auto` · `excluded_manual`.

Two points the design leaves implicit, made explicit here:

- **`excluded_auto` is decided once, at parse time** — a slug that duplicates an earlier item, or
  content that is empty after stripping tags and whitespace. The reason string is stored on the
  override so the Articles tab and build report can show it. The user can override it by hand.
- **`editedHtml` holds converted Gutenberg output, not source markup.** Opening an article in the
  drawer runs the conversion for that one article and shows the result; saving stores the edited
  Gutenberg. During a build, an article with `editedHtml` bypasses reader and writer entirely and
  its stored markup is emitted as-is — which is what makes the design's "Revert" meaningful
  (re-run the conversion, discard the edit).

**Consequence, deliberate:** the session backup cannot round-trip `status`/`statusReason` the way
the design does. It stores *decisions* — manual exclusions and edits — and statuses recompute on
restore. Restoring a stale status after a mapping change would be a bug. The format carries a
`version` field.

Data flows one way:

```
.xml file → parseWxr → source (read-only)
                          ↓
   user actions → reducer → state → selectors → components
                          ↓
   build: snapshot(source, mappings, settings, articles)
        → detectBuilder → reader → IR → writeBlocks → generateWxr → Blob
```

`ConversionPreview` calls `writeBlocks` on a fixture IR tree — the same function the build uses —
so preview and output cannot disagree.

## 5. The engine

### 5.1 Parsing — `core/wxr/`

`DOMParser` over the uploaded text as `application/xml`. Namespaced tags (`wp:post_type`,
`content:encoded`) are read by literal tag name through a `childText(el, name)` helper;
namespace-aware lookup is unreliable across browsers here.

- `<item>` with `wp:post_type` of `post`/`page` → article: `title`, `link`, `wp:post_date`,
  `wp:status`, `wp:post_name`, `content:encoded`, `excerpt:encoded`, `wp:postmeta` entries.
- `wp:post_type` of `attachment` → media index entry from `wp:attachment_url`.
- Taxonomies from `wp:category` / `wp:tag` / `wp:term` blocks, falling back to the union of
  `<category domain=… nicename=…>` across items.
- Domain from `wp:base_site_url`; counts by `wp:status` feed the design's stat cards.

Parsing yields to the event loop every N items so the design's existing
"Reading {{fileName}}…" state shows real progress.

### 5.2 Detection — `core/builders/detectBuilder.ts`

Runs every registered reader's `detect` across all posts, returns the winner and its score as
the real "% match" the header shows (replacing the hard-coded 87). Signals: `[vc_row`/`[vc_column`
→ WPBakery; `_elementor_data` postmeta or `data-elementor-type` → Elementor; `[et_pb_` → Divi;
otherwise Plain HTML. The user can still override via the existing select.

### 5.3 The IR — `core/ir/nodes.ts`

```ts
export type IRNode =
  | { kind: 'paragraph';  html: string }
  | { kind: 'heading';    level: 1|2|3|4|5|6; html: string }
  | { kind: 'list';       ordered: boolean; items: string[] }
  | { kind: 'quote';      html: string; cite?: string }
  | { kind: 'image';      src: string; alt: string; caption?: string; href?: string;
                          width?: number; height?: number }
  | { kind: 'gallery';    images: ImageRef[] }
  | { kind: 'button';     text: string; href: string }
  | { kind: 'file';       href: string; fileName: string; isPdf: boolean }
  | { kind: 'video';      src: string; provider: 'youtube' | 'vimeo' | 'file' }
  | { kind: 'separator' }
  | { kind: 'spacer';     height: number }
  | { kind: 'columns';    columns: IRNode[][] }
  | { kind: 'raw';        html: string; note: string }
```

`raw` always carries a `note` ("unknown widget: `testimonial-carousel`") which surfaces as a
warning on that article.

### 5.4 Readers — `core/builders/`

```ts
export interface BuilderReader {
  id: BuilderId;
  detect(input: DetectInput): number;   // 0..1
  read(input: ReadInput): { nodes: IRNode[]; warnings: string[] };
}
```

`index.ts` is the id → reader registry. Adding a builder is a new folder plus one registry line;
that is the whole of `docs/adding-a-builder.md`.

- **plainHtml** — baseline, and the tail the other three delegate to for inner content.
  `<p>`, `<h1–6>`, `<figure>/<img>`, `<ul>/<ol>`, `<blockquote>`, `<hr>`, plus classic
  `[gallery]` / `[caption]` shortcodes.
- **wpbakery** — shortcode tree via `tokenize.ts`. `[vc_row]`/`[vc_column]` → `columns`;
  `[vc_column_text]` delegates to plainHtml; `[vc_single_image]`, `[vc_gallery]`, `[vc_btn]`,
  `[vc_video]`, `[vc_separator]`, `[vc_empty_space]`.
- **divi** — same tokenizer: `[et_pb_section|row|column]` → `columns`; `[et_pb_text]` delegates;
  `[et_pb_image|gallery|button|video|divider]`. Percent-encoded attribute values are decoded.
- **elementor** — JSON tree in `_elementor_data` postmeta. Recurse `elType: section|column|widget`;
  dispatch widgets by `widgetType` (`text-editor`, `heading`, `image`, `image-gallery`, `button`,
  `video`, `divider`, `spacer`). Missing postmeta falls back to plainHtml on rendered content.

### 5.5 Writer — `core/gutenberg/`

`writeBlocks(nodes, settings)`, one `blocks/<kind>.ts` per node kind. **The only place Settings
are read:**

| Setting | Effect |
|---|---|
| `imageSize` / `customWidth` / `customHeight` | `sizeSlug`, or explicit width+height — set one, the other scales proportionally |
| `imageAlign` | block `align` attribute |
| `autoSpacing` + `spacerSize` | `wp:spacer` blocks around floated images |
| `galleryCols` | `wp:gallery {"columns":N}` |
| `pdfRender` / `buttonRender` | `wp:file` / `wp:buttons` as link, button, or embed |
| `headingShift` | demote `h1..h6` by N, clamped at `h6` |
| `linksNewTab` | `target="_blank" rel="noreferrer noopener"` |

### 5.6 Media — `core/media/resolveMedia.ts`

Resolution runs in two stages, and only reaches the network when the export itself comes up short.

**Stage 1 — the export's own attachment index.** Match each `<img src>` and file link against the
attachments parsed from the WXR: exact URL, then filename, then filename with the WordPress size
suffix stripped (`photo-150x150.jpg` → `photo.jpg`). Most media on a well-formed export resolves
here, with no network access at all.

**Stage 2 — live fetch through the proxy.** Anything unmatched is looked up against the old site
via `mediaClient.ts` (§5.7), keyed on the article's original URL. Exports with few or zero
attachment items — common enough that stage 1 alone leaves the tool close to useless on them —
resolve here instead. The proxy returns the page's `og:image`, its inline `<img src>` values, and
its file links; `resolveMedia` matches the unresolved reference against that set using the same
filename rules, then records the absolute URL it found.

Each resolution is one of four outcomes, recorded in `media.resolved`:

| Outcome | Meaning |
|---|---|
| `matched-export` | Found in the WXR's attachment index. |
| `matched-live` | Not in the export; recovered from the old site. |
| `unresolved` | Not in the export and not found live. Sets `mediaWarning`. |
| `unreachable` | The old site could not be fetched (offline, 404, blocked). Sets `mediaWarning` with a distinct reason. |

Only the last two set `mediaWarning`, which already feeds the drawer warning, the `review` status,
and the design's problem check. `unreachable` is reported separately from `unresolved` because the
fixes differ — one means the site is down or the URL is wrong, the other means the media is
genuinely gone.

Live lookups are opt-in per session via a checkbox on the Import tab (default on when a source
domain is known), run with bounded concurrency, and are skipped entirely if the source domain
field is empty. A migration can always be completed with the proxy switched off — every media
reference simply falls through to `unresolved` and is reported.

### 5.7 Media proxy — `server/`

A single-purpose Node HTTP server, roughly 100 lines plus guards. It exists because a browser
cannot fetch the old site cross-origin, and for no other reason. It duplicates none of the
conversion engine.

```
GET /api/page-media?url=<absolute old-site URL>
→ 200 { ogImage: string|null, images: string[], files: string[] }
→ 400 invalid or disallowed URL   → 502 upstream failed   → 504 timed out
```

`fetchPageMedia.ts` fetches the URL, parses the HTML, and returns `og:image`, every `<img src>`
(resolved to absolute), and links whose extension looks like a file (`.pdf`, `.docx`, `.zip`, …).
It returns URLs only — it never proxies the bytes of the media itself, since the generated WXR
references original URLs and the WordPress importer does the downloading.

`guard.ts` is the part that matters, because a naive URL-fetching endpoint is a
server-side request forgery hole:

- The requested host must match the source domain the app is currently working on, passed per
  request and checked against an allowlist the server is started with.
- Resolved IPs in private, loopback, or link-local ranges are refused — this is checked after DNS
  resolution, not by pattern-matching the hostname, so `localhost.evil.com` and DNS rebinding
  don't slip through.
- Redirects are followed at most twice and must stay on the allowlisted host.
- 10-second timeout, 5 MB response cap, `text/html` only.

`cache.ts` memoises responses per URL with a TTL for the session, so re-running a build does not
re-crawl the old site. Combined with `media.resolved` on the client, a given page is fetched once.

The server is started alongside Vite (`npm run dev` runs both) and is listed in
`docs/media-proxy.md` with its allowlist configuration.

### 5.8 Term suggestions — `core/mappings/suggestTerms.ts`

Purely generic name similarity. There is no per-site mapping table and no hardcoded term list;
the same code serves any migration.

`similarity.ts` implements the Sørensen–Dice coefficient over bigrams — the same algorithm the
`string-similarity` package uses, in about twenty lines. Implementing it keeps `core/`
dependency-free and directly unit-testable, which matters more here than saving those lines;
the package itself is also no longer maintained.

`suggestTerms(oldTerms, newTables)` compares each old term's name against every category and tag
name on the new site, after normalising both (lowercase, strip punctuation, collapse whitespace,
singularise a trailing `s`). The best match above **0.55** becomes a suggestion carrying its
score; anything below leaves the term unmapped rather than guessing. The threshold is a named
exported constant so it can be tuned in one place.

A suggestion's kind follows its source table — matching a new-site category suggests a category
mapping, matching a tag suggests a tag.

Two rules keep suggestions from fighting the user:

- Every mapping records `origin: 'suggested' | 'user'`. Recomputation — which happens whenever the
  new-site tables change — only ever overwrites `suggested` entries. A mapping the user touched is
  never silently replaced.
- Accepting, changing, or clearing a suggestion flips its origin to `user`, so it is thereafter
  stable.

The design already accommodates this: `TermRow` renders a green "suggested: X" line, and the
header has a "% match" chip style used for builder confidence. The same chip shows the similarity
score next to the suggested destination, so a 0.58 guess is visibly weaker than a 0.95 one.

### 5.9 Build & generate — `core/build/runBuild.ts`, `core/wxr/generateWxr.ts`

Included articles process in chunks yielded via `setTimeout(0)` so the progress bar and **Cancel**
stay responsive. `generateWxr` emits a real WXR: channel header, `wp:wxr_version 1.2`,
`wp:category` / `wp:tag` elements for the terms the mappings produce, one `<item>` per article
with CDATA-wrapped converted content. Download via `Blob`, so the history entry's size is real.

## 6. Error handling

| Stage | Behaviour |
|---|---|
| Parse | Invalid XML or not a WXR → typed `ParseError` rendered in the dropzone. Never a crash. |
| Reader | Unrecognised element → `raw` node + warning on that article. Nothing silently lost. |
| Transform | A throw in one article is caught, marks it `review` with the message, build continues. |
| Generate | Escaping and CDATA handled solely in `xml.ts`, verified by the round-trip test. |
| Session restore | Bad JSON or version mismatch → the design's existing "Couldn't parse that JSON" message. |
| Media proxy down | `mediaClient` catches connection failure and marks affected media `unreachable`. The build always completes; the report lists what could not be checked. The proxy is never on the critical path. |
| Proxy refuses a URL | A disallowed host or private IP returns 400 and is surfaced as `unreachable` with the reason, not retried. |
| Suggestions | Pure and total — an empty or malformed new-site table yields no suggestions rather than an error. |

## 7. Testing

`core/` is pure, so it tests as plain vitest units under jsdom (needed for `DOMParser`).

- One fixture export per builder in `tests/fixtures/`, each containing a gallery, a button, a PDF,
  one image with no matching attachment, and one duplicate slug.
- **Golden-file tests** — fixture in, expected Gutenberg out — so converter regressions read as diffs.
- **Round-trip test** — `generateWxr` output re-parsed through `parseWxr` with matching counts.
- Selectors tested directly. Components get light smoke tests via Testing Library only.
- The design's "Use a sample export instead" link loads the WPBakery fixture, so that path
  exercises the real pipeline.
- **Media resolution** is tested with a stubbed fetch — no network in the test suite. One fixture
  export deliberately ships zero attachment items, so the stage-2 path is covered as a first-class
  case rather than an afterthought. All four outcomes get a test.
- **`guard.ts` gets adversarial tests**, not happy-path ones: a private IP, a hostname resolving to
  a private IP, `localhost.evil.com`, an off-host redirect, an oversized response, a timeout.
  Every one must be refused.
- **`similarity.ts`** is tested on exact matches, case and punctuation differences, singular/plural
  pairs, and unrelated strings, asserting that the last group falls below the threshold.
  `suggestTerms` is tested for the origin rule: recomputation overwrites `suggested` mappings and
  leaves `user` ones untouched.

## 8. Known risks

- **Elementor and Divi mappings are written from documented shapes**, verified only against
  fixtures authored here. They will be structurally sound, but the first real export from each
  will likely surface attribute quirks. The `raw` fallback degrades this into warnings rather
  than breakage, and each fix is a small additive change. Recommendation: replace those two
  golden fixtures with real exports as soon as they are available.
- **Gutenberg block markup is version-sensitive.** Targeting the stable block API as of
  WordPress 6.x; blocks are serialised from small per-kind files so a format change is localised.
- **Live media resolution depends on the old site still being up** and still serving the original
  URLs. If a migration happens after the source is decommissioned, stage 2 yields `unreachable`
  for everything the export omitted. Worth running an import early, while the old site is live, to
  populate `media.resolved` — which is persisted in the session backup and so survives the site
  going away.
- **The proxy is a URL-fetching endpoint**, which is inherently SSRF-shaped. `guard.ts` and its
  adversarial tests are the mitigation, and the server binds to localhost only. It should not be
  deployed to a shared host without revisiting that; as specified it is a local dev-time process.
- **Scraping the old site is a polite-but-real load.** Bounded concurrency, caching, and per-page
  (not per-image) fetching keep it modest, but a several-hundred-post migration will issue several
  hundred requests to the source site.
- **Name similarity is a heuristic.** At 0.55 it will occasionally suggest a wrong-but-similar term
  ("Case Study" vs "Case Studies" is right; "News" vs "Newsletter" may not be). The visible
  confidence score and the fact that suggestions never auto-apply to user-owned mappings are the
  guard; the threshold is one constant to tune once real data shows how it behaves.

## 9. Sequencing

This is a large spec, but it stays one implementation plan rather than being decomposed, because
the two halves have very different risk profiles and a clean dependency direction:

1. **Engine first** (`core/`, §5) — pure functions, TDD, no UI needed to verify. Carries most of
   the technical risk. Complete and green before any component is written. Media resolution is
   built against a stubbed fetch here, so it does not wait on the server.
2. **Proxy** (`server/`, §5.7) — small and self-contained, with `guard.ts` and its adversarial
   tests written first. Slots in behind the `fetch`-like parameter the engine already takes.
3. **State** (§4) — reducer and selectors, tested directly against the engine's output types.
4. **UI** (`features/`, `ui/`, `theme/`) — a direct port of `design/Relay.dc.html`, which is an
   exact visual spec. Low design risk; the markup already exists and is read from the design file
   tab by tab.

Each phase is independently testable, and the engine is usable on its own — which is the point of
the `core/` boundary rule.

## 10. Out of scope

- WP REST sync to the new site, and therefore any credential handling. The proxy fetches **from**
  the old site only; it never authenticates anywhere and never writes to the new site.
- Media file downloading or rehosting — the proxy returns discovered **URLs**, never media bytes.
  The generated WXR references original URLs, which is what the WordPress importer expects.
- Crawling the old site beyond the specific article URLs already present in the export.
- Multi-site or incremental/resumable migrations.
- The three design-tool theme props as runtime settings.

## Critical files to reference while implementing

- `C:\Projects\__Scripts\wp-migration-tool\server\lib\shortcode-strip.js` — source material for the
  `wpbakery` reader's shortcode vocabulary (the pipeline itself is being redesigned around the IR,
  but the shortcode set — `vc_row`, `vc_column_text`, `vc_single_image`, `vc_gallery`, `vc_btn`,
  `pdf-embedder`, etc. — is the proven inventory to port).
- `C:\Projects\__Scripts\wp-migration-tool\server\lib\wxr-reader.js` and `wxr-writer.js` — proven
  parsing/serialization patterns (CDATA-safety, taxonomy discovery, attachment registry) to adapt
  into `core/wxr/`.
- `C:\Projects\__Scripts\wp-migration-tool\server\lib\media-resolver.js` — the og:image + inline
  `<img>` live-scrape pattern this spec's `server/fetchPageMedia.ts` generalizes (hostname
  parameterized instead of hardcoded, plus the new SSRF guards `media-resolver.js` never needed
  since it wasn't exposed as a public endpoint).
- `C:\Projects\__Scripts\wp-migration-tool\public\app.js` — UX patterns already captured in
  `Relay.dc.html`/`support.js` (taxonomy mapping table, article review modal, debounced autosave,
  build job polling) — useful cross-reference if the design file is ever ambiguous about intended
  behavior.
- `Relay.dc.html` / `support.js` (already imported into the new project) — the authoritative visual
  spec; `features/` is a direct port of this, tab by tab.

## Verification

Per §7 (Testing) and §9 (Sequencing) above:

- **Engine phase**: `core/` unit tests all green (golden-file conversion tests per builder,
  round-trip WXR test, media resolution with stubbed fetch covering all 4 outcomes including the
  zero-attachment-items case, `similarity.ts`/`suggestTerms` origin-rule tests) before any UI work
  starts.
- **Proxy phase**: `guard.ts` adversarial tests (private IP, `localhost.evil.com`, off-host
  redirect, oversized response, timeout) all refused correctly, before wiring it into the engine's
  live fetch path.
- **Integration**: run the design's "Use a sample export instead" path (loads the WPBakery fixture)
  end-to-end through the real pipeline — parse → detect → convert → build → download — and confirm
  the output is a valid WXR that re-parses cleanly (round-trip test covers this mechanically; also
  worth a manual import into a scratch WordPress install to confirm real-world compatibility).
- **Regression check against the reference tool**: once the WPBakery reader is implemented, run one
  of `wp-migration-tool`'s real dad.gr WXR exports through Relay and spot-check that image/gallery/
  PDF/button conversion quality is equivalent to what the reference tool produces for the same
  articles.
