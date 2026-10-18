// 手元の結果を、検索し直さずにジャンルで絞り込むための対応表（API は呼ばない）。
// Places の primaryType と、店の種類の表示名（primaryTypeDisplayName）・店名から、似たジャンルをまとめる。
// このファイルは型以外を import しない（node の型除去だけで検証スクリプトから読むため）。

import type { Place } from "./place";

export type GenreGroup = {
  key: string;
  label: string;
  /** 「このジャンルで検索し直す」ときに検索語へ足す語 */
  word: string;
  types: string[];
  /** 種類の表示名か店名に含まれていたら、このジャンルとみなす語 */
  words: string[];
};

export const GENRE_GROUPS: GenreGroup[] = [
  {
    key: "ramen",
    label: "ラーメン",
    word: "ラーメン",
    types: ["ramen_restaurant"],
    words: ["ラーメン", "らーめん", "中華そば", "つけ麺"],
  },
  {
    key: "cafe",
    label: "カフェ・喫茶",
    word: "カフェ",
    types: ["cafe", "coffee_shop", "tea_house", "cafeteria"],
    words: ["カフェ", "喫茶", "珈琲", "コーヒー"],
  },
  {
    key: "sushi",
    label: "寿司",
    word: "寿司",
    types: ["sushi_restaurant"],
    words: ["寿司", "鮨", "すし"],
  },
  {
    key: "soba",
    label: "そば・うどん",
    word: "そば",
    types: [],
    words: ["そば", "蕎麦", "うどん"],
  },
  {
    key: "izakaya",
    label: "居酒屋・バー",
    word: "居酒屋",
    types: ["bar", "pub", "wine_bar", "izakaya_restaurant", "japanese_izakaya_restaurant"],
    words: ["居酒屋", "バー", "酒場"],
  },
  {
    key: "yakiniku",
    label: "焼肉",
    word: "焼肉",
    types: ["yakiniku_restaurant", "korean_barbecue_restaurant", "barbecue_restaurant"],
    words: ["焼肉", "焼き肉"],
  },
  {
    key: "chinese",
    label: "中華・餃子",
    word: "中華",
    types: ["chinese_restaurant", "dumpling_restaurant"],
    words: ["中華", "餃子", "ぎょうざ"],
  },
  {
    key: "curry",
    label: "カレー",
    word: "カレー",
    types: ["indian_restaurant"],
    words: ["カレー"],
  },
  {
    key: "bakery",
    label: "パン",
    word: "パン",
    types: ["bakery"],
    words: ["パン", "ベーカリー"],
  },
  {
    key: "sweets",
    label: "スイーツ",
    word: "スイーツ",
    types: ["dessert_shop", "ice_cream_shop", "confectionery", "donut_shop", "chocolate_shop"],
    words: ["スイーツ", "ケーキ", "甘味"],
  },
  {
    key: "western",
    label: "洋食",
    word: "洋食",
    types: ["italian_restaurant", "french_restaurant", "steak_house", "hamburger_restaurant"],
    words: ["洋食", "イタリアン", "パスタ", "ハンバーグ"],
  },
  // 和食は最後に見る（ラーメン・寿司・そばなどの店も japanese_restaurant のことがあるため）
  {
    key: "washoku",
    label: "和食",
    word: "和食",
    types: ["japanese_restaurant"],
    words: ["和食", "定食", "食堂"],
  },
];

export const MAX_GENRE_CHIPS = 8;

/** 常に出す主なジャンル（結果にあればその場で絞り込み、なければ「今の街＋ジャンル」で検索し直す） */
export const MAIN_GENRE_KEYS = [
  "cafe",
  "washoku",
  "ramen",
  "curry",
  "chinese",
  "sushi",
  "izakaya",
  "bakery",
];

/** 検索語からジャンルの語を除いた「街」の部分（例:「高円寺 ラーメン」→「高円寺」） */
export function townPart(query: string): string {
  const all = GENRE_GROUPS.flatMap((g) => [g.word, g.label, ...g.words]).concat([
    "飲食店",
    "定食",
    "喫茶",
    "カフェ",
    "うどん",
    "そば",
    "餃子",
  ]);
  return query
    .split(/[\s　]+/)
    .filter((t) => t && !all.some((w) => t === w || t.includes(w)))
    .join(" ")
    .trim();
}

export type GenreOf = { key: string; label: string; word: string };

/** 店のジャンル。対応表に当たらなければ、Google の種類の表示名をそのまま使う */
export function genreOf(p: Place): GenreOf {
  const text = `${p.primaryTypeDisplayName?.text ?? ""} ${p.displayName?.text ?? ""}`;
  // 種類（primaryType）で当たるものを先に、なければ語で当てる
  const byType = p.primaryType
    ? GENRE_GROUPS.find((g) => g.types.includes(p.primaryType ?? ""))
    : undefined;
  const g =
    (byType && byType.key !== "washoku" ? byType : undefined) ??
    GENRE_GROUPS.find((x) => x.words.some((w) => text.includes(w))) ??
    byType;
  if (g) return { key: g.key, label: g.label, word: g.word };
  const label = p.primaryTypeDisplayName?.text || "その他";
  return { key: `t:${p.primaryType ?? label}`, label, word: label };
}

/** いまの結果に含まれるジャンルを、多い順に最大 MAX_GENRE_CHIPS 個 */
export function genreChips(places: Place[]): (GenreOf & { count: number })[] {
  const m = new Map<string, GenreOf & { count: number }>();
  for (const p of places) {
    const g = genreOf(p);
    const cur = m.get(g.key);
    if (cur) cur.count++;
    else m.set(g.key, { ...g, count: 1 });
  }
  return [...m.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"))
    .slice(0, MAX_GENRE_CHIPS);
}

/** URL の genre= から、対応表のジャンルを引く（結果に無くても「検索し直す」に使う） */
export function genreByKey(key: string): GenreOf | null {
  const g = GENRE_GROUPS.find((x) => x.key === key);
  return g ? { key: g.key, label: g.label, word: g.word } : null;
}
