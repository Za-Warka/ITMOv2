import { Building, cultureFor } from "@/domain/world";

/** All geometry shares an isometric footprint; culture changes the silhouette, not only its tint. */
export function BuildingModel({ building }: { building: Building }) {
  const { style, color } = cultureFor(building.language);
  const capital = building.kind === "capital",
    level = building.level;
  const w = capital ? 34 : 17,
    h = capital ? 19 + level * 10 : 12 + level * 4;
  const timber = style === "timber",
    japanese = style === "pagoda";
  const light = timber
    ? "#c3a06a"
    : japanese
      ? "#e2d9b9"
      : level < 2
        ? "#c5ac7a"
        : "#e8dfc6";
  const dark = timber
    ? "#957147"
    : japanese
      ? "#bdc3a6"
      : level < 2
        ? "#a68d60"
        : "#c4bea1";
  const roof = level < 2 ? "#8b7954" : color;
  const gable = (width: number, y: number, pitch = 0.9) => (
    <>
      <path
        d={`M${-width - 4} ${y} -3 ${y - width * pitch} ${width + 4} ${y} 0 ${y + width / 2 + 2}Z`}
        fill={roof}
      />
      <path
        d={`M-3 ${y - width * pitch} 0 ${y + width / 2 + 2} ${width + 4} ${y}Z`}
        fill="#203d2c"
        opacity=".2"
      />
    </>
  );
  return (
    <g data-architecture={style}>
      <path
        d={`M${-w - 3} 1 0 ${w / 2 + 3} ${w + 3} 1 0 ${-w / 2 - 1}Z`}
        fill="#ddcfaf"
        stroke="#baaf8e"
      />
      <path
        d={`M${-w} 0V${-h}L0 ${-h + w / 2}V${w / 2}Z`}
        fill={light}
        stroke="#b6ae90"
        strokeWidth=".6"
      />
      <path
        d={`M0 ${w / 2}V${-h + w / 2}L${w} ${-h}V0Z`}
        fill={dark}
        stroke="#aaa486"
        strokeWidth=".6"
      />
      {timber && (
        <>
          {Array.from({ length: Math.floor(h / 5) }, (_, i) => (
            <g key={i} stroke="#80603e" strokeWidth="1" opacity=".65">
              <path d={`M${-w} ${-i * 5}l${w} ${w / 2} ${w} ${-w / 2}`} />
              <circle cx={-w} cy={-i * 5} r="1.5" fill="#d6b781" />
              <circle cx="0" cy={w / 2 - i * 5} r="1.5" fill="#d6b781" />
            </g>
          ))}
          {gable(w, -h, 1.35)}
          <path
            d={`M${-w - 4} ${-h} -3 ${-h - w * 1.35} ${w + 4} ${-h}`}
            fill="none"
            stroke="#efdbad"
            strokeWidth="2.4"
          />
          <path
            d={`M-3 ${-h - w * 1.35 - 8}v10m-5-5 5-4 5 4`}
            fill="none"
            stroke="#a8844c"
            strokeWidth="2"
          />
          {capital && level >= 3 && (
            <g transform={`translate(11 ${-h - 13})`}>
              <path d="M-10 0v-25l10-6 10 6V0L0 6Z" fill="#bc985f" />
              <path d="M0 6v-30l10-6V0Z" fill="#927346" />
              <path d="M-16-25 0-59 16-25 0-17Z" fill={roof} />
              <path
                d="M-16-25 0-59 16-25"
                stroke="#ead8ad"
                fill="none"
                strokeWidth="2"
              />
              <path d="M0-64v7" stroke="#9c7d43" strokeWidth="2" />
            </g>
          )}
          <path
            d={`M${-w + 4} ${-h + 9}v11l7 3V${-h + 12}Z`}
            fill="#425e4c"
            stroke="#f0dfb8"
            strokeWidth="2"
          />
          <path
            d={`M${-w + 2} ${-h + 8}l5-3 7 8`}
            fill="none"
            stroke="#eee0bd"
            strokeWidth="2"
          />
        </>
      )}
      {style === "classical" && (
        <>
          {gable(w, -h, 0.65)}
          <path
            d={`M${-w - 3} ${-h + 2} 0 ${-h + w / 2 + 3} ${w + 3} ${-h + 2}`}
            fill="none"
            stroke="#fff4d8"
            strokeWidth="4"
          />
          {[0.18, 0.43, 0.7, 0.9].map((ratio, i) => (
            <g key={i}>
              <path
                d={`M${-w + w * ratio} ${(w * ratio) / 2 - 3}v${-h + 7}`}
                stroke="#fff3d5"
                strokeWidth={capital ? 4 : 2.5}
              />
              <path
                d={`M${w * ratio} ${w / 2 - (w * ratio) / 2 - 3}v${-h + 7}`}
                stroke="#e5dfc5"
                strokeWidth={capital ? 3 : 2}
              />
            </g>
          ))}
          <path
            d={`M${-w - 4} 1 0 ${w / 2 + 4} ${w + 4} 1m${-2 * w - 2} 3L0 ${w / 2 + 8} ${w + 2} 4`}
            stroke="#e9dabb"
            strokeWidth="3"
            fill="none"
          />
          {capital && level >= 3 && (
            <g transform={`translate(0 ${-h - 10})`}>
              <path d="M-12 0v-17L0-24l12 7V0L0 7Z" fill="#eee5cc" />
              <path d="M-15-17 0-30 15-17 0-9Z" fill={roof} />
              <circle cy="-11" r="3" fill="#b9a672" />
              <path d="M0-35v-12" stroke="#8b815f" />
              <path d="M1-47l15 3-15 6Z" fill={roof} />
            </g>
          )}
        </>
      )}
      {japanese && (
        <>
          {[-0.8, -0.3, 0.3, 0.8].map((ratio, i) => (
            <path
              key={i}
              d={`M${w * ratio} ${w / 2 - Math.abs(w * ratio) / 2}v${-h}`}
              stroke="#725e3d"
              strokeWidth={capital ? 3 : 2}
            />
          ))}
          {Array.from(
            { length: capital ? Math.min(level, 4) : level >= 3 ? 2 : 1 },
            (_, i) => {
              const width = w + 6 - i * 4,
                y = -h - i * 17;
              return (
                <g key={i}>
                  {i > 0 && (
                    <path
                      d={`M${-width + 6} ${y + 16}v-18l${width - 6} -5 ${width - 6} 5v18`}
                      fill="#d9d2ac"
                      stroke="#827350"
                    />
                  )}
                  <path
                    d={`M${-width - 6} ${y - 6}Q${-width} ${y + 3} 0 ${y - 13}Q${width} ${y + 3} ${width + 6} ${y - 6}L${width + 3} ${y + 4} 0 ${y + width / 2 + 3} ${-width - 3} ${y + 4}Z`}
                    fill={roof}
                    stroke="#2f5144"
                    strokeWidth=".8"
                  />
                  <path
                    d={`M${-width - 6} ${y - 6}Q${-width} ${y + 3} 0 ${y - 13}Q${width} ${y + 3} ${width + 6} ${y - 6}`}
                    fill="none"
                    stroke="#b7c09a"
                    strokeWidth="1.5"
                  />
                </g>
              );
            },
          )}
          <path
            d={`M${-w} -2 0 ${w / 2 - 2} ${w} -2`}
            fill="none"
            stroke="#715f3b"
            strokeWidth="2"
          />
        </>
      )}
      {style === "dome" && (
        <>
          <path
            d={`M${-w - 2} ${-h}Q${-w} ${-h - w * 1.7} 0 ${-h - w * 1.7}Q${w} ${-h - w * 1.7} ${w + 2} ${-h}Q0 ${-h + w * 0.7} ${-w - 2} ${-h}`}
            fill={roof}
          />
          <path
            d={`M0 ${-h - w * 1.7}Q${w * 0.7} ${-h - w * 0.8} 0 ${-h + w * 0.25}`}
            fill="none"
            stroke="#adba8f"
            strokeWidth="1.5"
          />
          <path
            d={`M0 ${-h - w * 1.7}V${-h - w * 2}`}
            stroke="#bbab74"
            strokeWidth="2"
          />
          {capital && <circle cy={-h - w * 2} r="4" fill="#c8b476" />}
        </>
      )}
      {style === "fort" && (
        <>
          <path
            d={`M${-w - 2} ${-h} 0 ${-h - w / 2} ${w + 2} ${-h} 0 ${-h + w / 2}Z`}
            fill="#a4a589"
          />
          {[-1, -0.5, 0, 0.5, 1].map((r, i) => (
            <path
              key={i}
              d={`M${w * r} ${-h + w / 2 - Math.abs(w * r) / 2}v-8`}
              stroke={roof}
              strokeWidth="5"
            />
          ))}
          {capital && level >= 3 && (
            <path
              d={`M${-w - 3} 0v${-h - 12}l11 5V5m${2 * w - 8} -5v${-h - 12}l-11 5V5`}
              fill="#b4b49b"
              stroke="#868e74"
            />
          )}
        </>
      )}
      {style === "canal" && (
        <>
          {gable(w, -h, 0.9)}
          <path
            d={`M${-w} ${-h}v-6h5v-6h5v-6h5v-6h5v6h5v6h5v6h4v6Z`}
            fill="#ded3b4"
            stroke="#a8a285"
          />
          <path d={`M-5 ${-h - 8}v8h6v-8Z`} fill="#5e7766" />
        </>
      )}
      {style === "courtyard" && (
        <>
          <path
            d={`M${-w - 3} ${-h} 0 ${-h - w / 2} ${w + 3} ${-h} 0 ${-h + w / 2}Z`}
            fill="#ede0bd"
            stroke="#b5a780"
            strokeWidth="2"
          />
          <path
            d={`M${-w / 2} ${-h} 0 ${-h - w / 4} ${w / 2} ${-h} 0 ${-h + w / 4}Z`}
            fill="#789568"
          />
          <path
            d={`M4 ${w / 2 - 3}v-17q6-12 12-5V${w / 2 - 11}`}
            fill="#4d6750"
            stroke="#efe3c4"
            strokeWidth="2"
          />
        </>
      )}
      {style === "chalet" && (
        <>
          {gable(w + 8, -h, 1.05)}
          <path
            d={`M${-w - 5} -10 0 ${w / 2 - 8} ${w + 5} -10`}
            fill="none"
            stroke="#927953"
            strokeWidth="5"
          />
          {[-0.8, -0.4, 0, 0.4, 0.8].map((r, i) => (
            <path
              key={i}
              d={`M${w * r} ${w / 2 - Math.abs(w * r) / 2 - 8}v-8`}
              stroke="#bca376"
              strokeWidth="2"
            />
          ))}
          <path d={`M${-w + 5} ${-h - 8}v-17h6v20`} fill="#bcba9e" />
        </>
      )}
      {style === "longhouse" && (
        <>
          {gable(w + 7, -h, 1.35)}
          <path
            d={`M-3 ${-h - (w + 7) * 1.35}l-7-12m7 12 9-10`}
            stroke="#8d724c"
            strokeWidth="3"
          />
          <path
            d={`M${-w} 0v${-h}m8 4v${h}m${w * 2 - 16} -4v${-h}`}
            stroke="#8a734d"
            strokeWidth="3"
          />
          <path
            d={`M${-w + 4} -10 0 ${w / 2 - 8} ${w - 4} -10`}
            fill="none"
            stroke="#b39361"
            strokeWidth="3"
          />
        </>
      )}
      {style === "windtower" && (
        <>
          <path
            d={`M${-w - 3} ${-h} 0 ${-h - w / 2} ${w + 3} ${-h} 0 ${-h + w / 2}Z`}
            fill="#ded0ab"
            stroke="#baaa83"
            strokeWidth="3"
          />
          <g transform={`translate(3 ${-h})`}>
            <path
              d="M-9 0v-32l10-6 11 6V0L1 6Z"
              fill="#e4d2a9"
              stroke="#b3a37d"
            />
            <path d="M1-30V6l11-6v-32Z" fill="#bca982" />
            <path
              d="M-6-28v14m5-11v14m7-15v13"
              stroke="#746f51"
              strokeWidth="2"
            />
            <path d="M-11-32 1-39 14-32 1-25Z" fill="#e7d9b5" />
          </g>
          {capital && (
            <path d={`M${w - 7} -5v${-h - 14}l9-5 8 5V0Z`} fill="#bbae86" />
          )}
        </>
      )}
      {style === "pavilion" && (
        <>
          <path
            d={`M${-w - 5} 0v${-h}M${w + 5} 0v${-h}M0 ${w / 2 + 3}v${-h}`}
            stroke="#776949"
            strokeWidth="3"
          />
          <path
            d={`M${-w - 12} ${-h + 4}Q-8 ${-h - 11} 0 ${-h - 32}Q8 ${-h - 11} ${w + 12} ${-h + 4}L0 ${-h + w / 2 + 6}Z`}
            fill={roof}
          />
          <path d={`M0 ${-h - 32}v-7`} stroke="#c5b777" strokeWidth="2" />
          <path
            d={`M${-w - 6} 2 0 ${w / 2 + 5} ${w + 6} 2`}
            fill="none"
            stroke="#c8b88d"
            strokeWidth="4"
          />
        </>
      )}
      {style === "temple" && (
        <>
          {gable(w + 5, -h, 0.8)}
          <path
            d={`M${-w - 5} ${-h} 0 ${-h + (w + 5) / 2}`}
            stroke="#f9edd1"
            strokeWidth="4"
          />
          {[0.12, 0.35, 0.6, 0.85].map((r, i) => (
            <g key={i}>
              <path
                d={`M${-w + w * r} ${(w * r) / 2}v${-h + 2}`}
                stroke="#f5eacd"
                strokeWidth={capital ? 5 : 3}
              />
              <path
                d={`M${-w + w * r - 3} ${(w * r) / 2}l6 3m-6 ${-h}l6 3`}
                stroke="#c4b99a"
                strokeWidth="2"
              />
            </g>
          ))}
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${-w - 5 - i * 3} ${i * 3} 0 ${w / 2 + 5 + i * 3} ${w + 5 + i * 3} ${i * 3}`}
              stroke="#ddcfaf"
              strokeWidth="3"
              fill="none"
            />
          ))}
        </>
      )}
      {(style === "terrace" || style === "ziggurat") && (
        <>
          {Array.from(
            { length: capital ? Math.min(level + 1, 5) : 3 },
            (_, i) => {
              const width = w + 4 - i * (capital ? 5 : 4),
                y = -h - i * 9;
              return (
                <g key={i}>
                  <path
                    d={`M${-width} ${y + 8}v-8L0 ${y - width / 2} ${width} ${y}v8L0 ${y + width / 2 + 8}Z`}
                    fill={style === "terrace" ? "#c9c6a9" : "#c4ad7e"}
                    stroke="#a69e7e"
                    strokeWidth=".7"
                  />
                  <path
                    d={`M${-width} ${y} 0 ${y - width / 2} ${width} ${y} 0 ${y + width / 2}Z`}
                    fill={style === "terrace" ? "#9fae7b" : "#e0cd9f"}
                  />
                </g>
              );
            },
          )}
          {style === "ziggurat" && (
            <path
              d={`M-3 ${w / 2 + 3}v${-h - 18}l8-4V${w / 2 - 1}Z`}
              fill="#e6d4ab"
            />
          )}
        </>
      )}
      {style === "stilt" && (
        <>
          {gable(w + 5, -h, 1.1)}
          <path
            d={`M${-w} 0v13M0 ${w / 2}v13M${w} 0v13`}
            stroke="#826e48"
            strokeWidth="3"
          />
          <path
            d={`M${-w - 6} 1 0 ${w / 2 + 5} ${w + 6} 1`}
            fill="none"
            stroke="#b59c68"
            strokeWidth="5"
          />
          {[-0.6, -0.2, 0.2, 0.6].map((r, i) => (
            <path
              key={i}
              d={`M-3 ${-h - (w + 5) * 1.1} ${w * r} ${-h + w / 2 - Math.abs(w * r) / 2}`}
              stroke="#c5bb83"
              opacity=".5"
            />
          ))}
        </>
      )}
      {style === "tent" && (
        <>
          <path
            d={`M${-w - 7} 3v${-h * 0.65}Q0 ${-h * 1.1} ${w + 7} ${3 - h * 0.65}V3Q0 ${w + 4} ${-w - 7} 3Z`}
            fill="#e9d9b4"
            stroke="#c2b18a"
          />
          <path
            d={`M${-w - 7} ${3 - h * 0.65}Q-10 ${-h - 9} 0 ${-h - 13}Q10 ${-h - 9} ${w + 7} ${3 - h * 0.65}Q0 ${-h * 0.65 + w / 2 + 7} ${-w - 7} ${3 - h * 0.65}Z`}
            fill={roof}
          />
          <path
            d={`M${-w - 7} 0Q0 ${w} ${w + 7} 0`}
            fill="none"
            stroke="#9a8152"
            strokeWidth="3"
          />
          <path
            d={`M-4 ${w / 2 + 3}v-15q5-5 10 0V${w / 2 + 3}`}
            fill="#6c7051"
          />
        </>
      )}
      {style === "basilica" && (
        <>
          {gable(w, -h, 1.4)}
          <g transform={`translate(${-w * 0.6} ${-h + 10})`}>
            <path d="M-6 10v-28l6-3 6 3v28Z" fill="#dad2b5" />
            <path d="M-9-18 0-49 9-18Z" fill={roof} />
            <path d="M0-13v8" stroke="#5d725a" strokeWidth="2" />
          </g>
          {capital && (
            <g transform={`translate(${w * 0.6} ${-h + 10})`}>
              <path d="M-6 10v-28l6-3 6 3v28Z" fill="#bfc1a6" />
              <path d="M-9-18 0-49 9-18Z" fill={roof} />
            </g>
          )}
          <circle
            cx={-w / 2}
            cy={-h / 2}
            r={capital ? 6 : 3}
            fill="#789380"
            stroke="#f2e5c4"
            strokeWidth="2"
          />
        </>
      )}
      {style === "greenhouse" && (
        <>
          <path
            d={`M${-w} 0V${-h}Q0 ${-h - w * 1.7} ${w} ${-h}V0L0 ${w / 2}Z`}
            fill="#a9c6af"
            fillOpacity=".85"
            stroke="#5d7f68"
            strokeWidth="1.5"
          />
          {[-0.7, -0.35, 0, 0.35, 0.7].map((r, i) => (
            <path
              key={i}
              d={`M${w * r} ${w / 2 - Math.abs(w * r) / 2}V${-h}Q0 ${-h - w * 1.7} 0 ${-h - w * 1.2}`}
              fill="none"
              stroke="#f0ebce"
              strokeWidth="1.2"
            />
          ))}
          <path
            d={`M${-w} ${-h / 2} 0 ${-h / 2 + w / 2} ${w} ${-h / 2}M${-w} ${-h} 0 ${-h + w / 2} ${w} ${-h}`}
            fill="none"
            stroke="#f0ebce"
            strokeWidth="1.2"
          />
          <ellipse cy="0" rx={w * 0.5} ry="5" fill="#718e5c" />
        </>
      )}
      {style === "aqueduct" && (
        <>
          <path
            d={`M${-w - 3} ${-h} 0 ${-h - w / 2} ${w + 3} ${-h} 0 ${-h + w / 2}Z`}
            fill="#d9cfac"
            stroke="#b8b491"
            strokeWidth="3"
          />
          {[0.2, 0.5, 0.8].map((r, i) => (
            <path
              key={i}
              d={`M${-w + w * r - 3} ${(w * r) / 2}v${-h * 0.7}q4-9 8 3V${(w * r) / 2 + 4}`}
              fill="#647c5b"
              stroke="#eee1bd"
              strokeWidth="2"
            />
          ))}
          {capital && (
            <path
              d={`M${-w} ${-h - 4}v-10l${w} ${-w / 2} ${w} ${w / 2}v10`}
              fill="none"
              stroke="#bbb996"
              strokeWidth="4"
            />
          )}
        </>
      )}

      {["plain", "market", "arcade"].includes(style) && gable(w, -h)}
      {!timber && style !== "courtyard" && (
        <>
          <path
            d={`M5 ${w / 2 - 4}V${-h / 2 + 7}q4-6 8-4V${w / 2 - 10}Z`}
            fill="#526052"
          />
          {style !== "classical" && (
            <path d={`M${-w + 5} ${-h + 11}v8l6 3v-8Z`} fill="#697454" />
          )}
        </>
      )}
      {style === "arcade" && (
        <>
          {[0.2, 0.5, 0.8].map((r, i) => (
            <path
              key={i}
              d={`M${-w + w * r - 2} ${(w * r) / 2 - 3}v-12q3-5 6 0v15`}
              fill="#738268"
              stroke="#eee5c9"
              strokeWidth="2"
            />
          ))}
        </>
      )}
      {style === "market" && (
        <>
          <path d={`M0 -15l${w} -8 8 10-${w} 8Z`} fill="#d4b677" />
          {[0.2, 0.5, 0.8].map((r, i) => (
            <path
              key={i}
              d={`M${w * r} ${-15 - w * r * 0.45}l8 10`}
              stroke="#f4e5bf"
              strokeWidth="3"
            />
          ))}
          <path d={`M8 -5v11m${w} -19v11`} stroke="#80714e" strokeWidth="2" />
        </>
      )}
    </g>
  );
}
