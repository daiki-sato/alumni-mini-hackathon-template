// キーがないときに使うデモデータ。Places API (New) と同じ形にしてある。
// 街・店・口コミ・著者名はすべて架空。位置も実在の店とは関係ない。

import type { Bounds, Place, Review } from "./place";

/**
 * 審査員向けの固定デモ（/map?demo=1）か。キーがあっても、このときはデモデータで動き、Google には接続しない
 */
export function forcedDemo(): boolean {
  return (
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1"
  );
}

/** デモの「いま」。口コミの日付はここから数える（描画のたびに値が変わらないよう固定） */
export const DEMO_NOW = Date.parse("2026-10-01T12:00:00+09:00");

export type DemoTown = {
  id: string;
  name: string;
  label: string;
  keywords: string[];
  center: { latitude: number; longitude: number };
};

export const DEMO_TOWNS: DemoTown[] = [
  {
    id: "tomori",
    name: "灯町",
    label: "下町・路地",
    keywords: ["下町", "路地", "谷根千風", "とうまち"],
    center: { latitude: 35.7262, longitude: 139.7655 },
  },
  {
    id: "minato",
    name: "みなと駅前",
    label: "駅前繁華街",
    keywords: ["繁華街", "駅前", "みなと"],
    center: { latitude: 35.6305, longitude: 139.7402 },
  },
  {
    id: "kasumi",
    name: "霞ビル街",
    label: "オフィス街",
    keywords: ["オフィス", "ビル街", "ランチ", "かすみ"],
    center: { latitude: 35.6748, longitude: 139.7552 },
  },
  {
    id: "gakuen",
    name: "学園坂",
    label: "学生街",
    keywords: ["学生", "大学", "坂", "がくえん"],
    center: { latitude: 35.7098, longitude: 139.7055 },
  },
  {
    id: "sakura",
    name: "桜ヶ丘",
    label: "住宅街の商店街",
    keywords: ["住宅街", "商店街", "丘", "さくら"],
    center: { latitude: 35.6452, longitude: 139.6702 },
  },
];

type Kind = "ramen" | "cafe" | "teishoku" | "gyoza" | "bakery" | "curry";
const KIND: Record<Kind, [string, string]> = {
  ramen: ["ramen_restaurant", "ラーメン店"],
  cafe: ["cafe", "カフェ"],
  teishoku: ["japanese_restaurant", "和食店"],
  gyoza: ["chinese_restaurant", "中華料理店"],
  bakery: ["bakery", "ベーカリー"],
  curry: ["indian_restaurant", "カレー店"],
};

type Opt = { cash?: boolean; resv?: boolean; groups?: boolean };
/** [著者, 何日前, ★, 本文] */
type R = [string, number, number, string];

const DAY = 24 * 60 * 60 * 1000;

function rev(placeId: string, i: number, [author, days, stars, text]: R): Review {
  return {
    name: `places/${placeId}/reviews/${i}`,
    rating: stars,
    text: { text, languageCode: "ja" },
    authorAttribution: { displayName: author },
    publishTime: new Date(DEMO_NOW - days * DAY).toISOString(),
    relativePublishTimeDescription:
      days < 7
        ? `${days}日前`
        : days < 60
          ? `${Math.round(days / 7)}週間前`
          : `${Math.round(days / 30)}か月前`,
  };
}

const byTown = new Map<string, Place[]>();

function P(
  town: string,
  name: string,
  kind: Kind,
  dLat: number,
  dLng: number,
  rating: number,
  count: number,
  opt: Opt,
  reviews: R[],
): Place {
  const t = DEMO_TOWNS.find((x) => x.id === town);
  if (!t) throw new Error(town);
  const list = byTown.get(town) ?? [];
  const id = `demo-${town}-${list.length + 1}`;
  const [type, typeName] = KIND[kind];
  const p: Place = {
    id,
    displayName: { text: name, languageCode: "ja" },
    formattedAddress: `${t.name}（架空の住所）`,
    location: { latitude: t.center.latitude + dLat, longitude: t.center.longitude + dLng },
    rating,
    userRatingCount: count,
    primaryType: type,
    primaryTypeDisplayName: { text: typeName, languageCode: "ja" },
    reservable: opt.resv,
    goodForGroups: opt.groups,
    paymentOptions: opt.cash ? { acceptsCashOnly: true } : { acceptsCreditCards: true },
    dineIn: true,
    reviews: reviews.map((r, i) => rev(id, i, r)),
  };
  list.push(p);
  byTown.set(town, list);
  return p;
}

// biome-ignore format: 1店ずつ読める並びにしておく
const ALL: Place[] = [
  // 灯町（下町・路地）
  P("tomori", "中華そば 小石", "ramen", 0.0011, -0.0021, 4.1, 64, { cash: true, resv: false }, [
    ["こう", 120, 4, "食券を買ってカウンターに座る。一人でさっと食べて帰る人ばかりで落ち着く。"],
    ["M.S", 200, 5, "もう3年通っている。スープが毎回同じ味で安心する。"],
    ["たろう", 340, 4, "昼は近所の常連さんが多い。私語は少なめ。"],
  ]),
  P("tomori", "喫茶 灯台", "cafe", -0.0008, -0.0032, 3.9, 38, { cash: true }, [
    ["ゆう", 90, 4, "ひとりで本を読むのにちょうどいい。私語が少ない店。"],
    ["H", 260, 4, "いつものブレンドをお願いすると、何も言わずに出てくる。"],
  ]),
  P("tomori", "定食 まるやま", "teishoku", -0.0017, 0.0004, 3.8, 52, { cash: true, resv: false }, [
    ["のり", 60, 4, "カウンターだけの小さな店。一人客が黙々と食べている。"],
    ["S.K", 150, 4, "常連さんがいつものを頼む声が聞こえる。焼き魚定食がうまい。"],
  ]),
  P("tomori", "麺処 たけ", "ramen", 0.0024, -0.0012, 4.2, 120, { cash: true, resv: false }, [
    ["けん", 45, 5, "食券制でロットごとに出てくる。私語は控えめに、と貼り紙がある。"],
    ["A", 110, 4, "一人で来る人がほとんど。カウンター8席。"],
    ["ぽん", 300, 4, "週に一度は通っている。"],
  ]),
  P("tomori", "パン 朝つゆ", "bakery", 0.0004, -0.0009, 4.0, 47, { cash: true, resv: false }, [
    ["みか", 80, 4, "朝7時から。近所の人がいつものパンを買っていく。"],
    ["T.N", 210, 4, "現金のみ。食パンがおいしい。"],
  ]),
  P("tomori", "洋食とカレー 一番星", "curry", 0.0031, 0.0018, 4.7, 210, { groups: true }, [
    ["miyu", 3, 5, "インスタで見て来ました！デートにぴったり。"],
    ["さき", 8, 5, "女子会で利用。映えるプレートが最高。"],
    ["R", 12, 5, "カップルで並びました。写真映えします。"],
    ["ゆ", 20, 5, "インスタの写真どおり。"],
  ]),
  P("tomori", "カフェ ルミエ", "cafe", 0.0042, 0.0031, 4.8, 860, { groups: true, resv: true }, [
    ["aya", 2, 5, "映えスポット！インスタに上げました。"],
    ["mei", 6, 5, "女子会で。大人数でも入れた。"],
    ["k", 14, 5, "デートで行きました。"],
    ["n", 25, 5, "カップル多め。"],
  ]),
  P("tomori", "らーめん 駅前大将 灯町駅前店", "ramen", 0.0039, 0.0022, 3.5, 420, { groups: true }, [
    ["しん", 40, 3, "駅前で入りやすい。グループ客も多い。"],
    ["Y", 100, 4, "食券制。普通においしい。"],
  ]),
  P("tomori", "餃子 宝来軒", "gyoza", 0.0018, 0.0026, 3.7, 96, { cash: true }, [
    ["まさ", 70, 4, "焼き餃子と瓶ビール。一人飲みにちょうどいい。"],
    ["E", 190, 4, "昔から通っている店。"],
  ]),
  P("tomori", "ドトール 灯町店", "cafe", 0.0036, 0.0012, 3.6, 150, {}, [
    ["U", 30, 4, "電源あり。打ち合わせにも使える。"],
  ]),

  // みなと駅前（駅前繁華街）
  P("minato", "中華そば 汽笛", "ramen", -0.0021, -0.0024, 4.1, 98, { cash: true, resv: false }, [
    ["じゅん", 50, 5, "カウンター7席。一人客ばかりで、私語のない静かな店。"],
    ["F", 140, 4, "食券を買って待つ。毎週通っている。"],
  ]),
  P("minato", "純喫茶 灯台守", "cafe", -0.0012, -0.0036, 3.9, 44, { cash: true }, [
    ["さとみ", 75, 4, "撮影禁止の貼り紙。おひとりさまが多い。"],
    ["W", 230, 4, "常連のおじさんたちが新聞を読んでいる。"],
  ]),
  P("minato", "定食 いかり", "teishoku", -0.0028, -0.0016, 3.8, 72, { cash: true, resv: false }, [
    ["ひろ", 95, 4, "ひとりで入りやすい定食屋。カウンター中心。"],
    ["Q", 180, 4, "いつもの日替わり。"],
  ]),
  P("minato", "カフェ マリンテラス", "cafe", 0.0015, 0.0018, 4.8, 920, { groups: true, resv: true }, [
    ["rina", 1, 5, "海が見えて映える！インスタ必須。"],
    ["kana", 4, 5, "デートで来ました。"],
    ["J", 9, 5, "女子会で利用、大人数OK。"],
    ["mm", 16, 5, "カップル席あり。"],
  ]),
  P("minato", "餃子酒場 ぎょうてん", "gyoza", 0.0002, 0.0006, 4.3, 460, { groups: true, resv: true }, [
    ["D", 10, 5, "大人数の飲み会で。にぎやか。"],
    ["ゆか", 22, 4, "インスタで見た羽根つき餃子。"],
  ]),
  P("minato", "らーめん 港屋", "ramen", 0.0019, 0.0004, 3.5, 530, { groups: true }, [
    ["P", 60, 3, "駅前で便利。観光客も多い。"],
    ["ち", 120, 4, "食券制。"],
  ]),
  P("minato", "スープカレー 波止場", "curry", 0.0005, 0.0012, 4.6, 380, { resv: false }, [
    ["L", 5, 5, "映えるスープカレー！"],
    ["もも", 11, 5, "デートで。"],
    ["X", 18, 5, "おいしい。"],
    ["G", 27, 4, "並びました。"],
  ]),
  P("minato", "ベーカリー ハーバー", "bakery", 0.0001, -0.0014, 3.7, 240, {}, [
    ["B", 90, 4, "駅前で便利。"],
  ]),
  P("minato", "カレーの店 錨", "curry", -0.0024, -0.0006, 3.8, 61, { cash: true }, [
    ["たく", 130, 4, "カウンターのみの小さなカレー屋。一人で来る人が多い。"],
    ["V", 260, 4, "昔から通っている。"],
  ]),

  // 霞ビル街（オフィス街）
  P("kasumi", "ラーメン 角", "ramen", -0.0022, -0.0026, 4.0, 180, { resv: false }, [
    ["Z", 40, 4, "昼は会社員が一人でさっと食べていく。食券制、ロットで出てくる。"],
    ["けい", 160, 4, "カウンターのみ。"],
  ]),
  P("kasumi", "地下の喫茶 ルート", "cafe", 0.0004, -0.0006, 3.8, 130, {}, [
    ["I", 70, 4, "ひとりで昼休みを過ごす人が多い。私語少なめで静か。"],
    ["O", 200, 4, "いつもの席がある。"],
  ]),
  P("kasumi", "カレー 霞ヶ屋", "curry", 0.0008, 0.0011, 3.9, 260, { cash: true, resv: false }, [
    ["あきら", 55, 4, "食券を買ってカウンターへ。一人客ばかり。"],
    ["C", 140, 4, "週3で通っている。"],
    ["ふみ", 300, 4, "常連さんが多い。"],
  ]),
  P("kasumi", "定食 昼の灯", "teishoku", -0.0028, -0.0012, 3.8, 66, { cash: true, resv: false }, [
    ["H.H", 100, 4, "一人で入っても気まずくない。常連が多い。"],
  ]),
  P("kasumi", "餃子定食 京橋", "gyoza", -0.0015, -0.0034, 3.7, 90, { cash: true }, [
    ["つよし", 80, 4, "カウンターで餃子定食。通って2年。"],
  ]),
  P("kasumi", "ビストロカフェ ガラス", "cafe", 0.0034, 0.0021, 4.7, 720, { groups: true, resv: true }, [
    ["sayo", 3, 5, "映えるランチ！"],
    ["kk", 7, 5, "女子会で。"],
    ["ma", 13, 5, "デートでも。"],
    ["to", 19, 5, "インスタで見ました。"],
  ]),
  P("kasumi", "ラーメン タワー", "ramen", 0.0026, 0.0035, 4.6, 980, { groups: true }, [
    ["sh", 6, 5, "インスタで話題。"],
    ["N", 15, 5, "大人数でも回転が早い。"],
  ]),
  P("kasumi", "パン 午後三時", "bakery", 0.0002, -0.0016, 3.8, 150, {}, [
    ["R.I", 120, 4, "会社帰りに。"],
  ]),
  P("kasumi", "松屋 霞ビル街店", "teishoku", 0.0018, 0.0002, 3.4, 410, {}, [
    ["K.O", 30, 3, "食券制。早い。"],
  ]),

  // 学園坂（学生街）
  P("gakuen", "家系 坂上家", "ramen", 0.0026, -0.0028, 4.0, 210, { resv: false }, [
    ["だい", 35, 5, "食券、ロット制。一人で来る学生が多い。"],
    ["Y.T", 150, 4, "カウンターのみ。私語は控えめに。"],
    ["しゅう", 280, 4, "4年間通った。"],
  ]),
  P("gakuen", "喫茶 ノート", "cafe", 0.0003, -0.0038, 3.9, 90, { cash: true }, [
    ["えみ", 60, 4, "ひとりで勉強している学生ばかり。私語は少なめ。"],
    ["ken", 210, 4, "いつもの窓際の席。"],
  ]),
  P("gakuen", "カレー 研究室", "curry", -0.0024, -0.0022, 4.0, 120, { resv: false }, [
    ["もと", 75, 4, "食券制、カウンター。一人客向き。"],
    ["S", 200, 4, "常連の先生も来る。"],
  ]),
  P("gakuen", "ラーメン 学食の向かい", "ramen", 0.0006, 0.0002, 3.9, 450, {}, [
    ["T", 20, 4, "授業の合間に。カウンター。"],
    ["あ", 50, 4, "グループでも入れる。"],
  ]),
  P("gakuen", "カフェ パステル", "cafe", 0.0011, 0.0014, 4.8, 780, { groups: true, resv: true }, [
    ["nana", 2, 5, "映えるパフェ！インスタに上げた。"],
    ["yu", 5, 5, "女子会で。"],
    ["rei", 9, 5, "デートで行った。"],
    ["mi", 14, 5, "カップル多め。"],
  ]),
  P("gakuen", "定食 学生の味方", "teishoku", -0.0006, -0.0006, 3.7, 330, { cash: true, groups: true }, [
    ["Q.Q", 40, 4, "大盛り無料。サークルの大人数でも入れる。"],
  ]),
  P("gakuen", "餃子 大盛軒", "gyoza", -0.0009, 0.0011, 3.6, 260, { groups: true }, [
    ["P.P", 90, 3, "飲み会で大人数。"],
  ]),
  P("gakuen", "パン 坂の途中", "bakery", 0.0018, -0.0042, 3.9, 70, { cash: true, resv: false }, [
    ["ちひろ", 110, 4, "近所の人がいつものパンを買いに来る。"],
  ]),

  // 桜ヶ丘（住宅街の商店街）
  P("sakura", "喫茶 さくら", "cafe", 0.0002, -0.0012, 3.9, 48, { cash: true }, [
    ["ふじ", 140, 4, "常連のお年寄りがいつもの席に座っている。私語は少なめ。"],
    ["ま", 320, 4, "ひとりでモーニング。"],
  ]),
  P("sakura", "中華そば 丘の上", "ramen", -0.0024, -0.0028, 3.9, 58, { cash: true, resv: false }, [
    ["しげ", 85, 4, "カウンター6席。一人客ばかり。"],
    ["Ｍ", 240, 4, "20年通っている。"],
  ]),
  P("sakura", "定食 おかめ", "teishoku", -0.0004, 0.0001, 3.8, 64, { cash: true, resv: false }, [
    ["よし", 100, 4, "商店街の定食屋。ひとりで入りやすい。常連が多い。"],
  ]),
  P("sakura", "パン工房 こむぎ", "bakery", 0.0004, 0.0011, 4.0, 110, { cash: true, resv: false }, [
    ["かな", 60, 4, "いつもの食パン。近所の人ばかり。"],
  ]),
  P("sakura", "餃子 桜亭", "gyoza", -0.0003, 0.0022, 3.7, 75, { cash: true }, [
    ["のぶ", 190, 4, "持ち帰りもできる。常連さんが多い。"],
  ]),
  P("sakura", "カレー ぽかぽか", "curry", 0.0021, -0.0018, 3.8, 40, {}, [
    ["ひな", 160, 4, "カウンターのみの小さな店。一人でゆっくり。"],
  ]),
  P("sakura", "カフェ 桜並木", "cafe", -0.0034, 0.0018, 4.7, 500, { groups: true, resv: true }, [
    ["lu", 3, 5, "桜の季節は映える！"],
    ["ai", 8, 5, "デートで。"],
    ["mo", 15, 5, "インスタで見て。"],
    ["su", 22, 5, "女子会。"],
  ]),
  P("sakura", "ファミリー定食 丘", "teishoku", -0.0026, 0.0026, 3.4, 290, { groups: true, resv: true }, [
    ["F.F", 70, 3, "家族で。大人数OK。"],
  ]),
];

export const DEMO_PLACES: Place[] = ALL;

export function demoTownOf(p: Place): DemoTown | undefined {
  const id = p.id.split("-")[1];
  return DEMO_TOWNS.find((t) => t.id === id);
}

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

function townText(t: DemoTown): string {
  return norm([t.name, t.label, ...t.keywords].join(" "));
}

export function placeText(p: Place): string {
  const t = demoTownOf(p);
  return (
    norm(`${p.displayName?.text ?? ""} ${p.primaryTypeDisplayName?.text ?? ""}`) +
    (t ? townText(t) : "")
  );
}

const GENRE_ALIASES: Record<string, string[]> = {
  ラーメン: ["ラーメン", "らーめん", "中華そば", "家系"],
  喫茶: ["喫茶", "カフェ"],
  定食: ["定食"],
  餃子: ["餃子"],
  パン: ["パン", "ベーカリー"],
  カレー: ["カレー"],
};

/** デモの検索。語をすべて含む店（ジャンル名は別名でも当てる）を返す */
export function demoSearch(q: string): Place[] {
  const ts = tokens(q);
  if (!ts.length) return [];
  return DEMO_PLACES.filter((p) => {
    const text = placeText(p);
    return ts.every((t) => {
      const alias = GENRE_ALIASES[t];
      return alias ? alias.some((a) => text.includes(norm(a))) : text.includes(t);
    });
  });
}

export function demoSearchBounds(b: Bounds): Place[] {
  return DEMO_PLACES.filter((p) => {
    const l = p.location;
    return (
      !!l &&
      l.latitude >= b.low.latitude &&
      l.latitude <= b.high.latitude &&
      l.longitude >= b.low.longitude &&
      l.longitude <= b.high.longitude
    );
  });
}
