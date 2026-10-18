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
  /** 語が出た一文 */
  quote: string;
  author?: string;
  authorUri?: string;
  /** 同じ投稿者を見分けるキー（名前がなければ口コミの番号） */
  authorKey: string;
  /** その語が（否定されずに）出た口コミの件数 */
  reviewCount: number;
  /** その語を書いた人のキー（重複なし） */
  authorKeys: string[];
};

export function reviewText(r: Review): string {
  return r.text?.text ?? r.originalText?.text ?? "";
}

/** 語のすぐ後ろにこれが来たら、その語は「否定されている」とみなして数えない */
// 「ず」だけだと「混まず快適」のような良い意味まで拾うので、「ずに」の形だけを見る
export const NEGATIONS = ["ない", "にくい", "づらい", "無理", "できない", "ずに", "ません"];
/** 否定を探す範囲（語の後ろの文字数）。文や読点をまたいでは探さない */
export const NEGATION_WINDOW = 8;
const CLAUSE_END = /[。！？!?\n、，,]/;

/**
 * 否定の語を含むが、否定ではない言い回し（「気まずくない」「まずい」「一人ずつ」など）。
 * 先にこれを伏せてから否定を探す
 */
export const NOT_NEGATIONS = [
  "気まずくない",
  "気にならない",
  "苦にならない",
  "悪くない",
  "問題ない",
  "抵抗ない",
  "困らない",
  "無理なく",
  "無理なし",
  "ずいぶん",
  "わずか",
  "ずっと",
  "気まず",
  "まずい",
  "まず",
  "必ず",
  "ずつ",
];

/** text の at 文字目から始まる長さ len の語が、すぐ後ろで否定されているか */
export function negatedAt(text: string, at: number, len: number): boolean {
  // 言い回しが窓の端で切れないよう、少し長めに取ってから伏せる
  let tail = text.slice(at + len, at + len + NEGATION_WINDOW * 2);
  const cut = tail.search(CLAUSE_END);
  if (cut >= 0) tail = tail.slice(0, cut);
  for (const ok of NOT_NEGATIONS) tail = tail.replaceAll(ok, "＿".repeat(ok.length));
  tail = tail.slice(0, NEGATION_WINDOW);
  return NEGATIONS.some((n) => tail.includes(n));
}

/** 本文の中で w が出る位置。長い語（「おひとりさま」）の一部として出たものと、否定されたものは除く */
export function positions(text: string, w: string, all: string[]): number[] {
  if (!w) return [];
  const longer = all.filter((x) => x !== w && x.length > w.length && x.includes(w));
  const out: number[] = [];
  for (let i = text.indexOf(w); i >= 0; i = text.indexOf(w, i + w.length)) {
    const inLonger = longer.some((l) => {
      const off = l.indexOf(w);
      return off >= 0 && i - off >= 0 && text.startsWith(l, i - off);
    });
    if (!inLonger && !negatedAt(text, i, w.length)) out.push(i);
  }
  return out;
}

/** 本文に w が「単独で」「否定されずに」出ているか */
export function appears(text: string, w: string, all: string[]): boolean {
  return positions(text, w, all).length > 0;
}

/** at 文字目を含む一文（長すぎるときは語のまわりだけ） */
export function sentenceAt(text: string, at: number, len: number): string {
  const ends = /[。！？!?\n]/;
  let s = at;
  while (s > 0 && !ends.test(text[s - 1])) s--;
  let e = at + len;
  while (e < text.length && !ends.test(text[e])) e++;
  if (e < text.length) e++;
  const MAX = 60;
  let pre = "";
  let post = "";
  if (e - s > MAX) {
    const ns = Math.max(s, at - 20);
    const ne = Math.min(e, ns + MAX);
    if (ns > s) pre = "…";
    if (ne < e) post = "…";
    s = ns;
    e = ne;
  }
  return `${pre}${text.slice(s, e).replace(/\s+/g, " ").trim()}${post}`;
}

/**
 * 語ごとに、引用する口コミを1件だけ拾い、その語が出た口コミの件数と書いた人を数える。
 * 引用は同じ投稿者に偏らないよう、まだ拾っていない投稿者の口コミを優先する
 */
export function wordHits(reviews: Review[], words: string[]): Hit[] {
  const out: Hit[] = [];
  const used = new Set<string>();
  for (const w of words) {
    const found: Hit[] = [];
    for (const [i, r] of reviews.entries()) {
      const text = reviewText(r);
      const at = positions(text, w, words)[0];
      if (at === undefined) continue;
      const name = r.authorAttribution?.displayName;
      found.push({
        word: w,
        quote: sentenceAt(text, at, w.length),
        author: name,
        authorUri: r.authorAttribution?.uri,
        authorKey: name ? `n:${name}` : `r:${i}`,
        reviewCount: 0,
        authorKeys: [],
      });
    }
    if (!found.length) continue;
    const pick = found.find((h) => !used.has(h.authorKey)) ?? found[0];
    used.add(pick.authorKey);
    out.push({
      ...pick,
      reviewCount: found.length,
      authorKeys: [...new Set(found.map((h) => h.authorKey))],
    });
  }
  return out;
}

/* ---------- 店ごとの材料 ---------- */

export type Signals = {
  count: number;
  /** 判定に使った口コミの件数（Places は最大5件） */
  reviewsUsed: number;
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
    reviewsUsed: reviews.filter((r) => reviewText(r)).length,
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
  /** この一文に出た語 */
  words?: string[];
  author?: string;
  authorUri?: string;
};

export type PartKey = "base" | "minority" | "natural" | "good" | "ng" | "cons" | "groups" | "chain";

export type Part = { key: PartKey; label: string; value: number; reasons: Evidence[] };

/** 基本点（何も材料がない店の点） */
export const BASE_POINT = 50;
export const GOOD_POINT = 4;
export const GOOD_MAX = 24;
/** 同じ投稿者の口コミからの加点は、1人あたりここまで */
export const GOOD_PER_AUTHOR = 4;
/** 同じ語が2件以上の口コミに出たら、その語の点をこの倍にする */
export const REPEAT_WEIGHT = 1.5;

/** 語の重み。1件の口コミだけなら1、2件以上なら REPEAT_WEIGHT */
export function wordWeight(h: Hit): number {
  return h.reviewCount >= 2 ? REPEAT_WEIGHT : 1;
}
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

/** 同じ一文に出た語は1つの根拠にまとめる */
export function hitEvidence(hits: Hit[]): Evidence[] {
  const byQuote = new Map<string, Hit[]>();
  for (const h of hits) byQuote.set(h.quote, [...(byQuote.get(h.quote) ?? []), h]);
  return [...byQuote.values()].map((hs) => ({
    text: `口コミに${hs
      .map((h) => `「${h.word}」${h.reviewCount >= 2 ? `（${h.reviewCount}件）` : ""}`)
      .join("")}`,
    quote: hs[0].quote,
    words: hs.map((h) => h.word),
    author: hs[0].author,
    authorUri: hs[0].authorUri,
  }));
}

/**
 * うれしいワードの加点。語ごとに GOOD_POINT × 重み（2件以上の口コミに出たら 1.5 倍）。
 * その点を、語を書いた人たちで等分してから、1人あたり GOOD_PER_AUTHOR、合計 GOOD_MAX までに収める
 */
export function goodPoints(hits: Hit[]): { value: number; capped: boolean } {
  const per = new Map<string, number>();
  for (const h of hits) {
    const keys = h.authorKeys.length ? h.authorKeys : [h.authorKey];
    const share = (GOOD_POINT * wordWeight(h)) / keys.length;
    for (const k of keys) per.set(k, (per.get(k) ?? 0) + share);
  }
  let v = 0;
  let capped = false;
  for (const n of per.values()) {
    if (n > GOOD_PER_AUTHOR) capped = true;
    v += Math.min(GOOD_PER_AUTHOR, n);
  }
  return { value: r1(Math.min(GOOD_MAX, v)), capped };
}

/** NG ワードの減点。語ごとに NG_POINT × 重み、合計 NG_MAX まで */
export function ngPoints(hits: Hit[]): number {
  let v = 0;
  for (const h of hits) v += NG_POINT * wordWeight(h);
  return r1(Math.min(NG_MAX, v));
}

export function parts(s: Signals): Part[] {
  const n = s.count;
  const out: Part[] = [
    { key: "base", label: "基本", value: BASE_POINT, reasons: [] },
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

  const gp = goodPoints(s.good);
  out.push({
    key: "good",
    label: "うれしいワード",
    value: gp.value,
    reasons: [
      ...hitEvidence(s.good),
      ...(gp.capped ? [{ text: `同じ人の口コミからの加点は1人 +${GOOD_PER_AUTHOR} まで` }] : []),
    ],
  });
  out.push({
    key: "ng",
    label: "NGワード",
    value: -ngPoints(s.ng),
    reasons: hitEvidence(s.ng),
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

/** 点数の横に出す、ひと言の評価（一覧・詳細・地図でそろえる） */
export function verdict(v: number): string {
  if (v >= 80) return "◎ 仲間が多そう";
  if (v >= 60) return "○ 合いそう";
  if (v >= 35) return "△ ふつう";
  return "× 合わなそう";
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

export type ScoreOptions = {
  /** グループ向きの減点をしない（友だちと行くとき） */
  ignoreGroups?: boolean;
};

export function scorePlace(
  p: Place,
  now: number,
  words: WordLists,
  opts: ScoreOptions = {},
): Scored {
  const raw = signals(p, now, words);
  // 理由のチップや並ぶ人の予想とずれないよう、外した材料は signals からも外す
  const sg = opts.ignoreGroups ? { ...raw, goodForGroups: false } : raw;
  const ps = parts(sg);
  return { place: p, signals: sg, parts: ps, score: totalScore(ps) };
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

/** 口コミの件数を、数値を出さずに言う */
export function popularityWord(n: number): string {
  return n <= 5
    ? "口コミはまだ少ない"
    : n < 30
      ? "口コミが少なめ"
      : n <= 300
        ? "知る人ぞ知る"
        : n < 1000
          ? "やや人気"
          : "とても人気";
}

/** ここに並ぶ人の一文（数値は出さない） */
export function whoText(s: Scored): string {
  const g = s.signals;
  let t = g.good.length
    ? `口コミに「${g.good.map((h) => h.word).join("」「")}」が出ます。`
    : "口コミにうれしいワードは出ていません。";
  t += g.ng.length
    ? `NGワードは「${g.ng.map((h) => h.word).join("」「")}」。`
    : "NGワードは出ていません。";
  const tags = constraintTags(g);
  t += tags.length ? `制約は${tags.join("・")}。` : "目立つ制約はなし。";
  t += `${popularityWord(g.count)}店です。`;
  if (g.chain) t += "チェーン店の可能性があります。";
  return t;
}

/** 前後に並ぶ人の予想（数値は出さない） */
export function partyText(s: Scored): string {
  const pc = partyChance(s.signals).good;
  if (pc >= 0.65) return "前後に並ぶのは、一人客や常連が多そう";
  if (pc <= 0.35) return "前後に並ぶのは、グループやカップルが多そう";
  return "前後に並ぶ人は、いろいろいそう";
}

export type ReasonChip = { text: string; tone: "plus" | "minus" };

/** 点数を動かした理由だけを、数値なしの文で（±0 の項目は出さない） */
export function reasonChips(s: Scored): ReasonChip[] {
  const out: ReasonChip[] = [];
  const g = s.signals;
  const v = (k: PartKey) => partValue(s.parts, k);
  if (v("minority") !== 0) {
    out.push({ text: popularityWord(g.count), tone: v("minority") > 0 ? "plus" : "minus" });
  }
  if (g.rating !== null && g.rating >= 4.6 && g.count >= 100) {
    out.push({ text: "高評価に偏りすぎ", tone: "minus" });
  }
  if (g.dated >= 3 && g.recent >= 3) out.push({ text: "最近急に口コミが増えた", tone: "minus" });
  if (v("good") > 0)
    for (const h of g.good) out.push({ text: `口コミに「${h.word}」`, tone: "plus" });
  for (const h of g.ng) out.push({ text: `口コミに「${h.word}」`, tone: "minus" });
  if (g.cashOnly) out.push({ text: "現金のみ", tone: "plus" });
  if (g.notReservable) out.push({ text: "予約不可", tone: "plus" });
  if (g.goodForGroups) out.push({ text: "グループ向き", tone: "minus" });
  if (g.chain) out.push({ text: "チェーンらしい", tone: "minus" });
  return out;
}

/* ---------- シーン（ひとりで／友だちと） ---------- */

export type Scene = "solo" | "friends";

/** 「ひとりのときだけ」の語の初期値（友だちと行くときは数えない） */
export const DEFAULT_SOLO_ONLY = ["一人", "ひとり", "おひとりさま", "カウンター"];

/**
 * シーンに合わせた語のリスト。友だちとのときは「ひとりのときだけ」の語をうれしいワードから外す。
 * NG ワードはそのまま（「大人数」などは友だちとでも苦手なので残す）
 */
export function wordsForScene(words: WordLists, soloOnly: string[], scene: Scene): WordLists {
  if (scene === "solo") return words;
  return { good: words.good.filter((w) => !soloOnly.includes(w)), ng: words.ng };
}

/**
 * シーンを加味して採点する（純粋な関数）。友だちとのときは「ひとりのときだけ」の語を数えず、
 * グループ向きの減点もしない（NG ワードはそのまま）
 */
export function scorePlaceInScene(
  p: Place,
  now: number,
  words: WordLists,
  soloOnly: string[],
  scene: Scene,
): Scored {
  return scorePlace(p, now, wordsForScene(words, soloOnly, scene), {
    ignoreGroups: scene === "friends",
  });
}

/* ---------- 並び順 ---------- */

/**
 * 点数（score）の高い順に並べる。同点なら Google の検索結果の順（順番がないものは後ろ）、
 * それも同じなら id の順（描画のたびに並びが揺れないように）
 */
export function rankByScore(cands: Scored[]): Scored[] {
  const g = (s: Scored) => s.place.googleRank ?? Number.POSITIVE_INFINITY;
  return cands
    .slice()
    .sort((a, b) => b.score - a.score || g(a) - g(b) || a.place.id.localeCompare(b.place.id));
}

/**
 * 決め手の口コミ一文。うれしいワードがいちばん多く出た一文を選ぶ（なければ null）
 */
export function keyQuote(s: Scored): Evidence | null {
  const ev = hitEvidence(s.signals.good);
  if (!ev.length) return null;
  return ev.reduce((a, b) => ((b.words?.length ?? 0) > (a.words?.length ?? 0) ? b : a));
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
    // 否定された語（「一人では入りにくい」の「一人」）は数えていないので、色も付けない
    if (m && !negatedAt(text, i, m.w.length)) {
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
