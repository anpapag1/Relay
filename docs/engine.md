# The conversion engine — `src/core/`

Everything in `core/` is pure TypeScript with zero React imports (the ESLint
boundary rule enforces this). The one exception is `media/mediaClient.ts`, which
touches the network through an injected `fetch`-like parameter so everything
else stays testable with a stub.

## Pipeline overview

```
ParseResult → detectBuilder → reader → IR tree → writeBlocks → WXR markup
   (from parseWxr or fetchSite)                       (settings applied here)
```

## `core/wxr/` — parse and generate WXR

- **`parseWxr.ts`** — parses an uploaded WXR via `DOMParser` (`application/xml`).
  Namespaced tags (`wp:post_type`, `content:encoded`) are read by literal tag
  name through a `childText(el, name)` helper; namespace-aware lookup is
  unreliable across browsers. `<item>` entries with `wp:post_type` of
  `post`/`page` become articles; `attachment` becomes media index entries from
  `wp:attachment_url`. Taxonomies come from `wp:category` / `wp:tag` /
  `wp:term` blocks (falling back to the union of `<category domain=…>` across
  items). Parsing yields to the event loop every N items so the UI's progress
  state stays responsive.
- **`generateWxr.ts`** — emits the output WXR: channel header, `wp:wxr_version
  1.2`, `wp:category`/`wp:tag` elements from the resolved mappings, and one
  `<item>` per included article. Articles with `editedHtml` emit that stored
  markup verbatim (no reader/writer round-trip). Title/postDate/newSlug/
  category/tag overrides from the article sidebar (`UPDATE_ARTICLE_METADATA`)
  are applied before emission — `newSlug` becomes `wp:post_name`, and
  `categoryIds`/`tagIds` replace the mapped terms of that taxonomy via
  `applyTermOverrides` in `core/build/resolveTerms.ts` — falling back to the
  parsed/mapped values when unset. Each article also carries a
  synthetic `<wp:attachment>` item for every inline media URL it uses
  (`mediaAttachmentUrls`) — Relay never carries the source export's attachment
  items over verbatim, so without these, inline images would import as bare
  hotlinks to the old (soon-to-be-decommissioned) site. `wp:post_name` is
  deduped across the included articles (WordPress-style `-2`/`-3` suffixing,
  skipping suffixes already taken by natural slugs) so a manually re-included
  article that collides with an included one still produces a valid WXR.
  `wp:post_date_gmt` is written from the source WXR's preserved GMT
  (`parseWxr` reads `wp:post_date_gmt` into `postDateGmt` and `runBuild`'s
  `toExportArticle` carries it through) so imported posts keep their true UTC
  publication time; when there is no source GMT — live-scraped articles, or a
  date override from the article sidebar — it is derived from `postDate` via a
  UTC conversion instead of copying the local time into both fields.
- **`xml.ts`** — the only place escaping/CDATA is handled. Escape when writing
  element text, wrap content blocks in CDATA. The round-trip test proves it.

## `core/site/` — import from the live site

This is the "fetch from site" path — an alternative source to a WXR file that
produces the same `ParseResult`.

- **`fetchSite.ts`** — single entry point the Import tab calls. Probes the URL
  (`probeSite.ts`): if it exposes WP REST (`wp-json`), import via REST;
  otherwise fall back to the RSS/Atom feed. Never throws; failures past the
  probe stage are contained and returned as `{ ok: false, reason }`. When the
  date range matches nothing it returns
  `{ ok: false, reason: "No articles found in the date range." }`.
- **`probeSite.ts`** — probes REST (`wp-json`, then `?rest_route=`), then the
  RSS/Atom feed URLs. On total failure it distinguishes *why*: if any probe
  fetch threw, the reason blames the network ("Couldn't reach the server…");
  if the proxy returned a 5xx on every probe, it names the HTTP status
  ("The old site returned a server error (HTTP N)…"); otherwise it reports
  that no WordPress REST API or RSS feed was found at the address.
- **`fetchRestPosts.ts`** — paginates `/wp-json/wp/v2/posts` (with
  `before`/`after` date filtering), reading `X-WP-TotalPages` / `X-WP-Total`
  headers. Reports `truncated` when it hits a cap.
- **`fetchRestMedia.ts`** — resolves featured images by media ID, batching
  `include=` ids in chunks of 10 (the WordPress default `per_page`, so an
  `include=` batch is never silently capped). Reports per-batch progress so
  the Import tab's media bar climbs as images resolve.
- **`fetchRestTaxonomies.ts`** — pulls the new site's term vocabularies into
  `oldTables`.
- **`fetchFeedPosts.ts`** — RSS/Atom parse fallback (same `SiteArticle` shape).
- **`mapToParseResult.ts`** — maps `SiteArticle[]` → `ParseResult`. Contains
  `restPostToSiteArticle` / `feedItemToSiteArticle`. A REST article's
  `featured_media` id is carried through as `_thumbnail_id` postmeta even
  when the media endpoint withheld its URL (e.g. a 401-private attachment),
  so the standard featured-image resolution (stage-1 attachment match, then
  og:image scrape) still engages. On the REST path the fetched taxonomy maps
  are merged into the result's `taxonomies`, so every category/tag on the
  source site appears for mapping — including ones no imported article uses
  (count 0) — not just the terms that happen to be attached to fetched posts.
- **`cleanSiteContent.ts`** — strips junk from live-fetched content.
- **`decodeHtmlEntities`** lives in `core/utils/` and is shared by the WXR
  parser, the feed importer, and the REST mapper — some source sites store
  literal `&#215;`-style entities in titles, which must be decoded before
  display.

All fetchers take a `TextFetchLike` (a `fetch`-ish function) as a parameter and
hit the proxy's `/api/fetch` route at the call site (see `docs/media-proxy.md`).

## `core/builders/` — page-builder detection and reading

```ts
export interface BuilderReader {
  id: BuilderId;
  detect(input: DetectInput): number;   // 0..1 confidence
  read(input: ReadInput): { nodes: IRNode[]; warnings: string[] };
}
```

`index.ts` is the id → reader registry. Adding a builder is a new folder plus
one registry line.

- **`detectBuilder.ts`** — runs every reader's `detect` across all posts,
  returns the winner and its score. Signals: `[vc_row`/`[vc_column` → WPBakery;
  `_elementor_data` postmeta or `data-elementor-type` → Elementor; `[et_pb_` →
  Divi; otherwise Plain HTML.
- **`plainHtml/`** — the baseline, and the tail the other three delegate to for
  inner content. Handles `<p>`, `<h1–6>`, `<figure>/<img>`, `<ul>/<ol>`,
  `<blockquote>`, `<hr>`, plus the classic `[gallery]` / `[caption]` / `[video]`
  / `[pdf-embedder]` and WPBakery `[vc_video]` shortcodes. Leading images in a
  paragraph (bare or each wrapped in inline formatting/a link, however many run
  together before real text) are promoted to standalone image nodes.
- **`wpbakery/`** — shortcode tree via `shortcode/tokenize.ts`. `[vc_row]` /
  `[vc_column]` → `columns`; `[vc_column_text]` delegates to plainHtml;
  `[vc_single_image]`, `[vc_gallery]`, `[vc_btn]`, `[vc_video]`,
  `[vc_separator]`, `[vc_empty_space]`. A row is flattened to a single flow
  (no `wp:columns`) when it holds one real content column, or a content
  column plus a media-only sidebar column (video/image/gallery/separator/
  spacer only) — the sidebar media merges into the main column's flow.
- **`divi/`** — the same tokenizer: `[et_pb_section|row|column]` → `columns`;
  `[et_pb_text]` delegates; `[et_pb_image|gallery|button|video|divider]`.
  The shared `shortcode/tokenize.ts` decodes the HTML-entity quote marks
  WPBakery/Divi exports use around attribute values (`&#8221;…&#8221;` →
  `"…"`) — otherwise a value containing spaces (a title) breaks the whole
  shortcode's parse and its content degrades to a raw fallback — and Divi's
  percent-encoded attribute values are decoded.
- **`elementor/`** — a JSON tree in the `_elementor_data` postmeta. Recurses
  `elType: section|column|widget`, dispatching widgets by `widgetType`
  (`text-editor`, `heading`, `image`, `image-gallery`, `button`, `video`,
  `divider`, `spacer`). Missing postmeta falls back to plainHtml on the
  rendered content.

## `core/ir/nodes.ts` — the intermediate representation

The contract every reader produces and every writer consumes. Node kinds
include `paragraph`, `heading`, `list`, `quote`, `image`, `gallery`, `button`,
`file`, `video`, `separator`, `spacer`, `columns`, `table`, and `raw`. A `raw`
node always carries a `note` ("unknown widget: `testimonial-carousel`") which
surfaces as a warning on that article.

## `core/gutenberg/` — the writer

`writeBlocks(nodes, settings)` maps IR nodes to Gutenberg block markup, one
`blocks/<kind>.ts` per node kind. **This is the only module that reads
`settings`**, so the Settings preview and the build cannot disagree (the
preview calls `writeBlocks` directly on a fixture IR tree).

| Setting | Effect |
|---|---|
| `imageSize` / `customWidth` / `customHeight` | `sizeSlug`, or explicit width+height — set one, the other scales proportionally |
| `imageAlign` | block `align` attribute |
| `autoSpacing` + `spacerSize` | `wp:spacer` blocks around floated images |
| `combineConsecutiveImages` | runs of standalone images become one `wp:gallery` |
| `galleryColumns` / `galleryAspectRatio` | `wp:gallery` columns + the crop ratio (matches the real editor's dropdown) |
| `pdfRender` / `buttonRender` | `wp:file` / `wp:buttons` as link, button, or embed |
| `headingShift` | demote `h1..h6` by N, clamped at `h6` |
| `linksNewTab` | `target="_blank" rel="noreferrer noopener"` |
| `fallbackFeaturedImageUrl` / `...DataUrl` | fallback featured image; the data URL is session-only and excluded from JSON backups |

## `core/media/` — resolve media

Resolution runs in two stages and only reaches the network when the export
itself comes up short.

**Stage 1 — the export's own attachment index.** Match each `<img src>` and
file link against the attachments parsed from the WXR: exact URL, then
filename, then filename with the WordPress size suffix stripped
(`photo-150x150.jpg` → `photo.jpg`). Most media on a well-formed export
resolves here, with no network access at all.

**Stage 2 — live fetch through the proxy.** Anything unmatched is looked up
against the old site via `mediaClient.ts` → `/api/page-media`, keyed on the
article's original URL. The proxy returns the page's `og:image`, inline
`<img src>` values, and file links; `resolveMedia` matches the unresolved
reference against that set with the same filename rules.

Each resolution is one of four outcomes, recorded in `media.resolved`:

| Outcome | Meaning |
|---|---|
| `matched-export` | Found in the WXR's attachment index. |
| `matched-live` | Not in the export; recovered from the old site. |
| `unresolved` | Not in the export and not found live. Sets `mediaWarning`. |
| `unreachable` | The old site could not be fetched (offline, 404, blocked). Sets `mediaWarning` with a distinct reason. |

Only the last two set `mediaWarning`, which feeds the drawer warning, the
`review` status, and the build report. `unreachable` is kept separate from
`unresolved` because the fixes differ — one means the site is down or the URL
is wrong, the other means the media is genuinely gone.

Live lookups are opt-in per session (checkbox on the Import tab, default on
when a source domain is known), run with bounded concurrency
(`utils/concurrencyLimit.ts`), and are skipped entirely if the source domain
field is empty. A migration can always be completed with the proxy switched
off — every media reference falls through to `unresolved` and is reported.

Other modules here: `resolveFeaturedImage.ts` (the `_thumbnail_id` →
attachment-index → og:image scrape chain), `effectiveFallbackFeaturedImage.ts`
(session fallback image), `verifyImages.ts` + `attachmentIndex.ts`, and
`collectImageSrcRefs.ts`.

## `core/mappings/` — taxonomy mapping

- **`suggestTerms.ts`** — generic name similarity, no per-site tables. For each
  old term, compares against every new-site category and tag name (normalized:
  lowercase, strip punctuation, collapse whitespace, singularize trailing `s`).
  Best match above **0.55** becomes a suggestion; below that the term stays
  unmapped. The threshold is a named exported constant.
- **`similarity.ts`** — the Sørensen–Dice coefficient over bigrams, about
  twenty lines, kept dependency-free so `core/` stays pure.
- **`applyMappings.ts`** — applies the mapping table when building.
- **`reconcileOldTables.ts`** — merges/refreshes old-site term tables when a
  new source is imported.
- **`termId.ts`** — the stable id scheme for old terms.

Two rules keep suggestions from fighting the user (in `applyMappings` /
`suggestTerms`):

- Every mapping records `origin: 'suggested' | 'user'`. Recomputation (which
  happens whenever the new-site tables change) only overwrites `suggested`
  entries — a mapping the user touched is never silently replaced.
- Accepting, changing, or clearing a suggestion flips its origin to `user`.

## `core/build/` — the build

- **`runBuild.ts`** — processes included articles in chunks yielded via
  `setTimeout(0)` so the progress bar and Cancel stay responsive. Per-article
  failures are caught, marked `review` with the message, and the build
  continues. Produces `BuildArticleResult[]` + the WXR string. Progress is
  reported monotonically across its two passes: the resolve pass (media, the
  network-bound half) ticks the first `N` steps and the convert pass the
  second, so the bar never sits at 0% for the whole network phase. The
  provider wraps the build's fetches with a 20s client-side timeout as a
  backstop against a wedged proxy connection.
- **`collectMediaRefs.ts`** — gathers every inline media URL an article uses so
  the export can emit synthetic attachment items.
- **`resolveTerms.ts`** — resolves each article's terms through the mapping
  table to their new-site destinations.
- `golden.test.ts` — fixture-in / Gutenberg-out golden tests.

## Error handling summary

| Stage | Behaviour |
|---|---|
| Parse | Invalid XML or not a WXR → typed `ParseError` rendered in the dropzone. Never a crash. |
| Reader | Unrecognised element → `raw` node + warning on that article. Nothing silently lost. |
| Transform | A throw in one article is caught, marks it `review` with the message, build continues. |
| Generate | Escaping and CDATA handled solely in `xml.ts`, verified by the round-trip test. |
| Profile restore | Bad JSON or version mismatch → "Couldn't parse that JSON" message. |
| Proxy down | `mediaClient` catches connection failure and marks affected media `unreachable`. The build always completes; the report lists what could not be checked. The proxy is never on the critical path. |
| Suggestions | Pure and total — an empty or malformed new-site table yields no suggestions rather than an error. |
