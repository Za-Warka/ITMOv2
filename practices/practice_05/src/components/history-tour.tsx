import { RepositorySnapshot } from "@/domain/world";
import { TourStop } from "@/domain/history-tour";
import s from "./atlas.module.css";
export function HistoryTour({
  stop,
  index,
  count,
  snapshot,
}: {
  stop: TourStop;
  index: number;
  count: number;
  snapshot: RepositorySnapshot;
}) {
  return (
    <section className={s.tourStory} aria-label="Экскурсия по истории">
      <p role="status">
        Остановка {index + 1} из {count}
      </p>
      <h4>{stop.title}</h4>
      <time dateTime={stop.date}>
        {new Intl.DateTimeFormat("ru-RU", {
          dateStyle: "long",
          timeZone: "UTC",
        }).format(new Date(stop.date))}
      </time>
      <p>{stop.description}</p>
      <small>
        Карта включает все коммиты до этой даты UTC. При равных датах события
        упорядочены по SHA.
      </small>
      {snapshot.demo ? (
        <p>Синтетическое событие демо.</p>
      ) : (
        <p>
          <a
            href={`https://github.com/${snapshot.name}/commit/${stop.sha}`}
            target="_blank"
            rel="noreferrer"
          >
            Исходный коммит {stop.sha.slice(0, 7)} ↗
          </a>
        </p>
      )}
      {!snapshot.coverage.historyComplete && (
        <p>
          Экскурсия охватывает только загруженную часть истории; более ранние
          события неизвестны.
        </p>
      )}
    </section>
  );
}
