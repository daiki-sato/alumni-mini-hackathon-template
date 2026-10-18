// 入口ページ（LP）に出す例を、デモデータ（架空の店）から score.ts で計算して選ぶ。手書きの数字は使わない。
// デモの店には Google の順位がないので、「Google の順」は口コミの多い順に見立てる（LP にもそう書く）。

import { DEMO_NOW, DEMO_PLACES, DEMO_TOWNS, type DemoTown, demoSearch } from "./demo";
import type { Place } from "./place";
import {
  appears,
  DEFAULT_WORDS,
  keyQuote,
  rankByScore,
  reviewText,
  type Scored,
  scorePlace,
  verdict,
} from "./score";

export type LpShop = {
  id: string;
  name: string;
  type: string;
  score: number;
  verdict: string;
  /** あなたの順（点数の高い順）での順位（街の中で） */
  mineRank: number;
  /** 口コミの多い順（Google の順に見立てる）での順位（街の中で） */
  popRank: number;
  quote: string | null;
};

/** 口コミの多い順（同数なら id の順） */
function byPopularity(list: Scored[]): Scored[] {
  return list
    .slice()
    .sort(
      (a, b) =>
        (b.place.userRatingCount ?? 0) - (a.place.userRatingCount ?? 0) ||
        a.place.id.localeCompare(b.place.id),
    );
}

function toShop(s: Scored, mine: Scored[], pop: Scored[]): LpShop {
  return {
    id: s.place.id,
    name: s.place.displayName?.text ?? "",
    type: s.place.primaryTypeDisplayName?.text ?? "飲食店",
    score: s.score,
    verdict: verdict(s.score),
    mineRank: mine.indexOf(s) + 1,
    popRank: pop.indexOf(s) + 1,
    quote: keyQuote(s)?.quote ?? null,
  };
}

function townPlaces(t: DemoTown): Place[] {
  return demoSearch(t.name);
}

/**
 * 並べ替えの差がいちばん大きい街を選ぶ。
 * 「口コミの多い順の1位が、あなたの順では下位」かつ「あなたの1位が、口コミの多い順では下位」になるほどよい
 */
export function lpExample(): {
  town: string;
  /** ヒーローのモック用: あなたの順の上位3軒 */
  top3: LpShop[];
  /** 比較用の同じ5軒。mine はあなたの順、pop は口コミの多い順 */
  mine: LpShop[];
  pop: LpShop[];
} {
  let best: { t: DemoTown; mine: Scored[]; pop: Scored[]; gap: number } | null = null;
  for (const t of DEMO_TOWNS) {
    const scored = townPlaces(t).map((p) => scorePlace(p, DEMO_NOW, DEFAULT_WORDS));
    if (scored.length < 5) continue;
    const mine = rankByScore(scored);
    const pop = byPopularity(scored);
    const gap = mine.indexOf(pop[0]) + pop.indexOf(mine[0]);
    if (!best || gap > best.gap) best = { t, mine, pop, gap };
  }
  if (!best) throw new Error("デモデータに5軒以上の街がありません");
  const { t, mine, pop } = best;
  // 5軒: 口コミの多い順の1位と、あなたの1位を必ず入れ、残りはあなたの順の上から
  const pick: Scored[] = [];
  for (const s of [pop[0], mine[0], ...mine]) {
    if (!pick.includes(s)) pick.push(s);
    if (pick.length === 5) break;
  }
  const five = (order: Scored[]) =>
    order.filter((s) => pick.includes(s)).map((s) => toShop(s, mine, pop));
  return {
    town: t.name,
    top3: mine.slice(0, 3).map((s) => toShop(s, mine, pop)),
    mine: five(mine),
    pop: five(pop),
  };
}

type Sentence = { text: string; place: string; placeId: string };

/** デモの口コミの一文のうち、kind の語がいちばん多く（否定されずに）出るもの */
function bestSentence(kind: "good" | "ng"): Sentence {
  const words = DEFAULT_WORDS[kind];
  let best: (Sentence & { n: number }) | null = null;
  for (const p of DEMO_PLACES) {
    for (const r of p.reviews ?? []) {
      for (const sentence of reviewText(r).split(/(?<=[。！？!?])/)) {
        const t = sentence.trim();
        if (!t) continue;
        const n = words.filter((w) => appears(t, w, words)).length;
        if (n && (!best || n > best.n))
          best = { text: t, place: p.displayName?.text ?? "", placeId: p.id, n };
      }
    }
  }
  if (!best) throw new Error(`デモの口コミに ${kind} の語が出る一文がありません`);
  return { text: best.text, place: best.place, placeId: best.placeId };
}

/**
 * 点数のしくみの例に使う、デモの口コミの一文（うれしいワードがいちばん多い一文と、NG ワードがいちばん多い一文）
 */
export function lpQuoteExamples(): { good: Sentence; ng: Sentence } {
  return { good: bestSentence("good"), ng: bestSentence("ng") };
}
