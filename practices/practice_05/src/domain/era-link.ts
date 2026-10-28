import { z } from "zod";
import { cultures, parseRepository } from "./world";

export const atlasTabs = ["chronicle", "people", "leaders", "legend"] as const;
export type AtlasTab = (typeof atlasTabs)[number];
export type EraLinkState = {
  repo: string | null;
  date?: string;
  tab: AtlasTab;
  includeBots: boolean;
  culture?: string;
};
export function readEraLink(params: URLSearchParams) {
  const source = params.get("repo");
  const repo = !source || source === "demo" ? null : parseRepository(source);
  const rawDate = params.get("date");
  const parsed = z.iso.datetime().safeParse(rawDate);
  const tab = params.get("tab");
  const culture = params.get("culture");
  const state: EraLinkState = {
    repo,
    date: parsed.success ? new Date(parsed.data).toISOString() : undefined,
    tab: atlasTabs.includes(tab as AtlasTab) ? (tab as AtlasTab) : "chronicle",
    includeBots: params.get("bots") === "1",
    culture:
      repo === null && culture && Object.hasOwn(cultures, culture)
        ? culture
        : undefined,
  };
  return {
    state,
    warnings:
      rawDate && !parsed.success
        ? ["Некорректная дата в ссылке. Открыт конец доступной истории."]
        : [],
  };
}
export function createEraLink(base: string, state: EraLinkState) {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set(
    "repo",
    state.repo === null ? "demo" : parseRepository(state.repo),
  );
  if (state.date)
    url.searchParams.set("date", new Date(state.date).toISOString());
  url.searchParams.set("tab", state.tab);
  url.searchParams.set("bots", state.includeBots ? "1" : "0");
  if (
    state.repo === null &&
    state.culture &&
    Object.hasOwn(cultures, state.culture)
  )
    url.searchParams.set("culture", state.culture);
  return url.toString();
}
export function resolveEraDate(
  date: string | undefined,
  coverage: { rangeStart: string; rangeEnd: string },
) {
  const start = Date.parse(coverage.rangeStart),
    end = Date.parse(coverage.rangeEnd);
  const requested = date ? Date.parse(date) : end;
  const time = Math.max(
    start,
    Math.min(end, Number.isFinite(requested) ? requested : end),
  );
  return {
    date: new Date(time).toISOString(),
    position: start === end ? 1000 : ((time - start) / (end - start)) * 1000,
    notice:
      requested !== time
        ? "Дата вне доступного периода. Открыта ближайшая доступная дата."
        : "",
  };
}
