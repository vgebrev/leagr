# --- Stage 1: Build ---
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# --- Stage 2: Final Runtime Image ---
FROM node:24-alpine

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./

RUN npm ci --omit=dev

ENV DATA_DIR=/app/data

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "build"]