# --- Stage 1: Build the app ---
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build
RUN mkdir -p /app/data

# --- Stage 2: Install only production dependencies ---
FROM node:24-alpine AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

# --- Stage 3: Final minimal image (distroless) ---
FROM gcr.io/distroless/nodejs24-debian12

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/data ./data

EXPOSE 3000

CMD ["build"]