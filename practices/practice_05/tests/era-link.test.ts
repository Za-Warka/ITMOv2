import { describe, expect, it } from "vitest";
import {
  readEraLink,
  createEraLink,
  resolveEraDate,
} from "../src/domain/era-link";
import { demoSnapshot } from "../src/fixtures/demo";
import { buildWorld } from "../src/domain/world";

describe("era links", () => {
  it.each(["chronicle", "people", "leaders", "legend"] as const)(
    "round trips %s without losing commit boundary",
    (tab) => {
      const date = demoSnapshot.commits[100].date;
      const state = {
        repo: null,
        date,
        tab,
        includeBots: true,
        culture: "Python",
      };
      const url = createEraLink("https://atlas.test/?token=secret#old", state);
      expect(url).not.toContain("secret");
      expect(url).not.toContain("#");
      expect(readEraLink(new URL(url).searchParams).state).toEqual(state);
      const restored = resolveEraDate(date, demoSnapshot.coverage);
      expect(restored.date).toBe(date);
      expect(buildWorld(demoSnapshot, restored.date).commitCount).toBe(101);
    },
  );
  it("preserves original demo language distribution", () => {
    const read = readEraLink(new URLSearchParams("repo=demo"));
    expect(read.state.culture).toBeUndefined();
    expect(read.state.repo).toBeNull();
  });
  it("normalizes real repos and ignores demo culture", () => {
    const state = readEraLink(
      new URLSearchParams("repo=Owner/Repo&culture=Python"),
    ).state;
    expect(state.repo).toBe("owner/repo");
    expect(state.culture).toBeUndefined();
  });
  it("rejects invalid repo instead of silently opening demo", () => {
    expect(() =>
      readEraLink(new URLSearchParams("repo=https://evil.test/a/b")),
    ).toThrow();
  });
  it("defaults invalid settings and reports bad date", () => {
    const { state, warnings } = readEraLink(
      new URLSearchParams("date=oops&tab=x&bots=yes&culture=x"),
    );
    expect(state.date).toBeUndefined();
    expect(state.tab).toBe("chronicle");
    expect(state.includeBots).toBe(false);
    expect(state.culture).toBeUndefined();
    expect(warnings.length).toBe(1);
  });
  it.each(["2000-01-01T00:00:00.000Z", "2099-01-01T00:00:00.000Z"])(
    "clamps %s with notice",
    (date) => {
      const result = resolveEraDate(date, demoSnapshot.coverage);
      expect(result.notice).toBeTruthy();
      expect([
        demoSnapshot.coverage.rangeStart,
        demoSnapshot.coverage.rangeEnd,
      ]).toContain(result.date);
    },
  );
  it("handles one instant and missing date", () => {
    const coverage = {
      rangeStart: demoSnapshot.coverage.rangeStart,
      rangeEnd: demoSnapshot.coverage.rangeStart,
    };
    expect(resolveEraDate(undefined, coverage).position).toBe(1000);
    expect(resolveEraDate(coverage.rangeStart, coverage).position).toBe(1000);
  });
  it("preserves a millisecond before a commit", () => {
    const date = new Date(
      Date.parse(demoSnapshot.commits[100].date) - 1,
    ).toISOString();
    expect(
      buildWorld(demoSnapshot, resolveEraDate(date, demoSnapshot.coverage).date)
        .commitCount,
    ).toBe(100);
  });
});
