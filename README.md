# Relay — WordPress → Gutenberg migration tool

Relay helps you move a WordPress site over to Gutenberg for a fresh install.
You give it the old site — either as a WXR export file or by pointing it at the
live site — and it does the tedious parts for you: it reads the old page-builder
markup (WPBakery, Elementor, Divi, or plain HTML), turns it into real Gutenberg
blocks, helps you map the old categories and tags onto the new site's
taxonomies, lets you review each article before it ships, and finally hands you
a new WXR ready to import.

The whole conversion runs in your browser. The one thing a browser can't do —
asking the old site for media it didn't include in the export — is handled by a
small companion server that fetches pages on your behalf. That same server can
also serve the finished app as a single container if you'd rather host it than
run it locally.

```
old site → import → map & review → build → new WXR
```

You move through five screens as you work: **Import → Mappings → Settings →
Articles → Build & Export**.

## Quick start

```sh
npm install
npm run dev
```

That starts both halves — the app at http://localhost:5173 and the companion
server behind it — and opens the door. From there, `npm test` runs the test
suite, and the [testing docs](docs/testing.md) explain what it covers.

You don't need the server for everything: importing a WXR and converting it
works fully offline. Only the live-site features — fetching from the site,
recovering missing media, and image health checks — need it running.

## What the five screens do

| Screen | What you'll use it for |
|---|---|
| **Import** | Bring the old site in: drop a WXR file onto the dropzone, or paste the site's address and import straight from its REST API (falling back to its RSS feed). You can also load a sample export to see how things work. Every site's taxonomies, mappings, and settings auto-save by domain; the domain pill in the header opens a drawer to manage them. |
| **Mappings** | Line the old taxonomy terms up with the new site's categories and tags. Relay suggests matches by name similarity — visible confidence scores, and it never overrides a choice you've made yourself. |
| **Settings** | Decide how conversion behaves: image sizes and alignment, gallery columns and cropping, how PDFs and buttons render, heading levels, external links, and a fallback featured image. |
| **Articles** | Review everything before it ships — filter and sort, open any article to see it before and after conversion, hand-edit the generated Gutenberg if you need to, and flag or exclude articles. |
| **Build & Export** | Run the conversion, watch it progress, review the report of what happened, and download the WXR to import into the new site. |

## Going deeper

The repo has a set of short docs written for whoever works on this project next:

- [**How the app is put together**](docs/architecture.md) — the two pieces,
  the code layout, the state model, and how data flows through.
- [**The conversion engine**](docs/engine.md) — everything under `src/core/`:
  parsing, builders, the block writer, media resolution, and mapping.
- [**The React frontend**](docs/frontend.md) — the screens above, the state
  store, and the article review drawer.
- [**The companion server**](docs/media-proxy.md) — its routes, the safety
  guard, caching, and how it serves the built app.
- [**Testing**](docs/testing.md) — how the suite works and when to add a test.
- [**Maintaining**](docs/maintaining.md) — how to change things safely and
  where the sharp edges are.
- [**Deploying**](docs/deployment.md) — shipping it as one Docker image, the
  Bitbucket pipeline, and keeping it updated.

If you're just getting the app running on a server for your team, that last one
is the one to read.