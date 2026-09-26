# DummyJSON Products & Categories API Reference

Base URL: `https://dummyjson.com`

Official docs: [Products](https://dummyjson.com/docs/products), [common query rules](https://dummyjson.com/docs).

The Nitro BFF proxies `GET /products`, `GET /products/{id}`, `GET /products/search`, `GET /products/category/{slug}`, and `GET /products/categories`. It does not forward `select`, `delay`, `modifiedAfter`, `modifiedBefore`, `limit=0`, or `GET /products/category-list`.

## 1. Endpoints

### Get All Products (Paginated)
- **Method:** `GET`
- **URL:** `/products`
- **Query Params:**
  - `limit`: `number` (default: 30). `limit=0` returns every item.
  - `skip`: `number` (default: 0)
  - `select`: `string` (comma-separated keys, e.g. `title,price`). Repeatable: `select=title&select=price`.
  - `sortBy`: `string` (field name, e.g. `title`, `price`, `rating`)
  - `order`: `'asc' | 'desc'`
  - `modifiedAfter`: ISO 8601. Keeps products whose `meta.updatedAt` is after this instant.
  - `modifiedBefore`: ISO 8601. Keeps products whose `meta.updatedAt` is before this instant.
  - `delay`: `number` from `0` to `5000` (milliseconds). Applies to any DummyJSON resource.

`modifiedAfter` and `modifiedBefore` also work on search and category lists, and combine with `sortBy`, `limit`, `skip`, and `select`.

### Get Single Product
- **Method:** `GET`
- **URL:** `/products/{id}`

### Search Products
- **Method:** `GET`
- **URL:** `/products/search`
- **Query Params:**
  - `q`: `string` (search query)
  - `limit`: `number` (`0` returns every match)
  - `skip`: `number`
  - `sortBy`: `string`
  - `order`: `'asc' | 'desc'`
  - `select`: `string` (comma-separated or repeated)
  - `modifiedAfter`: ISO 8601
  - `modifiedBefore`: ISO 8601
  - `delay`: `0`–`5000`

### Get Category List (Detailed objects)
- **Method:** `GET`
- **URL:** `/products/categories`
- **Response:** `Array<{ slug: string, name: string, url: string }>`

### Get Category Slug List
- **Method:** `GET`
- **URL:** `/products/category-list`
- **Response:** `string[]` of slugs only (`"beauty"`, `"fragrances"`, …). No `name` or `url`.

### Get Products by Category
- **Method:** `GET`
- **URL:** `/products/category/{slug}`
- **Query Params:** `limit`, `skip`, `sortBy`, `order`, `select`, `modifiedAfter`, `modifiedBefore`, `delay`

---

## 2. Response Schemas

`brand` is absent on many products (92 of 194 at the time of this note, mostly groceries). Treat it as optional.

Image URLs are WebP files on `cdn.dummyjson.com` under `/product-images/{category}/{slug}/`.

### Single Product Object
```json
{
  "id": 1,
  "title": "Essence Mascara Lash Princess",
  "description": "The Essence Mascara Lash Princess is a popular mascara...",
  "category": "beauty",
  "price": 9.99,
  "discountPercentage": 10.48,
  "rating": 2.56,
  "stock": 99,
  "tags": ["beauty", "mascara"],
  "brand": "Essence",
  "sku": "BEA-ESS-ESS-001",
  "weight": 2,
  "dimensions": {
    "width": 23.17,
    "height": 14.43,
    "depth": 28.01
  },
  "warrantyInformation": "1 month warranty",
  "shippingInformation": "Ships in 1 month",
  "availabilityStatus": "In Stock",
  "reviews": [
    {
      "rating": 2,
      "comment": "Very unhappy with my purchase!",
      "date": "2024-05-23T08:56:21.618Z",
      "reviewerName": "John Doe",
      "reviewerEmail": "john.doe@x.dummyjson.com"
    }
  ],
  "returnPolicy": "30 days return policy",
  "minimumOrderQuantity": 24,
  "meta": {
    "createdAt": "2024-05-23T08:56:21.618Z",
    "updatedAt": "2024-05-23T08:56:21.618Z",
    "barcode": "5784719087687",
    "qrCode": "https://cdn.dummyjson.com/public/qr-code.png"
  },
  "images": [
    "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp"
  ],
  "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp"
}
```

### Products Paginated Response

```json
{
  "products": [ /* Array of Product objects */ ],
  "total": 194,
  "skip": 0,
  "limit": 30
}
```
