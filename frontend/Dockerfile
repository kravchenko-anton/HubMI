FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV CI=1
ENV EXPO_NO_TELEMETRY=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx expo export --platform web

FROM node:22-bookworm-slim

WORKDIR /app

RUN npm install -g serve@14.2.6

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production

CMD ["sh", "-c", "serve dist --listen tcp://0.0.0.0:${PORT:-8080}"]
