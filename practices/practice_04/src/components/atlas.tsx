"use client";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  buildWorld,
  cultureFor,
  cultures,
  eras,
  parseRepository,
  RepositorySnapshot,
  snapshotSchema,
} from "@/domain/world";
import { demoSnapshot } from "@/fixtures/demo";
import { Island } from "./island";
import s from "./atlas.module.css";
const formatDate = (date: string | number, short = false) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: short ? undefined : "numeric",
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
const number = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const stages: Record<string, string> = {
  metadata: "Читаем сведения о репозитории",
  history: "Собираем историю коммитов",
  languages: "Изучаем языки проекта",
  building: "Строим цивилизацию",
};

const tabs = [
  ["chronicle", "Летопись"],
  ["people", "Жители"],
  ["leaders", "Деятели"],
  ["legend", "Легенда"],
] as const;
type Tab = (typeof tabs)[number][0];
export default function Atlas() {
  const [snapshot, setSnapshot] = useState<RepositorySnapshot>(demoSnapshot);
  const [input, setInput] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState("");
  const [position, setPosition] = useState(1000),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1);
  const atEnd = position >= 1000;
  const [tab, setTab] = useState<Tab>("chronicle");
  const [selected, setSelected] = useState<string | null>(null),
    [includeBots, setIncludeBots] = useState(false);
  const controller = useRef<AbortController | null>(null),
    requestId = useRef(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const lastSelection = useRef<Element | null>(null);
  const start = Date.parse(snapshot.coverage.rangeStart),
    end = Date.parse(snapshot.coverage.rangeEnd);
  const date = new Date(
    start + ((end - start) * position) / 1000,
  ).toISOString();
  const world = useMemo(
    () => buildWorld(snapshot, date, includeBots),
    [snapshot, date, includeBots],
  );
  const building = world.buildings.find((b) => b.id === selected);
  const nextEra = eras[world.era + 1];
  const buckets = useMemo(() => {
    const values = Array<number>(60).fill(0);
    snapshot.commits.forEach((c) => {
      const index = Math.min(
        59,
        Math.max(
          0,
          Math.floor(
            ((Date.parse(c.date) - start) / Math.max(1, end - start)) * 60,
          ),
        ),
      );
      values[index]++;
    });
    return values;
  }, [snapshot, start, end]);
  useEffect(() => {
    if (!playing || atEnd) return;
    const timer = setInterval(
      () => setPosition((p) => Math.min(1000, p + 5 * speed)),
      100,
    );
    return () => clearInterval(timer);
  }, [playing, speed, atEnd]);
  useEffect(() => () => controller.current?.abort(), []);
  async function load(event: FormEvent) {
    event.preventDefault();
    controller.current?.abort();
    const id = ++requestId.current;
    setPlaying(false);
    setError("");
    setLoading("");
    let name: string;
    try {
      name = parseRepository(input);
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setLoading(stages.metadata);
    try {
      const response = await fetch(
        `/api/repository?repo=${encodeURIComponent(name)}`,
        { signal: abort.signal },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Не удалось загрузить репозиторий.");
      }
      if (!response.body)
        throw new Error("Поток данных недоступен. Повторите запрос.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        complete = false;
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim() || id !== requestId.current) continue;
          const message = JSON.parse(line);
          if (message.type === "progress")
            setLoading(
              `${stages[message.stage] ?? "Загрузка"}${message.count ? ` · ${message.count}` : ""}`,
            );
          if (message.type === "error")
            throw new Error(
              message.message +
                (message.retryAfter
                  ? ` Повтор через ${message.retryAfter} с.`
                  : ""),
            );
          if (message.type === "result") {
            const next = snapshotSchema.parse(message.snapshot);
            setSnapshot(next);
            setPosition(1000);
            setSelected(null);
            complete = true;
          }
        }
        if (done) break;
      }
      if (!complete && id === requestId.current)
        throw new Error("Загрузка прервалась. Попробуйте ещё раз.");
    } catch (err) {
      if (id === requestId.current && !abort.signal.aborted)
        setError(err instanceof Error ? err.message : "Ошибка загрузки.");
    } finally {
      if (id === requestId.current) setLoading("");
    }
  }
  function openDemo() {
    controller.current?.abort();
    requestId.current++;
    setSnapshot(demoSnapshot);
    setPosition(1000);
    setPlaying(false);
    setSelected(null);
    setLoading("");
    setError("");
    setInput("");
  }
  function seek(value: number) {
    setPosition(value);
    setPlaying(false);
    setSelected(null);
  }
  function closeDetails() {
    setSelected(null);
    if (
      lastSelection.current instanceof SVGElement ||
      lastSelection.current instanceof HTMLElement
    )
      lastSelection.current.focus();
  }
  return (
    <div className={s.app}>
      <header className={s.header}>
        <Link className={s.brand} href="/" aria-label="Repo Atlas — главная">
          <svg
            width="37"
            height="37"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
          >
            <path d="m4 23 16-9 16 9-16 9Z" fill="#a8bb8a" />
            <path d="M14 22V12l6-4 6 4v10l-6 4Z" fill="#315642" />
            <path d="m20 8 6 4-6 4-6-4Z" fill="#718c65" />
            <path d="M20 16v10" stroke="#b4c895" />
          </svg>
          <span>
            Repo Atlas
            <span className={s.brandCaption}>История кода в новом мире</span>
          </span>
        </Link>
        <nav aria-label="Основная навигация">
          <button
            className={s.navActive}
            onClick={() =>
              document.getElementById("world")?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              })
            }
          >
            Атлас
          </button>
          <button
            onClick={() => {
              setTab("legend");
              document
                .getElementById("details")
                ?.scrollIntoView({ block: "nearest" });
            }}
          >
            Как это устроено
          </button>
          <a href="https://github.com" target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </nav>
      </header>
      <main>
        <section className={s.intro}>
          <div>
            <div className={s.introNote}>
              <span /> У каждого проекта есть своя история
            </div>
            <h1>Ваш код. Целая цивилизация.</h1>
            <p>
              Превратите историю репозитория в живой мир.
              <br className={s.desktopBreak} /> От первого коммита до города,
              построенного вместе.
            </p>
          </div>
          <form onSubmit={load} className={s.repoForm}>
            <label htmlFor="repository">Ссылка на GitHub-репозиторий</label>
            <div className={s.inputRow}>
              <span aria-hidden="true">⌘</span>
              <input
                id="repository"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="owner/repository"
                autoComplete="off"
                spellCheck={false}
                aria-describedby={error ? "load-error" : "repo-hint"}
              />
              <button className={s.primary} type="submit">
                {loading ? "Строим…" : "Построить мир"}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
            <div className={s.formHint} id="repo-hint">
              Публичный репозиторий{" "}
              <span>
                или{" "}
                <button type="button" onClick={openDemo}>
                  открыть пример
                </button>
              </span>
            </div>
          </form>
        </section>
        {loading && (
          <div role="status" className={s.loading}>
            <span className={s.spinner} />
            {loading}
            <button
              onClick={() => {
                controller.current?.abort();
                requestId.current++;
                setLoading("");
              }}
            >
              Отменить
            </button>
          </div>
        )}
        {error && (
          <div role="alert" id="load-error" className={s.error}>
            {error}
            <button onClick={openDemo}>Открыть пример</button>
          </div>
        )}
        <section
          className={s.workspace}
          id="world"
          aria-busy={Boolean(loading)}
        >
          <div className={s.worldHeader}>
            <div className={s.repoTitle}>
              <span className={s.repoIcon}>⑂</span>
              <div>
                <h2>{snapshot.name}</h2>
                <span>
                  {snapshot.demo
                    ? "Демонстрационный мир · синтетическая история"
                    : `Ветка ${snapshot.branch}${snapshot.archived ? " · Архивный проект" : ""}${snapshot.fork ? " · Форк" : ""}`}
                </span>
              </div>
            </div>
            <span className={s.status}>
              <span />
              {snapshot.demo
                ? "Пример"
                : snapshot.coverage.historyComplete
                  ? "История загружена"
                  : "Частичная история"}
            </span>
          </div>
          {snapshot.demo && (
            <div className={s.culturePreview}>
              <label htmlFor="demo-culture">Культура примера</label>
              <select
                id="demo-culture"
                value={world.dominantLanguage}
                onChange={(e) => {
                  setSnapshot({
                    ...demoSnapshot,
                    languages: { [e.target.value]: 100000 },
                  });
                  setSelected(null);
                }}
              >
                {Object.entries(cultures).map(([language, culture]) => (
                  <option key={language} value={language}>
                    {language} — {culture.name}
                  </option>
                ))}
              </select>
              <span>Меняет только синтетический пример</span>
            </div>
          )}
          <div className={s.worldBody}>
            <div className={s.mapArea}>
              <div className={s.mapHeading}>
                <span className={s.eraBadge}>
                  <span aria-hidden="true">✦</span> {world.eraName}
                </span>
                <span>{formatDate(date)}</span>
              </div>
              <Island
                key={snapshot.id}
                world={world}
                seed={snapshot.id}
                selected={selected}
                onSelect={(b) => {
                  lastSelection.current = document.activeElement;
                  setSelected(b.id);
                  setTimeout(() => detailHeading.current?.focus(), 0);
                }}
              />
              {world.commitCount === 0 && (
                <div className={s.empty}>
                  Пока нет коммитов. Здесь начнётся новая история.
                </div>
              )}
              <div className={s.mapLegend}>
                <span>
                  <i style={{ background: "#456d53" }} />
                  Постройки — коммиты
                </span>
                <span>
                  <i style={{ background: "#a8bb8a" }} />
                  Поселение — авторы
                </span>
                <button onClick={() => setTab("legend")}>Вся легенда ↗</button>
              </div>
            </div>
            <aside className={s.sidebar} id="details">
              {building ? (
                <section className={s.buildingDetails}>
                  <button className={s.back} onClick={closeDetails}>
                    ← Назад к истории
                  </button>
                  <span className={s.detailSymbol}>⌂</span>
                  <h3 ref={detailHeading} tabIndex={-1}>
                    {building.name}
                  </h3>
                  <p>{cultureFor(building.language).name}</p>
                  <dl>
                    <div>
                      <dt>Архитектура</dt>
                      <dd>{building.language}</dd>
                    </div>
                    <div>
                      <dt>Эпоха</dt>
                      <dd>{world.eraName}</dd>
                    </div>
                  </dl>
                  <p>
                    {building.kind === "capital"
                      ? `Общественное здание выросло благодаря ${number(world.commitCount)} наблюдаемым коммитам.`
                      : `Один из ${world.lots} жилых участков. Вместе они представляют ${world.authors.length} авторов.`}
                  </p>
                  <p className={s.muted}>
                    Квартал может представлять нескольких жителей. Язык здания —
                    художественное оформление, а не язык его авторов.
                  </p>
                </section>
              ) : (
                <>
                  <div className={s.summary}>
                    <span className={s.overline}>Цивилизация проекта</span>
                    <h3>
                      {
                        cultureFor(
                          world.languages[0]?.name ?? "Смешанная культура",
                        ).name
                      }
                    </h3>
                    <p>{world.eraName} растёт вместе с кодом</p>
                    <div className={s.metrics}>
                      <div>
                        <strong data-testid="commit-count">
                          {number(world.commitCount)}
                        </strong>
                        <span>коммитов</span>
                      </div>
                      <div>
                        <strong data-testid="author-count">
                          {world.authors.length}
                        </strong>
                        <span>жителей</span>
                      </div>
                      <div>
                        <strong>{world.lots}</strong>
                        <span>участков</span>
                      </div>
                    </div>
                    {nextEra && (
                      <div className={s.eraProgress}>
                        <div>
                          <span>Следующая эпоха</span>
                          <b>{nextEra.name}</b>
                        </div>
                        <progress
                          value={world.commitCount}
                          max={nextEra.threshold}
                        />
                        <span>
                          Ещё {number(nextEra.threshold - world.commitCount)}{" "}
                          коммитов
                        </span>
                      </div>
                    )}
                  </div>
                  <div
                    className={s.tabs}
                    role="tablist"
                    aria-label="Сведения о цивилизации"
                  >
                    {tabs.map(([key, label]) => (
                      <button
                        key={key}
                        role="tab"
                        aria-selected={tab === key}
                        aria-controls={`panel-${key}`}
                        id={`tab-${key}`}
                        onKeyDown={(e) => {
                          const keys = tabs.map(([key]) => key);
                          const index = keys.indexOf(key);
                          const next =
                            e.key === "ArrowRight"
                              ? (index + 1) % keys.length
                              : e.key === "ArrowLeft"
                                ? (index + keys.length - 1) % keys.length
                                : e.key === "Home"
                                  ? 0
                                  : e.key === "End"
                                    ? keys.length - 1
                                    : null;
                          if (next !== null) {
                            e.preventDefault();
                            setTab(keys[next]);
                            document
                              .getElementById(`tab-${keys[next]}`)
                              ?.focus();
                          }
                        }}
                        tabIndex={tab === key ? 0 : -1}
                        onClick={() => setTab(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div
                    className={s.tabPanel}
                    role="tabpanel"
                    id={`panel-${tab}`}
                    aria-labelledby={`tab-${tab}`}
                  >
                    {tab === "chronicle" && (
                      <>
                        <div className={s.activity}>
                          <span className={s.activityDot} />
                          <div>
                            <b>
                              {world.recentCount
                                ? "В городе кипит жизнь"
                                : "Тихий сезон"}
                            </b>
                            <span>
                              {world.recentCount} коммитов за 30 дней до
                              выбранной даты
                            </span>
                          </div>
                        </div>
                        <ol className={s.chronicle}>
                          {world.recentCommits.slice(0, 5).map((c, i) => (
                            <li key={c.sha}>
                              <span className={s.eventDot}>
                                {i === 0 ? "✦" : "·"}
                              </span>
                              <time dateTime={c.date}>
                                {formatDate(c.date, true)}
                              </time>
                              {snapshot.demo ? (
                                <b>{c.message}</b>
                              ) : (
                                <a
                                  href={`https://github.com/${snapshot.name}/commit/${c.sha}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {c.message || "Коммит без сообщения"} ↗
                                </a>
                              )}
                              <span>{c.authorName}</span>
                            </li>
                          ))}
                        </ol>
                        {!world.commitCount && (
                          <p>В этой истории пока нет событий.</p>
                        )}
                      </>
                    )}
                    {tab === "people" && (
                      <>
                        <p className={s.muted}>
                          Авторы наблюдаемых коммитов. Алиасы одного человека
                          могут учитываться отдельно.
                        </p>
                        <label className={s.botToggle}>
                          <input
                            type="checkbox"
                            checked={includeBots}
                            onChange={(e) => setIncludeBots(e.target.checked)}
                          />{" "}
                          Учитывать ботов-мастеров
                        </label>
                        <ul className={s.people}>
                          {world.authors.map((a) => (
                            <li key={a.id}>
                              <span>
                                {a.bot ? "⚙" : a.name.slice(0, 1).toUpperCase()}
                              </span>
                              <b>{a.name}</b>
                              {a.bot && <small>бот</small>}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {tab === "leaders" && (
                      <section className={s.leaders}>
                        <h4>Совет цивилизации</h4>
                        <p className={s.muted}>
                          Топ 10 по коммитам до выбранной даты. Титулы — игровые
                          роли, не должности в проекте. Боты не участвуют.
                        </p>
                        {!snapshot.coverage.historyComplete && (
                          <p className={s.leaderNotice}>
                            Топ построен только по загруженной части истории.
                          </p>
                        )}
                        {!world.leaders.length ? (
                          <p className={s.leaderNotice}>
                            Пока нет авторов-людей. Деятели появятся после их
                            первых коммитов.
                          </p>
                        ) : (
                          <ol
                            className={s.leaderList}
                            aria-label="Топ контрибьюторов"
                          >
                            {world.leaders.map((leader) => (
                              <li key={leader.id} data-rank={leader.rank}>
                                <div
                                  className={s.leaderPortrait}
                                  aria-hidden="true"
                                >
                                  <span>
                                    {leader.rank === 1 ? "♛" : leader.rank}
                                  </span>
                                  <b>{leader.name.slice(0, 1).toUpperCase()}</b>
                                </div>
                                <div className={s.leaderInfo}>
                                  <span className={s.leaderTitle}>
                                    {leader.title}
                                  </span>
                                  {!snapshot.demo &&
                                  leader.id.startsWith("github-") ? (
                                    <a
                                      href={`https://github.com/${encodeURIComponent(leader.name)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {leader.name} ↗
                                    </a>
                                  ) : (
                                    <strong>{leader.name}</strong>
                                  )}
                                  <span>
                                    {number(leader.commits)} коммитов ·{" "}
                                    {Math.round(leader.share * 100)}% вклада
                                    людей
                                  </span>
                                  <div
                                    className={s.leaderBar}
                                    aria-hidden="true"
                                  >
                                    <i
                                      style={{
                                        width: `${leader.share * 100}%`,
                                        background: world.culture.color,
                                      }}
                                    />
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ol>
                        )}
                        <p className={s.muted}>
                          При равном числе коммитов порядок определяется ID
                          автора. Алиасы могут учитываться отдельно.
                        </p>
                      </section>
                    )}
                    {tab === "legend" && (
                      <div className={s.explanation}>
                        <h4>Как читать этот мир</h4>
                        <p>
                          <b>Коммиты развивают здания.</b> Эпохи начинаются с 1,
                          25, 100, 500 и 2000 коммитов. Это художественная
                          шкала, не оценка качества кода.
                        </p>
                        <p>
                          <b>Авторы расширяют город.</b> До 48 участков
                          представляют всех наблюдаемых авторов. Боты по
                          умолчанию исключены из населения.
                        </p>
                        <p>
                          <b>
                            Преобладающий язык задаёт архитектуру всего города.
                          </b>{" "}
                          Он определяется объёмом кода в байтах. При равенстве
                          выбирается первый по имени языка. При перемотке
                          используется текущий состав языков.
                        </p>
                        <p>
                          <b>{world.culture.name}.</b>{" "}
                          {world.culture.architecture}. Деятели получают титулы
                          этой культуры по числу наблюдаемых коммитов.
                        </p>
                        <p>
                          Рельеф процедурный. Мост и лес — декорации. Таймлайн
                          основан на датах коммиттера в UTC, merge считается
                          одним коммитом. Co-authored-by не учитывается.
                        </p>
                        <p>
                          {snapshot.coverage.historyComplete
                            ? "Загружена вся доступная история выбранной ветки."
                            : `Загружено ${snapshot.commits.length} последних коммитов. Прошлое за пределами выборки не учитывается.`}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className={s.languages}>
                    <h4>Языки проекта</h4>
                    <div className={s.languageBar}>
                      {world.languages.map((l) => (
                        <span
                          key={l.name}
                          style={{
                            width: `${l.share * 100}%`,
                            background: cultureFor(l.name).color,
                          }}
                        />
                      ))}
                    </div>
                    <div className={s.languageLabels}>
                      {world.languages.map((l) => (
                        <span key={l.name}>
                          <i style={{ background: cultureFor(l.name).color }} />
                          {l.name} <b>{Math.round(l.share * 100)}%</b>
                        </span>
                      ))}
                    </div>
                    <p>
                      Архитектура: {world.dominantLanguage}. Текущий состав
                      языков.
                    </p>
                  </div>
                </>
              )}
            </aside>
          </div>
          <div className={s.timeline}>
            <div className={s.timelineTop}>
              <div>
                <span className={s.overline}>Путешествие во времени</span>
                <h3>{formatDate(date)}</h3>
              </div>
              <div className={s.playControls}>
                <button
                  aria-label="К началу истории"
                  onClick={() => seek(0)}
                  disabled={!snapshot.commits.length}
                >
                  |‹
                </button>
                <button
                  className={s.play}
                  onClick={() => {
                    if (position >= 1000) {
                      setPosition(0);
                      setPlaying(true);
                    } else setPlaying((p) => !p);
                  }}
                  disabled={!snapshot.commits.length}
                >
                  {playing && position < 1000
                    ? "Ⅱ Пауза"
                    : "▷ Смотреть историю"}
                </button>
                <button
                  aria-label="К концу истории"
                  onClick={() => seek(1000)}
                  disabled={!snapshot.commits.length}
                >
                  ›|
                </button>
                <select
                  aria-label="Скорость воспроизведения"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  <option value="1">1×</option>
                  <option value="2">2×</option>
                  <option value="4">4×</option>
                </select>
              </div>
            </div>
            <div className={s.histogram} aria-hidden="true">
              {buckets.map((v, i) => (
                <span
                  key={i}
                  style={{
                    height: `${Math.max(5, (v / Math.max(...buckets, 1)) * 100)}%`,
                    background:
                      i / 59 <= position / 1000 ? "#829a6c" : "#dedfcc",
                  }}
                />
              ))}
            </div>
            <input
              className={s.range}
              type="range"
              min="0"
              max="1000"
              value={position}
              aria-label="Дата истории"
              aria-valuetext={formatDate(date)}
              onChange={(e) => seek(Number(e.target.value))}
              disabled={!snapshot.commits.length}
            />
            <div className={s.timeLabels}>
              <span>{formatDate(start, true)}</span>
              <span>Каждый коммит оставляет след</span>
              <span>{formatDate(end, true)}</span>
            </div>
          </div>
          <div className={s.coverage}>
            {snapshot.demo
              ? "Синтетические данные для знакомства с атласом."
              : `${snapshot.coverage.historyComplete ? "Полная доступная история" : "Неполная история"} · ${snapshot.commits.length} коммитов · снимок ${formatDate(snapshot.coverage.fetchedAt)}`}
            {snapshot.coverage.reasons.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>
        </section>
        <section className={s.bottomNote}>
          <span className={s.bottomStar}>✳</span>
          <div>
            <h2>За каждым городом — люди.</h2>
            <p>
              Атлас помогает увидеть путь проекта. Его настоящая ценность — в
              тех, кто его создаёт.
            </p>
          </div>
          <span className={s.atlasEdition}>
            Repo Atlas
            <br />
            Первая экспедиция
          </span>
        </section>
      </main>
      <footer className={s.footer}>
        <span>Repo Atlas · Открывайте историю своего кода</span>
        <span>Создано с любопытством к тому, что мы строим вместе</span>
      </footer>
    </div>
  );
}
