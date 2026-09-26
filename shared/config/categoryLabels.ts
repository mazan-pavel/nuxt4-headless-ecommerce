const CATEGORY_LABELS: Record<string, string> = {
  beauty: 'Красота',
  fragrances: 'Ароматы',
  furniture: 'Мебель',
  groceries: 'Продукты',
  'home-decoration': 'Декор',
  'kitchen-accessories': 'Кухня',
  laptops: 'Ноутбуки',
  'mens-shirts': 'Рубашки',
  'mens-shoes': 'Обувь',
  'mens-watches': 'Часы',
  'mobile-accessories': 'Гаджеты',
  motorcycle: 'Мото',
  'skin-care': 'Уход',
  smartphones: 'Смартфоны',
  'sports-accessories': 'Спорт',
  sunglasses: 'Очки',
  tablets: 'Планшеты',
  tops: 'Топы',
  vehicle: 'Авто',
  'womens-bags': 'Сумки',
  'womens-dresses': 'Платья',
  'womens-jewellery': 'Украшения',
  'womens-shoes': 'Обувь',
  'womens-watches': 'Часы',
  lighting: 'Свет',
}

export function categoryLabel(slug: string, fallbackName: string): string {
  return CATEGORY_LABELS[slug] ?? fallbackName
}
