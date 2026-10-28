"use client";
import { useState } from "react";
import { createEraLink, EraLinkState } from "@/domain/era-link";
import s from "./atlas.module.css";

export function ShareEra({
  state,
  disabled,
}: {
  state: EraLinkState;
  disabled: boolean;
}) {
  const [result, setResult] = useState<{ url: string; message: string } | null>(
    null,
  );
  async function share() {
    const url = createEraLink(window.location.href, state);
    try {
      await navigator.clipboard.writeText(url);
      setResult({ url, message: "Ссылка скопирована." });
    } catch {
      setResult({
        url,
        message:
          "Не удалось скопировать автоматически. Выделите ссылку и скопируйте вручную.",
      });
    }
  }
  return (
    <div className={s.shareEra}>
      <button disabled={disabled} onClick={share}>
        Скопировать ссылку на эпоху
      </button>
      {!state.repo ? (
        <small>Ссылка на синтетический пример, доступный без GitHub.</small>
      ) : (
        <small>
          Ссылка загрузит актуальную историю. Данные и доступный период могут
          измениться.
        </small>
      )}
      {result && (
        <div key={result.url}>
          <p role="status">{result.message}</p>
          <label>
            Ссылка на выбранную эпоху
            <input
              readOnly
              value={result.url}
              onFocus={(event) => event.target.select()}
            />
          </label>
        </div>
      )}
    </div>
  );
}
