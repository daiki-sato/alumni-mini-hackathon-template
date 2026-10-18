// 営業状況（営業中・もうすぐ閉店・営業時間外）を、取ってある営業時間から手元で計算する（追加のリクエストなし）。
// このファイルは型以外を import しない（node の型除去だけで検証スクリプトから読むため）。

import type { OpeningPeriod } from "./place";

export type OpenStatus = "open" | "closing" | "closed";

const WEEK = 7 * 24 * 60;
/** 閉店までこれ以下なら「もうすぐ閉店」 */
export const CLOSING_SOON_MIN = 60;

const at = (p: { day: number; hour: number; minute: number }) =>
  p.day * 1440 + p.hour * 60 + p.minute;

/**
 * いまの営業状況。periods がなければ null（分からないときは出さない）。
 * close がない期間は24時間営業とみなす。日をまたぐ期間（22時〜翌2時）も扱う
 */
export function openStatus(periods: OpeningPeriod[] | undefined, now: Date): OpenStatus | null {
  if (!periods?.length) return null;
  const t = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
  let best: number | null = null;
  for (const p of periods) {
    if (!p.close) return "open";
    const s = at(p.open);
    let e = at(p.close);
    if (e <= s) e += WEEK;
    // 週の終わりをまたぐ場合に備えて、1週前・同じ週・1週後で調べる
    for (const x of [t - WEEK, t, t + WEEK]) {
      if (x >= s && x < e) best = Math.max(best ?? 0, e - x);
    }
  }
  if (best === null) return "closed";
  return best <= CLOSING_SOON_MIN ? "closing" : "open";
}

export const OPEN_LABEL: Record<OpenStatus, string> = {
  open: "営業中",
  closing: "もうすぐ閉店",
  closed: "営業時間外",
};
