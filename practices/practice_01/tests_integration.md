# Integration-проверки

| Связь компонентов | Что может сломаться | Как воспроизводим | Ожидаемый результат | Evidence |
|---|---|---|---|---|
| API -> LLM (через ReviewService) | Вызов LLM при слишком большом diff | POST `/api/reviews` с телом, где `diff` длиной >20000 | HTTP 413, LLM не вызывается | Правило API-1; app/api.py:35-37 — нет лимита сейчас |
| API -> ReviewService -> LLM | Зависание или долгий ответ LLM | Смоделировать задержку >10с у LLM | Контролируемый ответ об ошибке по REL-1 | REL-1; app/review_service.py:21-22 — нет таймаута сейчас |
| End-to-end | Несоответствие OUT-1 | POST `/api/reviews` с валидным diff | JSON с `summary`, `risks≤3` (с полями), `checks` | OUT-1; app/review_service.py:22 — возвращается `{"comment": ...}` сейчас |

## Как использовали AI

- Строка в [`prompts.md`](prompts.md): P1-03.
- Что проверили и исправили сами: отразили API-1/REL-1/OUT-1; привязали к строкам diff; не добавляли собственных правил.
