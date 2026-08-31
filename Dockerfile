FROM node:22-alpine AS base
WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run db:generate

RUN chmod +x scripts/docker-entrypoint.sh

EXPOSE 3000

CMD ["/bin/sh", "scripts/docker-entrypoint.sh"]
