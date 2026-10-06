import { describe, expect, it } from "vitest";
import {
  buildWorld,
  eraFor,
  parseRepository,
  snapshotSchema,
  sortedCommits,
} from "../src/domain/world";
import { demoSnapshot } from "../src/fixtures/demo";
describe("repository input", () => {
  it.each([
    "https://github.com/Owner/Repo",
    "https://github.com/Owner/Repo.git",
    "Owner/Repo",
    "https://github.com/Owner/Repo/",
  ])("normalizes %s", (input) =>
    expect(parseRepository(input)).toBe("owner/repo"),
  );
  it.each([
    "https://evil.com/a/b",
    "https://github.com.evil.com/a/b",
    "https://x@github.com/a/b",
    "https://github.com:444/a/b",
    "https://github.com/a/b/tree/main",
    "https://github.com/a/b?x=1",
    "a/..",
    "file:///a/b",
    "a/b/c",
  ])("rejects %s", (input) => expect(() => parseRepository(input)).toThrow());
});
it.each([
  [0, 0],
  [1, 1],
  [24, 1],
  [25, 2],
  [99, 2],
  [100, 3],
  [499, 3],
  [500, 4],
  [1999, 4],
  [2000, 5],
])("era boundary %i", (count, era) => expect(eraFor(count)).toBe(era));
it("deduplicates SHA and sorts equal dates deterministically", () => {
  const a = { ...demoSnapshot.commits[0], sha: "a" },
    b = { ...a, sha: "b" };
  expect(sortedCommits([b, a, a]).map((c) => c.sha)).toEqual(["a", "b"]);
});
it("reverses time and reproduces the same world without mutation", () => {
  const first = buildWorld(demoSnapshot, demoSnapshot.commits[10].date);
  const last = buildWorld(demoSnapshot, demoSnapshot.coverage.rangeEnd);
  expect(last.commitCount).toBe(864);
  expect(first.commitCount).toBe(11);
  expect(buildWorld(demoSnapshot, demoSnapshot.commits[10].date)).toEqual(
    first,
  );
  for (const home of first.buildings) {
    const later = last.buildings.find((b) => b.id === home.id)!;
    expect([later.x, later.y, later.language]).toEqual([
      home.x,
      home.y,
      home.language,
    ]);
  }
});
it("counts bots only when enabled and does not discard their commits", () => {
  const normal = buildWorld(demoSnapshot, demoSnapshot.coverage.rangeEnd),
    bots = buildWorld(demoSnapshot, demoSnapshot.coverage.rangeEnd, true);
  expect(normal.authors).toHaveLength(24);
  expect(bots.authors).toHaveLength(25);
  expect(normal.commitCount).toBe(bots.commitCount);
});
it("preserves partial coverage and empty land", () => {
  const snapshot = {
    ...demoSnapshot,
    commits: [],
    languages: {},
    coverage: { ...demoSnapshot.coverage, historyComplete: false },
  };
  const world = buildWorld(snapshot, snapshot.coverage.rangeEnd);
  expect(world.buildings).toEqual([]);
  expect(world.lots).toBe(0);
  expect(world.coverage.historyComplete).toBe(false);
});
it("rejects malformed MCP snapshot inputs", () => {
  expect(
    snapshotSchema.safeParse({ ...demoSnapshot, languages: { Python: -1 } })
      .success,
  ).toBe(false);
  expect(() => buildWorld(demoSnapshot, "nonsense")).toThrow();
});
