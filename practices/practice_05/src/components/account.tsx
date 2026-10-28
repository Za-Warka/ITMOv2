"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import s from "./atlas.module.css";

type Repository = {
  id: number;
  fullName: string;
  description: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  defaultBranch: string;
  htmlUrl: string;
};

type Session = {
  authenticated: boolean;
  user: { name: string; githubLogin: string; avatarUrl: string; profileUrl: string } | null;
};

export default function Account() {
  const [session, setSession] = useState<Session | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/session")
      .then((response) => response.json())
      .then(setSession)
      .catch(() => setSession({ authenticated: false, user: null }));
  }, []);

  useEffect(() => {
    if (!session || !session.authenticated) {
      return;
    }
    fetch(`/api/me/repositories?page=${page}&perPage=12`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message ?? "Не удалось загрузить репозитории.");
        return body;
      })
      .then((body) => {
        setRepositories(body.items);
        setHasNext(body.hasNext);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Ошибка загрузки."))
      .finally(() => setLoading(false));
  }, [session, page]);

  if (!session || loading && !session) return <main className={s.accountPage}><p>Загружаем кабинет…</p></main>;
  if (!session.authenticated || !session.user) {
    return <main className={s.accountPage}><h1>Личный кабинет</h1><p>Войдите через GitHub, чтобы увидеть свои публичные репозитории.</p><a className={s.primary} href="/auth/github">Войти через GitHub</a></main>;
  }

  return (
    <main className={s.accountPage}>
      <Link href="/" className={s.backLink}>← Вернуться к атласу</Link>
      <header className={s.accountHeader}>
        {session.user.avatarUrl ? <img src={session.user.avatarUrl} alt="" width={72} height={72} /> : null}
        <div><span className={s.overline}>Личный кабинет</span><h1>{session.user.name}</h1><p>@{session.user.githubLogin}</p></div>
        <a href={session.user.profileUrl} target="_blank" rel="noreferrer">Открыть GitHub ↗</a>
      </header>
      <section aria-labelledby="repositories-title">
        <div className={s.accountSectionTitle}><div><span className={s.overline}>Публичная коллекция</span><h2 id="repositories-title">Мои репозитории</h2></div><span>{repositories.length} на странице</span></div>
        {error && <p className={s.searchError} role="alert">{error}</p>}
        {!loading && !repositories.length && !error && <p>Публичных репозиториев пока нет.</p>}
        <div className={s.repositoryGrid}>
          {repositories.map((repo) => <article className={s.repositoryCard} key={repo.id}>
            <div><span className={s.repoBadge}>{repo.archived ? "Архив" : repo.fork ? "Форк" : "Публичный"}</span><h3>{repo.fullName}</h3><p>{repo.description || "Без описания"}</p></div>
            <div className={s.repositoryActions}><Link className={s.primary} href={`/?repo=${encodeURIComponent(repo.fullName)}`}>Построить атлас</Link><a href={repo.htmlUrl} target="_blank" rel="noreferrer">GitHub ↗</a></div>
          </article>)}
        </div>
        <div className={s.pagination}><button onClick={() => setPage((value) => value - 1)} disabled={page === 1 || loading}>← Назад</button><span>Страница {page}</span><button onClick={() => setPage((value) => value + 1)} disabled={!hasNext || loading}>Вперёд →</button></div>
      </section>
    </main>
  );
}
