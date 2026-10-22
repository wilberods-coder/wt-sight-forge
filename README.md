# WT Sight Forge

**Генератор пользовательских прицелов War Thunder из ваших картинок.** Загрузите PNG / JPG / WebP, настройте — и получите готовый `.blk` для папки `UserSights`. Всё работает в браузере: без сервера, регистрации и платных API, изображения никуда не загружаются.

🌐 **Сайт:** https://wilberods-coder.github.io/wt-sight-forge/
📦 **Репозиторий:** https://github.com/wilberods-coder/wt-sight-forge

> English summary below.

## Как это работает

Файл прицела War Thunder — это **текстовая конфигурация** (формат DataBlock `.blk`), а не картинка. Встроить в него растровое изображение нельзя, поэтому генератор **векторизует** картинку в примитивы, которые игра действительно умеет рисовать:

| Что | Блок `.blk` | Как получается |
|---|---|---|
| Залитые области | `drawQuads { quad { tl, tr, br, bl } }` | маска → сетка → жадное покрытие прямоугольниками |
| Контуры | `drawLines { line { line:p4 } }` | marching squares → упрощение Дугласа–Пекера |
| Окружности | `drawCircles { circle { … } }` | конструктор элементов |
| Подписи | `drawTexts { text { … } }` | дальномерная шкала, деления |
| Баллистическая шкала | `crosshair_distances { distance:p3 }` | позиции рисок считает сама игра |

Все координаты пишутся в тысячных (`thousandth:b = yes`), ось Y направлена вниз — как в официальном примере вики.

### Возможности

- Drag & drop PNG / JPG / JPEG / WebP, миниатюра, замена и удаление.
- Удаление однотонного фона (заливка от краёв, внутренние области не трогаются).
- Маска по альфа-каналу, тёмным/светлым областям или по краям (оператор Собеля), настраиваемый порог, инверсия, удаление мусора.
- Режимы «заливка», «контур», «заливка + контур»; детализация и упрощение контуров для контроля размера файла.
- Размер (в тысячных), поворот, смещение от центра (слайдерами или перетаскиванием в предпросмотре), отражение.
- Конструктор: центральная точка, перекрестие (линии или толстые планки), горизонтальная и вертикальная линии с делениями, стадиметрическая дальномерная шкала, баллистические деления дистанции, окружности, пользовательские линии.
- Предпросмотр: 6 фонов местности, цели-танки на 400/800/1500 м в реальном угловом размере, кратность, сетка в тысячных, центр, подсветка, маска прицела, подложка исходника.
- GENERATE .BLK: строгая проверка синтаксиса и структуры, скачивание `.blk` или ZIP (структура `UserSights/…`, инструкции RU/EN, файл проекта).
- Проекты сохраняются локально (IndexedDB) — вкладка «Мои прицелы»; импорт/экспорт `.wtsf.json`.
- Русский интерфейс по умолчанию, полная английская локализация, тёмная тема, адаптив под смартфоны, офлайн-режим после первого открытия (service worker).

### Ограничения формата (честно)

- Весь прицел рисуется **одним цветом** (`crosshairColor`) плюс цвет подсветки — фотографии, градиенты и разные цвета невозможны.
- Полупрозрачность отдельных элементов не поддерживается — имитируется штриховкой строк.
- Элементы в тысячных масштабируются вместе с кратностью прицела.
- Более ~4000 элементов в игре не проверялось.
- Предпросмотр в браузере приблизителен (толщина линий, шрифт, экранные единицы).
- **Совместимость с текущей версией игры нужно подтвердить в тестовом заезде** (`Alt + F9` перечитывает прицел). Генератор проверяет файл по официальной документации и реальным рабочим образцам, но запустить War Thunder из браузера невозможно.

## Установка прицела в игру

По официальной вики ([User-made sighting reticles](https://wiki.warthunder.com/User-made_sighting_reticles)):

1. Папка (с обновления 2.53): `Documents\My Games\WarThunder\Saves\<ID>\production\UserSights` (Linux: `$HOME/.config/WarThunder/Saves/<ID>/production/UserSights/`). ID — на странице профиля в магазине Gaijin.
2. Подпапка `all_tanks` (для всей техники) или ID конкретной машины.
3. Скопируйте `.blk` туда и перезапустите клиент.
4. **Options → Main Parameters → Ground Vehicle Battle Settings → «Sight Settings»**, выберите прицел в меню «Reticle», нажмите «Save».
5. Тестовый заезд, `Alt + F9` — перезагрузка прицела после правок.

Подробная инструкция и диагностика — на вкладке «Инструкция» сайта.

## Локальный запуск

Нужен Node.js 20+.

```bash
git clone https://github.com/wilberods-coder/wt-sight-forge.git
cd wt-sight-forge
npm install
npm run dev        # http://localhost:5173
npm test           # 37 unit-тестов: парсер, генератор, обработка изображений, ZIP
npm run build      # production-сборка в dist/
npm run preview    # просмотр сборки
```

`node scripts/make-fixtures.mjs` пересоздаёт тестовые изображения (PNG с прозрачностью, JPG с фоном, сложная сцена).

## Тесты

- **Реальные образцы**: шаблон пользовательского прицела из сообщества и примеры из официальной вики (P40, баллистика Т-55А, шкалы по умолчанию, блоки draw*). Парсер находит в примерах вики реальные опечатки (`3,5` в `p4`, незакрытый блок) — это проверяется тестами.
- **Синтаксис**: неверные типы, экспоненциальная запись, цвета вне 0..255, смешивание форматов `crosshair_distances`, невыпуклые `quad`.
- **Изображения**: PNG с прозрачным фоном, JPG с белым фоном (артефакты сжатия), сложная «фотографическая» сцена с шумом.
- **Генерация**: все элементы, повороты/отражения (выпуклость quad), размер файла, только ASCII, структура ZIP.

## Публикация на GitHub Pages

Workflow `.github/workflows/deploy.yml` на каждый push в `main` ставит зависимости, гоняет тесты, собирает и публикует `dist/`. В настройках репозитория: **Settings → Pages → Source: GitHub Actions**. `base` в `vite.config.ts` — `/wt-sight-forge/`.

## Структура

```
src/core/blk/      парсер, валидатор и сериализатор формата .blk
src/core/image/    фон, маска, контуры, прямоугольники, трассировка
src/core/sight/    модель проекта, конструктор элементов, компилятор .blk
src/lib/           рендер предпросмотра, сцены, загрузка, хранилище, ZIP
src/components/    UI-панели
src/pages/         Генератор, Мои прицелы, Инструкция
tests/             vitest + реальные образцы .blk
```

---

## English

**WT Sight Forge** turns your images into War Thunder custom sight files (`.blk`) entirely in the browser. Since a sight file is a text configuration, the image is vectorised into primitives the game supports — filled `drawQuads`, `drawLines` outlines — plus a constructor for standard elements (center dot, crosshair, lines, stadiametric rangefinder, ballistic range marks, circles, custom lines). Output is validated by a strict parser tested against real sight files. Install into `Saves/<ID>/production/UserSights/all_tanks/` and select it under *Options → Main Parameters → Ground Vehicle Battle Settings → Sight Settings → Reticle*. Final compatibility must be confirmed in a test drive (`Alt + F9` reloads the sight).

Unofficial fan tool. War Thunder is a trademark of Gaijin Entertainment. Licensed under MIT.
