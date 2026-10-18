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

export type BootPlan = {
  /** 審査員向けの固定デモ（?demo=1） */
  forcedDemo: boolean;
  /** URL から読んだ状態（scene・genre・view はデモでも実データでも同じに戻す） */
  state: UrlState;
  /** 開いた直後に探す語（探さないなら null） */
  query: string | null;
  /** 結果の中にあれば詳細を開く店（なければ開かず、URL から静かに外す） */
  select: string | null;
};

/**
 * 開いたときの URL から、最初に何をするかを決める（デモでも実データでも同じ道を通す）。
 * - 固定デモ: 語がデモの街に当たればその語、当たらなければ最初のサンプルの街
 * - キーのないデモ: 語がデモに当たらなければ探さない（最初のサンプルの街のまま）
 * - 実データ: 語があれば探す
 * どの場合も place は select として渡し、探した結果の中にあるときだけ詳細を開く
 */
export function bootPlan(
  search: string,
  opts: {
    demo: boolean;
    demoHas: (q: string) => boolean;
    fallbackTown: string;
    maxLength: number;
  },
): BootPlan {
  const state = readUrlState(search);
  const forcedDemo = new URLSearchParams(search).get("demo") === "1";
  let query: string | null = state.q.slice(0, opts.maxLength) || null;
  if (forcedDemo) query = query && opts.demoHas(query) ? query : opts.fallbackTown;
  else if (opts.demo && query && !opts.demoHas(query)) query = null;
  return { forcedDemo, state, query, select: query ? state.place : null };
}
