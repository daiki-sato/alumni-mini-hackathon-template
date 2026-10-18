// 検索欄の候補。手元のリストだけで作る（入力中に Google の API は呼ばない。費用のため）。
// 検索した語の履歴は残さない（記録しない方針）。
// このファイルは型以外を import しない（node の型除去だけで検証スクリプトから読むため）。

export type Town = { name: string; readings: string[] };

/** 東京の主な街（候補用）。読みはひらがなで、入力の途中（変換前）でも当たるように */
export const TOKYO_TOWNS: Town[] = [
  { name: "高円寺", readings: ["こうえんじ"] },
  { name: "下北沢", readings: ["しもきたざわ", "しもきた"] },
  { name: "吉祥寺", readings: ["きちじょうじ"] },
  { name: "神保町", readings: ["じんぼうちょう"] },
  { name: "中野", readings: ["なかの"] },
  { name: "荻窪", readings: ["おぎくぼ"] },
  { name: "西荻窪", readings: ["にしおぎくぼ", "にしおぎ"] },
  { name: "阿佐ヶ谷", readings: ["あさがや"] },
  { name: "三軒茶屋", readings: ["さんげんぢゃや", "さんちゃ"] },
  { name: "経堂", readings: ["きょうどう"] },
  { name: "祖師ヶ谷大蔵", readings: ["そしがやおおくら"] },
  { name: "蒲田", readings: ["かまた"] },
  { name: "大井町", readings: ["おおいまち"] },
  { name: "五反田", readings: ["ごたんだ"] },
  { name: "品川", readings: ["しながわ"] },
  { name: "目黒", readings: ["めぐろ"] },
  { name: "武蔵小山", readings: ["むさしこやま"] },
  { name: "学芸大学", readings: ["がくげいだいがく"] },
  { name: "自由が丘", readings: ["じゆうがおか"] },
  { name: "中目黒", readings: ["なかめぐろ"] },
  { name: "恵比寿", readings: ["えびす"] },
  { name: "渋谷", readings: ["しぶや"] },
  { name: "新宿", readings: ["しんじゅく"] },
  { name: "高田馬場", readings: ["たかだのばば"] },
  { name: "早稲田", readings: ["わせだ"] },
  { name: "池袋", readings: ["いけぶくろ"] },
  { name: "赤羽", readings: ["あかばね"] },
  { name: "十条", readings: ["じゅうじょう"] },
  { name: "北千住", readings: ["きたせんじゅ"] },
  { name: "上野", readings: ["うえの"] },
  { name: "谷中", readings: ["やなか"] },
  { name: "根津", readings: ["ねづ"] },
  { name: "千駄木", readings: ["せんだぎ"] },
  { name: "浅草", readings: ["あさくさ"] },
  { name: "秋葉原", readings: ["あきはばら"] },
  { name: "神田", readings: ["かんだ"] },
  { name: "御茶ノ水", readings: ["おちゃのみず", "お茶の水"] },
  { name: "人形町", readings: ["にんぎょうちょう"] },
  { name: "門前仲町", readings: ["もんぜんなかちょう", "もんなか"] },
  { name: "錦糸町", readings: ["きんしちょう"] },
];

export type Genre = { name: string; readings: string[] };

/** ジャンルの語（候補用） */
export const GENRE_WORDS: Genre[] = [
  { name: "ラーメン", readings: ["らーめん", "中華そば"] },
  { name: "喫茶", readings: ["きっさ", "カフェ", "かふぇ"] },
  { name: "カレー", readings: ["かれー"] },
  { name: "定食", readings: ["ていしょく"] },
  { name: "餃子", readings: ["ぎょうざ"] },
  { name: "パン", readings: ["ぱん"] },
  { name: "そば", readings: ["蕎麦"] },
  { name: "うどん", readings: [] },
  { name: "居酒屋", readings: ["いざかや"] },
  { name: "寿司", readings: ["すし", "鮨"] },
];

/** デモデータにあるジャンル（デモのときはこれだけを候補に出す） */
export const DEMO_GENRE_NAMES = ["ラーメン", "喫茶", "定食", "餃子", "パン", "カレー"];

/** 検索前に見せる例（検索欄の候補・一覧の空の状態・入口ページ） */
export const LIVE_EXAMPLES = ["高円寺 ラーメン", "神保町 喫茶", "門前仲町 定食", "蒲田 餃子"];
export const DEMO_EXAMPLES = ["灯町", "学園坂 ラーメン", "霞ビル街 定食", "桜ヶ丘 喫茶"];

export const MAX_SUGGESTIONS = 6;

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s　]+/g, "");
}

/** 語が入力の一片に当たるか（前方一致・部分一致。読みでも当てる） */
function hits(t: { name: string; readings: string[] }, token: string): boolean {
  if (!token) return false;
  return [t.name, ...t.readings].some((x) => {
    const n = norm(x);
    return n.includes(token) || (token.length >= 2 && token.includes(n));
  });
}

/**
 * 入力に合う「街 ジャンル」の組み合わせを最大 MAX_SUGGESTIONS 件。
 * 例:「高円」→「高円寺 ラーメン」「高円寺 喫茶」…、「カレー」→「高円寺 カレー」「下北沢 カレー」…
 */
export function suggestQueries(
  input: string,
  towns: Town[] = TOKYO_TOWNS,
  genres: Genre[] = GENRE_WORDS,
): string[] {
  const tokens = input
    .trim()
    .split(/[\s　]+/)
    .map(norm)
    .filter(Boolean);
  if (!tokens.length) return [];
  const townHits = towns.filter((t) => tokens.some((x) => hits(t, x)));
  const genreHits = genres.filter((g) => tokens.some((x) => hits(g, x)));
  const out: string[] = [];
  const push = (q: string) => {
    if (out.length < MAX_SUGGESTIONS && !out.includes(q) && norm(q) !== norm(input)) out.push(q);
  };
  if (townHits.length && genreHits.length) {
    for (const t of townHits) for (const g of genreHits) push(`${t.name} ${g.name}`);
  }
  if (townHits.length) {
    for (const t of townHits) for (const g of genres) push(`${t.name} ${g.name}`);
  } else if (genreHits.length) {
    for (const g of genreHits) for (const t of towns) push(`${t.name} ${g.name}`);
  }
  return out;
}

/** ジャンル語のほかに「飲食の検索だ」と分かる語（これがあれば「飲食店」を足さない） */
const FOOD_HINTS = ["飲食", "食堂", "レストラン", "グルメ", "ランチ", "ごはん"];

/**
 * Places に送る語。ジャンル語がないとき（例:「高円寺」）は末尾に「 飲食店」を足す。
 * 街の名前だけだと駅や公園ばかり返るため。画面の見出しとキャッシュのキーは入力のままにする
 */
export function foodQuery(input: string): string {
  const q = input.trim();
  if (!q) return q;
  const tokens = q
    .split(/[\s　]+/)
    .map(norm)
    .filter(Boolean);
  const hasGenre = GENRE_WORDS.some((g) => tokens.some((t) => hits(g, t)));
  const hasHint = FOOD_HINTS.some((h) => norm(q).includes(h));
  return hasGenre || hasHint ? q : `${q} 飲食店`;
}
