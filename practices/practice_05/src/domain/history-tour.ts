import { Commit, eras, RepositorySnapshot, sortedCommits } from "./world";
export type TourStop = {
  kind: "first" | "era" | "author";
  sha: string;
  date: string;
  title: string;
  description: string;
};
export function buildTour(snapshot: RepositorySnapshot): TourStop[] {
  const commits = sortedCommits(snapshot.commits);
  if (!commits.length) return [];
  const stops = new Map<string, TourStop>();
  function add(
    commit: Commit,
    kind: TourStop["kind"],
    title: string,
    description: string,
  ) {
    if (stops.size < 5 && !stops.has(commit.sha))
      stops.set(commit.sha, {
        kind,
        sha: commit.sha,
        date: commit.date,
        title,
        description,
      });
  }
  add(
    commits[0],
    "first",
    "Начало наблюдаемой истории",
    "Самый ранний коммит в загруженной выборке. Он не обязательно является первым коммитом проекта.",
  );
  for (const era of eras.filter((era) => era.threshold > 1)) {
    const commit = commits[era.threshold - 1];
    if (commit)
      add(
        commit,
        "era",
        `Эпоха «${era.name}»`,
        `На этом коммите достигнут порог ${era.threshold} уникальных наблюдаемых коммитов. Это художественный порог развития города, а не оценка качества кода.`,
      );
  }
  const seen = new Set<string>();
  for (const commit of commits) {
    if (commit.bot || seen.has(commit.authorId)) continue;
    seen.add(commit.authorId);
    add(
      commit,
      "author",
      "Новый житель",
      `${commit.authorName}: первое наблюдаемое появление автора в загруженной истории. Жители влияют на число жилых участков; один участок может представлять нескольких авторов.`,
    );
  }
  return [...stops.values()].sort(
    (a, b) =>
      Date.parse(a.date) - Date.parse(b.date) || a.sha.localeCompare(b.sha),
  );
}
