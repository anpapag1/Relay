# Relay — WordPress → Gutenberg migration tool

Relay converts an old WordPress site to Gutenberg for a new WordPress install.
It takes a WXR export (or pulls posts live from the old site's REST API / RSS
feed), converts the page-builder markup (WPBakery, Elementor, Divi, plain HTML)
into Gutenberg blocks, lets you map taxonomies and review each article, then
generates a fresh WXR for the new site. Everything runs in the browser; a tiny
Node proxy covers the only thing a browser cannot do (fetching old-site media
cross-origin) and can also serve the whole app as a single container.

```
WXR file or live site  →  parse/fetch  →  review & map  →  build  →  new WXR
```

Five tabs: **Import → Mappings → Settings → Articles → Build & Export**.

## Quick start

```sh
npm install
npm run dev        # Vite (web) + the media proxy, both live-reloading
npm test           # run the whole suite (client + server)
npm run build      # typecheck + build the SPA to dist/
npm run preview    # serve the built SPA (proxy is separate; see below)
```

`npm run dev` starts two processes:

- `dev:web` — Vite on http://localhost:5173 (proxies `/api` → the proxy)
- `dev:proxy` — the Node proxy on http://localhost:8787

The proxy only needs to be running for the live-site features ("fetch from
site", media resolution, image health checks). Uploading a WXR and converting
works fully offline.

## The five tabs

| Tab | What it does |
|---|---|
| **Import** | Load a WXR file (drag & drop), paste/save a session, use a sample export, or **fetch from site** — point it at the old site's URL and it imports via REST (falling back to RSS), with date filtering. |
| **Mappings** | Map old taxonomy terms to new-site categories/tags. Suggestions are automatic (name similarity) but never override a mapping you touched. |
| **Settings** | Conversion choices: image size/alignment, gallery columns & crop, PDF/button rendering, heading shift, external-link behavior, fallback featured image. |
| **Articles** | Filter/sort the article list, open the drawer to preview before/after and edit the generated Gutenberg, exclude or flag articles for review. |
| **Build & Export** | Run the build, watch progress, review the report, download the generated WXR. |

## Documentation

| Doc | Covers |
|---|---|
| `docs/architecture.md` | Code layout, the two pieces, state model, data flow |
| `docs/engine.md` | The conversion engine in `src/core/` |
| `docs/frontend.md` | The React app: state, tabs, article drawer |
| `docs/media-proxy.md` | The Node server: routes, SSRF guard, caching, static serving |
| `docs/testing.md` | How tests work and how to run them |
| `docs/maintaining.md` | How to change the app safely, where things live |
| `docs/deployment.md` | Docker, Bitbucket Pipelines, deploying & updating |

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite + proxy together |
| `npm run dev:web` | Vite only |
| `npm run dev:proxy` | Proxy only (`server/`, tsx watch) |
| `npm run build` | `tsc -b` typecheck + `vite build` → `dist/` |
| `npm test` | Full vitest suite (client + server workspaces) |
| `npm run test:watch` | Client tests in watch mode |
| `npm run test --workspace server` | Server tests only |
| `npm run lint` | ESLint (note: the eslint config currently has pre-existing repo-wide errors) |

## Deploying

See `docs/deployment.md`. The whole app ships as one Docker image: stage 1
builds the SPA, stage 2 compiles the proxy, stage 3 runs a single `node`
process that serves both the static app and the `/api/*` routes on port 8080.
`bitbucket-pipelines.yml` builds and pushes the image to Docker Hub on every
push to `main`.