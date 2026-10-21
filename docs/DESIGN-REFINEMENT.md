# Доработка покупательской части — 20.10.2026

Основание: присланный пользователем список Skills и пример запроса на премиальный автомобильный сайт. Текущий стек HTML/CSS/JavaScript, фирменный логотип, палитра, каталог, цены в исходной валюте, заявки и локальная автоматизация сохранены. Админка в этой итерации не менялась.

## Применённые навыки

Глобально установлены в `C:/Users/Yarchi/.codex/skills/` через штатный skill-installer:

- `frontend-design` — anthropics/skills, skills/frontend-design.
- `design-taste-frontend` — leonxlnx/taste-skill, актуальная папка skills/taste-skill.
- `ui-ux-pro-max` — nextlevelbuilder/ui-ux-pro-max-skill, .claude/skills/ui-ux-pro-max.
- `impeccable` — pbakaus/impeccable, .agents/skills/impeccable.

Инструкции прочитаны в текущем запросе; автоматическое подключение установленных Skills доступно со следующего запроса. Посторонний npm-установщик не запускался.

## Визуальное решение

Уточнение существующей фирменной системы, без смены бренда: тёмно-синий #0D2948, оранжевый #FF882B, светлый #F5F5F2, графит #171A1F. Один основной шрифт Manrope с кириллицей, локальный variable TTF 164 700 байт, font-display: swap. Шрифт и лицензия OFL взяты из https://github.com/google/fonts/tree/main/ofl/manrope и находятся в assets/fonts/.

Три направления Design Taste рассмотрены; выбран «The object, large», seed 89356378: крупный автомобиль и короткий путь к выбору. Детальный лист и выводы поиска UI/UX Pro Max оставлены в игнорируемой .local-source. Предложенные внешние шрифты и фотографии из листа не использованы: выбраны кириллический шрифт и уже имеющееся автомобильное изображение. Брендовые цвета имеют приоритет над рекомендованной общей красной палитрой. Новые фото, отзывы, статистика и бизнес-обещания не добавлялись.

Первый экран: одно двухстрочное сообщение, существующий Porsche Panamera крупным планом, поиск марки/модели и ссылка на подтверждённый Telegram. Живое взаимодействие — поиск с подсказками из реального текущего каталога; он сбрасывает мешающие фильтры и переносит запрос в общий каталог без перезагрузки. Каталог сохраняет источники, даты, валюты и предупреждение об отдельном расчёте ввоза.

Убраны декоративные надзаголовки и индекс первого экрана. Обновлены шрифт, иерархия каталога, кнопки, отступы, состояния и мобильная композиция. Восстановление фокуса и reduced motion предусмотрены в коде. Изображение первого экрана уже находилось в проекте; источник существующего изображения не переатрибутирован и новое авторство не заявляется.

## Проверки и ограничения

- Сборка прошла: 154 статические страницы, 1 639 локальных ссылок/ресурсов; проверки каталогов и фильтров прошли.
- Синтаксис order.js и git diff --check прошли.
- Impeccable context выполнен один раз; mechanical detector запущен, его исходный отчёт сохранён в .local-source/design-detector.json. Он отметил возможные проблемы контраста, мелкие тексты, старые стили и img без src в закрытых динамических карточках. Последние получают src при открытии; это требует проверки исполнения, а не автоматического удаления галереи.
- Контраст новых полей, навигации и ряда старых подписей усилен. Детектор не заменяет проверку фактического CSS-каскада и динамических состояний.
- Браузерная проверка заблокирована политикой доступа к локальному URL: инструмент сообщил о недопустимом протоколе, хотя был запрошен HTTP. Обход не предпринимался. Скриншоты и визуальные оценки этой итерации не получены; отображение на 390/768/1440 px, клики и фактическая загрузка шрифта не объявляются проверенными.
- Ни нулевое число визуальных дефектов, ни оценка Awwwards/WCAG-соответствия не заявляются. Для следующей визуальной проверки: первый экран, поиск, модальная карточка, мобильное меню, клавиатура и reduced motion.

Изменения локальные. GitHub Pages в этой итерации не публиковался.


## Catalog usability — 2026-10-21

Applied Frontend Design, UI/UX Pro Max and Impeccable to the existing catalog without replacing its visual direction.

- Visible selected-filter buttons remove one criterion at a time; removing currency also clears dependent price restrictions and price sorting.
- Original LOTTE titles split into model and trim for scanning. Agency titles and manually edited titles stay verbatim, with complete titles retained in the detail dialog.
- Cover photographs open the existing gallery using native keyboard-operable buttons.
- Keyboard focus survives saved-selection rerenders and removal of filter buttons.
- Empty results offer filter reset or individual selection. Reset preserves the selected catalog source.
- Added pure-function regression checks for filter dependencies, zero-mileage inputs and editorial title preservation; included in build.

Validation: full static build, catalog checks and JavaScript syntax passed. Impeccable source scan saved privately in `.local-source/catalog-polish-detector.json`; it still flags legacy styles and dialog images populated at runtime, so it is not evidence of rendered WCAG compliance. Browser inspection remains unavailable after the earlier local-URL policy rejection; mobile layout and real clicks need rendered verification when browser access is available. No GitHub Pages deployment in this iteration.


## Search assistance — 2026-10-21

- Search accepts common Russian brand/model aliases, Unicode spacing and punctuation, joined model names (SantaFe / Santa Fe, CX-5 / CX5), and the listing year.
- Up to four model suggestions come from records matching current filters, excluding inaccessible or absent photos. Counts describe saved advertisements, not confirmed stock. Selecting a suggestion changes only the text query.
- Suggestions are ordinary labelled buttons, keyboard accessible, with 44px minimum targets. No new dropdown focus trap or remote service.
- Regression checks cover aliases, year rejection, currency/source restrictions, absent photos, duplicate model counts and suggestion limits.
- Full build, syntax and whitespace checks passed. Local Node benchmark on 6,004 static records: median 31ms, p95 35ms for search plus suggestions (20 runs); excludes DOM rendering and network, and is not a mobile performance measurement.
- Static Impeccable scan only flagged the gallery image whose source is assigned before the dialog opens. Output: `.local-source/catalog-search-detector.json`. Browser policy still prevents rendered/mobile verification. Changes remain local.


## Unified buyer selection — 2026-10-21

Before implementation, saved all tracked and non-ignored source changes in commit `87f8d20`, annotated tag `backup-before-unified-selection-20261021`. The tag was pushed to origin; main and GitHub Pages were not published. This Git snapshot excludes the ignored runtime database, downloaded vehicle library and private photo processing environment.

- Hero and catalog help actions now open an inline three-step assistant alongside the same buyer catalog: body, total-order budget, optional year and mileage.
- Existing text, source, brand, currency and other filters remain. Body/year/mileage are explicitly replaced by the assistant. No separate recommendation catalog is opened.
- Total-order budget is a calculation request, never a seller-price restriction or a promise that displayed vehicles fit it. The budget is kept in `budgetWish` for reload/share and can be removed separately.
- Selected-car requests include the budget and wishes automatically. A budget summary can also prepare a generic request using the existing copy-only dialog. Nothing is sent automatically.
- Applied budget is retained in the URL; form budget is saved locally for future edits when storage is available. Existing saved-car selection remains intact.
- Legacy helper entry listeners are disabled on the unified buyer surface; body/query/budget from old guide links migrate to the catalog. Legacy direction remains a URL reference and does not assert a supplier route.
- Wizard fieldsets support keyboard navigation, step feedback, current-step validation, explicit close, return to search, and focus return. Network failure keeps unsubmitted wishes in the form.

Checks: full static build and regression suite, Node syntax, whitespace validation. New assertions cover zero mileage, range errors, optional values, preserved filter restrictions and separation of total budget from foreign prices. Browser rendering and mobile interaction were not verified in this iteration because the earlier browser policy rejection is unresolved.


## Buyer comparison — 2026-10-21

- Added comparison to the existing saved selection (2–5 cars), with no second favorites store. Button appears after selecting two cars.
- Native dialog contains a semantic table, column/row headers, caption and keyboard-focusable horizontal scroll region. First column remains sticky on narrow viewports.
- Only-differences mode hides equal and equally unknown values. It does not infer identical equipment from missing information.
- Price values retain their currencies and prefixes. No cross-currency ranking, total import quote or "best vehicle" claims.
- Names open the existing gallery/detail dialog; a shared request includes saved budget context, using the existing copy-only workflow. Closing details or the request restores focus to an available control.
- Regression assertions cover missing versus zero mileage, differing currencies, from-prices, unknown engines, sold markers, case-insensitive fuel labels, duplicate IDs and selection limits.

Full build, regression checks, JavaScript syntax and whitespace checks passed. Static Impeccable scan reported the existing gallery image populated at runtime; results are in `.local-source/buyer-comparison-detector.json`. Rendered appearance, mobile scrolling and real keyboard/dialog interaction remain unverified in this iteration. Backup tag remains unchanged; changes are local and unpublished.


## Unified vehicle detail page — 2026-10-21

Implemented the vehicle page part of the approved roadmap in the incumbent navy/orange, Manrope visual system. Main photograph and gallery form the primary content; price and request actions sit alongside them on desktop and below on narrow layouts. No replacement brand system, invented proof or price calculation.

- Catalog titles and Details now use ordinary links to `cars/vehicle/?id=...`. Cover photographs retain quick gallery preview; the dialog also links to the full page.
- Page displays original title, gallery with thumbnails/arrows, source/availability caveats, price in source currency, specs, original description, and a copy-only request.
- Saved selection uses the same 5-car local storage key. Catalog refreshes that selection on back/forward cache return and cross-tab storage changes.
- Return link retains only allowed catalog filters and budget context. Share copy strips the return state and shares only the car ID. URL builders use relative project paths suitable for GitHub Pages subdirectories.
- Known zero mileage stays zero; missing values stay unknown. Gallery errors skip failed sources and eventually show an explicit unavailable state, without a decorative car placeholder.
- Catalog navigation stores a one-record session preview for up to five minutes to avoid a second download of the full catalog. Direct/shared links without that preview currently fetch the approximately 6MB unified catalog. A smaller public per-record data endpoint is a remaining performance improvement; the current snapshot does not verify live availability.
- Generic detail route is `noindex,follow`; existing statically generated agency/model pages retain their SEO behavior. Per-car social preview/SSR is not implemented.

Validation: source HTML IDs/resources, subdirectory routing, safe return parameters, zero/unknown values, syntax and full build passed. Browser render, gallery clicks, native storage/back interactions and mobile layout still need real browser verification; no screenshot-based quality claim is made. New code is local, with the original GitHub backup tag preserved.


## Classified discovery patterns — 2026-10-21

User requested adapting useful Avito functionality. Direct web retrieval of Avito's home, car catalog and safety pages failed; no current visual audit of Avito was completed. Reviewed the first-party AvitoTech article "Recommendations on Avito" (2017): https://habr.com/ru/companies/avito/articles/338470/ . Its discussion of browsing/search/favorites signals informed the discovery direction; it is historical context, not proof of current interface behavior. No Avito UI, assets, badges or product claims were copied.

Applied to our existing catalog:
- Save up to five searches locally with query, scope, limits, currency, sorting, saved-selection filter and total-budget context. Canonical query order deduplicates equivalent searches. Each search can be reopened or removed. No account synchronization, server subscription or notifications are implied.
- Store the eight most recently viewed car IDs locally. Show only IDs still present in the current photo-bearing catalog. History includes quick previews and full detail pages, can be cleared, and updates on back/forward-cache returns and cross-tab storage changes.
- Mobile vehicle page has a fixed source-price/request action with safe-area padding; it is hidden while editing the request text to avoid obstructing the field. Desktop keeps the existing side panel.
- No admin UI additions or automatic external messages.

Validation: full build, JavaScript syntax and regression checks passed. New assertions cover history ordering/deduplication/limits, all eight history slots, absent-photo or withdrawn IDs, saved search limits, canonical deduplication and preserved zero mileage/budget/currency state. Browser click, mobile viewport and visual verification remain pending. Changes are local; backup tag preserved.


## Visual rhythm refinement — 2026-10-21

Preserved the existing "The object, large" direction and original hero photograph (inspected as a source image, not as a rendered page). Expanded its desktop coverage, grouped secondary hero actions and refined responsive title size. Search controls share a quiet background; source navigation now has an underline indicator. Cards use flex layout to align price/action regions, restrained borders, sentence-case source labels and plain saved-state text. New active styles respect reduced motion. Vehicle detail panels were aligned to the same visual rhythm. `DESIGN.md` records the incumbent system for future changes.

Full build and existing business-logic checks passed. CSS/HTML sources and whitespace were checked. Browser screenshot comparison and mobile interaction were not performed; the earlier browser tool policy rejection has not been resolved, so this iteration makes no claim of observed visual correctness. No new image source, price, dependency or external font was introduced. Changes remain local; the original backup tag is intact.


## 2026-10-21 — Showroom composition
- Catalog changed to two large photo cards per desktop row and one on narrow screens; larger model names, prices and controls.
- Vehicle page now has a larger gallery, sticky navy price panel, section navigation, and native fullscreen photo dialog with keyboard arrows, Escape and focus return. Original photos use contain, preserving their content.
- Build script, vehicle JavaScript syntax and diff checks passed. npm launcher unavailable; build executed with bundled Node directly. Browser rendering and mobile interaction remain unverified. No publication performed.


## 2026-10-21 — Buyer filter rail and marques
- Rebuilt catalog around a left filter rail and a right horizontal listing feed. Mobile uses a native disclosure for filters, with original form controls and validation.
- Popular marque buttons rank actual photo-bearing records under the other filters; search string and selected marque are excluded from the counts. Buttons toggle the existing brand control and retain the rest of the search.
- Locally stored Simple Icons marks with CC0 license; absent marks use the brand name. Saved selection uses a keyboard-accessible native checkbox styled as a switch. No fake purchase/credit/discount options added.
- Build and markup nesting checks passed. Rendered desktop/mobile validation remains outstanding because no browser verification was performed.


## 2026-10-21 — Decoded photo transitions
- Main vehicle gallery, quick preview and fullscreen share a decoded image cache (maximum 20 entries) and latest-request sequencing. Prior frame remains visible during loading, followed by a 240ms crossfade; reduced-motion skips animation.
- Adjacent photos preload after a successful selection unless Save-Data is enabled. A delayed loading indicator avoids flashing on cache hits, network requests time out after 15s, failed photos are skipped, and the full vehicle page allows retry when none remain.
- Async race assertions cover out-of-order completion, stale failures, failed loads retaining the current frame and cancellation. Browser animation/mobile rendering remain unverified.


## 2026-10-21 — Preliminary recycling-fee shortlist
- Added an optional sidebar select for technical pre-screening or known-power-only results; filter chips, search URLs, saved searches and vehicle back state preserve it.
- Missing power is disclosed in results and candidate badges; hybrid/electric/unknown-engine records are not treated as qualifying. Current catalog has zero explicit power records. No zero-fee claim, invented power or promised savings. See RECYCLING-SHORTLIST.md for limits.
- Boundary, missing-data and URL persistence checks added to build. Browser rendering not verified.


## 2026-10-21 — Separate site pages
- Home now contains hero/search and section navigation. Catalog, import process/FAQ, budget constructor and contacts are separate static pages with shared navigation, active states, titles and canonical URLs.
- Catalog code and full dataset are loaded only on the catalog route. Legacy app/guide/supplier scripts and hidden legacy catalog/dialogs are omitted from the new page shell.
- Existing vehicle pages return to catalog with whitelisted filters intact. Old home query/hash bookmarks redirect client-side to the appropriate route. Saved searches link directly to catalog. Shared local selection/history storage keys are preserved.
- Budget form transfers only its user-entered estimate via session storage into the contacts draft. No auto submission or live duty/rate calculation. Earlier contact text drafts are restored without deleting originals.
- Source fragments are in pages/, catalog-section.html remains authoritative. Build generates all five pages. Sitemap and server static allowlist include the new routes; an already running admin server needs restart for the expanded allowlist.
- Routing checks cover base paths, assets, anchors and catalog isolation. Visual/mobile browser verification remains unperformed.


## 2026-10-21 — Page and navigation motion
- Shared site-motion.css opts the five main pages and vehicle page into native same-origin document View Transitions. Header has a separate transition name; page content fades/moves 12px in 280ms. Navigation remains real links with default browser history, modifier keys, downloads and new tabs. No interception, forced delay or page-fetching router.
- Hover/focus underline for navigation, subtle CTA lift/press, arrow movement and short color transitions. Pointer-only hover motion is scoped to fine pointers; touch uses press feedback.
- Reduced-motion disables document/entrance transitions and button movement. Browsers without the transition property use a small CSS entrance; other unsupported cases retain regular navigation. No uniform cross-browser animation claim.
- Static routes/build checked; perceived smoothness and rendered mobile/desktop behavior remain unverified in browser.
