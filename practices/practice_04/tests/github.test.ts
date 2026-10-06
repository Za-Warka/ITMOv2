import { describe, expect, it, vi } from "vitest";
import { fetchSnapshot } from "../src/server/github/client";
const repo = {
  id: 1,
  full_name: "a/b",
  description: null,
  default_branch: "main",
  private: false,
  archived: false,
  fork: false,
};
const commit = (
  sha: string,
  author: unknown = { id: 2, login: "Ada", type: "User" },
) => ({
  sha,
  author,
  commit: {
    message: "Hello\nprivate detail",
    author: { name: "Ada", email: "ada@example.org" },
    committer: { date: "2025-01-01T00:00:00Z" },
  },
});
function responder(responses: Response[]) {
  return vi.fn<typeof fetch>().mockImplementation(async () => {
    const response = responses.shift();
    if (!response) throw new Error("Unexpected request");
    return response;
  });
}
const json = (
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) => new Response(JSON.stringify(value), { status, headers });
describe("GitHub adapter", () => {
  it("pins head, follows pagination, deduplicates, hides emails and handles unlinked authors", async () => {
    const fetcher = responder([
      json(repo),
      json({ sha: "fixed-head" }),
      json([commit("1"), commit("2", null)], 200, {
        link: '<https://api.github.com/...>; rel="next"',
      }),
      json([commit("2", null), commit("3")]),
      json({ TypeScript: 120 }),
    ]);
    const result = await fetchSnapshot("a/b", fetcher);
    expect(result.commits).toHaveLength(3);
    expect(result.coverage.historyComplete).toBe(true);
    expect(fetcher.mock.calls[2][0]).toContain("sha=fixed-head");
    expect(fetcher.mock.calls[3][0]).toContain("page=2");
    expect(JSON.stringify(result)).not.toContain("ada@example.org");
    expect(result.commits[1].authorId).toMatch(/^anon-/);
  });
  it("handles empty repository", async () => {
    const result = await fetchSnapshot(
      "a/b",
      responder([json(repo), json({}, 409), json({})]),
    );
    expect(result.commits).toEqual([]);
    expect(result.coverage.historyComplete).toBe(true);
  });
  it.each([404, 403, 429])("reports HTTP %i", async (status) => {
    await expect(
      fetchSnapshot("a/b", responder([json({}, status)])),
    ).rejects.toMatchObject({ status });
  });
  it("does not expose private data", async () => {
    const f = responder([json({ ...repo, private: true })]);
    await expect(fetchSnapshot("a/b", f)).rejects.toMatchObject({
      status: 403,
    });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("preserves loaded commits on partial failure", async () => {
    const result = await fetchSnapshot(
      "a/b",
      responder([
        json(repo),
        json({ sha: "head" }),
        json([commit("1")], 200, { link: '<next>; rel="next"' }),
        json({}, 429, { "retry-after": "60" }),
        json({ Python: 10 }),
      ]),
    );
    expect(result.commits).toHaveLength(1);
    expect(result.coverage.historyComplete).toBe(false);
    expect(result.coverage.reasons[0]).toContain("лимит");
  });
  it("handles timeouts without leaking internal error", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("secret network debug"));
    await expect(fetchSnapshot("a/b", f)).rejects.toThrow("не ответил вовремя");
  });
  it("enforces the 1000-commit budget", async () => {
    const pages = Array.from({ length: 10 }, (_, p) =>
      json(
        Array.from({ length: 100 }, (_, i) => commit(`${p}-${i}`)),
        200,
        { link: '<next>; rel="next"' },
      ),
    );
    const result = await fetchSnapshot(
      "a/b",
      responder([json(repo), json({ sha: "head" }), ...pages, json({})]),
    );
    expect(result.commits).toHaveLength(1000);
    expect(result.coverage.historyComplete).toBe(false);
  });
});
