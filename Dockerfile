# Build web + API into one Node image
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
RUN npm install --legacy-peer-deps && npm install --prefix server

COPY . .
# Same-origin API when served by Express
ENV EXPO_PUBLIC_API_BASE_URL=
RUN npx expo export --platform web
# Expo uses public/index.html as the SPA template and injects the JS bundle.
# Never copy public/index.html over dist/index.html after export — that blanks the UI.
# Re-copy PWA assets in case export skipped any, then assert installability tags remain.
RUN cp -a public/manifest.webmanifest public/sw.js public/favicon.png dist/ \
  && cp -a public/icons public/screenshots dist/ \
  && grep -q 'manifest.webmanifest' dist/index.html \
  && grep -q 'serviceWorker.register' dist/index.html \
  && grep -q '_expo/static/js/web/entry-' dist/index.html
RUN mkdir -p server/public && cp -r dist/* server/public/

FROM node:22-bookworm-slim AS runner
WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=3001
ENV ALLOW_MOCK_FALLBACK=false

COPY --from=build /app/server/package.json /app/server/package-lock.json ./
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/src ./src
COPY --from=build /app/server/tsconfig.json ./tsconfig.json
COPY --from=build /app/server/public ./public
# Seoul + Cheongju 3y+ backfill (packed ~15MB); store-first /api/trades
COPY data/molit-store/molit-normalized.tgz /tmp/molit-normalized.tgz
RUN mkdir -p /app/server/data/molit-store \
  && tar -xzf /tmp/molit-normalized.tgz -C /app/server/data/molit-store \
  && rm /tmp/molit-normalized.tgz \
  && mkdir -p /app/server/.cache
ENV MOLIT_STORE_DIR=/app/server/data/molit-store/normalized

EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
