# Base images are pinned by digest so a compromised or retagged upstream cannot
# silently enter a build. The tag is kept alongside the digest for readability.
# To pick up upstream patches, re-resolve each with:
#   docker buildx imagetools inspect <tag> --format '{{.Manifest.Digest}}'

# --- Stage 1: Build the app ---
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build
RUN mkdir -p /app/data
RUN mkdir -p /app/logs

# --- Stage 2: Install only production dependencies ---
# Must be a glibc base matching the distroless debian-12 runtime below. sharp's
# prebuilt binaries are libc-specific, and npm only installs the variant matching
# the build platform, so installing here on alpine (musl) ships binaries the
# runtime cannot load.
FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./

# --ignore-scripts: nothing that ships needs an install script (fsevents is the
# only dependency with one and it is darwin-only), so refusing to run them
# closes the postinstall supply-chain vector. Do NOT add this to the builder
# stage above - the build depends on `prepare` running `svelte-kit sync`.
RUN npm ci --omit=dev --ignore-scripts

# --- Stage 3: Final minimal image (distroless, nonroot) ---
# The :nonroot variant runs as uid/gid 65532 instead of root. Baking it into the
# image means the container stays unprivileged even if run without --user.
FROM gcr.io/distroless/nodejs24-debian12:nonroot@sha256:14d42e2511532589a7c7e01a753667a74fcc96266e137e8125006b87b0c32d0a

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
# data and logs are bind-mounted in production and these copies are shadowed,
# but owning them as 65532 keeps the image runnable without mounts.
COPY --from=builder --chown=65532:65532 /app/data ./data
COPY --from=builder --chown=65532:65532 /app/logs ./logs

EXPOSE 3000

CMD ["build"]

# --- Stage 3 (Alt): Debug image (node alpine) ---
# Swap in when you need a shell in the running container. Note this reverts to
# root and to a musl base, so it is for local debugging only - never deploy it.
#FROM node:24-alpine
#
#WORKDIR /app
#
#COPY --from=prod-deps /app/node_modules ./node_modules
#COPY --from=builder /app/build ./build
#COPY --from=builder /app/package*.json ./
#COPY --from=builder /app/data ./data
#
#EXPOSE 3000
#
#CMD ["node", "build"]
