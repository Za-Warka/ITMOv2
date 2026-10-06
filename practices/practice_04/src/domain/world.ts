import { cultureFor } from "./cultures";
import { z } from "zod";

export const commitSchema = z.object({
  sha: z.string().min(1).max(100),
  date: z.iso.datetime(),
  authorId: z.string().min(1).max(100),
  authorName: z.string().max(200),
  bot: z.boolean(),
  message: z.string().max(500),
});
export const snapshotSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  branch: z.string().max(200),
  demo: z.boolean(),
  archived: z.boolean(),
  fork: z.boolean(),
  commits: z.array(commitSchema).max(10000),
  languages: z.record(z.string().max(100), z.number().finite().nonnegative()),
  coverage: z.object({
    headSha: z.string(),
    fetchedAt: z.iso.datetime(),
    languagesFetchedAt: z.iso.datetime(),
    historyComplete: z.boolean(),
    loadedCommitCount: z.number().int().nonnegative(),
    rangeStart: z.iso.datetime(),
    rangeEnd: z.iso.datetime(),
    reasons: z.array(z.string()),
  }),
});
export type Commit = z.infer<typeof commitSchema>;
export type RepositorySnapshot = z.infer<typeof snapshotSchema>;
export const eras = [
  { name: "Ненаселённая земля", threshold: 0 },
  { name: "Основание", threshold: 1 },
  { name: "Поселение", threshold: 25 },
  { name: "Город", threshold: 100 },
  { name: "Возрождение", threshold: 500 },
  { name: "Инженерная эпоха", threshold: 2000 },
];
export function eraFor(count: number) {
  return Math.max(
    0,
    eras.findLastIndex((era) => count >= era.threshold),
  );
}
export function parseRepository(input: string): string {
  let value = input.trim();
  if (value.includes("://")) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error("Введите ссылку https://github.com/owner/repo.");
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "Поддерживаются только ссылки https://github.com/owner/repo без дополнительных параметров.",
      );
    value = url.pathname.slice(1);
  }
  value = value.replace(/\/$/, "").replace(/\.git$/, "");
  if (
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})\/[a-zA-Z0-9_.-]{1,100}$/.test(value) ||
    [".", ".."].includes(value.split("/")[1])
  )
    throw new Error(
      "Укажите репозиторий в формате owner/repo, без пути к файлу или ветке.",
    );
  return value.toLowerCase();
}
export { cultures, cultureFor } from "./cultures";
export function sortedCommits(commits: Commit[]) {
  return [...new Map(commits.map((c) => [c.sha, c])).values()].sort(
    (a, b) =>
      Date.parse(a.date) - Date.parse(b.date) || a.sha.localeCompare(b.sha),
  );
}
export function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export type Building = {
  id: string;
  x: number;
  y: number;
  kind: "capital" | "home";
  language: string;
  level: number;
  name: string;
};
export function buildWorld(
  snapshot: RepositorySnapshot,
  date: string,
  includeBots = false,
) {
  if (!Number.isFinite(Date.parse(date))) throw new Error("Некорректная дата");
  const time = Date.parse(date);
  const commits = sortedCommits(snapshot.commits).filter(
    (c) => Date.parse(c.date) <= time,
  );
  const authors = [
    ...new Map(
      commits
        .filter((c) => includeBots || !c.bot)
        .map((c) => [
          c.authorId,
          { id: c.authorId, name: c.authorName, bot: c.bot },
        ]),
    ).values(),
  ];
  const era = eraFor(commits.length);
  const lots = authors.length
    ? Math.min(48, Math.ceil(4 * Math.sqrt(authors.length)))
    : 0;
  const allLanguages = Object.entries(snapshot.languages)
    .filter(([, bytes]) => bytes > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const languages =
    allLanguages.length > 5
      ? [
          ...allLanguages.slice(0, 5),
          ["Другие", allLanguages.slice(5).reduce((s, l) => s + l[1], 0)] as [
            string,
            number,
          ],
        ]
      : allLanguages;
  const total = languages.reduce((s, [, n]) => s + n, 0);
  const shares = languages.map(([name, bytes]) => ({
    name,
    bytes,
    share: bytes / total,
  }));
  const dominantLanguage = shares[0]?.name ?? "Смешанная культура";
  const culture = cultureFor(dominantLanguage);
  const authorCounts = new Map<
    string,
    { id: string; name: string; commits: number }
  >();
  for (const commit of commits) {
    if (commit.bot) continue;
    const author = authorCounts.get(commit.authorId) ?? {
      id: commit.authorId,
      name: commit.authorName,
      commits: 0,
    };
    author.commits++;
    author.name = commit.authorName;
    authorCounts.set(commit.authorId, author);
  }
  const humanCommits = [...authorCounts.values()].reduce(
    (sum, author) => sum + author.commits,
    0,
  );
  const leaders = [...authorCounts.values()]
    .sort(
      (a, b) =>
        b.commits - a.commits || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, 10)
    .map((author, index) => ({
      ...author,
      rank: index + 1,
      title: culture.titles[index],
      share: author.commits / humanCommits,
    }));
  // A fixed spiral avoids moving existing homes as the population grows.
  const positions: [number, number][] = [];
  for (let ring = 1; ring <= 4; ring++) {
    for (let x = -ring; x <= ring; x++)
      for (let y = -ring; y <= ring; y++) {
        if (Math.max(Math.abs(x), Math.abs(y)) === ring && x !== 0 && y !== 0)
          positions.push([x, y]);
      }
  }
  const buildings: Building[] = commits.length
    ? [
        {
          id: "capital",
          x: 0,
          y: 0,
          kind: "capital",
          language: dominantLanguage,
          level: era,
          name:
            era >= 3
              ? culture.capital
              : [
                  "",
                  "Лагерь основателей",
                  "Дом собраний",
                  "Городская библиотека",
                  "Дворец знаний",
                  "Инженерная академия",
                ][era],
        },
      ]
    : [];
  for (let i = 0; i < lots; i++) {
    const [x, y] = positions[i];
    buildings.push({
      id: `home-${i}`,
      x,
      y,
      kind: "home",
      language: dominantLanguage,
      level: era,
      name: `Жилой квартал ${i + 1}`,
    });
  }
  return {
    algorithmVersion: 2,
    dominantLanguage,
    culture,
    leaders,
    humanCommits,
    era,
    eraName: eras[era].name,
    commitCount: commits.length,
    authors,
    lots,
    buildings,
    languages: shares,
    recentCount: commits.filter(
      (c) => Date.parse(c.date) > time - 30 * 86400000,
    ).length,
    recentCommits: commits.slice(-12).reverse(),
    coverage: snapshot.coverage,
  };
}
export type WorldState = ReturnType<typeof buildWorld>;
