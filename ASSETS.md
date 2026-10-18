# Визуальные материалы

Фотографии локальные, JPEG с Unsplash Images. 640 px для карточек, 1920 px для первого экрана. Снимки иллюстративные, не фотографии товарных предложений. Условия: https://unsplash.com/license.

| Файл | Источник |
| --- | --- |
| hero.jpg / sport.jpg | https://images.unsplash.com/photo-1503376780353-7e6692767b70 |
| suv.jpg | https://images.unsplash.com/photo-1555215695-3004980ad54e |
| electric.jpg | https://images.unsplash.com/photo-1560958089-b8a1929cea89 |
| sedan.jpg | https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb |
| family.jpg | https://images.unsplash.com/photo-1519641471654-76ce0107ad1b |
| touring.jpg | https://images.unsplash.com/photo-1611859266238-4b98091d9d9b |

`mark.svg` — временный векторный знак по описанию владельца.

## Каталог из канала

Файлы `assets/catalog/*.jpg` — 73 фотографии из восьми отобранных объявлений и 8 миниатюр карточек. Получены из предоставленного владельцем экспорта. EXIF удалён при перекодировании. Соответствие источникам — в `CATALOG-SOURCES.md`. Старые иллюстративные файлы каталога больше не используются.

## Полная база

Фотографии текущего каталога лежат рядом с записью: `data/vehicles/<brand>/<model>/<record_id>/photos/`. SHA-256 оригиналов и имена файлов из экспорта записаны в `sources.json`. Обложки 720×480, галереи ограничены 1440×1080, EXIF удалён. Неподписанные и прочие материалы сохранены в `data/intake`. Файлы `assets/catalog/` — предыдущая версия восьми карточек; текущий генератор их не использует. Исходные оригиналы и миниатюры целиком сохранены в `.local-source/telegram-export/` только локально.
