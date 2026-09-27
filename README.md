# Atelier

Витрина на **Nuxt 4**: каталог, карточка товара, корзина и оформление заказа. Товары приходят из [DummyJSON](https://dummyjson.com/) через Nitro BFF. Вживую: [https://nuxt4-headless-ecommerce.vercel.app/](https://nuxt4-headless-ecommerce.vercel.app/).

Автор: [Pavel Mazan](https://github.com/mazan-pavel) · лицензия [MIT](LICENSE)

## Стек

- Nuxt 4, Vue 3, TypeScript
- Tailwind CSS и shadcn-vue
- Pinia и VueUse
- `@nuxt/image`, `@nuxt/fonts`

Каталог, поиск и карточка товара ходят в `server/api`. Контракт DummyJSON описан в [`docs/dummyjson-api.md`](docs/dummyjson-api.md).

## Быстрый старт

Нужен **Node.js 22+**.

```bash
npm install
npm run dev
```

Сервер разработки: [http://localhost:3000](http://localhost:3000)

```bash
npm run build
npm run preview
```

Локальный аудит Lighthouse (сервер должен быть запущен):

```bash
npm run audit
```

SEO / AI crawlers: `/robots.txt`, `/sitemap.xml`, `/llms.txt`. Публичный origin задаётся через `NUXT_PUBLIC_SITE_URL` (см. `.env.example`).

## Лицензия

MIT © Pavel Mazan ([mazan-pavel](https://github.com/mazan-pavel))
