"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { placeName } from "@/lib/jibunmap/place";
import { SCORE_NAME, type Scored, verdict } from "@/lib/jibunmap/score";
import { InfoIcon } from "./Icons";

const PAD = 56;

/** 決まった並びの乱数（描画のたびに街並みが変わらないように） */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * キーがないときの簡易地図。店の位置（緯度経度）を枠に収めて点で並べるだけ。
 * 背景の道や建物は飾りで、実際の地形ではない
 */
export function DemoMapView({
  note,
  items,
  rankIds,
  selId,
  hoverId,
  onSelect,
  onHover,
}: {
  note: string;
  items: Scored[];
  rankIds: string[];
  selId: string | null;
  hoverId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      if (r.width && r.height) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = useMemo(() => {
    const locs = items.flatMap((s) => (s.place.location ? [s.place.location] : []));
    if (!locs.length) return new Map<string, { x: number; y: number }>();
    let minLat = Math.min(...locs.map((l) => l.latitude));
    let maxLat = Math.max(...locs.map((l) => l.latitude));
    let minLng = Math.min(...locs.map((l) => l.longitude));
    let maxLng = Math.max(...locs.map((l) => l.longitude));
    // 1軒だけのときなど、幅がゼロにならないように
    const minSpan = 0.004;
    if (maxLat - minLat < minSpan) {
      minLat -= minSpan / 2;
      maxLat += minSpan / 2;
    }
    if (maxLng - minLng < minSpan) {
      minLng -= minSpan / 2;
      maxLng += minSpan / 2;
    }
    // 経度1度は緯度1度より短い（東京あたりで約0.81倍）。縦横比を保って枠に収める
    const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const spanX = (maxLng - minLng) * kx;
    const spanY = maxLat - minLat;
    const scale = Math.min((size.w - PAD * 2) / spanX, (size.h - PAD * 2) / spanY);
    const ox = (size.w - spanX * scale) / 2;
    const oy = (size.h - spanY * scale) / 2;
    const m = new Map<string, { x: number; y: number }>();
    for (const s of items) {
      const l = s.place.location;
      if (!l) continue;
      m.set(s.place.id, {
        x: ox + (l.longitude - minLng) * kx * scale,
        y: oy + (maxLat - l.latitude) * scale,
      });
    }
    return m;
  }, [items, size]);

  const city = useMemo(() => {
    const rnd = seeded(7);
    const roads: string[] = [];
    for (let x = rnd() * 80; x < size.w; x += 90 + rnd() * 70) {
      roads.push(`M${x.toFixed(0)} -10 L${(x + (rnd() - 0.5) * 60).toFixed(0)} ${size.h + 10}`);
    }
    for (let y = rnd() * 80; y < size.h; y += 80 + rnd() * 60) {
      roads.push(`M-10 ${y.toFixed(0)} L${size.w + 10} ${(y + (rnd() - 0.5) * 50).toFixed(0)}`);
    }
    const blocks: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < Math.round((size.w * size.h) / 9000); i++) {
      blocks.push({ x: rnd() * size.w, y: rnd() * size.h, w: 14 + rnd() * 26, h: 10 + rnd() * 18 });
    }
    return { roads, blocks };
  }, [size]);

  // 下位から描いて、上位ほど前に出す。選択中の店はいちばん最後（最前面）
  const weight = (id: string) => {
    const r = rankIds.indexOf(id);
    return (id === selId ? 1000 : 0) + (r < 0 ? 0 : 100 - r);
  };
  const order = items.slice().sort((a, b) => weight(a.place.id) - weight(b.place.id));
  const tip = items.find((s) => s.place.id === (hoverId ?? ""));
  const tipPt = tip ? pts.get(tip.place.id) : undefined;

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden bg-[var(--map-ground)]">
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="absolute inset-0"
      >
        <title>デモの地図。店の位置を点で示しています（道と建物は飾り）</title>
        <g pointerEvents="none">
          {city.blocks.map((b) => (
            <rect
              key={`${b.x.toFixed(1)}-${b.y.toFixed(1)}`}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={3}
              fill="var(--map-block)"
              opacity={0.7}
            />
          ))}
          {city.roads.map((d) => (
            <g key={d}>
              <path d={d} stroke="var(--map-road-edge)" strokeWidth={9} fill="none" />
              <path d={d} stroke="var(--map-road)" strokeWidth={7} fill="none" />
            </g>
          ))}
        </g>
        {order.map((s) => {
          const p = pts.get(s.place.id);
          if (!p) return null;
          const id = s.place.id;
          const rank = rankIds.indexOf(id) + 1;
          const sel = id === selId;
          const label = `${placeName(s.place)}、${SCORE_NAME}${s.score}点（${verdict(s.score)}）${rank ? `、${rank}位` : ""}`;
          return (
            // biome-ignore lint/a11y/useSemanticElements: SVG の中なので <button> は置けない
            <g
              key={id}
              className="demo-pin"
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={sel}
              data-hot={id === hoverId}
              transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
              onClick={() => onSelect(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(id);
                }
              }}
              onMouseEnter={() => onHover(id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(id)}
              onBlur={() => onHover(null)}
            >
              <circle r={18} fill="transparent" />
              {rank && rank <= 3 ? (
                <g className="pin-body">
                  <path d="M0 0 L-6 -9 H6 Z" fill="var(--accent)" />
                  <rect
                    className="pin-focus"
                    x={-22}
                    y={-33}
                    width={44}
                    height={25}
                    rx={12.5}
                    fill="var(--accent)"
                    stroke={sel ? "var(--brand)" : "#fff"}
                    strokeWidth={sel ? 4 : 2}
                  />
                  <circle cx={-10} cy={-20.5} r={8.5} fill="var(--brand)" />
                  <text
                    x={-10}
                    y={-16.5}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill="var(--on-brand)"
                  >
                    {rank}
                  </text>
                  <text
                    x={8}
                    y={-16}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={700}
                    fill="var(--on-accent)"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {s.score}
                  </text>
                </g>
              ) : (
                <g className="pin-body">
                  {/* 4位以下は番号だけの小さなピン */}
                  <circle
                    className="pin-focus"
                    r={9}
                    fill="var(--surface)"
                    stroke={sel ? "var(--brand)" : "var(--pin-dot)"}
                    strokeWidth={sel ? 4 : 1.5}
                  />
                  <text
                    y={3.5}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill="var(--ink)"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {rank}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      {tip && tipPt && (
        <div
          className="anim-pop-in pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-brand px-2.5 py-1.5 text-on-brand text-xs shadow-e2"
          style={{ left: tipPt.x, top: tipPt.y - (rankIds.indexOf(tip.place.id) < 3 ? 40 : 14) }}
          role="status"
        >
          {placeName(tip.place)}
          <span className="ml-1.5 tabular-nums opacity-70">
            {tip.score}・{verdict(tip.score)}
          </span>
        </div>
      )}
      <div className="absolute top-3 left-1/2 flex max-w-[92%] -translate-x-1/2 items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-muted text-xs shadow-e1">
        <InfoIcon className="size-4 shrink-0" />
        <span className="truncate">{note}</span>
      </div>
    </div>
  );
}
