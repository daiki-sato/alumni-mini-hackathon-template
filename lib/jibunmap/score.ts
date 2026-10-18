// 「自分の意思で選ぶ人が集まる度」の計算。
// 式と係数は public/prototypes/ik-1.html と同じ。発表スライドの数字と一致させるため変えない。
// このファイルは型以外を import しない（node の型除去だけで実行して ik-1 と突き合わせるため）。

import type { ShopData } from "./shops";

type Scorable = ShopData & { id: number };

export type Parts = {
  base: number;
  solo: number;
  reg: number;
  cons: number;
  sns: number;
  spike: number;
  skew: number;
};

export type Band = "hi" | "mid" | "lo";

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function pct(r: number): string {
  return `${Math.round(r * 100)}%`;
}

export function frac(r: number): string {
  if (r < 0.1) return "1割未満";
  if (r >= 0.95) return "ほぼ全員";
  if (r >= 0.45 && r < 0.55) return "半分";
  return `${Math.round(r * 10)}割`;
}

export function parts(s: ShopData): Parts {
  const d5 = s.d[4] / 100;
  return {
    base: 30,
    solo: s.so * 30,
    reg: s.rg * 25,
    cons: Math.min(s.cs.length, 4) * 5,
    sns: -s.ig * 60,
    spike: -Math.max(0, s.rc - 0.1) * 50,
    skew: -Math.max(0, d5 - 0.5) * 40,
  };
}

export function score(s: ShopData): number {
  const p = parts(s);
  let t = 0;
  for (const k of Object.keys(p) as (keyof Parts)[]) t += p[k];
  return Math.round(clamp(t, 0, 100));
}

export function band(v: number): Band {
  return v >= 60 ? "hi" : v >= 35 ? "mid" : "lo";
}

export function flags(s: ShopData): string[] {
  const f: string[] = [];
  if (s.d[4] >= 60) f.push(`★5が${s.d[4]}%に偏っている（★1〜2は${s.d[0] + s.d[1]}%）`);
  if (s.rc >= 0.2) f.push(`ここ3か月の口コミが全体の${pct(s.rc)}（急に増えた）`);
  if (s.ig >= 0.2) f.push(`口コミの${pct(s.ig)}に「インスタ」「映え」が出る`);
  return f;
}

export type AxisKey = "solo" | "reg" | "cons" | "sns" | "rev" | "old" | "few";

export type Axis = {
  k: AxisKey;
  l: string;
  /** 0〜1。大きいほど軸に合う */
  v: (s: ShopData) => number;
  /** 選ばれた理由の一言 */
  w: (s: ShopData) => string;
};

export const AXES: Axis[] = [
  { k: "solo", l: "一人客が多い", v: (s) => s.so, w: (s) => `一人客${pct(s.so)}` },
  { k: "reg", l: "常連が多い", v: (s) => s.rg, w: (s) => `常連${pct(s.rg)}` },
  {
    k: "cons",
    l: "制約がある",
    v: (s) => Math.min(s.cs.length, 4) / 4,
    w: (s) => `制約${s.cs.length}つ`,
  },
  {
    k: "sns",
    l: "SNS露出が少ない",
    v: (s) => 1 - Math.min(s.ig / 0.4, 1),
    w: (s) => `SNS露出${pct(s.ig)}`,
  },
  {
    k: "rev",
    l: "口コミが自然",
    v: (s) => 1 - flags(s).length / 3,
    w: (s) => {
      const f = flags(s).length;
      return f ? `怪しい点${f}つ` : "怪しい点なし";
    },
  },
  { k: "old", l: "年配が多い", v: (s) => 1 - s.yg, w: (s) => `若者${pct(s.yg)}` },
  {
    k: "few",
    l: "カップル・グループが少ない",
    v: (s) => 1 - (s.cp + s.gr),
    w: (s) => `カップル・グループ${pct(s.cp + s.gr)}`,
  },
];

export const DEFAULT_AXES: AxisKey[] = ["solo", "cons", "rev"];
export const MAX_AXES = 3;

export function axisObj(k: AxisKey): Axis | undefined {
  return AXES.find((a) => a.k === k);
}

export function isAxisKey(k: unknown): k is AxisKey {
  return typeof k === "string" && AXES.some((a) => a.k === k);
}

export function rankVal(s: ShopData, axes: AxisKey[]): number {
  let t = 0;
  for (const k of axes) {
    const a = axisObj(k);
    if (a) t += a.v(s);
  }
  return t + score(s) / 1000;
}

/** 候補を判断軸で並べ替えて返す。先頭3件が「今日の3軒」 */
export function computeTop<T extends Scorable>(cands: T[], axes: AxisKey[]): T[] {
  const c = cands.slice();
  c.sort((a, b) => rankVal(b, axes) - rankVal(a, axes) || a.id - b.id);
  return c;
}

/** すぐ前後に来る組が一人客である見込み（客数の割合を組の数に直す） */
export function partyChance(s: ShopData): { solo: number; other: number } {
  const p1 = s.so;
  const p2 = s.cp / 2;
  const p3 = s.gr / 3;
  const sum = p1 + p2 + p3;
  return sum ? { solo: p1 / sum, other: (p2 + p3) / sum } : { solo: 0, other: 0 };
}

export function whoText(s: ShopData): string {
  const age =
    s.yg < 0.35
      ? `年配が多め（若者は${frac(s.yg)}）`
      : s.yg > 0.6
        ? `若者が多め（${frac(s.yg)}）`
        : `年齢はまちまち（若者${frac(s.yg)}）`;
  let t = `一人客が${frac(s.so)}・常連が${frac(s.rg)}・SNS露出は${frac(s.ig)}。カップル・グループは${frac(s.cp + s.gr)}。${age}。`;
  if (s.cs.length) t += `制約は${s.cs.join("・")}の${s.cs.length}つ。`;
  else t += "店の制約はなし。";
  return t;
}
