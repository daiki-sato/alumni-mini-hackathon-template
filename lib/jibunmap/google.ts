// ブラウザ側で Maps JavaScript API を読み、Place.searchByText で店を探す。
// キーは HTTP リファラで制限したブラウザ用の1本（NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY）。
// 費用の安全策: 同じ検索は sessionStorage に10分だけ置いて再検索しない／1セッションの検索回数に上限。

import type { Bounds, Place, PriceLevel, Review } from "./place";

export const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
export const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";

export const SEARCH_LIMIT = 30;
const CACHE_MS = 10 * 60 * 1000;
const CACHE_PREFIX = "jibunmap-cache:";
const COUNT_KEY = "jibunmap-search-count";

/**
 * 取得する項目（JS 版の名前）。課金の区分は要求した項目のうち最も高いものになる。
 * reviews・isReservable・isGoodForGroups・paymentOptions・editorialSummary は Enterprise + Atmosphere。
 * 詳細を開いたときに追加で取らないよう、一覧の検索でまとめて取る（1検索1リクエスト）。
 */
export const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "primaryType",
  "primaryTypeDisplayName",
  "googleMapsURI",
  "isReservable",
  "isGoodForGroups",
  "paymentOptions",
  "reviews",
  "editorialSummary",
  // 以下は Pro（photos）と Enterprise（営業時間・価格帯・電話・Web サイト）。上の Enterprise + Atmosphere
  // より下の区分なので、Text Search の料金は変わらない。写真の画像そのものは別の SKU（下の上限を参照）
  "photos",
  "regularOpeningHours",
  "priceRange",
  "nationalPhoneNumber",
  "websiteURI",
];

/** 1店あたり持っておく写真の数（Places が返す分＝最大10枚。読むのは画面に入ったものだけ） */
export const PHOTOS_PER_PLACE = 10;
/**
 * 1セッションで読む写真の上限。写真は1枚ごとに Place Details Photos（無料枠は月1,000回）に数えられるため。
 * 上限を超えたら写真の代わりにプレースホルダーを出す
 */
export const PHOTO_LIMIT = 60;
const PHOTO_KEY = "jibunmap-photo-urls";

/* ---------- Maps JavaScript API の最小限の型 ---------- */

export type GLatLng = { lat(): number; lng(): number };
export type GLatLngBounds = { getSouthWest(): GLatLng; getNorthEast(): GLatLng };

type JsReview = {
  text?: string | null;
  textLanguageCode?: string | null;
  originalText?: string | null;
  rating?: number | null;
  publishTime?: Date | null;
  relativePublishTimeDescription?: string | null;
  authorAttribution?: {
    displayName?: string;
    uri?: string | null;
    photoURI?: string | null;
  } | null;
  googleMapsURI?: string | null;
};

type JsMoney = {
  currencyCode?: string | null;
  units?: number | string | null;
  nanos?: number | null;
};

type JsPhoto = {
  widthPx?: number | null;
  heightPx?: number | null;
  authorAttributions?: { displayName?: string; uri?: string | null }[] | null;
  getURI(opts?: { maxWidth?: number; maxHeight?: number }): string;
};

type JsPlace = {
  id: string;
  displayName?: string | null;
  formattedAddress?: string | null;
  location?: GLatLng | null;
  rating?: number | null;
  userRatingCount?: number | null;
  priceLevel?: string | null;
  primaryType?: string | null;
  primaryTypeDisplayName?: string | null;
  googleMapsURI?: string | null;
  isReservable?: boolean | null;
  isGoodForGroups?: boolean | null;
  paymentOptions?: {
    acceptsCashOnly?: boolean | null;
    acceptsCreditCards?: boolean | null;
    acceptsDebitCards?: boolean | null;
    acceptsNFC?: boolean | null;
  } | null;
  reviews?: JsReview[] | null;
  editorialSummary?: string | null;
  photos?: JsPhoto[] | null;
  regularOpeningHours?: { weekdayDescriptions?: string[] | null } | null;
  priceRange?: { startPrice?: JsMoney | null; endPrice?: JsMoney | null } | null;
  nationalPhoneNumber?: string | null;
  websiteURI?: string | null;
};

type PlacesLib = {
  Place: {
    searchByText(req: Record<string, unknown>): Promise<{ places: JsPlace[] }>;
  };
};

type ImportLibrary = (name: string) => Promise<unknown>;

/* ---------- 読み込み（公式の dynamic library import と同じ動き） ---------- */

let installed = false;

function installLoader(params: Record<string, string>): void {
  if (installed) return;
  installed = true;
  const w = window as unknown as { google?: { maps?: Record<string, unknown> } };
  w.google ??= {};
  w.google.maps ??= {};
  const maps = w.google.maps;
  if (maps.importLibrary) return;
  const libs = new Set<string>();
  let loading: Promise<void> | null = null;
  const load = () => {
    loading ??= new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      const q = new URLSearchParams();
      q.set("libraries", [...libs].join(","));
      for (const [k, v] of Object.entries(params)) {
        q.set(
          k.replace(/[A-Z]/g, (t) => `_${t.toLowerCase()}`),
          v,
        );
      }
      q.set("callback", "google.maps.__ib__");
      s.src = `https://maps.googleapis.com/maps/api/js?${q}`;
      maps.__ib__ = resolve;
      s.onerror = () => {
        loading = null;
        reject(new Error("Google Maps JavaScript API を読み込めませんでした"));
      };
      s.nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? "";
      document.head.append(s);
    });
    return loading;
  };
  // 読み込みが終わると Google が本物の importLibrary に差し替える
  maps.importLibrary = (name: string) => {
    libs.add(name);
    return load().then(() => (maps.importLibrary as ImportLibrary)(name));
  };
}

export function importLibrary<T>(
  name: "maps" | "marker" | "places" | "core" | "routes",
): Promise<T> {
  installLoader({ key: BROWSER_KEY, v: "weekly", language: "ja", region: "JP" });
  const maps = (window as unknown as { google: { maps: { importLibrary: ImportLibrary } } }).google
    .maps;
  return maps.importLibrary(name) as Promise<T>;
}

/* ---------- JS 版の Place を REST と同じ形に直す ---------- */

const PRICE: Record<string, PriceLevel> = {
  FREE: "PRICE_LEVEL_FREE",
  INEXPENSIVE: "PRICE_LEVEL_INEXPENSIVE",
  MODERATE: "PRICE_LEVEL_MODERATE",
  EXPENSIVE: "PRICE_LEVEL_EXPENSIVE",
  VERY_EXPENSIVE: "PRICE_LEVEL_VERY_EXPENSIVE",
};

const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

function fromJsReview(r: JsReview): Review {
  return {
    text: r.text ? { text: r.text, languageCode: opt(r.textLanguageCode) } : undefined,
    originalText: r.originalText ? { text: r.originalText } : undefined,
    rating: opt(r.rating),
    publishTime: r.publishTime ? r.publishTime.toISOString() : undefined,
    relativePublishTimeDescription: opt(r.relativePublishTimeDescription),
    authorAttribution: r.authorAttribution
      ? { displayName: r.authorAttribution.displayName, uri: opt(r.authorAttribution.uri) }
      : undefined,
    googleMapsUri: opt(r.googleMapsURI),
  };
}

function fromJsMoney(m?: JsMoney | null) {
  if (!m) return undefined;
  return {
    currencyCode: opt(m.currencyCode),
    units: m.units === null || m.units === undefined ? undefined : String(m.units),
    nanos: opt(m.nanos),
  };
}

function fromJsPhoto(ph: JsPhoto) {
  return {
    // URL を作るだけでは課金されない（画像を読んだときに数えられる）
    thumb: ph.getURI({ maxWidth: 160, maxHeight: 160 }),
    large: ph.getURI({ maxWidth: 600, maxHeight: 600 }),
    full: ph.getURI({ maxWidth: 1200, maxHeight: 1200 }),
    widthPx: opt(ph.widthPx),
    heightPx: opt(ph.heightPx),
    authorAttributions: (ph.authorAttributions ?? []).flatMap((a) =>
      a.displayName ? [{ displayName: a.displayName, uri: opt(a.uri) }] : [],
    ),
  };
}

export function fromJsPlace(p: JsPlace): Place {
  return {
    id: p.id,
    displayName: p.displayName ? { text: p.displayName } : undefined,
    formattedAddress: opt(p.formattedAddress),
    location: p.location ? { latitude: p.location.lat(), longitude: p.location.lng() } : undefined,
    rating: opt(p.rating),
    userRatingCount: opt(p.userRatingCount),
    priceLevel: p.priceLevel ? PRICE[p.priceLevel] : undefined,
    primaryType: opt(p.primaryType),
    primaryTypeDisplayName: p.primaryTypeDisplayName
      ? { text: p.primaryTypeDisplayName }
      : undefined,
    googleMapsUri: opt(p.googleMapsURI),
    reservable: opt(p.isReservable),
    goodForGroups: opt(p.isGoodForGroups),
    paymentOptions: p.paymentOptions
      ? {
          acceptsCashOnly: opt(p.paymentOptions.acceptsCashOnly),
          acceptsCreditCards: opt(p.paymentOptions.acceptsCreditCards),
          acceptsDebitCards: opt(p.paymentOptions.acceptsDebitCards),
          acceptsNfc: opt(p.paymentOptions.acceptsNFC),
        }
      : undefined,
    reviews: p.reviews ? p.reviews.map(fromJsReview) : undefined,
    editorialSummary: p.editorialSummary ? { text: p.editorialSummary } : undefined,
    photos: p.photos?.length ? p.photos.slice(0, PHOTOS_PER_PLACE).map(fromJsPhoto) : undefined,
    regularOpeningHours: p.regularOpeningHours?.weekdayDescriptions?.length
      ? { weekdayDescriptions: p.regularOpeningHours.weekdayDescriptions }
      : undefined,
    priceRange: p.priceRange
      ? {
          startPrice: fromJsMoney(p.priceRange.startPrice),
          endPrice: fromJsMoney(p.priceRange.endPrice),
        }
      : undefined,
    nationalPhoneNumber: opt(p.nationalPhoneNumber),
    websiteUri: opt(p.websiteURI),
  };
}

/* ---------- 写真の上限 ---------- */

const shownPhotos = new Set<string>();

function loadShown(): void {
  try {
    for (const u of JSON.parse(sessionStorage.getItem(PHOTO_KEY) ?? "[]") as string[]) {
      shownPhotos.add(u);
    }
  } catch {
    // 読めなければメモリ上だけで数える
  }
}
let shownLoaded = false;

/**
 * この写真の URL を読んでよいか。一度読んだ URL はそのまま許す（数え直さない）。
 * 新しい URL は、セッションの上限 PHOTO_LIMIT までだけ許す
 */
export function photoAllowed(url: string): boolean {
  if (!shownLoaded) {
    shownLoaded = true;
    loadShown();
  }
  if (shownPhotos.has(url)) return true;
  if (shownPhotos.size >= PHOTO_LIMIT) return false;
  shownPhotos.add(url);
  try {
    sessionStorage.setItem(PHOTO_KEY, JSON.stringify([...shownPhotos]));
  } catch {
    // 保存できなくてもメモリ上で数える
  }
  return true;
}

/* ---------- 一時キャッシュと回数 ---------- */

let memCount = 0;

function readCount(): number {
  try {
    const v = Number(sessionStorage.getItem(COUNT_KEY));
    return Number.isFinite(v) ? Math.max(v, memCount) : memCount;
  } catch {
    return memCount;
  }
}

function bumpCount(): void {
  memCount = readCount() + 1;
  try {
    sessionStorage.setItem(COUNT_KEY, String(memCount));
  } catch {
    // 保存できなくてもメモリ上で数える
  }
}

export function searchesLeft(): number {
  return Math.max(0, SEARCH_LIMIT - readCount());
}

/**
 * キャッシュのキー。ふつうの検索は語だけで決める（地図の範囲が少し違うだけで取り直して課金しないため）。
 * 「このエリアで再検索」のときだけ範囲を含める
 */
function cacheKey(query: string, bounds?: Bounds): string {
  const b = bounds
    ? [bounds.low.latitude, bounds.low.longitude, bounds.high.latitude, bounds.high.longitude]
        .map((v) => v.toFixed(3))
        .join(",")
    : "";
  return `${CACHE_PREFIX}${query}|${b}`;
}

function readCache(key: string): Place[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { t: number; places: Place[] };
    if (Date.now() - v.t > CACHE_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return v.places;
  } catch {
    return null;
  }
}

function writeCache(key: string, places: Place[]): void {
  try {
    // 期限切れを掃除してから入れる
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (!k?.startsWith(CACHE_PREFIX)) continue;
      const v = JSON.parse(sessionStorage.getItem(k) ?? "{}") as { t?: number };
      if (!v.t || Date.now() - v.t > CACHE_MS) sessionStorage.removeItem(k);
    }
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), places }));
  } catch {
    // 容量オーバーなどは無視（次回また取る）
  }
}

/** 飲食の店の種類（Places の primaryType）。これ以外（駅・公園など）は一覧と地図に出さない */
const FOOD_TYPES = new Set([
  "restaurant",
  "food",
  "cafe",
  "coffee_shop",
  "tea_house",
  "cafeteria",
  "bakery",
  "bar",
  "pub",
  "wine_bar",
  "meal_takeaway",
  "meal_delivery",
  "food_court",
  "diner",
  "deli",
  "steak_house",
  "sandwich_shop",
  "bagel_shop",
  "donut_shop",
  "dessert_shop",
  "ice_cream_shop",
  "juice_shop",
  "confectionery",
  "chocolate_shop",
  "candy_store",
]);

/** 飲食の店か。種類が分からないものは残す（外しすぎない） */
export function isFoodPlace(p: Place): boolean {
  const t = p.primaryType;
  if (!t) return true;
  return FOOD_TYPES.has(t) || t.endsWith("_restaurant") || t.endsWith("_bar");
}

export class SearchLimitError extends Error {}

export type SearchResult = { places: Place[]; cached: boolean };

/** 現在地のまわりで探すときの半径（m） */
export const NEAR_RADIUS_M = 800;

export type LatLngLiteral = { lat: number; lng: number };

/**
 * Text Search を1回だけ呼ぶ（ページ送りはしない）。
 * bounds は寄せる範囲（locationBias）。area が true のときだけ、範囲もキャッシュのキーに入れる。
 * textQuery は Google に送る語（例:「高円寺 飲食店」）。キャッシュのキーは query（入力のまま）で作る
 */
export async function searchPlaces(
  query: string,
  bounds?: Bounds,
  opts: { area?: boolean; textQuery?: string; near?: LatLngLiteral } = {},
): Promise<SearchResult> {
  const q = query.trim() || "飲食店";
  // 現在地のまわりは、丸めた座標（小数2桁、約1km）をキーにする。位置そのものは保存しない
  const key = opts.near
    ? `${CACHE_PREFIX}現在地|${opts.near.lat.toFixed(2)},${opts.near.lng.toFixed(2)}|${q}`
    : cacheKey(q, opts.area ? bounds : undefined);
  const hit = readCache(key);
  if (hit) return { places: hit, cached: true };
  if (readCount() >= SEARCH_LIMIT) {
    throw new SearchLimitError(
      `このデモの検索回数の上限（1セッション${SEARCH_LIMIT}回）に達しました。`,
    );
  }
  const { Place } = await importLibrary<PlacesLib>("places");
  bumpCount();
  const req: Record<string, unknown> = {
    textQuery: opts.textQuery?.trim() || q,
    fields: PLACE_FIELDS,
    language: "ja",
    region: "JP",
    maxResultCount: 20,
  };
  if (opts.near) {
    req.locationBias = { center: opts.near, radius: NEAR_RADIUS_M };
  } else if (bounds) {
    req.locationBias = {
      south: bounds.low.latitude,
      west: bounds.low.longitude,
      north: bounds.high.latitude,
      east: bounds.high.longitude,
    };
  }
  const { places } = await Place.searchByText(req);
  // Google が返した並び順を残す（「Google の検索結果では◯番目」と見せるため）。
  // 順番を付けてから飲食でないものを外すので、番号は Google の結果のままになる
  const out = (places ?? [])
    .map((p, i) => ({ ...fromJsPlace(p), googleRank: i + 1 }))
    .filter(isFoodPlace);
  writeCache(key, out);
  return { places: out, cached: false };
}

/* ---------- 経路（Maps JavaScript API の Routes ライブラリ） ---------- */

/**
 * 1セッションの経路の回数の上限（検索とは別に数える）。
 * Route.computeRoutes は Compute Routes Essentials（基本機能だけ。無料枠は月1万回）
 */
export const ROUTE_LIMIT = 30;
const ROUTE_COUNT_KEY = "jibunmap-route-count";
let routeMem = 0;

function readRouteCount(): number {
  try {
    const v = Number(sessionStorage.getItem(ROUTE_COUNT_KEY));
    return Number.isFinite(v) ? Math.max(v, routeMem) : routeMem;
  } catch {
    return routeMem;
  }
}

export class RouteLimitError extends Error {}

export type TravelMode = "WALKING" | "TRANSIT";
export type RouteResult = { path: LatLngLiteral[]; minutes: number | null };

type JsLatLngLike = { lat: number | (() => number); lng: number | (() => number) };
type RoutesLib = {
  Route: {
    computeRoutes(req: Record<string, unknown>): Promise<{
      routes?: { path?: JsLatLngLike[]; durationMillis?: number | null }[];
    }>;
  };
};

const num = (v: number | (() => number)) => (typeof v === "function" ? v() : v);

/**
 * 現在地から店までの経路を1回だけ取る。fields は線（path）と所要時間（durationMillis）だけ。
 * 経路がなければ null。回数の上限を超えたら RouteLimitError
 */
export async function computeRoute(
  origin: LatLngLiteral,
  destination: LatLngLiteral,
  mode: TravelMode,
): Promise<RouteResult | null> {
  if (readRouteCount() >= ROUTE_LIMIT) {
    throw new RouteLimitError(`経路の上限（1セッション${ROUTE_LIMIT}回）に達しました。`);
  }
  const { Route } = await importLibrary<RoutesLib>("routes");
  routeMem = readRouteCount() + 1;
  try {
    sessionStorage.setItem(ROUTE_COUNT_KEY, String(routeMem));
  } catch {
    // 保存できなくてもメモリ上で数える
  }
  const { routes } = await Route.computeRoutes({
    origin,
    destination,
    travelMode: mode,
    fields: ["path", "durationMillis"],
  });
  const r = routes?.[0];
  if (!r?.path?.length) return null;
  return {
    path: r.path.map((p) => ({ lat: num(p.lat), lng: num(p.lng) })),
    minutes:
      typeof r.durationMillis === "number"
        ? Math.max(1, Math.round(r.durationMillis / 60000))
        : null,
  };
}

export function boundsOf(b: GLatLngBounds): Bounds {
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return {
    low: { latitude: sw.lat(), longitude: sw.lng() },
    high: { latitude: ne.lat(), longitude: ne.lng() },
  };
}
