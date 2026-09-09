FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN npm install -g pnpm@9

# Dependencies layer
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Development runner
FROM base AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm dev"]
