"use client";

import { useMemo, useState } from "react";
import { DEMO_NOW, DEMO_PLACES } from "@/lib/jibunmap/demo";
import {
  DEFAULT_SOLO_ONLY,
  DEFAULT_WORDS,
  reasonChips,
  SCORE_HINT,
  SCORE_NAME,
  type Scene,
  scorePlaceInScene,
  verdict,
} from "@/lib/jibunmap/score";

/** 例に使うデモの店（ひとりで／友だちとで点数が変わる店） */
export const LP_SCENE_PLACE_NAME = "麺処 たけ";

/**
 * 入口ページの「点数のしくみ」: 点数のゲージと理由のチップ。「ひとりで／友だちと」を押すと、
 * score.ts で計算し直して実際に数字が変わる（通信なし）
 */
export function LpScoreDemo() {
  const [scene, setScene] = useState<Scene>("solo");
  const place = DEMO_PLACES.find((p) => p.displayName?.text === LP_SCENE_PLACE_NAME);
  const s = useMemo(
    () =>
      place ? scorePlaceInScene(place, DEMO_NOW, DEFAULT_WORDS, DEFAULT_SOLO_ONLY, scene) : null,
    [place, scene],
  );
  if (!place || !s) return null;
  const chips = reasonChips(s);
  return (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-e1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold">
          {place.displayName?.text}
          <span className="ml-2 font-normal text-muted text-xs">（架空の店）</span>
        </p>
        <fieldset className="flex rounded-full bg-surface-2 p-0.5">
          <legend className="sr-only">誰と行くか</legend>
          {(
            [
              ["solo", "ひとりで"],
              ["friends", "友だちと"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={scene === v}
              onClick={() => setScene(v)}
              className={`h-10 rounded-full px-4 font-medium text-sm transition-colors ${
                scene === v ? "bg-brand text-on-brand" : "text-muted hover:text-ink"
              }`}
            >
              {l}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="mt-4 flex items-end gap-3" aria-live="polite">
        <span
          className="font-bold text-5xl tabular-nums leading-none"
          data-lp-scene-score={s.score}
        >
          {s.score}
        </span>
        <span className="pb-1 text-muted text-sm" title={SCORE_HINT}>
          / 100・{verdict(s.score)}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted">{SCORE_NAME}</p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-[#F2A71B] transition-[width] duration-300"
          style={{ width: `${s.score}%` }}
        />
      </div>
      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="点数を動かした理由">
        {chips.map((c) => (
          <li
            key={`${c.tone}-${c.text}`}
            className={`rounded-full px-3 py-1 text-[13px] ${
              c.tone === "plus" ? "bg-hi-soft text-hi" : "bg-lo-soft text-lo"
            }`}
          >
            {c.text}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted text-xs leading-relaxed">
        {scene === "friends"
          ? "友だちと行くときは、「一人」「カウンター」など、ひとりのときだけうれしい語を数えません。"
          : "ひとりで行くときは、「一人」「カウンター」などの語も点数に入ります。"}
      </p>
    </div>
  );
}
