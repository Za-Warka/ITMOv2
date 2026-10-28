"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import s from "./atlas.module.css";

type Repository = {
  id: number;
  fullName: string;
  description: string;
  archived: boolean;
  htmlUrl: string;
};

type SearchResult = {
  user: {
    githubLogin: string;
    name: string;
    avatarUrl: string;
    profileUrl: string;
    publicRepositories: number;
  };
  repositories: Repository[];
};

export function UserSearch() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    const login = value.trim();
    if (!/^@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(login)) {
      setError("Введите GitHub-тег в формате @username.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(login)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Пользователь не найден.");
      setResult(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось выполнить поиск.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={s.userSearch} aria-labelledby="user-search-title">
      <div>
        <span className={s.overline}>Следопыт по GitHub</span>
        <h2 id="user-search-title">Найти пользователя по тегу</h2>
        <p>Введите точный GitHub login с символом @ и посмотрите публичные проекты.</p>
      </div>
      <form onSubmit={search} className={s.userSearchForm}>
        <label htmlFor="github-user-search">GitHub-тег</label>
        <div className={s.userSearchRow}>
          <input
            id="github-user-search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="@octocat"
            autoComplete="off"
            aria-describedby={error ? "github-search-error" : undefined}
          />
          <button className={s.primary} type="submit" disabled={loading}>
            {loading ? "Ищем…" : "Найти"}
          </button>
        </div>
      </form>
      {error && <p className={s.searchError} id="github-search-error" role="alert">{error}</p>}
      {result && (
        <div className={s.searchResult}>
          <div className={s.searchProfile}>
            {result.user.avatarUrl ? <img src={result.user.avatarUrl} alt="" width={44} height={44} /> : null}
            <div>
              <strong>{result.user.name}</strong>
              <span>@{result.user.githubLogin}</span>
            </div>
            <a href={result.user.profileUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
          </div>
          {!result.repositories.length ? (
            <p>У пользователя нет публичных репозиториев.</p>
          ) : (
            <ul className={s.searchRepos}>
              {result.repositories.slice(0, 6).map((repo) => (
                <li key={repo.id}>
                  <div>
                    <Link href={`/?repo=${encodeURIComponent(repo.fullName)}`}>{repo.fullName}</Link>
                    <span>{repo.description || "Без описания"}</span>
                  </div>
                  <a href={repo.htmlUrl} target="_blank" rel="noreferrer" aria-label={`${repo.fullName} на GitHub`}>↗</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
