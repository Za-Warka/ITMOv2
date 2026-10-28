# Spec Delta

## Purpose

Даёт пользователю безопасный способ войти в Repo Atlas через GitHub и получить личный кабинет с минимальным локальным профилем. Сессия связывает браузер с пользователем, но не раскрывает GitHub-секреты.

## ADDED Requirements

### Requirement: GitHub OAuth login
Система SHALL начинать серверный OAuth-поток GitHub и после успешного callback создавать или обновлять локальный профиль пользователя.

#### Scenario: Successful login
- **WHEN** пользователь подтверждает доступ на GitHub и возвращается с действительными `code` и `state`
- **THEN** система создаёт сессию, сохраняет GitHub ID и login пользователя и перенаправляет его в личный кабинет

#### Scenario: Invalid OAuth state
- **WHEN** callback содержит неизвестный, повторно использованный или просроченный `state`
- **THEN** система отклоняет вход и не создаёт сессию

### Requirement: Session status
Система SHALL предоставлять текущий статус сессии без передачи браузеру GitHub access token, client secret или email пользователя.

#### Scenario: Authenticated session
- **WHEN** браузер отправляет действительную сессионную cookie
- **THEN** API возвращает `authenticated: true` и публичные поля локального профиля

#### Scenario: Anonymous request
- **WHEN** браузер не отправляет действительную сессионную cookie
- **THEN** API возвращает `authenticated: false` и `user: null`

### Requirement: Logout
Система SHALL завершать локальную сессию по запросу пользователя.

#### Scenario: User logs out
- **WHEN** авторизованный пользователь отправляет запрос выхода
- **THEN** сессия становится недействительной, cookie очищается, а последующий запрос статуса считается анонимным

### Requirement: Public profile data
Система SHALL хранить и показывать только данные, необходимые для идентификации пользователя в Repo Atlas: GitHub ID, login, отображаемое имя, avatar URL и ссылку на профиль.

#### Scenario: GitHub profile is incomplete
- **WHEN** GitHub не возвращает отображаемое имя или avatar URL
- **THEN** система сохраняет доступные значения и использует login как запасное отображаемое имя

### Requirement: OAuth failure handling
Система SHALL возвращать понятное состояние ошибки при отказе пользователя, недействительном callback или недоступности GitHub.

#### Scenario: User denies authorization
- **WHEN** GitHub возвращает отказ в авторизации
- **THEN** система не создаёт пользователя или сессию и показывает возможность повторить вход
