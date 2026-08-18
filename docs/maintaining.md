# Maintaining Relay

How to change the app safely, and where things live. Read `docs/architecture.md`
first if you haven't.

## The golden rule: keep docs in sync

`docs/` and `README.md` describe how the app actually works. Any change that
touches something they describe — an API route, the state shape, a command,
a setting, the Docker/proxy setup, the conversion pipeline — **must update the
affected docs in the same commit**. A commit that changes behavior without
updating the docs it describes is incomplete. See `AGENTS.md`.

## Making a change safely

1. **Find the smallest module that owns the behavior.** The boundaries do the
   finding for you:
   - Conversion output → `core/gutenberg/` (settings apply here and nowhere else)
   - Parsing → `core/wxr/` or `core/site/`
   - Media recovery → `core/media/`
   - An API behavior → `server/src/`
   - What the UI shows → `src/features/<tab>/`
   - What derives from state → `src/state/selectors.ts`
2. **Write the test first** (see `docs/testing.md` for what a change of your
   shape needs). Core is pure and network-free, so engine changes test as
   plain units; server routes test against the live server; the reducer and
   selectors test directly.
3. **Keep `core/` React-free.** No component/state imports in `src/core/`.
   Network access goes through an injected `fetch`-like parameter.
4. **Never store derived data.** Statuses, counts, filtered lists belong in
   selectors, not state. The session format stores decisions only.
5. **Run the suite** — `npm test`, then `npm run build` (typecheck).
   Lint currently has pre-existing repo-wide config errors; don't rely on it.
6. **Update the docs that describe your change** before committing.

## Common tasks

### Add a page builder

1. New folder `src/core/builders/<name>/` implementing `BuilderReader`
   (`detect` + `read` → IR nodes).
2. One registry line in `src/core/builders/index.ts`.
3. Fixture + golden test + `detect` test (`docs/testing.md`).
4. Document it in `docs/engine.md` (the reader list).

### Add a Gutenberg block kind

1. New `src/core/gutenberg/blocks/<kind>.ts` following the existing files.
2. `writeBlocks` must emit it from the matching IR node (`core/ir/nodes.ts`).
3. Unit test + ensure the Settings preview still renders.
4. Document in `docs/engine.md`.

### Add a setting

1. Add the field to `ConversionSettings` (`src/types/domain.ts`).
2. Read it in `core/gutenberg/writeBlocks.ts` only.
3. UI control in `src/features/settings/SettingsTab.tsx`.
4. Tests on the `writeBlocks` behavior; docs in `docs/engine.md` (the settings
   table) and `docs/frontend.md`.

### Add an API route

1. Handler + route registration in `server/src/index.ts`. If it fetches a URL,
   go through `guard.ts` + `rawRequest.ts` and add adversarial guard tests.
2. Route test in `server/src/index.test.ts`.
3. Client call site uses an injected fetch (never a bare global).
4. Docs: `docs/media-proxy.md` (routes table), `docs/architecture.md`
   (directory map), and `docs/deployment.md` if it changes the proxy surface.

### Change settings/state shape

- Update `src/state/types.ts` and the reducer/selectors that read it.
- The session backup has a `version` field — bump it if the restore shape
  changes (a version mismatch surfaces as the existing "couldn't parse" flow).
- Docs: `docs/architecture.md` (state model) and `docs/frontend.md`.

### Deploy / update the running app

See `docs/deployment.md`. Build the image (`docker build -t relay .`), push it
via the Bitbucket pipeline, swap the container. Because the app is stateless,
updates are image swaps and rollback is the previous tag.

## Where the sharp edges are

- **The proxy is a URL-fetching endpoint.** The private-IP guard
  (`server/src/guard.ts`) is the security invariant. Do not expose it to
  untrusted users; if egress matters in your environment, see
  `docs/deployment.md`.
- **The client normalizes traversal URLs.** `fetch` collapses `%2e%2e`
  client-side before the request ever leaves, so the static-serving traversal
  test must use a raw `http.request` to exercise the guard. See
  `server/src/index.test.ts`.
- **`server/` is plain ESM.** Relative imports carry explicit `.js` extensions
  because `tsc` emits them as written and Node ESM requires them. `tsx` (dev)
  and Vite (vitest) tolerate them; do not remove them.
- **The compiled server must not ship test files.** `server/tsconfig.json`
  excludes `src/**/*.test.ts`. If you move or add build-affecting files, keep
  that exclusion.
- **Elementor/Divi readers are fixture-verified, not real-export-verified.**
  The first real export from each will likely surface attribute quirks; the
  `raw` fallback turns them into warnings, not breakage.
- **Name similarity is a heuristic.** At the 0.55 threshold it occasionally
  suggests a wrong-but-similar term. The threshold is one named constant in
  `core/mappings/suggestTerms.ts`.