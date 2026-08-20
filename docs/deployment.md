# Deployment

Relay is a single container: one process serves both the static SPA and the
`/api/*` proxy from the same origin, so there are no CORS rules, no separate
static host, and nothing to persist.

## Architecture

```
┌─────────────────────────────── one container ──────────────────────────────┐
│  node server-dist/index.js (port 8080)                                      │
│   ├─ /api/fetch        → fetches old-site RSS/REST feeds (SSRF-guarded)     │
│   ├─ /api/page-media   → extracts media URLs from old-site HTML             │
│   ├─ /api/image-check  → health-checks migrated image URLs (cached)         │
│   ├─ /health           → liveness probe for the container HEALTHCHECK       │
│   └─ everything else   → serves the built SPA (dist/), SPA-fallback to      │
│                          index.html for client routes                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

All state is ephemeral:

- The proxy caches `image-check` results in memory only (lost on restart, fine).
- Saved site profiles live in the browser's `localStorage`.
- No database, no volume, no shared filesystem.

Because the app is stateless, updates are a simple image swap and rollback is
deploying the previous tag.

## Requirements

- Node.js 18+ (bundled in the container image)
- Outbound internet access from the server to the old sites you migrate
  (the proxy calls arbitrary external URLs on your behalf for fetching and
  image health checks). If egress is allowlisted, add the old-site hostnames.

## First-time setup (checklist)

**Your side (app owner):**

1. Push `Dockerfile`, `bitbucket-pipelines.yml`, and this doc to the repo's
   `main` branch.
2. In Bitbucket → **Repository settings → Repository variables**, add
   `DOCKER_HUB_USERNAME` and `DOCKER_HUB_PASSWORD` (an access token works).
   Without these the pipeline's push step fails.
3. On your next push, confirm the pipeline (Pipelines tab) builds and pushes
   successfully.
4. Give IT the image name: `DOCKER_HUB_USERNAME/<repo-slug>:latest`.

**IT side (infra):**

5. Grant the pipeline host/host runner outbound HTTPS access to Docker Hub.
6. Deploy the image to your host or Kubernetes (commands below), expose port
   8080, and point an internal hostname + TLS at it.
7. Open outbound egress from the running server to the old-site hostnames you
   migrate (required for fetching and image health checks).

## Running locally with Docker

```sh
docker build -t relay .
docker run --rm -p 8080:8080 relay
```

Then open http://localhost:8080 — the SPA and `/api/*` come from the same port.

### Environment variables

| Variable    | Default | Description                                |
|-------------|---------|--------------------------------------------|
| `PORT`      | `8080`  | Port the single process listens on.        |
| `STATIC_DIR`| `dist`  | Directory holding the built SPA (relative to the working directory). |

## The Dockerfile

Multi-stage: stage 1 runs `vite build` for the SPA, stage 2 compiles the proxy
with `tsc`, stage 3 copies both outputs onto `node:20-alpine` (~120 MB) and
runs one `node` process. The proxy's `tsconfig.json` excludes test files so the
image ships no test code. A `HEALTHCHECK` polls `/health` every 30 s so
orchestrators restart a wedged container automatically.

## Bitbucket Pipelines

`bitbucket-pipelines.yml` builds and pushes the image whenever `main` is
updated. It targets **Docker Hub** using Bitbucket's predefined variables:

| Repository variable (Settings → Repository variables) | Value                                  |
|-------------------------------------------------------|----------------------------------------|
| `DOCKER_HUB_USERNAME`                                 | Your Docker Hub username               |
| `DOCKER_HUB_PASSWORD`                                 | Docker Hub access token / password     |

Image names are `DOCKER_HUB_USERNAME/<repo-slug>:latest` plus a
`:<git-commit-sha>` tag, so every build is reproducible and rollback-safe.

> For a different registry (e.g. AWS ECR, Harbor, GitLab), replace the
> `docker build`/`docker login`/`docker push` lines — the image itself is
> registry-agnostic. The first push creates the Docker Hub repository; it is
> public by default, so mark it **private** unless you want it exposed.

## Hosting on Render (free)

`render.yaml` is a Render Blueprint that deploys the same single container as a
free Web Service — no Docker Hub involved, Render builds the `Dockerfile`
itself. The app is stateless, so the free plan (512 MB RAM, 750 hrs/month)
suffices; the service **sleeps after 15 minutes idle** and takes ~1 min to cold
start on the next visit.

To deploy:

1. Push this repo to a git host Render can connect to (GitHub/GitLab/Bitbucket)
   and set the `repo`/`branch` fields in `render.yaml`. The repo currently has
   no remote, so this is the one prerequisite.
2. Render → **New +** → **Blueprint** → pick the repo. Render finds
   `render.yaml`, creates the Web Service, and builds from the Dockerfile.
3. When the deploy finishes, open the `*.onrender.com` URL (TLS is automatic).
   Everything comes from that origin — SPA and `/api/*` — so there are no CORS
   or environment changes.

No-git alternative: build and push the image to any registry, then Render →
**New Web Service** → *Deploy an existing image from a registry* and enter the
image name (updates are then a re-push + manual redeploy rather than
auto-deploy on push).

Port/health: Render routes traffic to the container's `8080` (`port` in the
blueprint matches the Dockerfile `EXPOSE` and the `PORT` env default), and its
health check polls `/health` — the same liveness route the Docker
`HEALTHCHECK` uses.

Outbound egress to old-site hosts works out of the box on Render, so live-site
import ("fetch from site") and image health checks behave exactly as they do
running locally.

## Deploying to your internal host

Once the image is in the registry, one of:

```sh
# Simple single host
docker run -d --restart unless-stopped -p 8080:8080 \
  -e PORT=8080 \
  myregistry/relay:latest
```

```sh
# systemd unit instead of a restart policy (example)
# /etc/systemd/system/relay.service
[Service]
ExecStart=/usr/bin/docker run --rm --name relay -p 8080:8080 myregistry/relay:latest
Restart=always
```

Or, if you have Kubernetes, deploy the image as a `Deployment` with
`containerPort: 8080` and a `Service`. For zero-downtime restarts run two
replicas behind a load balancer; for an internal tool a single instance with a
~10-second restart is usually fine.

### TLS / URL

Point an internal hostname (e.g. `relay.internal.example.com`) at the host or
service and terminate TLS at your normal edge (nginx/ingress/load balancer).
The app needs no TLS handling of its own.

## Updating the app

1. Change code, commit, push to `main`.
2. Pipelines builds a new image and pushes `latest` + commit-sha tags.
3. On the host: `docker pull` the new tag and restart the container
   (or `kubectl rollout restart`).
4. To roll back, deploy the previous tag.

Because nothing is persisted server-side, there are no migrations or data
backups to worry about.

## Operational notes

- **Logs**: structured JSON lines on stdout/stderr (see `docs/media-proxy.md`).
  Proxy failures carry the upstream `status` and `reason`, so diagnosing a
  broken migration is `docker logs <container> | jq 'select(.event=="proxy_failed")'`.
- **Egress**: "fetch from site" and image health checks require the server to
  reach external URLs. The SSRF guard (`server/src/guard.ts`) blocks private
  ranges; if you see 400s on otherwise-valid URLs, check the company egress
  firewall first.
- **Memory cache**: `image-check` results are cached in memory and evicted on
  restart. No action needed.
- **16 MB cap**: `/api/fetch` allows bodies up to 16 MB for large media feeds;
  increase `maxBytes` in `server/src/index.ts` if you hit it.
