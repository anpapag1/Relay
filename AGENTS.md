# Relay — project rules

## Documentation stays current

The docs are part of the deliverable, not an afterthought. `docs/` and
`README.md` describe how the app actually works — routes, state shape, env
vars, commands, architecture, the Docker/proxy setup, the conversion pipeline.

Whenever a change (feature, bugfix, refactor) touches anything those documents
describe, **update the affected docs in the same change** so they match the
current state. A commit that changes behavior without updating the docs it
describes is incomplete.

Docs to keep in sync:

- `README.md` — friendly overview, quick start, doc index
- `docs/architecture.md` — code layout, state model, data flow
- `docs/engine.md` — the conversion engine (`src/core/`)
- `docs/frontend.md` — the React app (`src/features/`, `src/state/`)
- `docs/media-proxy.md` — the Node server (`server/`)
- `docs/testing.md` — how tests work
- `docs/maintaining.md` — how to change things safely
- `docs/deployment.md` — container, Bitbucket Pipelines, deploy/update

If a change adds or removes an API route, changes the state shape, renames a
command, changes settings, or alters behavior a doc describes, that doc must be
edited in the same commit.