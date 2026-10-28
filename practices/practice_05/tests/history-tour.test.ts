import { describe, expect, it } from "vitest";
import { buildTour } from "../src/domain/history-tour";
import { demoSnapshot } from "../src/fixtures/demo";
import { buildWorld } from "../src/domain/world";
const fixture = (count: number) => ({
  ...demoSnapshot,
  commits: Array.from({ length: count }, (_, i) => ({
    ...demoSnapshot.commits[0],
    sha: `sha-${String(i).padStart(5, "0")}`,
    date: new Date(Date.UTC(2020, 0, 1) + i * 86400000).toISOString(),
    authorId: `author-${i}`,
    authorName: `Автор ${i}`,
  })),
});
describe("history tour", () => {
  it("has no invented events for empty history", () =>
    expect(buildTour(fixture(0))).toEqual([]));
  it.each([1, 24, 25, 100, 500, 2000])(
    "bounds %i commits and keeps all epoch stops",
    (count) => {
      const snapshot = fixture(count),
        stops = buildTour(snapshot);
      expect(stops.length).toBeLessThanOrEqual(5);
      expect(stops[0].kind).toBe("first");
      expect(new Set(stops.map((s) => s.sha)).size).toBe(stops.length);
      for (const threshold of [25, 100, 500, 2000].filter((n) => n <= count))
        expect(
          stops.find((s) => s.sha === snapshot.commits[threshold - 1].sha)
            ?.kind,
        ).toBe("era");
      expect(buildTour(snapshot)).toEqual(stops);
    },
  );
  it("does not invent a later first appearance when original SHA is reserved", () => {
    const snapshot = fixture(26);
    snapshot.commits = snapshot.commits.map((c) => ({
      ...c,
      authorId: "founder",
    }));
    expect(buildTour(snapshot).map((s) => s.kind)).toEqual(["first", "era"]);
  });
  it("excludes bots from residents but counts their era commits", () => {
    const snapshot = fixture(25);
    snapshot.commits = snapshot.commits.map((c) => ({ ...c, bot: true }));
    expect(buildTour(snapshot).map((s) => s.kind)).toEqual(["first", "era"]);
  });
  it("deduplicates and orders equal dates by SHA without claiming exact map count", () => {
    const snapshot = fixture(100);
    snapshot.commits = snapshot.commits
      .map((c) => ({ ...c, date: snapshot.commits[0].date }))
      .reverse();
    snapshot.commits.push(snapshot.commits[0]);
    const stops = buildTour(snapshot);
    expect(stops.find((s) => s.kind === "era")?.description).toContain(
      "порог 25",
    );
    expect(buildWorld(snapshot, stops[0].date).commitCount).toBe(100);
    expect(stops.map((s) => s.sha)).toEqual(stops.map((s) => s.sha).sort());
  });
  it("uses observed wording for incomplete history and preserves snapshot", () => {
    const snapshot = {
      ...demoSnapshot,
      coverage: { ...demoSnapshot.coverage, historyComplete: false },
    };
    const before = JSON.stringify(snapshot);
    const stops = buildTour(snapshot);
    expect(stops[0].title).toContain("наблюдаемой");
    expect(JSON.stringify(snapshot)).toBe(before);
    const first = buildWorld(snapshot, stops[0].date);
    buildWorld(snapshot, stops.at(-1)!.date);
    expect(buildWorld(snapshot, stops[0].date)).toEqual(first);
  });
});
