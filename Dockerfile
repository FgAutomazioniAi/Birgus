# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --fund=false

COPY . .

RUN npm run db:generate

RUN chmod +x scripts/docker-entrypoint.sh

EXPOSE 3000

CMD ["/bin/sh", "scripts/docker-entrypoint.sh"]
