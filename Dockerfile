FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run db:generate

EXPOSE 3000

CMD sh -c "npm run db:push && npm run db:bootstrap && npm run db:sync:workflow-tools && npm run dev"
