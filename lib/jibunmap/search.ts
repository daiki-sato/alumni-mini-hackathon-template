// 上部の検索欄の簡易検索。街名・店名・ジャンルのどれでも当たる。
// 空白で区切った語をすべて含むものを返す（例:「学生街 ラーメン」）。

import { areaName, GENRES, type Genre, getTown, SHOPS, type Shop, TOWNS, type Town } from "./shops";

export type Suggestion =
  | { type: "town"; town: Town; genre: Genre | null; count: number }
  | { type: "shop"; shop: Shop }
  | { type: "results"; query: string; ids: number[] };

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function tokens(q: string): string[] {
  return q
    .trim()
    .split(/[\s　]+/)
    .map(norm)
    .filter(Boolean);
}

function townText(t: Town): string {
  return norm([t.name, t.label, ...t.keywords, ...t.areas].join(" "));
}

function shopText(s: Shop): string {
  return norm([s.n, s.g, areaName(s)].join(" ")) + townText(getTown(s.townId));
}

const GENRE_SET = new Set<string>(GENRES.filter((g) => g !== "すべて"));

/** 語の中にジャンル名があれば返す */
function genreOf(ts: string[]): Genre | null {
  for (const t of ts) if (GENRE_SET.has(t)) return t as Genre;
  return null;
}

export function matchShops(q: string): Shop[] {
  const ts = tokens(q);
  if (!ts.length) return [];
  return SHOPS.filter((s) => {
    const text = shopText(s);
    return ts.every((t) => text.includes(t));
  });
}

export function suggest(q: string, limitShops = 6): Suggestion[] {
  const ts = tokens(q);
  if (!ts.length) return [];
  const genre = genreOf(ts);
  const out: Suggestion[] = [];
  const shops = matchShops(q);

  // 街: ジャンル名以外の語がすべて街に当たるとき
  const rest = ts.filter((t) => !GENRE_SET.has(t));
  if (rest.length) {
    for (const town of TOWNS) {
      const text = townText(town);
      if (rest.every((t) => text.includes(t))) {
        const count = SHOPS.filter((s) => s.townId === town.id && (!genre || s.g === genre)).length;
        out.push({ type: "town", town, genre, count });
      }
    }
  }

  // 店が2軒以上当たるときは「まとめて地図に出す」を先頭に置く。
  // 街の候補と同じ顔ぶれになるときは、街を選べば済むので出さない
  const sameAsTown = out.some((s) => s.type === "town" && s.count === shops.length);
  if (shops.length >= 2 && !sameAsTown) {
    out.unshift({ type: "results", query: q.trim(), ids: shops.map((s) => s.id) });
  }
  // 街に当たったときは、店名そのものに語を含む店だけを候補に出す（街の全店を並べない）
  const listed = out.some((s) => s.type === "town")
    ? shops.filter((s) => ts.some((t) => norm(s.n).includes(t)))
    : shops;
  for (const shop of listed.slice(0, limitShops)) out.push({ type: "shop", shop });
  return out;
}
