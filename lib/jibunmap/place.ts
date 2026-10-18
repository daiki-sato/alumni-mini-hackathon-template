// Places API (New) の Place のうち、このアプリが使う項目だけの型（REST 版の形）。
// ブラウザの Place クラスで取った値も lib/jibunmap/google.ts でこの形に直す。
// フィールド名は https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places に合わせる。

export type LocalizedText = { text: string; languageCode?: string };
export type LatLng = { latitude: number; longitude: number };

export type Review = {
  name?: string;
  relativePublishTimeDescription?: string;
  text?: LocalizedText;
  originalText?: LocalizedText;
  rating?: number;
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  /** RFC 3339 */
  publishTime?: string;
  googleMapsUri?: string;
};

export type Money = { currencyCode?: string; units?: string; nanos?: number };

/**
 * 写真。JS 版の Photo.getURI() で作った URL を持つ（このアプリ独自の形。REST の photos とは違う）。
 * 画像を1枚読むごとに Place Details Photos の課金が発生するので、出す場所は限る
 */
export type PlacePhoto = {
  /** サムネイル用（最大 160px） */
  thumb: string;
  /** 写真の一覧（グリッド）とモザイクの小さい枠（最大 400px） */
  mid: string;
  /** モザイクの大きい枠（最大 800px） */
  large: string;
  /** 拡大ギャラリー用（最大 1200px。開いた写真だけ読む） */
  full: string;
  widthPx?: number;
  heightPx?: number;
  /** 写真の帰属表示（規約で必要） */
  authorAttributions: { displayName: string; uri?: string }[];
};

/** 営業時間の1区切り（day は 0=日曜。REST の Period と同じ形） */
export type OpeningPeriod = {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
};

export type PriceLevel =
  | "PRICE_LEVEL_UNSPECIFIED"
  | "PRICE_LEVEL_FREE"
  | "PRICE_LEVEL_INEXPENSIVE"
  | "PRICE_LEVEL_MODERATE"
  | "PRICE_LEVEL_EXPENSIVE"
  | "PRICE_LEVEL_VERY_EXPENSIVE";

export type Place = {
  id: string;
  displayName?: LocalizedText;
  formattedAddress?: string;
  location?: LatLng;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: PriceLevel;
  primaryType?: string;
  primaryTypeDisplayName?: LocalizedText;
  googleMapsUri?: string;
  reservable?: boolean;
  goodForGroups?: boolean;
  paymentOptions?: {
    acceptsCreditCards?: boolean;
    acceptsDebitCards?: boolean;
    acceptsCashOnly?: boolean;
    acceptsNfc?: boolean;
  };
  dineIn?: boolean;
  takeout?: boolean;
  reviews?: Review[];
  editorialSummary?: LocalizedText;
  currentOpeningHours?: { openNow?: boolean };
  photos?: PlacePhoto[];
  regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: OpeningPeriod[] };
  priceRange?: { startPrice?: Money; endPrice?: Money };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  /** Google の検索結果での順番（1から）。Google から取ったときだけ。デモのデータにはない */
  googleRank?: number;
};

export type Bounds = { low: LatLng; high: LatLng };

/** 検索欄に入れられる文字数（長すぎる検索を送らない） */
export const MAX_QUERY_LENGTH = 100;

export function placeName(p: Place): string {
  return p.displayName?.text ?? "（名前なし）";
}
