# ПРОУЮТ — сайт мебельной фабрики

Статический сайт на Astro (чистый CSS, минимум JS). Хостинг — GitHub Pages.

## Команды
```bash
npm install
npm run data     # docx/xlsx из _source/ → src/data/*.json + docs/stage1-report.md
npm run images   # оригиналы фото из _source/ → public/img/ (этап 2)
npm run dev      # локальная разработка
npm run build    # сборка в dist/
```

## Где что менять
- Контакты, меню, оговорки, переключатель цен (`priceMode`) — `src/data/site.json`
- Разделы каталога — `src/data/categories.json`
- Модели, цены, тексты, характеристики — `src/data/products.json`
- Ручные поправки к данным из docx/xlsx — `scripts/overrides.json`; соответствие моделей и файлов — `scripts/model-map.json`

## base / site
`SITE_URL` и `BASE_PATH` берутся из окружения. По умолчанию `https://mdp2mdp.github.io` и `/prouyt`; для собственного домена: `SITE_URL=https://prouyt.ru BASE_PATH=/`.

`_source/` (исходные материалы и оригиналы фото) в git не попадает.
