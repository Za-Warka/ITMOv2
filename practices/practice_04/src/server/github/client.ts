import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  Commit,
  RepositorySnapshot,
  parseRepository,
  sortedCommits,
} from "../../domain/world";

export class GitHubError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryAfter?: string,
  ) {
    super(message);
  }
}
const anonymousKey =
  process.env.AUTHOR_HASH_SECRET || randomBytes(32).toString("hex");
const repoSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  description: z.string().nullable(),
  default_branch: z.string(),
  private: z.boolean(),
  archived: z.boolean(),
  fork: z.boolean(),
});
const apiCommit = z.object({
  sha: z.string(),
  author: z
    .object({ id: z.number(), login: z.string(), type: z.string().optional() })
    .nullable(),
  commit: z.object({
    message: z.string(),
    author: z
      .object({ name: z.string().nullable(), email: z.string().nullable() })
      .nullable(),
    committer: z.object({ date: z.iso.datetime() }).nullable(),
  }),
});
export type LoadStage = "metadata" | "history" | "languages" | "building";
type StageListener = (stage: LoadStage, count?: number) => void;

export async function fetchSnapshot(
  input: string,
  request: typeof fetch = fetch,
  onStage: StageListener = () => {},
): Promise<RepositorySnapshot> {
  const name = parseRepository(input);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Repo-Atlas",
  };
  if (process.env.GITHUB_TOKEN)
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  async function get(path: string) {
    let response: Response;
    try {
      response = await request(`https://api.github.com/repos/${name}${path}`, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
        redirect: "error",
      });
    } catch {
      throw new GitHubError("GitHub не ответил вовремя. Попробуйте ещё раз.");
    }
    if (!response.ok) {
      if (response.status === 404)
        throw new GitHubError(
          "Репозиторий не найден или недоступен. Проверьте ссылку и публичность проекта.",
          404,
        );
      if (response.status === 409)
        throw new GitHubError("Репозиторий пока пуст.", 409);
      if (response.status === 403 || response.status === 429) {
        const reset = response.headers.get("x-ratelimit-reset");
        const retry =
          response.headers.get("retry-after") ??
          (reset
            ? String(Math.max(1, Number(reset) - Math.floor(Date.now() / 1000)))
            : undefined);
        throw new GitHubError(
          response.status === 429 ||
            response.headers.get("x-ratelimit-remaining") === "0" ||
            retry
            ? "Достигнут лимит GitHub. Повторите позже или настройте серверный GITHUB_TOKEN."
            : "GitHub запретил доступ к этому репозиторию.",
          response.status,
          retry,
        );
      }
      throw new GitHubError(
        "GitHub временно недоступен. Повторите запрос позже.",
      );
    }
    return response;
  }
  onStage("metadata");
  const repo = repoSchema.parse(await (await get("")).json());
  if (repo.private)
    throw new GitHubError("Поддерживаются только публичные репозитории.", 403);
  const now = new Date().toISOString();
  const reasons: string[] = [];
  let headSha = "",
    historyComplete = true;
  const commits: Commit[] = [];
  onStage("history", 0);
  try {
    const head = z
      .object({ sha: z.string() })
      .parse(
        await (
          await get(`/commits/${encodeURIComponent(repo.default_branch)}`)
        ).json(),
      );
    headSha = head.sha;
    for (let page = 1; page <= 10; page++) {
      const response = await get(
        `/commits?sha=${encodeURIComponent(headSha)}&per_page=100&page=${page}`,
      );
      const batch = z.array(apiCommit).parse(await response.json());
      for (const item of batch) {
        if (!item.commit.committer?.date) {
          historyComplete = false;
          reasons.push("Пропущен коммит без корректной даты.");
          continue;
        }
        const rawAuthor = item.commit.author;
        const authorId = item.author
          ? `github-${item.author.id}`
          : `anon-${createHmac("sha256", anonymousKey)
              .update(
                rawAuthor?.email?.toLowerCase() ||
                  `${rawAuthor?.name ?? "unknown"}:${item.sha}`,
              )
              .digest("hex")
              .slice(0, 24)}`;
        commits.push({
          sha: item.sha,
          date: new Date(item.commit.committer.date).toISOString(),
          authorId,
          authorName: (
            item.author?.login ??
            rawAuthor?.name ??
            "Неизвестный автор"
          ).slice(0, 200),
          bot:
            item.author?.type === "Bot" ||
            Boolean(item.author?.login.endsWith("[bot]")),
          message: item.commit.message.split("\n")[0].slice(0, 500),
        });
      }
      onStage("history", commits.length);
      const hasNext = /rel="next"/.test(response.headers.get("link") ?? "");
      if (!hasNext) break;
      if (page === 10) {
        historyComplete = false;
        reasons.push("Загружены последние 1000 коммитов.");
      }
    }
  } catch (error) {
    if (!(
      error instanceof GitHubError &&
      error.status === 409 &&
      !commits.length
    )) {
      if (!commits.length) throw error;
      historyComplete = false;
      reasons.push(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить всю историю.",
      );
    }
  }
  onStage("languages");
  let languages: Record<string, number> = {};
  try {
    languages = z
      .record(z.string(), z.number().nonnegative())
      .parse(await (await get("/languages")).json());
  } catch {
    reasons.push(
      "Состав языков недоступен; используется нейтральная архитектура.",
    );
  }
  const ordered = sortedCommits(commits);
  onStage("building");
  return {
    id: repo.id,
    name: repo.full_name,
    description: repo.description?.slice(0, 1000) ?? "",
    branch: repo.default_branch,
    demo: false,
    archived: repo.archived,
    fork: repo.fork,
    commits: ordered,
    languages,
    coverage: {
      headSha,
      fetchedAt: now,
      languagesFetchedAt: new Date().toISOString(),
      historyComplete,
      loadedCommitCount: ordered.length,
      rangeStart: ordered[0]?.date ?? now,
      rangeEnd: ordered.at(-1)?.date ?? now,
      reasons: [...new Set(reasons)],
    },
  };
}
const cache = new Map<string, { expires: number; value: RepositorySnapshot }>();
const pending = new Map<string, Promise<RepositorySnapshot>>();
export async function loadRepository(input: string, onStage: StageListener) {
  const name = parseRepository(input);
  const key = `${name}:1000:v1`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    onStage("building");
    return cached.value;
  }
  if (pending.has(key)) {
    onStage("history");
    return pending.get(key)!;
  }
  if (pending.size >= 5)
    throw new GitHubError(
      "Сейчас строится несколько миров. Попробуйте через минуту.",
      429,
      "60",
    );
  const job = fetchSnapshot(name, fetch, onStage)
    .then((value) => {
      if (cache.size >= 50) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, expires: Date.now() + 15 * 60 * 1000 });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
