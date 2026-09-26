# 1. Базовый образ
FROM node:22-alpine AS base
WORKDIR /app

# 2. Установка зависимостей
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 3. Сборка Nuxt 4 / Nitro
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
RUN npm run build

# 4. Продакшен рантайм
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Безопасность: запуск от не-root пользователя node
USER node

# Копируем только готовый артефакт Nitro из этапа builder
COPY --chown=node:node --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
