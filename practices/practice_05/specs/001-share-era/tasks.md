# Tasks: Ссылка на эпоху
## Phase 1: Setup
- [x] T001 Зафиксировать конституцию и область в .specify/memory/constitution.md и AGENTS.md.
## Phase 2: Foundation
- [x] T002 Проверить контракты URL в tests/era-link.test.ts до реализации (FR-001–003).
## Phase 3: US1 — восстановление
Independent test: открыть ссылку демо с датой, культурой, вкладкой и ботами.
- [x] T003 [US1] Реализовать codec и clamp в src/domain/era-link.ts (FR-001, FR-003; дата ISO UTC, tab allowlist).
- [x] T004 [US1] Восстановить exactDate и настройки после result в src/components/atlas.tsx (FR-002, FR-005).
## Phase 4: US2 — копирование
Independent test: успех Clipboard и fallback при запрете.
- [x] T005 [US2] Добавить кнопку, статус и readOnly поле в src/components/share-era.tsx (FR-004).
- [x] T006 [US2] Добавить адаптивные стили в src/components/atlas.module.css (FR-006).
## Phase 5: Verification
- [x] T007 Выполнить npm run check и браузерные сценарии из specs/001-share-era/quickstart.md, записать результат в verification.md этой фичи (SC-001–003).
## Dependencies and strategy
T001 → T002 → T003 → T004 → T005 → T006 → T007. Сначала восстановление, затем копирование. Параллельных задач внутри одного файла нет; после T003 можно независимо готовить UI и расширять тесты. MVP US1 требует US2 для создания ссылки, прямой URL проверяется независимо.
