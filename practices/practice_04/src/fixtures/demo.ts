import { RepositorySnapshot } from "../domain/world";
const start = Date.parse("2023-02-01T10:00:00.000Z");
const names = [
  "Александра",
  "Михаил",
  "Анна",
  "Никита",
  "Мария",
  "Илья",
  "Даша",
  "Лев",
  "София",
  "Артём",
  "Вера",
  "Денис",
  "Ольга",
  "Тимур",
  "Ева",
  "Марк",
  "Полина",
  "Роман",
  "Нина",
  "Кирилл",
  "Лиза",
  "Саша",
  "Юлия",
  "Павел",
];
const messages = [
  "Новая глава истории проекта",
  "Добавлена навигация по атласу",
  "Обновлены компоненты карты",
  "Исправлена обработка дат",
  "Улучшена доступность интерфейса",
  "Добавлены примеры в документацию",
  "Ускорена загрузка истории",
  "Новые детали архитектуры",
];
const commits = Array.from({ length: 864 }, (_, i) => {
  const author = i % Math.min(24, 1 + Math.floor(i / 32));
  const bot = i > 100 && i % 41 === 0;
  return {
    sha: `demo-${String(i).padStart(6, "0")}`,
    date: new Date(start + i * 86400000 * 1.15).toISOString(),
    authorId: bot ? "demo-bot" : `author-${author}`,
    authorName: bot ? "atlas[bot]" : names[author],
    bot,
    message: messages[i % messages.length],
  };
});
export const demoSnapshot: RepositorySnapshot = {
  id: 147,
  name: "atlas / living-garden",
  description: "Воображаемый проект. Настоящая история роста.",
  branch: "main",
  demo: true,
  archived: false,
  fork: false,
  commits,
  languages: { TypeScript: 68000, Python: 21000, JavaScript: 11000 },
  coverage: {
    headSha: commits.at(-1)!.sha,
    fetchedAt: "2026-01-01T00:00:00.000Z",
    languagesFetchedAt: "2026-01-01T00:00:00.000Z",
    historyComplete: true,
    loadedCommitCount: commits.length,
    rangeStart: commits[0].date,
    rangeEnd: commits.at(-1)!.date,
    reasons: [],
  },
};
