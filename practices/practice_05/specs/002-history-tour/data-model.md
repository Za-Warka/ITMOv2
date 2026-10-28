# Data model
TourStop: kind first|era|author, sha, date, title, description. Дополнительных персональных данных нет.
Источник: RepositorySnapshot. sortedCommits убирает SHA, сортирует UTC/SHA. Переход эпохи соответствует уникальному коммиту с индексом threshold-1. First имеет приоритет над совпадающим автором.
State: index null → start 0 → next/previous bounded → finish null. finish сохраняет дату. Ручной seek/play/load/demo/culture закрывает тур. tab меняется на chronicle при переходе к остановке; если выбрана другая вкладка, управление у таймлайна позволяет вернуться/завершить.
