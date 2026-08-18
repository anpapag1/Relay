# Testing

Tests sit beside their source as `*.test.ts(x)`. The suite runs under vitest in
two workspaces: the client (root) and the server (`server/`).

## Running

```sh
npm test                                    # everything
npm run test:watch                          # client, watch mode
npm run test --workspace server             # server only
npm run test --workspace server -- --run src/index.test.ts   # one server file
```

`npm run build` runs `tsc -b` typecheck; run it before pushing.

## Client strategy (`src/`)

- **Core is pure, so it tests as plain units.** jsdom is configured because
  the WXR parser needs `DOMParser`. Core tests never hit the network — network
  access is stubbed via the injected `fetch`-like parameter.
- **Golden-file tests.** Fixture export in, expected Gutenberg out
  (`core/build/golden.test.ts` + snapshots). Converter regressions read as
  diffs.
- **Round-trip test.** `generateWxr` output re-parsed through `parseWxr` with
  matching counts — proves the escaping/CDATA handling in `xml.ts`.
- **One fixture per builder** (WPBakery, Elementor, Divi, Plain HTML), each
  exercising a gallery, a button, a PDF, an image with no matching attachment,
  and a duplicate slug. One fixture deliberately ships zero attachment items so
  the live-fetch (stage-2) media path is a first-class case.
- **Media resolution** is tested with a stubbed fetch; all four outcomes
  (`matched-export`, `matched-live`, `unresolved`, `unreachable`) get a test.
- **Selectors and reducer** are tested directly (statuses derive correctly, a
  mapping change reflows statuses, session restore recomputes rather than
  restoring stale statuses).
- **Components get light smoke tests** via React Testing Library — render,
  basic interactions, no snapshot-heavy UI tests.
- **`suggestTerms` origin rule:** recomputation overwrites `suggested`
  mappings and leaves `user` ones untouched.

## Server strategy (`server/`)

The routes are integration-tested against a real listening server (`PORT=0`,
so the OS picks a free port — see `server/src/index.test.ts`). It exercises:

- Route validation (`400` on missing params), the SSRF guard (private URLs →
  `400`), header forwarding (`X-WP-TotalPages`), and the 16 MB cap wiring.
- **Caching semantics:** successful `image-check` results are cached (one call
  for two requests), failures are not.
- **Static serving:** index.html at the root, asset content-types, SPA fallback
  for client routes, JSON `404` for unknown `/api/*`, and two traversal tests —
  one via `fetch` (whose client-side URL normalization already defuses
  `%2e%2e`) and one via a raw `http.request` that sends the path verbatim.
  The static fixture is created in a temp dir before the server module loads,
  because the server reads `STATIC_DIR` at import time.
- **`guard.ts` gets adversarial tests, not happy-path ones**: a private IP, a
  hostname resolving to a private IP, `localhost.evil.com`, an off-host
  redirect, an oversized response, a timeout. Every one must be refused.
- **`fetchUrl`/`fetchPageMedia`** cover live upstreams, timeouts, size caps,
  and malformed responses.

## When to add a test

- A new builder reader → a fixture + golden output + a `detect` test.
- A new Gutenberg block kind → a `writeBlocks` unit test + preview integration.
- A new API route → a route test in `index.test.ts` (+ guard adversarial tests
  if it fetches URLs).
- A settings change → the corresponding `writeBlocks` test, because settings
  only ever affect output through that one module.
- A new media outcome → a `resolveMedia` test with a stubbed fetch.