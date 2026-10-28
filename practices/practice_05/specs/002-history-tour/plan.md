# Implementation Plan: Экскурсия
**Branch**: practice_05 | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)
## Summary
Чистая buildTour(snapshot) на sortedCommits и eras. Кандидаты с приоритетом first → era → author; дедуп по SHA, до 5, затем хронологическая сортировка. Контроллер индекса в Atlas использует exactDate и resolveEraDate из фичи 1. Отдельный HistoryTour показывает текст и кнопки.
## Technical Context
TypeScript strict, React/Next из lockfile; без новых зависимостей/запросов/хранилища. Vitest + Playwright CLI. Web 360/768/1440; до 1000 наблюдаемых коммитов, O(n log n), максимум 5 остановок.
## Constitution Check
I: только наблюдаемые данные и явное демо/partial. II: сортировка UTC/SHA, точная дата, чистая функция. III: пустые данные и доступные кнопки. IV: unit + браузер + npm run check отдельно от фичи 1. V: только practice_05, Go/API не меняются. До и после дизайна PASS.
## Project Structure
src/domain/history-tour.ts — события и алгоритм.
src/components/history-tour.tsx — текстовая экскурсия.
src/components/atlas.tsx — индекс, запуск, навигация, отмена.
src/components/atlas.module.css — оформление и переносы.
tests/history-tour.test.ts — алгоритм и границы.
## Design
Палитра и шрифты проекта сохранены. Кнопка запуска рядом с таймлайном; текст экскурсии над списком коммитов в летописи. Порядковый номер показывает реальный прогресс; кнопки минимум 44px, перенос строк на мобильном. Карта остаётся главной, дополнительных анимаций нет. Дизайн соответствует brief, декоративных сущностей не добавляется.
## Complexity Tracking
Нарушений нет. Переиспользуем resolveEraDate; не привязываем домен к React.
