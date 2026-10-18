// URL（?q=&place=&genre=&scene=&view=）から、戻る・進むで戻すべき画面の状態を読む。
// このファイルは何も import しない（node の型除去だけで検証スクリプトから読むため）。

export type UrlState = {
  q: string;
  place: string | null;
  genre: string | null;
  scene: "solo" | "friends";
  view: "list" | "map" | null;
};

export function readUrlState(search: string): UrlState {
  const sp = new URLSearchParams(search);
  const v = sp.get("view");
  return {
    q: sp.get("q")?.trim() ?? "",
    place: sp.get("place"),
    genre: sp.get("genre"),
    scene: sp.get("scene") === "friends" ? "friends" : "solo",
    view: v === "list" || v === "map" ? v : null,
  };
}

/**
 * popstate のときにすること。
 * - URL の検索語が今の検索語と違う → その語で結果を戻す（キャッシュがあれば費用なし）
 * - 同じ → 結果はそのまま、詳細（place）だけ開け閉めする
 * 検索語のない URL（現在地のまわりの検索など）では、検索し直さない（位置がないため）
 */
export function popAction(
  search: string,
  currentQ: string,
): { kind: "search"; state: UrlState } | { kind: "place"; state: UrlState } {
  const state = readUrlState(search);
  if (state.q && state.q !== currentQ.trim()) return { kind: "search", state };
  return { kind: "place", state };
}
