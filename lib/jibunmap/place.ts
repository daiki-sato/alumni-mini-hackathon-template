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
};

export type Bounds = { low: LatLng; high: LatLng };

/** 検索欄に入れられる文字数（長すぎる検索を送らない） */
export const MAX_QUERY_LENGTH = 100;

export function placeName(p: Place): string {
  return p.displayName?.text ?? "（名前なし）";
}
