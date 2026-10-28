# Spec Delta

## Purpose

Позволяет авторизованному пользователю просматривать свои публичные GitHub-репозитории в личном кабинете и выбирать репозиторий для анализа в существующем атласе Repo Atlas.

## ADDED Requirements

### Requirement: List authenticated user repositories
Система SHALL возвращать авторизованному пользователю список его публичных GitHub-репозиториев с устойчивым идентификатором, полным именем, описанием, видимостью, статусом fork или archived, default branch и ссылкой на GitHub.

#### Scenario: Repositories are available
- **WHEN** авторизованный пользователь запрашивает список репозиториев
- **THEN** API возвращает только публичные репозитории, к которым относится его GitHub-профиль

#### Scenario: Anonymous repository request
- **WHEN** анонимный посетитель запрашивает личный список репозиториев
- **THEN** API возвращает ошибку `unauthorized` без обращения к пользовательским данным

### Requirement: Repository pagination
Система SHALL поддерживать постраничную загрузку списка репозиториев и сообщать, есть ли следующая страница.

#### Scenario: More repositories exist
- **WHEN** пользователь запрашивает страницу с меньшим количеством элементов, чем полный список
- **THEN** API возвращает текущую страницу, параметры пагинации и `hasNext: true`

#### Scenario: Last repository page
- **WHEN** пользователь запрашивает последнюю страницу
- **THEN** API возвращает доступные элементы и `hasNext: false`

### Requirement: Repository visibility boundary
Система SHALL исключать приватные репозитории из ответа MVP независимо от прав GitHub-токена.

#### Scenario: Private repository is returned by GitHub
- **WHEN** GitHub включает приватный репозиторий в upstream-ответ
- **THEN** сервис отбрасывает его до формирования ответа браузеру

### Requirement: Open repository in Atlas
Система SHALL позволять открыть выбранный публичный репозиторий в существующем сценарии построения цивилизации по его нормализованному `owner/repository`.

#### Scenario: User selects repository
- **WHEN** пользователь выбирает репозиторий в кабинете
- **THEN** frontend передаёт его имя текущему endpoint анализа репозитория и открывает карту без потери гостевого демо-сценария

### Requirement: GitHub failure response
Система SHALL преобразовывать ошибки GitHub, включая rate limit, not found и временную недоступность, в стабильные коды API без внутренних деталей.

#### Scenario: GitHub rate limit
- **WHEN** GitHub сообщает о превышении лимита
- **THEN** API возвращает `github_rate_limit`, понятное сообщение и, если доступно, время повторной попытки
