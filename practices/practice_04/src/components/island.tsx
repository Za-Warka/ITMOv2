"use client";
import { useRef, useState } from "react";
import { Building, WorldState, seeded } from "@/domain/world";
import s from "./atlas.module.css";
import { BuildingModel } from "./building-model";

const project = (x: number, y: number) => ({
  x: 480 + (x - y) * 43,
  y: 295 + (x + y) * 22,
});
function Tree({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <ellipse cy="4" rx="14" ry="6" fill="#49623c" opacity=".13" />
      <path d="M0 4v-22" stroke="#716344" strokeWidth="3" />
      <path d="M-14-11 0-39 14-11Z" fill="#58734c" />
      <path d="M-11-22 0-45 11-22Z" fill="#7d955b" />
      <path d="M0-45 0-11 14-11Z" fill="#315642" opacity=".3" />
    </g>
  );
}
function House({
  building,
  selected,
  onSelect,
}: {
  building: Building;
  selected: boolean;
  onSelect: () => void;
}) {
  const p = project(building.x, building.y),
    capital = building.kind === "capital";
  const w = capital ? 34 : 17;
  return (
    <g
      transform={`translate(${p.x} ${p.y})`}
      tabIndex={0}
      role="button"
      aria-label={`${building.name}, ${building.language}`}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={s.building}
    >
      <title>{`${building.name} · ${building.language}`}</title>
      <ellipse cy="5" rx={w * 1.7} ry={w * 0.65} fill="#435c34" opacity=".16" />
      {selected && (
        <ellipse
          cy="3"
          rx={w * 1.9}
          ry={w * 0.85}
          fill="#e3d490"
          stroke="#315642"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
      )}
      <BuildingModel building={building} />
    </g>
  );
}
export function Island({
  world,
  seed,
  selected,
  onSelect,
}: {
  world: WorldState;
  seed: number;
  selected: string | null;
  onSelect: (b: Building) => void;
}) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const random = seeded(seed);
  const trees = Array.from({ length: 56 }, () => {
    const angle = random() * Math.PI * 2,
      radius = 0.7 + random() * 0.24;
    return {
      x: 480 + Math.cos(angle) * 345 * radius,
      y: 307 + Math.sin(angle) * 159 * radius,
      size: 0.65 + random() * 0.45,
    };
  }).sort((a, b) => a.y - b.y);
  const buildings = [...world.buildings].sort(
    (a, b) => a.x + a.y - (b.x + b.y),
  );
  return (
    <div className={s.mapCanvas}>
      <svg
        ref={svg}
        viewBox="0 0 960 620"
        className={s.island}
        aria-label="Карта цивилизации. Выберите здание или используйте панель деталей."
        onPointerDown={(e) => {
          if (
            e.pointerType === "mouse" &&
            e.button === 0 &&
            !(e.target as Element).closest('[role="button"]')
          ) {
            drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            const ratio =
              960 / (svg.current?.getBoundingClientRect().width || 960);
            setPan({
              x: Math.max(
                -500,
                Math.min(
                  500,
                  drag.current.px + (e.clientX - drag.current.x) * ratio,
                ),
              ),
              y: Math.max(
                -300,
                Math.min(
                  300,
                  drag.current.py + (e.clientY - drag.current.y) * ratio,
                ),
              ),
            });
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <pattern
            id="mapgrid"
            width="48"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 14 24 0 48 14 24 28Z"
              fill="none"
              stroke="#c6cbb5"
              strokeWidth=".5"
              opacity=".3"
            />
          </pattern>
          <filter id="islandshadow">
            <feGaussianBlur stdDeviation="13" />
          </filter>
        </defs>
        <rect width="960" height="620" fill="url(#mapgrid)" />
        <g
          transform={`translate(${480 + pan.x} ${310 + pan.y}) scale(${zoom}) translate(-480 -310)`}
        >
          <ellipse
            cx="480"
            cy="388"
            rx="326"
            ry="141"
            fill="#405640"
            opacity=".13"
            filter="url(#islandshadow)"
          />
          <path
            d="M106 313 142 235 258 173 389 155 500 134 652 170 756 220 843 299 805 381 687 438 560 470 402 455 241 414 151 369Z"
            fill="#d6decb"
            stroke="#c2cebc"
          />
          <path
            d="M135 311 165 249 269 192 392 174 502 154 643 187 744 235 811 299 780 366 681 418 557 447 408 433 251 393 177 357Z"
            fill="#e1d8b9"
            transform="translate(0 15)"
          />
          <path
            d="M135 311 165 249 269 192 392 174 502 154 643 187 744 235 811 299 780 366 681 418 557 447 408 433 251 393 177 357Z"
            fill="#b4c490"
            stroke="#9dac7a"
            strokeWidth="1.5"
          />
          <path
            d="M180 285 299 211 421 204 551 189 701 248 749 315 647 381 499 413 334 377 216 342Z"
            fill="#c3cc9c"
          />
          <path
            d="M627 192Q562 234 643 259T655 320Q610 349 697 407"
            fill="none"
            stroke="#dfd7b7"
            strokeWidth="24"
          />
          <path
            d="M627 192Q562 234 643 259T655 320Q610 349 697 407"
            fill="none"
            stroke="#94b9aa"
            strokeWidth="15"
          />
          <path
            d="M629 196Q569 234 647 259T659 320"
            fill="none"
            stroke="#cce0c8"
            strokeWidth="3"
            opacity=".75"
          />
          <g
            fill="none"
            stroke="#e1d6ad"
            strokeWidth="12"
            strokeLinecap="round"
          >
            <path d="M290 205 694 407M263 400 680 191" />
            {world.lots > 6 && (
              <path
                d="M349 249 564 359 651 315 438 205 349 249 263 293 479 403 564 359"
                strokeWidth="7"
              />
            )}
          </g>
          <g opacity=".7" fill="#98ad76">
            <ellipse cx="292" cy="338" rx="38" ry="15" />
            <ellipse cx="527" cy="216" rx="29" ry="13" />
            <ellipse cx="715" cy="302" rx="23" ry="12" />
          </g>
          {trees
            .filter((t) => t.y < 290)
            .map((t, i) => (
              <Tree key={`back-${i}`} {...t} />
            ))}
          <g transform="translate(277 213)">
            <path d="M-55 17 0-61 55 17Z" fill="#8a977b" />
            <path d="M0-61 55 17 8 1Z" fill="#74836b" />
            <path d="M-17-36 0-61 17-36 5-40-3-29Z" fill="#e8e5d0" />
          </g>
          {world.commitCount > 0 && (
            <>
              <path
                d="M609 275 639 290 665 277 635 262Z"
                fill="#c9b48c"
                stroke="#9f906e"
                strokeWidth="2"
              />
              <path
                d="M609 275v-9l30 15 26-13v9"
                fill="none"
                stroke="#ae9e79"
                strokeWidth="3"
              />
            </>
          )}
          {buildings.map((b) => (
            <House
              key={b.id}
              building={b}
              selected={selected === b.id}
              onSelect={() => onSelect(b)}
            />
          ))}
          {trees
            .filter((t) => t.y >= 290)
            .map((t, i) => (
              <Tree key={`front-${i}`} {...t} />
            ))}
          <g transform="translate(371 422)">
            <ellipse rx="26" ry="10" fill="#a6b481" />
            <path d="m-9 0 5-9 10 2 4 7Z" fill="#a1a58e" />
            <path d="m13 2 3-6 7 2 2 4Z" fill="#bbbca0" />
          </g>
          {world.recentCount > 0 && (
            <g fill="#e9d6a3">
              {[
                [-42, 29],
                [60, 28],
                [-67, -20],
              ]
                .slice(0, Math.min(3, world.recentCount))
                .map(([x, y], i) => (
                  <g key={i} transform={`translate(${480 + x} ${310 + y})`}>
                    <circle cy="-5" r="2.5" fill="#566147" />
                    <path d="M-2-2h4l1 6h-6Z" />
                  </g>
                ))}
            </g>
          )}
        </g>
        <g transform="translate(865 76)" fill="none" stroke="#768169">
          <circle r="26" opacity=".35" />
          <path d="M0-37V37M-37 0H37" opacity=".35" />
          <path d="M0-23 6 0 0 23-6 0Z" fill="#d5dbc5" />
          <path d="M0-23 6 0 0-5-6 0Z" fill="#456449" />
          <text
            y="-43"
            textAnchor="middle"
            stroke="none"
            fill="#657357"
            fontSize="11"
          >
            С
          </text>
        </g>
        <g transform="translate(65 552)" stroke="#829071" fill="none">
          <path d="M0-5V0H100V-5M50 0v-5" />
          <text
            x="50"
            y="18"
            textAnchor="middle"
            fill="#657357"
            stroke="none"
            fontSize="10"
          >
            Земли репозитория
          </text>
        </g>
      </svg>
      <div className={s.mapControls}>
        <button
          aria-label="Уменьшить карту"
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
        >
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          aria-label="Увеличить карту"
          onClick={() => setZoom((z) => Math.min(2.4, z + 0.2))}
        >
          +
        </button>
        <button
          aria-label="Показать весь остров"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          ⌖
        </button>
      </div>
      <div className={s.panControls} aria-label="Перемещение карты">
        <button
          aria-label="Карта влево"
          onClick={() => setPan((p) => ({ ...p, x: Math.max(-500, p.x - 50) }))}
        >
          ←
        </button>
        <button
          aria-label="Карта вверх"
          onClick={() => setPan((p) => ({ ...p, y: Math.max(-300, p.y - 50) }))}
        >
          ↑
        </button>
        <button
          aria-label="Карта вниз"
          onClick={() => setPan((p) => ({ ...p, y: Math.min(300, p.y + 50) }))}
        >
          ↓
        </button>
        <button
          aria-label="Карта вправо"
          onClick={() => setPan((p) => ({ ...p, x: Math.min(500, p.x + 50) }))}
        >
          →
        </button>
      </div>
    </div>
  );
}
