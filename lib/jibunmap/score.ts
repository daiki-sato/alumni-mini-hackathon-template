// 「自分の意思で選ぶ人が集まる度」v2。
// ik-1 の考え方（一人客・常連・制約で加点、SNS露出・口コミの急増・★5の偏りで減点）を、
// Places API で実際に取れる項目に置き換えたもの。Google の並び順（件数・広告）は使わない。
// 口コミの語は、利用者が編集できる「うれしいワード」「NGワード」で数える。
// このファイルは型以外を import しない（node の型除去だけで検証スクリプトから読むため）。

import type { Place, Review } from "./place";

/* ---------- 語の初期値 ---------- */

export const DEFAULT_GOOD_WORDS = [
  "一人",
  "ひとり",
  "おひとりさま",
  "カウンター",
  "常連",
  "通って",
  "食券",
  "現金のみ",
  "静か",
];
export const DEFAULT_NG_WORDS = [
  "デート",
  "カップル",
  "映え",
  "インスタ",
  "女子会",
  "大人数",
  "パーティー",
  "行列必至",
];
export const MAX_WORDS = 20;
export const MAX_WORD_LENGTH = 12;

export type WordLists = { good: string[]; ng: string[] };
export const DEFAULT_WORDS: WordLists = { good: DEFAULT_GOOD_WORDS, ng: DEFAULT_NG_WORDS };

/** 既知のチェーン名（簡易） */
export const CHAIN_NAMES = [
  "松屋",
  "吉野家",
  "すき家",
  "なか卯",
  "日高屋",
  "天下一品",
  "一蘭",
  "一風堂",
  "丸亀製麺",
  "富士そば",
  "大戸屋",
  "やよい軒",
  "餃子の王将",
  "大阪王将",
  "CoCo壱番屋",
  "ココイチ",
  "サイゼリヤ",
  "ガスト",
  "コメダ",
  "スターバックス",
  "ドトール",
  "タリーズ",
  "ベローチェ",
  "マクドナルド",
  "モスバーガー",
];

/** 直近とみなす日数（口コミの急増の代わり） */
export const RECENT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/* ---------- 口コミの語 ---------- */

export type Hit = {
  word: string;
  quote: string;
  author?: string;
  authorUri?: string;
};

export function reviewText(r: Review): string {
  return r.text?.text ?? r.originalText?.text ?? "";
}

function count(text: string, w: string): number {
  if (!w) return 0;
  let n = 0;
  let i = text.indexOf(w);
  while (i >= 0) {
    n++;
    i = text.indexOf(w, i + w.length);
  }
  return n;
}

/**
 * 本文に w が「単独で」出ているか。
 * 「ひとり」が「おひとりさま」の中にしか出ないときは、長い方だけを数える（二重に数えない）
 */
export function appears(text: string, w: string, all: string[]): boolean {
  let n = count(text, w);
  if (!n) return false;
  for (const longer of all) {
    if (longer !== w && longer.length > w.length && longer.includes(w)) {
      n -= count(text, longer) * count(longer, w);
    }
  }
  return n > 0;
}

function snippet(text: string, at: number, len: number): string {
  const s = Math.max(0, at - 14);
  const e = Math.min(text.length, at + len + 14);
  return `${s > 0 ? "…" : ""}${text.slice(s, e).replace(/\s+/g, " ")}${e < text.length ? "…" : ""}`;
}

/** 語ごとに、最初に出た口コミを1件だけ拾う */
export function wordHits(reviews: Review[], words: string[]): Hit[] {
  const out: Hit[] = [];
  for (const w of words) {
    for (const r of reviews) {
      const text = reviewText(r);
      if (!appears(text, w, words)) continue;
      out.push({
        word: w,
        quote: snippet(text, text.indexOf(w), w.length),
        author: r.authorAttribution?.displayName,
        authorUri: r.authorAttribution?.uri,
      });
      break;
    }
  }
  return out;
}

/* ---------- 店ごとの材料 ---------- */

export type Signals = {
  count: number;
  rating: number | null;
  good: Hit[];
  ng: Hit[];
  /** 日付のある口コミの数と、そのうち直近のもの */
  dated: number;
  recent: number;
  cashOnly: boolean;
  notReservable: boolean;
  goodForGroups: boolean;
  /** チェーンらしい理由（なければ null） */
  chain: string | null;
};

export function chainReason(name: string): string | null {
  const known = CHAIN_NAMES.find((c) => name.includes(c));
  if (known) return `店名に「${known}」（チェーン）`;
  // 「○○ 新宿東口店」のように、空白のあとに地名＋「店」が付く形。本店は除く
  const m = name.match(/[\s　]([^\s　]{2,}店)$/);
  if (m && m[1] !== "本店") return `店名が「${m[1]}」で終わる（支店の形）`;
  return null;
}

export function signals(p: Place, now: number, words: WordLists): Signals {
  const reviews = p.reviews ?? [];
  let dated = 0;
  let recent = 0;
  for (const r of reviews) {
    if (!r.publishTime) continue;
    const t = Date.parse(r.publishTime);
    if (Number.isNaN(t)) continue;
    dated++;
    if (now - t <= RECENT_DAYS * DAY_MS) recent++;
  }
  return {
    count: p.userRatingCount ?? 0,
    rating: typeof p.rating === "number" ? p.rating : null,
    good: wordHits(reviews, words.good),
    ng: wordHits(reviews, words.ng),
    dated,
    recent,
    cashOnly: p.paymentOptions?.acceptsCashOnly === true,
    notReservable: p.reservable === false,
    goodForGroups: p.goodForGroups === true,
    chain: chainReason(p.displayName?.text ?? ""),
  };
}

/* ---------- 内訳 ---------- */

export type Evidence = {
  text: string;
  quote?: string;
  /** ハイライトする語 */
  word?: string;
  author?: string;
  authorUri?: string;
};

export type PartKey = "base" | "minority" | "natural" | "good" | "ng" | "cons" | "groups" | "chain";

export type Part = { key: PartKey; label: string; value: number; reasons: Evidence[] };

export const GOOD_POINT = 4;
export const GOOD_MAX = 24;
export const NG_POINT = 5;
export const NG_MAX = 25;

const r1 = (v: number) => Math.round(v * 10) / 10;

/** 少数派: 口コミ件数が少なめなほど加点。多すぎると減点。ごく少ないと情報不足で中立 */
export function minorityPoints(n: number): number {
  if (n <= 5) return 0;
  if (n < 30) return 6;
  if (n <= 300) return 12;
  if (n < 1000) return r1((12 * (1000 - n)) / 700);
  if (n < 3000) return -8;
  return -15;
}

function minorityText(n: number): string {
  if (n <= 5) return `口コミ${n}件。情報が足りないので中立`;
  if (n < 30) return `口コミ${n}件。少なめ`;
  if (n <= 300) return `口コミ${n}件。知る人ぞ知る件数`;
  if (n < 1000) return `口コミ${n}件。やや多い`;
  return `口コミ${n}件。多くの人が集まる店`;
}

function hitEvidence(h: Hit): Evidence {
  return {
    text: `口コミに「${h.word}」`,
    quote: h.quote,
    word: h.word,
    author: h.author,
    authorUri: h.authorUri,
  };
}

export function parts(s: Signals): Part[] {
  const n = s.count;
  const out: Part[] = [
    { key: "base", label: "基本", value: 40, reasons: [] },
    {
      key: "minority",
      label: "少数派（口コミ件数）",
      value: minorityPoints(n),
      reasons: [{ text: minorityText(n) }],
    },
  ];

  const nat: Evidence[] = [];
  let natV = 0;
  if (s.rating !== null && s.rating >= 4.6 && n >= 100) {
    natV -= 10;
    nat.push({ text: `★${s.rating.toFixed(1)}で${n}件。高評価に偏りすぎ` });
  }
  if (s.dated >= 4 && s.recent >= 4) {
    natV -= 10;
    nat.push({ text: `口コミ${s.dated}件のうち${s.recent}件が直近${RECENT_DAYS}日（急に増えた）` });
  } else if (s.dated >= 3 && s.recent >= 3) {
    natV -= 5;
    nat.push({ text: `口コミ${s.dated}件のうち${s.recent}件が直近${RECENT_DAYS}日` });
  }
  out.push({ key: "natural", label: "口コミの自然さ", value: natV, reasons: nat });

  out.push({
    key: "good",
    label: "うれしいワード",
    value: Math.min(GOOD_MAX, s.good.length * GOOD_POINT),
    reasons: s.good.map(hitEvidence),
  });
  out.push({
    key: "ng",
    label: "NGワード",
    value: -Math.min(NG_MAX, s.ng.length * NG_POINT),
    reasons: s.ng.map(hitEvidence),
  });

  const cons: Evidence[] = [];
  let consV = 0;
  if (s.cashOnly) {
    consV += 5;
    cons.push({ text: "支払いは現金のみ（Google の店舗情報）" });
  }
  if (s.notReservable) {
    consV += 5;
    cons.push({ text: "予約不可（Google の店舗情報）" });
  }
  out.push({ key: "cons", label: "店の制約", value: consV, reasons: cons });

  out.push({
    key: "groups",
    label: "グループ向き",
    value: s.goodForGroups ? -6 : 0,
    reasons: s.goodForGroups ? [{ text: "グループ向き（Google の店舗情報）" }] : [],
  });

  out.push({
    key: "chain",
    label: "チェーンらしさ",
    value: s.chain ? -10 : 0,
    reasons: s.chain ? [{ text: s.chain }] : [],
  });
  return out;
}

export function partValue(ps: Part[], k: PartKey): number {
  return ps.find((p) => p.key === k)?.value ?? 0;
}

export function totalScore(ps: Part[]): number {
  let t = 0;
  for (const p of ps) t += p.value;
  return Math.round(Math.max(0, Math.min(100, t)));
}

export type Band = "hi" | "mid" | "lo";
export function band(v: number): Band {
  return v >= 60 ? "hi" : v >= 35 ? "mid" : "lo";
}

/* ---------- 店ひとつ分の結果 ---------- */

export type Scored = {
  place: Place;
  signals: Signals;
  parts: Part[];
  score: number;
};

export function scorePlace(p: Place, now: number, words: WordLists): Scored {
  const sg = signals(p, now, words);
  const ps = parts(sg);
  return { place: p, signals: sg, parts: ps, score: totalScore(ps) };
}

/** 口コミの怪しい点 */
export function flags(s: Scored): string[] {
  return (s.parts.find((p) => p.key === "natural")?.reasons ?? []).map((e) => e.text);
}

/** 店の制約のタグ（Google の店舗情報＋うれしいワードに入った制約の語） */
export function constraintTags(s: Signals): string[] {
  const t: string[] = [];
  if (s.cashOnly) t.push("現金のみ");
  if (s.notReservable) t.push("予約不可");
  for (const h of s.good) {
    if (["食券", "ロット", "撮影禁止", "私語"].includes(h.word)) t.push(h.word);
  }
  return t;
}

/**
 * 前後に並ぶ組が「仲間」（うれしいワード側の客）である見込み。
 * 口コミの語の数からの推定で、ラプラス補正（両方0なら50%）をかける
 */
export function partyChance(s: Signals): { good: number; other: number } {
  const a = s.good.length;
  const b = s.ng.length + (s.goodForGroups ? 1 : 0);
  const good = (a + 1) / (a + b + 2);
  return { good, other: 1 - good };
}

export function whoText(s: Scored): string {
  const g = s.signals;
  const n = g.count;
  const size = n <= 5 ? "まだ少ない" : n <= 300 ? "ほどほど" : n < 1000 ? "やや多い" : "とても多い";
  let t = g.good.length
    ? `口コミに「${g.good.map((h) => h.word).join("」「")}」が出ます。`
    : "口コミにうれしいワードは出ていません。";
  t += g.ng.length
    ? `NGワードは「${g.ng.map((h) => h.word).join("」「")}」。`
    : "NGワードは出ていません。";
  const tags = constraintTags(g);
  t += tags.length ? `制約は${tags.join("・")}。` : "目立つ制約はなし。";
  t += `口コミ件数は${n}件で${size}。`;
  if (g.chain) t += "チェーン店の可能性があります。";
  return t;
}

/* ---------- 判断軸 ---------- */

export type AxisKey = "good" | "ng" | "cons" | "rev" | "few" | "groups" | "chain";

export type Axis = {
  k: AxisKey;
  l: string;
  /** 0〜1。大きいほど軸に合う */
  v: (s: Scored) => number;
  /** 選ばれた理由の一言 */
  w: (s: Scored) => string;
};

export const AXES: Axis[] = [
  {
    k: "good",
    l: "うれしいワードが多い",
    v: (s) => Math.min(s.signals.good.length, 4) / 4,
    w: (s) => `うれしいワード${s.signals.good.length}語`,
  },
  {
    k: "ng",
    l: "NGワードが少ない",
    v: (s) => 1 - Math.min(s.signals.ng.length, 4) / 4,
    w: (s) => (s.signals.ng.length ? `NGワード${s.signals.ng.length}語` : "NGワードなし"),
  },
  {
    k: "cons",
    l: "制約がある",
    v: (s) => partValue(s.parts, "cons") / 10,
    w: (s) => `制約${constraintTags(s.signals).length}つ`,
  },
  {
    k: "rev",
    l: "口コミが自然",
    v: (s) => 1 + partValue(s.parts, "natural") / 20,
    w: (s) => {
      const f = flags(s).length;
      return f ? `怪しい点${f}つ` : "怪しい点なし";
    },
  },
  {
    k: "few",
    l: "件数がほどほど",
    v: (s) => (partValue(s.parts, "minority") + 15) / 27,
    w: (s) => `口コミ${s.signals.count}件`,
  },
  {
    k: "groups",
    l: "グループ向きでない",
    v: (s) => (s.signals.goodForGroups ? 0 : 1),
    w: (s) => (s.signals.goodForGroups ? "グループ向き" : "グループ向きではない"),
  },
  {
    k: "chain",
    l: "チェーンらしくない",
    v: (s) => (s.signals.chain ? 0 : 1),
    w: (s) => (s.signals.chain ? "チェーンの可能性" : "個人店らしい"),
  },
];

export const DEFAULT_AXES: AxisKey[] = ["good", "ng", "rev"];
export const MAX_AXES = 3;

export function axisObj(k: AxisKey): Axis | undefined {
  return AXES.find((a) => a.k === k);
}

export function isAxisKey(k: unknown): k is AxisKey {
  return typeof k === "string" && AXES.some((a) => a.k === k);
}

export function rankVal(s: Scored, axes: AxisKey[]): number {
  let t = 0;
  for (const k of axes) {
    const a = axisObj(k);
    if (a) t += a.v(s);
  }
  return t + s.score / 1000;
}

/** 判断軸の合計で並べる。先頭3件が「今日の3軒」。Google の並び順は使わない */
export function computeTop(cands: Scored[], axes: AxisKey[]): Scored[] {
  return cands
    .slice()
    .sort(
      (a, b) =>
        rankVal(b, axes) - rankVal(a, axes) ||
        b.score - a.score ||
        a.place.id.localeCompare(b.place.id),
    );
}

/* ---------- ジャンル ---------- */

export const GENRES = ["すべて", "ラーメン", "喫茶", "定食", "餃子", "パン", "カレー"] as const;
export type Genre = (typeof GENRES)[number];

const GENRE_RULES: Record<Exclude<Genre, "すべて">, { types: string[]; words: string[] }> = {
  ラーメン: {
    types: ["ramen_restaurant"],
    words: ["ラーメン", "らーめん", "中華そば", "麺", "つけ麺"],
  },
  喫茶: {
    types: ["cafe", "coffee_shop", "tea_house"],
    words: ["喫茶", "カフェ", "珈琲", "コーヒー"],
  },
  定食: { types: ["japanese_restaurant"], words: ["定食", "食堂", "ごはん", "とんかつ"] },
  餃子: {
    types: ["chinese_restaurant", "dumpling_restaurant"],
    words: ["餃子", "ぎょうざ", "ギョーザ"],
  },
  パン: { types: ["bakery"], words: ["パン", "ベーカリー"] },
  カレー: { types: ["indian_restaurant"], words: ["カレー", "スパイス"] },
};

export function matchesGenre(p: Place, g: Genre): boolean {
  if (g === "すべて") return true;
  const rule = GENRE_RULES[g];
  if (p.primaryType && rule.types.includes(p.primaryType)) return true;
  const text = `${p.displayName?.text ?? ""} ${p.primaryTypeDisplayName?.text ?? ""}`;
  return rule.words.some((w) => text.includes(w));
}

/** 本文を、うれしいワード・NGワードの位置で区切る（詳細画面のハイライト用） */
export type Segment = { text: string; kind?: "good" | "ng" };

export function highlight(text: string, words: WordLists): Segment[] {
  const all = [
    ...words.good.map((w) => ({ w, kind: "good" as const })),
    ...words.ng.map((w) => ({ w, kind: "ng" as const })),
  ]
    .filter((x) => x.w)
    // 長い語を優先（「おひとりさま」を「ひとり」より先に当てる）
    .sort((a, b) => b.w.length - a.w.length);
  const out: Segment[] = [];
  let i = 0;
  let plain = "";
  while (i < text.length) {
    const m = all.find((x) => text.startsWith(x.w, i));
    if (m) {
      if (plain) out.push({ text: plain });
      plain = "";
      out.push({ text: m.w, kind: m.kind });
      i += m.w.length;
    } else {
      plain += text[i];
      i++;
    }
  }
  if (plain) out.push({ text: plain });
  return out;
}
