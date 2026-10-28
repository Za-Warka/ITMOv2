# Две фичи через GitHub Spec Kit

Рабочая папка — `practices/practice_05`, ветка `practice_05`. OpenSpec-артефакты прежней разработки сохранены, для этих двух фич они не использовались.

## Установка

Установлен официальный `specify-cli` 1.2.4 с PyPI через `uv tool install specify-cli --python 3.12`. Проверка `specify version`: CLI 1.2.4, Python 3.12.13. Повторяемая установка той же версии:

```sh
uv tool install specify-cli==1.2.4 --python 3.12
specify init --here --force --non-interactive --integration codex --integration-options=--skills --script sh
```

Источник: https://github.com/github/spec-kit и его installation guide. `.specify/init-options.json` и `.specify/integration.json` фиксируют версию и интеграцию. Установлены официальные `.agents/skills/speckit-*`, шаблоны, shell scripts и workflow. Новых runtime-зависимостей приложения нет.

## Выполненный процесс

Spec Kit выполняет этапы через инструкции skills, а не через shell-команду `specify implement`. В этом сеансе агент прочитал установленные SKILL.md и выполнил их инструкции. Дополнительных extension hooks в проекте нет.

1. `$speckit-constitution`: принципы из AGENTS.md записаны в `.specify/memory/constitution.md` v1.0.0. Исполнен официальный resolve-template.sh.
2. `$speckit-specify`: отдельно созданы [001-share-era](../specs/001-share-era/spec.md) и позднее [002-history-tour](../specs/002-history-tour/spec.md), с user stories, FR, SC и граничными случаями. `.specify/feature.json` выбирает текущую фичу без переключения Git-ветки.
3. `$speckit-plan`: официальный setup-plan.sh для каждой фичи; созданы plan, research, data-model, contracts, quickstart. Исследование отдельным агентом выполнено по прямой инструкции plan skill.
4. `$speckit-checklist`: официальный check-prerequisites.sh с checklist-template; авторское ревью требований отражено в checklists/ux.md. Это ревью агента, не фиктивное одобрение пользователя. Встроенный requirements checklist также пройден.
5. `$speckit-tasks`: официальный setup-tasks.sh; задачи организованы по user stories, с ID, зависимостями и путями.
6. `$speckit-analyze`: официальный check-prerequisites.sh --require-spec --require-tasks --include-tasks и read-only анализ согласованности. Отчёты сохранены в analysis.md; обе фичи имеют 100% покрытие FR задачами, critical=0.
7. `$speckit-implement`: сначала тесты, затем чистая модель, интерфейс и проверки; выполненные задачи отмечены в tasks.md.
8. `$speckit-converge`: проверка кода против spec/plan/tasks и конституции. Результат и фактически выполненные проверки — в verification.md каждой фичи.

Первая фича завершена и проверена до начала спецификации второй: исходно 65 тестов → после первой 77 → после второй 88. Подробности: [первая проверка](../specs/001-share-era/verification.md), [вторая проверка](../specs/002-history-tour/verification.md).

## Запуск

```sh
npm run dev
```

Открыть http://127.0.0.1:3000/?repo=demo. Кнопки «Начать экскурсию» и «Скопировать ссылку на эпоху» находятся над таймлайном. В экскурсии текст остановки появляется в летописи. Реальные репозитории используют существующий серверный API; Go нужен для прежней авторизации, но новые функции её не требуют.

## Повторение проверок

```sh
npm run check
```

Для браузера — Playwright CLI по установленному skill. После `playwright-cli open http://127.0.0.1:3000`:

```sh
playwright-cli run-code --filename tests/browser/share-era.txt
playwright-cli run-code --filename tests/browser/history-tour.txt
playwright-cli run-code --filename tests/browser/repository-links.txt
```

В сеансе использован wrapper `/Users/zawarka/.codex/skills/playwright/scripts/playwright_cli.sh` вместо глобального CLI. Файлы `.txt` — функции-snippets формата run-code, не модули JS: завершающий semicolon форматтера несовместим с обёрткой CLI. Backend/session и ответы GitHub изолированы mocks. Проверки не обращаются к личному GitHub и не требуют токена. Скриншоты: `output/playwright/tour-360.png`, `tour-768.png`, `tour-1440.png`.

Ограничения: ссылка хранит параметры, а не снимок истории, камеру или активность экскурсии. Экскурсия не анализирует ancestry и релизы. На одинаковой UTC-дате карта показывает все коммиты этого момента. Проверка реального GitHub API онлайн не выполнялась; серверный контракт проверялся mock NDJSON. Рефлексия студента не изменялась.
