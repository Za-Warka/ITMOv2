# Tasks: Экскурсия
## Phase 1: Setup
- [x] T001 Проверить контракт времени фичи 1 и зафиксировать решения в specs/002-history-tour/research.md.
## Phase 2: Foundation
- [x] T002 Написать тесты порогов, SHA, ботов и равных дат в tests/history-tour.test.ts (FR-001–002).
## Phase 3: US1 — экскурсия
Independent test: пройти демо туда/обратно, сравнить точные даты и источник.
- [x] T003 [US1] Добавить buildTour в src/domain/history-tour.ts: максимум 5, UTC/SHA, first→era→author (FR-001–002).
- [x] T004 [US1] Добавить HistoryTour в src/components/history-tour.tsx с synthetic/partial и GitHub-ссылкой (FR-004).
- [x] T005 [US1] Добавить index и переходы exactDate в src/components/atlas.tsx, остановить play и очистить выбор (FR-003).
## Phase 4: US2 — выход и границы
Independent test: ручной seek/play/demo/culture/load закрывает экскурсию, finish сохраняет дату.
- [x] T006 [US2] Добавить сбросы, loading/empty и disabled края в src/components/atlas.tsx (FR-005–006).
- [x] T007 [US2] Добавить keyboard/focus/переносы в src/components/atlas.module.css (FR-006).
## Phase 5: Verification
- [x] T008 Выполнить npm run check и Playwright quickstart, записать факты в specs/002-history-tour/verification.md, выполнить speckit-converge (SC-001–003).
## Dependencies and strategy
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008. После T003 UI и дополнительное исследование тестов могут идти независимо; изменения Atlas последовательны. MVP US1 — проход с происхождением, затем US2 — завершение и границы.
