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

EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
