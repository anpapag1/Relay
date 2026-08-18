# The media proxy — `server/`

A tiny zero-dependency Node HTTP server (plain `node:http`, global `fetch`
not needed). It exists for exactly one thing: fetching the old site on the
client's behalf, because a browser cannot make cross-origin requests. It
duplicates none of the conversion engine and never proxies media bytes — it
returns **URLs and bodies**, and the generated WXR references original URLs,
which is what the WordPress importer expects.

In production it also serves the built SPA, so the whole app runs as one
process on one origin (see `docs/deployment.md`).

## Routes

| Route | Purpose | Success | Failure |
|---|---|---|---|
| `GET /api/page-media?url=<old-site URL>` | Scrape one article page: return its `og:image`, inline `<img src>` values (absolutized), and file links (`.pdf`, `.docx`, `.zip`, …). Used by media stage-2 resolution. | `200 { ogImage, images, files }` | `400` invalid/disallowed URL, `502` upstream failed, `504` timed out. Cached per URL. |
| `GET /api/image-check?url=<image URL>` | Check whether one already-resolved image URL actually loads. Used by the post-import health check. | Always `200` with `{ ok, status?, reason? }` — "image is broken" is a valid answer, not a proxy error. Successes cached. | — |
| `GET /api/fetch?url=<old-site URL>` | Unfiltered passthrough of an old-site body (JSON or XML for the site-import fetchers). 16 MB cap. Forwards `X-WP-TotalPages` / `X-WP-Total` so the client can paginate. Deliberately **not** cached — pages can change between reads. | `200` with the body + content-type | `4xx`/`5xx` mapped onto the response status. |
| everything else | Serves the built SPA from `STATIC_DIR` (see below). | `200` with the file | unknown `/api/*` → JSON 404; SPA client routes → `index.html`. |

`server/src/index.ts` is just the HTTP entry point; each route delegates to its
module and all parsing, guarding, timeouts, and caching live in the helpers:

- `fetchPageMedia.ts` — fetch URL, parse HTML, return `og:image` + images + files
- `checkImage.ts` — HEAD/GET one URL, report `{ ok, status, reason }`
- `fetchUrl.ts` — raw passthrough with a per-call `maxBytes` (16 MB for `/api/fetch`)
- `guard.ts` — the SSRF mitigation, described below
- `rawRequest.ts` — shared low-level HTTP fetch: `User-Agent:
  RelayMediaProxy/1.0`, per-call timeout and size cap. Defaults: `page-media`
  and `fetch` time out at 10 s (`image-check` at 8 s); `page-media` caps
  responses at 5 MB, `fetch` at 3 MB (raised to 16 MB for `/api/fetch`).
- `cache.ts` — in-memory, TTL'd, keyed per URL

## The SSRF guard — `server/src/guard.ts`

A URL-fetching endpoint is inherently server-side-request-forgery shaped. The
mitigation: **the address a URL's host actually resolves to must not be
private / loopback / link-local.**

- The check runs on the *resolved* IP (after DNS), not by pattern-matching the
  hostname, so `localhost.evil.com` and DNS rebinding don't slip through.
- There is deliberately **no host allowlist**. The URLs this proxy fetches come
  from the WXR file the user loaded (an article's own permalink) or from a
  user-supplied old-site URL in the Import tab — never arbitrary attacker
  input — so the private-IP check is the invariant that matters. If you ever
  expose the proxy to untrusted users, revisit this.
- Protocol is restricted to `http:`/`https:`.
- Redirects are followed at most twice, and **every hop (initial URL and each
  redirect target) is re-checked by `guardUrl` before connecting** — a redirect
  cannot jump to a private address. (This is in `fetchPageMedia.ts`,
  `checkImage.ts`, and `fetchUrl.ts`; each enforces its own redirect cap.)

### A warning about egress

The guard stops the proxy from reaching *private* networks. It does **not**
stop a *public* IP with a private destination behind it. If you deploy this
behind a corporate firewall, outbound egress for the running server is your
responsibility (see `docs/deployment.md`).

## Static serving

For any request that isn't `/api/*`, `serveStatic` reads from `STATIC_DIR`
(default `dist`, relative to the working directory). Unknown paths fall back to
`index.html` (SPA client routing). Dot-segment traversal is rejected on the raw
request target (the WHATWG URL parser already collapses `%2e%2e` before
routing, so the check happens pre-normalization for a clean 404). A small MIME
map covers the Vite asset types.

In the container the runtime stage copies the SPA build to `/app/dist` and the
compiled proxy to `/app/server-dist`, so one `node` process serves everything.
See `docs/deployment.md`.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` (dev) / `8080` (container) | Listen port |
| `STATIC_DIR` | `dist` | Directory holding the built SPA |

## Running it

```sh
# dev — alongside Vite, from the repo root
npm run dev            # both
npm run dev:proxy      # proxy only (tsx watch)

# standalone compiled
npm run build --workspace server   # → server/dist/
node server/dist/index.js

# tests
npm run test --workspace server
```

## Notes

- **Caching**: `page-media` results and successful `image-check` results are
  cached in memory for the session. Combined with `media.resolved` on the
  client, a given old-site page is fetched at most once per session.
- **Size caps**: `page-media` and `image-check` cap responses small; `/api/fetch`
  allows up to 16 MB because a 100-post REST page can be large. The cap is
  `FETCH_MAX_BYTES` in `index.ts`.
- **It binds to whatever host you run it on.** In dev it's localhost-only via
  `npm run dev`; in the container it's the image's published port.