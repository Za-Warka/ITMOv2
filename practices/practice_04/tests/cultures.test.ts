import { describe, expect, it } from "vitest";
import {
  buildWorld,
  cultureFor,
  cultures,
  type Commit,
} from "../src/domain/world";
import { demoSnapshot } from "../src/fixtures/demo";
const date = demoSnapshot.coverage.rangeEnd;
const snapshot = (
  languages: Record<string, number>,
  commits = demoSnapshot.commits,
) => ({ ...demoSnapshot, languages, commits });

describe("language cultures", () => {
  it.each(Object.keys(cultures))(
    "%s has a complete court and drives every building",
    (language) => {
      const world = buildWorld(
        snapshot({ [language]: 500, Unknown: 10 }),
        date,
      );
      expect(world.dominantLanguage).toBe(language);
      expect(world.buildings.every((b) => b.language === language)).toBe(true);
      expect(world.culture.style).not.toBe("plain");
      expect(world.culture.titles).toHaveLength(10);
      expect(new Set(world.culture.titles).size).toBe(10);
      expect(world.leaders[0].title).toBe(world.culture.titles[0]);
      expect(world.buildings[0].name).toBe(world.culture.capital);
    },
  );
  it("gives the 21 supported languages distinct architectural silhouettes", () => {
    expect(Object.keys(cultures)).toHaveLength(21);
    expect(new Set(Object.values(cultures).map((c) => c.style)).size).toBe(21);
  });
  it("selects by bytes, not insertion order or combined other languages", () => {
    const world = buildWorld(
      snapshot({
        Java: 5,
        "C++": 10,
        Python: 3,
        Go: 3,
        CSS: 3,
        Ruby: 3,
        Lua: 3,
        Shell: 3,
        SQL: 3,
      }),
      date,
    );
    expect(world.dominantLanguage).toBe("C++");
    expect(world.culture.titles[0]).toBe("Царь");
  });
  it("uses a deterministic language tie and a neutral fallback", () => {
    expect(
      buildWorld(snapshot({ Java: 10, "C#": 10 }), date).dominantLanguage,
    ).toBe(buildWorld(snapshot({ "C#": 10, Java: 10 }), date).dominantLanguage);
    expect(cultureFor("Unknown").style).toBe("plain");
    expect(buildWorld(snapshot({}), date).dominantLanguage).toBe(
      "Смешанная культура",
    );
  });
});
function commit(sha: string, id: string, day: number, bot = false): Commit {
  return {
    ...demoSnapshot.commits[0],
    sha,
    authorId: id,
    authorName: id,
    date: `2024-01-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    bot,
  };
}
describe("top contributors", () => {
  it("ranks observed commits, deduplicates SHA and excludes bots even when population includes them", () => {
    const commits = [
      commit("1", "a", 1),
      commit("2", "b", 2),
      commit("3", "b", 3),
      commit("3", "b", 3),
      commit("4", "robot", 4, true),
    ];
    const world = buildWorld(snapshot({ "C#": 10 }, commits), date, true);
    expect(world.leaders.map((a) => [a.id, a.commits, a.title])).toEqual([
      ["b", 2, "Король"],
      ["a", 1, "Герцог"],
    ]);
    expect(world.humanCommits).toBe(3);
    expect(world.leaders[0].share).toBeCloseTo(2 / 3);
    expect(world.authors).toHaveLength(3);
  });
  it("rewinds rankings and titles without changing culture", () => {
    const data = snapshot({ "C++": 10 }, [
      commit("1", "a", 1),
      commit("2", "b", 2),
      commit("3", "b", 3),
    ]);
    expect(
      buildWorld(data, "2024-01-01T00:00:00.000Z").leaders[0],
    ).toMatchObject({ id: "a", title: "Царь", commits: 1 });
    expect(buildWorld(data, date).leaders[0]).toMatchObject({
      id: "b",
      title: "Царь",
      commits: 2,
    });
  });
  it("breaks tied counts by stable ID and caps the court at ten", () => {
    const commits = Array.from({ length: 14 }, (_, i) =>
      commit(String(i), `author-${String(i).padStart(2, "0")}`, 1),
    ).reverse();
    const leaders = buildWorld(snapshot({ Java: 1 }, commits), date).leaders;
    expect(leaders).toHaveLength(10);
    expect(leaders[0].id).toBe("author-00");
    expect(leaders[9].rank).toBe(10);
  });
  it("returns no invented figures for an empty or bots-only history", () => {
    expect(buildWorld(snapshot({ Java: 1 }, []), date).leaders).toEqual([]);
    expect(
      buildWorld(
        snapshot({ Java: 1 }, [commit("1", "robot", 1, true)]),
        date,
        true,
      ).leaders,
    ).toEqual([]);
  });
});
