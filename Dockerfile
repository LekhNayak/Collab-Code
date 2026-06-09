# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests first (layer-cache friendly)
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install all deps (including devDeps needed to compile)
RUN npm ci

# Copy source
COPY packages/shared ./packages/shared
COPY packages/server/src ./packages/server/src
COPY packages/server/tsconfig.json ./packages/server/
COPY packages/server/prisma ./packages/server/prisma

# Generate Prisma client and compile TypeScript
RUN cd packages/server && npx prisma generate
RUN cd packages/server && npx tsc

# ─── Production stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install production deps only
RUN npm ci --omit=dev

# Compiled server + Prisma schema
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma

# Generated Prisma query engine (created by prisma generate, not npm install)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Prisma CLI — needed to run db push at startup
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Startup script: runs prisma db push then starts the server
COPY start.sh ./start.sh
RUN chmod +x start.sh

RUN mkdir -p /data

EXPOSE 3001

ENV NODE_ENV=production
ENV DATA_DIR=/data

CMD ["sh", "start.sh"]
