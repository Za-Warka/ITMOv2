# Design

## Context

Сейчас Next.js обслуживает интерфейс и единственный серверный маршрут `/api/repository`, а GitHub-данные кэшируются только в памяти процесса. Новая функция пересекает frontend, авторизацию, внешнее API, долговременное хранилище и безопасность, поэтому Go-бэкенд вводится как отдельный HTTP-сервис. Текущая карта и демо должны продолжить работать без входа.

## Goals / Non-Goals

**Goals:**

- Дать браузеру единый API для OAuth-сессии, личного кабинета и поиска `@login`.
- Скрыть GitHub OAuth client secret и access token на сервере.
- Сохранить нормализованные публичные данные и ограниченный кэш, чтобы не зависеть от GitHub при каждом повторном открытии.
- Подключить выбранный репозиторий к существующему `RepositorySnapshot` и карте без переписывания доменной модели.
- Сделать Go-код тестируемым через разделение HTTP handlers, services, GitHub client и store.

**Non-Goals:**

- Приватные репозитории, запись в GitHub, организации и управление разрешениями.
- Полнотекстовый поиск по имени или fuzzy-поиск пользователей.
- Перенос текущего анализа коммитов из Next.js в Go в рамках этого изменения.
- Микросервисная очередь, фоновые workers и PostgreSQL.

## Decisions

### Граница сервисов

Go владеет `/auth/*` и `/api/account/*`, а Next.js продолжает владеть текущим `/api/repository` и рендерингом карты. На deployment единый origin обеспечивается reverse proxy: `/auth` и `/api/account` направляются в Go, остальные маршруты — в Next.js. Это снижает риск поломать проверенный MVP; прямой вызов Go из браузера с отдельным origin отклонён из-за дополнительной CORS- и cookie-сложности.

### OAuth и сессии

Используется серверный GitHub OAuth authorization-code flow. `state` хранится ограниченное время и проверяется на callback. После обмена кода Go получает профиль GitHub, сохраняет только нужные публичные поля и выдаёт случайный непрозрачный session ID в HttpOnly cookie. Cookie имеет `Secure` в production и `SameSite=Lax`; access token не попадает в JSON и логи.

Альтернатива — GitHub App с fine-grained permissions. Она предпочтительнее для будущих приватных репозиториев, но для публичного MVP добавляет настройку установки приложения и не нужна для чтения заявленного набора данных.

### Хранилище

Используется SQLite с миграциями для `users`, `sessions`, `oauth_states` и `repository_cache`. Сессии хранят хэш session ID, срок действия и user ID; исходная cookie содержит только случайный идентификатор. Для публичного MVP OAuth token после получения профиля не сохраняется: GitHub-запросы к публичным данным выполняются без пользовательского token либо с общим серверным `GITHUB_TOKEN`, если он настроен.

SQLite выбран вместо PostgreSQL из-за локального учебного deployment и отсутствия требований к нескольким backend-инстансам. Абстракция store сохраняется, чтобы заменить драйвер позже.

### API-контракт

Минимальные маршруты Go:

```text
GET  /auth/github
GET  /auth/github/callback
POST /auth/logout
GET  /api/session
GET  /api/me/repositories?page=1&perPage=30
GET  /api/users/{login}
GET  /healthz
```

Ответы используют JSON с машинным `error.code` и русским `error.message`. Login нормализуется на границе API; путь к GitHub строится сервером из проверенного значения и не принимается как URL.

### Go-модули и границы кода

Рекомендуется структура `backend/cmd/api`, `backend/internal/http`, `backend/internal/auth`, `backend/internal/github`, `backend/internal/store` и `backend/migrations`. Доменный слой не импортирует HTTP или SQLite. GitHub client отвечает за заголовки, pagination, rate limit и преобразование upstream-ответов; handlers отвечают только за ввод, сессию и HTTP-ответ.

### Интеграция с frontend

В Next.js добавляются ссылка входа, состояние `/api/session`, страница `/account` и форма поиска. Кабинет получает `full_name` репозитория, а затем переиспользует существующий guest-flow `/api/repository?repo=owner/repo`. Запросы к Go используют тот же origin, поэтому браузеру не нужны bearer tokens или CORS-исключения.

### Ошибки и лимиты

GitHub 401/403/404/429, timeout и некорректные upstream-данные переводятся в ограниченный набор публичных кодов. Нельзя возвращать stack trace, email, OAuth token или полный ответ GitHub. Кэш имеет TTL и ограниченный размер; stale-данные показываются только с явной отметкой, если это будет реализовано отдельной задачей.

## Risks / Trade-offs

- [GitHub rate limit] → Ограничить pagination, использовать TTL-кэш, передавать `Retry-After` и показывать понятную ошибку.
- [Утечка OAuth token] → Не отдавать token браузеру, запретить логирование секретов, использовать зашифрованное хранение или не хранить token для публичных запросов.
- [Сессия на нескольких инстансах] → Для MVP зафиксировать один backend-инстанс; перед масштабированием вынести sessions в общий store.
- [Cookie и reverse proxy] → Проверить production flags, trusted proxy и callback URL в интеграционном тесте.
- [Изменение API GitHub] → Версионировать заголовок GitHub API, валидировать upstream через схемы и скрывать неожиданные поля за стабильным DTO.
- [Несогласованность Next.js и Go во время запуска] → Ввести `/healthz`, сначала включить Go API за proxy, затем показывать кнопку входа только при доступном backend.

## Migration Plan

1. Добавить Go-сервис и миграции SQLite, не меняя текущий Next.js API.
2. Реализовать healthcheck, OAuth callback и session endpoint; проверить их отдельными тестами.
3. Добавить repository и user-search endpoints с mock GitHub client.
4. Добавить frontend-экраны за feature boundary и проксирование маршрутов локально.
5. Провести smoke-проверку: гостевая карта, вход, выход, кабинет, `@login`, ошибка GitHub.
6. При откате отключить proxy и ссылки на кабинет; текущий guest-flow остаётся рабочим.

## Open Questions

Нет вопросов, блокирующих реализацию MVP. В локальной разработке используется Next.js rewrite/proxy на Go API; конкретный reverse proxy production определяется настройками deployment и не меняет публичный API.
