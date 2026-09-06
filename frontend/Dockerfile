# Three stages, so the shipped image contains neither the source nor the dev dependencies.
#   deps  — install node_modules from the lockfile alone (cached until the lockfile changes)
#   build — compile the app with those modules
#   run   — copy only Next.js's standalone output

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable

# Only the manifests, so this layer is reused whenever the source changes but the
# dependencies have not.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are substituted into the JavaScript at build time, not read at
# startup, so this has to be an ARG rather than a runtime environment variable.
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm build

# ---------- run ----------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

# Running as root inside a container is an unnecessary risk.
RUN addgroup -S app && adduser -S app -G app

# `standalone` already contains a minimal node_modules and the server entry point; static
# assets and public/ are the two things it expects to find beside it.
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
