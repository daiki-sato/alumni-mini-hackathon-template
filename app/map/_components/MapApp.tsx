"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { preconnect } from "react-dom";
import { Logo } from "@/app/_components/Logo";
import {
  DEMO_NOW,
  DEMO_PLACES,
  DEMO_TOWNS,
  demoSearch,
  demoSearchBounds,
  forcedDemo,
} from "@/lib/jibunmap/demo";
import { genreByKey, genreChips, genreOf, MAIN_GENRE_KEYS, townPart } from "@/lib/jibunmap/genre";
import {
  BROWSER_KEY,
  computeRoute,
  importLibrary,
  type LatLngLiteral,
  RouteLimitError,
  SEARCH_LIMIT,
  SearchLimitError,
  searchesLeft,
  searchPlaces,
  type TravelMode,
} from "@/lib/jibunmap/google";
import type { Bounds, Place } from "@/lib/jibunmap/place";
import { MAX_QUERY_LENGTH, placeName } from "@/lib/jibunmap/place";
import {
  rankByScore,
  type Scene,
  type Scored,
  scorePlaceInScene,
  wordHits,
  wordsForScene,
} from "@/lib/jibunmap/score";
import { foodQuery, nearbyQueries } from "@/lib/jibunmap/suggest";
import { bootPlan, popAction } from "@/lib/jibunmap/url-state";
import { visibleTimeout } from "@/lib/jibunmap/visible-timer";
import { DemoMapView } from "./DemoMapView";
import { DetailPanel } from "./DetailPanel";
import { GoogleMapView } from "./GoogleMapView";
import { InfoIcon, ListIcon, MapIcon, MyLocationIcon, SearchIcon, TuneIcon } from "./Icons";
import { InstallHint } from "./InstallHint";
import { ListPanel, PeekCard } from "./ListPanel";
import { Onboarding, onboardingDone } from "./Onboarding";
import { MinScoreSlider, PrefsSheet } from "./PrefsSheet";
import { SearchBox } from "./SearchBox";
import { DEFAULT_PREFS, usePrefs } from "./usePrefs";

// キーはビルド時に埋め込まれる。サーバーとブラウザで同じ値なので、最初の描画がずれない
const HAS_KEY = !!BROWSER_KEY;
const FIRST_DEMO_TOWN = DEMO_TOWNS[0].name;
/**
 * URL（?q=検索語&place=店の id&view=list|map）。検索語・選んだ店・スマホの表示を、
 * 共有・再読み込み・戻るボタンのために載せる（位置などの個人の情報は載せない）
 */
function urlFor(
  q: string,
  place: string | null,
  extra: Record<string, string | undefined> = {},
): string {
  const sp = new URLSearchParams();
  if (q.trim()) sp.set("q", q.trim());
  if (place) sp.set("place", place);
  for (const [k, v] of Object.entries(extra)) if (v) sp.set(k, v);
  const s = sp.toString();
  return `${window.location.pathname}${s ? `?${s}` : ""}`;
}

/** 検索がこれ以上かかったら、Google に届いていないとみなしてデモに切り替える */
const SEARCH_TIMEOUT_MS = 12_000;

type View = "list" | "map";
type MyPos = { lat: number; lng: number; acc: number };

const MOBILE_QUERY = "(max-width: 767px)";
/** 点数の説明の吹き出しを閉じたかの記録 */
const TIP_KEY = "jibunmap-tip-score";

/** スマホの幅か（サーバーと最初の描画では false。hydration のずれを防ぐ） */
function useIsMobile(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(MOBILE_QUERY);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

type Status = { kind: "idle" | "loading" | "ok" } | { kind: "error"; message: string };

class TimeoutError extends Error {}

/**
 * ms までに p が終わらなければ TimeoutError。ページが見えているあいだだけ数える
 * （裏のタブではブラウザが通信を絞るので、そのあいだに止まっていても失敗にしない）
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let cancel = () => {};
  const t = new Promise<never>((_, reject) => {
    cancel = visibleTimeout(ms, () => reject(new TimeoutError(`${ms}ms で応答がありません`)));
  });
  return Promise.race([p, t]).finally(() => cancel());
}

export function MapApp() {
  // Maps の読み込み先へ早めに接続しておく（head に preconnect を差し込む）
  if (HAS_KEY) {
    preconnect("https://maps.googleapis.com");
    preconnect("https://maps.gstatic.com", { crossOrigin: "anonymous" });
  }
  const { prefs, update } = usePrefs();
  // キーがあっても、Google に届かなければデモに切り替える（fellBack）
  const [demo, setDemoState] = useState(!HAS_KEY);
  const [fellBack, setFellBack] = useState(false);
  /** 今日の地図（Dynamic Maps）の上限に達したので、簡易地図を出している */
  const [mapLimited, setMapLimited] = useState(false);
  const onMapLimit = useCallback(() => {
    console.info("[ジブンマップ] 今日の地図の表示上限に達したので、簡易地図にします");
    setMapLimited(true);
  }, []);
  /** タイムアウトで切り替わったので、自動の再試行を待っている */
  const [autoRetry, setAutoRetry] = useState(false);
  /** 自動の再試行はページを開いているあいだに1回だけ */
  const autoRetried = useRef(false);
  /** 固定デモ（?demo=1）で開いている */
  const [pinnedDemo, setPinnedDemo] = useState(false);
  const demoRef = useRef(!HAS_KEY);
  const setDemo = useCallback((v: boolean) => {
    demoRef.current = v;
    setDemoState(v);
  }, []);
  const [query, setQuery] = useState(HAS_KEY ? "" : FIRST_DEMO_TOWN);
  const [title, setTitle] = useState<string | null>(HAS_KEY ? null : FIRST_DEMO_TOWN);
  const [places, setPlaces] = useState<Place[]>(() => (HAS_KEY ? [] : demoSearch(FIRST_DEMO_TOWN)));
  const [now, setNow] = useState(DEMO_NOW);
  const [status, setStatus] = useState<Status>({ kind: HAS_KEY ? "idle" : "ok" });
  /** 圏外か（navigator.onLine と online/offline のイベント） */
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  /** 実データで検索を1回終えたか（ホーム画面に追加の案内は、そのあとに出す） */
  const [searchedOnce, setSearchedOnce] = useState(false);
  /** 検索中に来た次の検索の語（前の検索が終わったら自動で探す。表示にも使う） */
  const [busy, setBusy] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [moved, setMoved] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  /** 上の帯の「◯点以上」から開く、最低点のスライダー */
  const [minOpen, setMinOpen] = useState(false);
  /** 点数の説明の吹き出し（初回だけ。閉じたら二度と出さない） */
  const [scoreTip, setScoreTip] = useState(false);
  useEffect(() => {
    try {
      setScoreTip(localStorage.getItem(TIP_KEY) !== "1");
    } catch {
      setScoreTip(false);
    }
  }, []);
  const closeScoreTip = useCallback(() => {
    setScoreTip(false);
    try {
      localStorage.setItem(TIP_KEY, "1");
    } catch {
      // 保存できなくても、このページでは閉じたままにする
    }
  }, []);
  /** 初めて使う人だけに出す、3ステップの設定 */
  const [onboardOpen, setOnboardOpen] = useState(false);
  useEffect(() => {
    // 固定デモでは出さない（すぐに触れるように）
    if (!onboardingDone() && !forcedDemo()) setOnboardOpen(true);
  }, []);
  /** 「並びが変わりました」などの短い知らせ */
  const [toast, setToast] = useState<string | null>(null);
  /** 現在地。state にだけ持つ（localStorage・URL・ログには残さない） */
  const [me, setMe] = useState<MyPos | null>(null);
  /** 現在地を取り直したら地図をそこへ動かすための番号 */
  const [meKey, setMeKey] = useState(0);
  /** アプリ内に描いている経路（1本だけ。別の店を選んだら消す） */
  const [route, setRoute] = useState<{
    placeId: string;
    name: string;
    mode: TravelMode;
    path: LatLngLiteral[];
    minutes: number | null;
  } | null>(null);
  const [routeState, setRouteState] = useState<{
    placeId: string;
    mode: TravelMode;
    status: "loading" | "error";
    message?: string;
  } | null>(null);
  /** マイ条件を開いたときの並び（閉じたときに変わったかを見る） */
  const rankAtOpen = useRef<string>("");
  // ひとりで／友だちと。保存はしない（毎回「ひとりで」から）。URL の ?scene=friends には載せる
  const [scene, setSceneState] = useState<Scene>("solo");
  // スマホ（768px 未満）は地図とリストを全画面で切り替える。検索前は地図、検索後はリスト
  const [view, setViewState] = useState<View>("map");
  const viewRef = useRef<View>("map");
  /** 起動時の URL にあった view（最初の検索の結果を出すときに1回だけ使う） */
  const bootView = useRef<View | null>(null);
  /** スマホの地図全画面で、ピンを押して下に出している店 */
  const [peekId, setPeekId] = useState<string | null>(null);
  const mobile = useIsMobile();
  const boundsRef = useRef<Bounds | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searching = useRef(false);
  /** 戻る/進むで結果を戻している途中 */
  const popRestoring = useRef(false);
  type RunOpts = {
    bounds?: Bounds;
    fit: boolean;
    select?: string;
    /** 現在地のまわりで探す（位置は state にだけ持ち、URL や保存には残さない） */
    near?: LatLngLiteral;
    /**
     * 履歴の積み方。ふつうの検索は push（戻るで前の検索に戻れる）。起動時・戻る/進む・再試行・
     * エリアの再検索は replace（履歴を増やさない。戻る/進むで履歴が増え続けないように）
     */
    history?: "push" | "replace";
  };
  /** 検索中に来た、いちばん新しい検索（古い保留は上書きして捨てる） */
  const pending = useRef<{ q: string; opts: RunOpts } | null>(null);
  const runRef = useRef<(q: string, opts: RunOpts) => void>(() => {});
  /** いちばん新しい検索の番号。古い検索の結果やエラーは捨てる */
  const seq = useRef(0);
  /** 最後に Google で探した語（「もう一度試す」用） */
  const lastLive = useRef<{ q: string; select?: string; near?: LatLngLiteral } | null>(null);
  /** URL に載せる検索語（デモに切り替わっても、入力した語のまま） */
  const urlQ = useRef("");
  /** 詳細を開くとき履歴を1つ積んだか（積んだなら、閉じるときは history.back() で戻る） */
  const placePushed = useRef(false);
  /** 詳細を開く前にいたカード（閉じたらここにフォーカスを戻す） */
  const fromCard = useRef<string | null>(null);
  const selRef = useRef<string | null>(null);
  selRef.current = selId;
  const placesRef = useRef(places);
  placesRef.current = places;
  /** URL に一緒に載せる値（表示モード・シーン）。コールバックの依存にしないよう ref で持つ */
  const urlExtra = useRef<Record<string, string | undefined>>({ view: "map" });
  const setScene = useCallback((v: Scene) => {
    urlExtra.current = { ...urlExtra.current, scene: v === "friends" ? "friends" : undefined };
    setSceneState(v);
  }, []);
  const setView = useCallback((v: View) => {
    viewRef.current = v;
    urlExtra.current = { ...urlExtra.current, view: v };
    setViewState(v);
  }, []);

  const allWords = useMemo(() => ({ good: prefs.good, ng: prefs.ng }), [prefs.good, prefs.ng]);
  // 印を付けるのは、いまのシーンで数えている語だけ（友だちとでは「一人」などに色を付けない）
  const words = useMemo(
    () => wordsForScene(allWords, prefs.soloOnly, scene),
    [allWords, prefs.soloOnly, scene],
  );
  const scored = useMemo(
    () => places.map((p) => scorePlaceInScene(p, now, allWords, prefs.soloOnly, scene)),
    [places, now, allWords, prefs.soloOnly, scene],
  );
  // 点数の高い順（同点は Google の検索結果の順）
  const ranked = useMemo(() => rankByScore(scored), [scored]);
  /** 最低点で隠したものを、一時的に全部出す（新しい検索で戻す） */
  const [showAll, setShowAll] = useState(false);
  // ジャンルの絞り込み（1つだけ）。URL の &genre= に載せ、保存はしない
  const [genre, setGenreState] = useState<string | null>(null);
  /** 起動時の URL の genre を、最初の検索で消さないための印 */
  const keepGenreOnce = useRef(false);
  const setGenre = useCallback((g: string | null) => {
    urlExtra.current = { ...urlExtra.current, genre: g ?? undefined };
    setGenreState(g);
  }, []);
  // 点数の高い順なので、隠れるのは末尾だけ（順位の番号はずれない）。一覧と地図に同じ絞り込みを当てる
  // ジャンルのチップ: いまの結果に含まれるジャンルだけ。押すと手元で絞り込む（API は呼ばない）
  const chips = useMemo(() => genreChips(places), [places]);
  const inGenre = useMemo(
    () => (genre ? ranked.filter((s) => genreOf(s.place).key === genre) : ranked),
    [ranked, genre],
  );
  const visible = useMemo(
    () => (showAll ? inGenre : inGenre.filter((s) => s.score >= prefs.minScore)),
    [inGenre, showAll, prefs.minScore],
  );
  // 並び順: あなたの順（点数）／Google の順（googleRank の昇順に並べ替えるだけ。再検索しない）
  const [order, setOrder] = useState<"mine" | "google">("mine");
  const hasGoogleRank = places.some((p) => p.googleRank);
  const shown = useMemo(() => {
    if (order !== "google" || !hasGoogleRank) return visible;
    const g = (s: Scored) => s.place.googleRank ?? Number.POSITIVE_INFINITY;
    return visible.slice().sort((a, b) => g(a) - g(b));
  }, [visible, order, hasGoogleRank]);
  const myRanks = useMemo(
    () =>
      order === "google" && hasGoogleRank
        ? new Map(visible.map((s, i) => [s.place.id, i + 1]))
        : null,
    [visible, order, hasGoogleRank],
  );
  // 番号は、いま出している並びの順位（一覧と地図のピンでそろえる）
  const rankIds = useMemo(() => shown.map((s) => s.place.id), [shown]);
  const genreLabel = genre
    ? (chips.find((c) => c.key === genre)?.label ?? genreByKey(genre)?.label ?? null)
    : null;
  const selected: Scored | undefined = scored.find((s) => s.place.id === selId);

  // 一覧と詳細を切り替えたら、パネルを上まで戻す
  // biome-ignore lint/correctness/useExhaustiveDependencies: 選んだ店が変わったときだけ
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [selId]);

  /**
   * 地図と一覧の見た目の状態を初期に戻す（デモへの切り替え・再試行のとき）。
   * 地図は作り直されるので、前の地図の表示範囲を locationBias に使わないよう boundsRef も消す
   */
  const resetView = useCallback(() => {
    boundsRef.current = null;
    setSelId(null);
    setHoverId(null);
    setMoved(false);
  }, []);

  /** Google に届かないとき: デモの店と SVG の地図に切り替える。詳しい理由は console にだけ出す */
  const fallBack = useCallback(
    (why: string, detail?: unknown, kind?: "timeout") => {
      if (demoRef.current) return;
      // タイムアウトのときは、ページが見えている状態で1回だけ自動で実データに戻してみる
      if (kind === "timeout" && !autoRetried.current) setAutoRetry(true);
      console.warn(
        `[ジブンマップ] Google に接続できないため、デモデータに切り替えます（${why}）`,
        detail ?? "",
      );
      seq.current++;
      searching.current = false;
      // 保留していた検索も Google に聞くものなので、デモに切り替えたら捨てる
      pending.current = null;
      setBusy(null);
      setDemo(true);
      setFellBack(true);
      resetView();
      // URL の検索語は入力した語のまま残す（「もう一度試す」や再読み込みで Google に聞き直せるように）
      placePushed.current = false;
      fromCard.current = null;
      window.history.replaceState(null, "", urlFor(urlQ.current, null, urlExtra.current));
      const q = lastLive.current?.q.trim() ?? "";
      const hits = q ? demoSearch(q) : [];
      const label = hits.length ? q : FIRST_DEMO_TOWN;
      setQuery(label);
      setTitle(label);
      setPlaces(hits.length ? hits : demoSearch(FIRST_DEMO_TOWN));
      setNow(DEMO_NOW);
      setStatus({ kind: "ok" });
      setFitKey((k) => k + 1);
    },
    [setDemo, resetView],
  );

  // Maps JS は、ページを開いた直後（検索の前）に読み始める。スクリプトとライブラリを読むだけでは
  // 数えられない（Dynamic Maps は地図を作ったとき＝new Map のたびに1回数えられ、ここでは作らない）。
  // 失敗の扱いは地図と検索の側に任せる
  useEffect(() => {
    if (!HAS_KEY || forcedDemo()) return;
    importLibrary("places").catch(() => {});
  }, []);

  // キーの拒否（HTTP リファラ制限・キーの誤り）は、Maps の読み込み後にこの関数で知らされる
  useEffect(() => {
    if (!HAS_KEY) return;
    const w = window as unknown as { gm_authFailure?: () => void };
    w.gm_authFailure = () =>
      fallBack("gm_authFailure: キーが拒否された（HTTP リファラ制限・キーの誤り）");
    return () => {
      w.gm_authFailure = undefined;
    };
  }, [fallBack]);

  const run = useCallback(
    async (q: string, opts: RunOpts) => {
      if (searching.current) {
        pending.current = { q, opts };
        setBusy(q.trim() || "このエリア");
        return;
      }
      setBusy(null);
      const label = opts.near ? `現在地の近く（${q}）` : q.trim() || "このエリア";
      setSelId(null);
      setMoved(false);
      setShowAll(false);
      setRoute(null);
      setRouteState(null);
      // 新しい検索ではジャンルの絞り込みを外す（起動時の URL のものと、エリアの再検索は残す）
      if (keepGenreOnce.current) keepGenreOnce.current = false;
      else if (!opts.bounds) setGenre(null);
      fromCard.current = null;
      placePushed.current = false;
      // 現在地のまわりの検索は URL に語を載せない（再読み込みで、位置なしの検索にならないように）
      if (!opts.bounds) urlQ.current = opts.near ? "" : q;
      // 戻る/進むで結果を戻している途中か（1回の検索で使い切る）
      const restoring = popRestoring.current;
      popRestoring.current = false;
      const found0 = (found: Place[]) => {
        const sel = opts.select && found.some((p) => p.id === opts.select) ? opts.select : null;
        // 検索したらリストを出す（エリアの再検索は地図のまま）。起動時の URL に view があればそれ
        if (!opts.bounds) setView(bootView.current ?? "list");
        bootView.current = null;
        setPeekId(null);
        const url = urlFor(urlQ.current, sel, urlExtra.current);
        if (opts.history === "replace" || opts.bounds) window.history.replaceState(null, "", url);
        else window.history.pushState(null, "", url);
        // 戻る/進むで詳細つきの URL に戻ったときは、閉じるときも戻るで戻れるようにする
        placePushed.current = restoring && !!sel;
        if (sel) setSelId(sel);
      };
      if (demoRef.current) {
        const found = opts.bounds ? demoSearchBounds(opts.bounds) : demoSearch(q);
        setPlaces(found);
        setNow(DEMO_NOW);
        setTitle(label);
        setStatus(
          found.length
            ? { kind: "ok" }
            : { kind: "error", message: `「${label}」に当たる店はデモデータにありません。` },
        );
        if (opts.fit) setFitKey((k) => k + 1);
        found0(found);
        return;
      }
      const my = ++seq.current;
      if (!opts.bounds) lastLive.current = { q, select: opts.select, near: opts.near };
      searching.current = true;
      setStatus({ kind: "loading" });
      setTitle(label);
      try {
        // 地図が出ているときは、表示中の範囲に寄せる（絞り込みではない）
        const { places: found } = await withTimeout(
          searchPlaces(q, opts.bounds ?? boundsRef.current ?? undefined, {
            area: !!opts.bounds,
            textQuery: foodQuery(q || "飲食店"),
            near: opts.near,
          }),
          SEARCH_TIMEOUT_MS,
        );
        if (my !== seq.current) return;
        setSearchedOnce(true);
        setPlaces(found);
        setNow(Date.now());
        setStatus(
          found.length
            ? { kind: "ok" }
            : { kind: "error", message: `「${label}」で店が見つかりませんでした。` },
        );
        if (opts.fit) setFitKey((k) => k + 1);
        found0(found);
      } catch (e) {
        if (my !== seq.current) return;
        if (e instanceof SearchLimitError) {
          // 古いピンを地図に残さない
          setPlaces([]);
          setStatus({ kind: "error", message: e.message });
        } else {
          fallBack(
            e instanceof TimeoutError
              ? `検索が ${SEARCH_TIMEOUT_MS / 1000} 秒で返らない`
              : "Place.searchByText が失敗（Places API (New) の有効化・リファラ制限を確認）",
            e,
            e instanceof TimeoutError ? "timeout" : undefined,
          );
        }
      } finally {
        // 通信が返らなくても、次の検索ができなくならないように必ず解放する。
        // ただし新しい検索がもう始まっていたら、そちらの印は消さない
        if (my === seq.current) {
          searching.current = false;
          setBusy(null);
          const next = pending.current;
          pending.current = null;
          if (next) runRef.current(next.q, next.opts);
        }
      }
    },
    [fallBack, setView, setGenre],
  );
  runRef.current = run;

  // /map?q=... で開いたら、その語で1回だけ探す（&place= があれば、結果の中にあれば詳細を開く）。
  // StrictMode で effect が2回走っても二重に検索しないよう、ref で実行済みを覚える
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    // URL から最初にすることを決める（デモでも実データでも同じ道。place・scene・genre・view を保つ）
    const plan = bootPlan(window.location.search, {
      demo: demoRef.current,
      demoHas: (q) => demoSearch(q).length > 0,
      fallbackTown: FIRST_DEMO_TOWN,
      maxLength: MAX_QUERY_LENGTH,
    });
    // 審査員向けの固定デモ: 通信も API も使わず、デモの街を決まった語で開く
    if (plan.forcedDemo) {
      setDemo(true);
      setPinnedDemo(true);
      urlExtra.current = { ...urlExtra.current, demo: "1" };
    }
    const st = plan.state;
    if (st.view) bootView.current = st.view;
    if (st.scene === "friends") setScene("friends");
    if (st.genre) {
      setGenre(st.genre);
      keepGenreOnce.current = true;
    }
    const q = plan.query;
    if (!q) return;
    // 今日の検索の上限に達していたら、開いただけでは探さない（自分で検索ボタンを押せば、上限の案内が出る）
    if (!demoRef.current && searchesLeft() <= 0) {
      setQuery(q);
      setTitle(q);
      setStatus({
        kind: "error",
        message: `今日の検索の上限（1日${SEARCH_LIMIT}回）に達したため、自動では探しませんでした。明日また使えます。`,
      });
      return;
    }
    setQuery(q);
    // place は、探した結果の中にあれば詳細を開き、なければ開かずに URL から外す（found0）
    run(q, { fit: true, select: plan.select ?? undefined, history: "replace" });
  }, [run, setScene, setGenre, setDemo]);

  /** デモから Google に戻してもう一度探す */
  const retry = useCallback(() => {
    setDemo(false);
    setFellBack(false);
    resetView();
    setPlaces([]);
    setTitle(null);
    setStatus({ kind: "idle" });
    const last = lastLive.current;
    if (last?.q.trim()) {
      setQuery(last.near ? "" : last.q);
      run(last.q, { fit: true, select: last.select, near: last.near, history: "replace" });
    } else {
      setQuery("");
    }
  }, [run, setDemo, resetView]);

  // タイムアウトでデモに切り替えたあと: ページが見えていれば（隠れていれば見えたときに）1回だけ自動で再試行する。
  // 2回目以降は「もう一度試す」ボタンで
  useEffect(() => {
    if (!autoRetry) return;
    const go = () => {
      if (document.hidden) return;
      autoRetried.current = true;
      setAutoRetry(false);
      console.info("[ジブンマップ] タイムアウトのあとなので、1回だけ自動で実データを読み直します");
      retry();
    };
    document.addEventListener("visibilitychange", go);
    go();
    return () => document.removeEventListener("visibilitychange", go);
  }, [autoRetry, retry]);

  /** 現在地を取る。ボタンや「現在地の近くで」を押したときに初めて呼ぶ（開いただけでは許可を求めない） */
  const locate = useCallback((): Promise<MyPos | null> => {
    return new Promise((resolve) => {
      const fail = () => {
        setToast("現在地を取得できませんでした");
        resolve(null);
      };
      if (!("geolocation" in navigator)) return fail();
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
          setMe(pos);
          setMeKey((k) => k + 1);
          resolve(pos);
        },
        fail,
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
      );
    });
  }, []);

  /**
   * 現在地から選んだ店までの経路をアプリの地図に描く（1回押す = 1リクエスト）。
   * スマホでは地図に切り替えて、下に所要時間のバーを出す
   */
  const onRoute = useCallback(
    async (mode: TravelMode) => {
      const s = scored.find((x) => x.place.id === selRef.current);
      const loc = s?.place.location;
      if (!s || !loc) return;
      // 計算中は二重に走らせない（ボタンも無効にしているが、連打や別の経路からの呼び出しに備える）
      if (routeBusy.current) return;
      routeBusy.current = true;
      const placeId = s.place.id;
      setRouteState({ placeId, mode, status: "loading" });
      try {
        const pos = await locate();
        if (!pos) {
          setRouteState({ placeId, mode, status: "error" });
          return;
        }
        try {
          const r = await computeRoute(
            { lat: pos.lat, lng: pos.lng },
            { lat: loc.latitude, lng: loc.longitude },
            mode,
          );
          if (selRef.current !== placeId) return;
          if (!r) {
            setRouteState({ placeId, mode, status: "error" });
            return;
          }
          setRoute({ placeId, name: placeName(s.place), mode, ...r });
          setRouteState(null);
          if (mobile) {
            setView("map");
            onBackRef.current();
          }
        } catch (e) {
          console.warn(
            "[ジブンマップ] 経路を取得できませんでした（Routes API の有効化・キーの制限を確認）",
            e,
          );
          setRouteState({
            placeId,
            mode,
            status: "error",
            message: e instanceof RouteLimitError ? e.message : undefined,
          });
        }
      } finally {
        routeBusy.current = false;
      }
    },
    [scored, locate, mobile, setView],
  );
  const onBackRef = useRef<() => void>(() => {});
  /** 経路を計算中か（二重に走らせない） */
  const routeBusy = useRef(false);

  /** 現在地のまわりで探す。距離は点数にも画面にも使わない（「家の近さは関係ない」方針） */
  const onNear = useCallback(
    async (genre: string) => {
      const pos = await locate();
      if (!pos) return;
      setQuery("");
      run(genre, { fit: true, near: { lat: pos.lat, lng: pos.lng } });
    },
    [locate, run],
  );

  const onSearch = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      run(q, { fit: true });
    },
    [run],
  );

  const onPickPlace = useCallback(
    (id: string, name: string) => {
      // デモの店を候補から選んだとき: その店がいる街ごと出して、詳細を開く
      const p = DEMO_PLACES.find((x) => x.id === id);
      const town = p ? DEMO_TOWNS.find((t) => id.startsWith(`demo-${t.id}-`)) : undefined;
      setQuery(town?.name ?? name);
      run(town?.name ?? name, { fit: true, select: id });
    },
    [run],
  );

  /** 店を選ぶ。一覧から開くときは履歴を1つ積む（ブラウザの戻るで一覧に戻れるように） */
  const onSelect = useCallback((id: string) => {
    // 別の店を選んだら、前の経路は消す
    setRoute((r) => (r && r.placeId !== id ? null : r));
    setRouteState(null);
    if (selRef.current === id) return;
    if (selRef.current) {
      window.history.replaceState(null, "", urlFor(urlQ.current, id, urlExtra.current));
    } else {
      window.history.pushState(null, "", urlFor(urlQ.current, id, urlExtra.current));
      placePushed.current = true;
      fromCard.current = id;
    }
    setSelId(id);
  }, []);

  /** 詳細を閉じる。積んだ履歴があればそれを戻る（popstate で閉じる） */
  const onBack = useCallback(() => {
    if (!selRef.current) return;
    if (placePushed.current) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, "", urlFor(urlQ.current, null, urlExtra.current));
    setSelId(null);
  }, []);
  onBackRef.current = onBack;

  // ブラウザの戻る・進む: URL の place に合わせて詳細を開け閉めする（ここでは履歴を積まない）
  useEffect(() => {
    const onPop = () => {
      const act = popAction(window.location.search, urlQ.current);
      const st = act.state;
      setScene(st.scene);
      if (st.view) setView(st.view);
      if (act.kind === "search") {
        // URL の検索語が今の結果と違う: その語で結果を戻す。キャッシュ（10分）にあれば費用なし、
        // なければ検索し直す（1日の上限に数える）。履歴は増やさない
        setGenre(st.genre);
        keepGenreOnce.current = true;
        popRestoring.current = true;
        setQuery(st.q);
        runRef.current(st.q, { fit: true, select: st.place ?? undefined, history: "replace" });
        return;
      }
      setGenre(st.genre);
      const place = st.place;
      if (place && placesRef.current.some((p) => p.id === place)) {
        placePushed.current = true;
        setSelId(place);
      } else {
        placePushed.current = false;
        setSelId(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setScene, setView, setGenre]);

  // Escape で一覧に戻る（検索欄などで打っているときは除く）
  useEffect(() => {
    if (!selId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select")) return;
      onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selId, onBack]);

  // 詳細を閉じたら、開く前のカードにフォーカスを戻す
  const prevSel = useRef<string | null>(null);
  useEffect(() => {
    const was = prevSel.current;
    prevSel.current = selId;
    if (selId || !was) return;
    const id = fromCard.current ?? was;
    fromCard.current = null;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-place-card="${CSS.escape(id)}"]`)?.focus();
    });
  }, [selId]);
  const onReset = useCallback(() => update(() => DEFAULT_PREFS), [update]);
  const onUserMove = useCallback(() => setMoved(true), []);

  const searchArea = () => {
    if (!boundsRef.current) return;
    run(query.trim() || "飲食店", { bounds: boundsRef.current, fit: false });
  };

  const rank = selected ? rankIds.indexOf(selected.place.id) + 1 : 0;

  /** スマホ: 地図とリストを切り替える。地図に戻したら、隠れていた間の大きさで範囲を合わせ直す */
  const toggleView = () => {
    const next: View = viewRef.current === "list" ? "map" : "list";
    setView(next);
    setPeekId(null);
    window.history.replaceState(null, "", urlFor(urlQ.current, selRef.current, urlExtra.current));
    if (next === "map") setFitKey((k) => k + 1);
  };

  /** ピンを押したとき。スマホの地図全画面では、下に小さなカードを出す（タップで詳細） */
  const onPin = useCallback(
    (id: string) => {
      if (mobile && viewRef.current === "map") setPeekId(id);
      else onSelect(id);
    },
    [mobile, onSelect],
  );
  const peek = peekId ? ranked.find((s) => s.place.id === peekId) : undefined;

  /**
   * 友だちとのときだけ:「この3軒を LINE で送る」。店名3つと、同じ条件で開ける共有 URL を送る
   * （位置は載せない。現在地のまわりの検索なら語なしの URL）
   */
  const lineUrl = (() => {
    if (scene !== "friends" || !shown.length || typeof window === "undefined") return null;
    const names = shown.slice(0, 3).map((s, i) => `${i + 1}. ${placeName(s.place)}`);
    const sp = new URLSearchParams();
    if (urlQ.current) sp.set("q", urlQ.current);
    sp.set("scene", "friends");
    if (pinnedDemo) sp.set("demo", "1");
    const text = `ジブンマップで見つけた3軒\n${names.join("\n")}\n${window.location.origin}/map?${sp}`;
    return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
  })();

  /** シーンを切り替える。再検索はしない（手元で並べ直すだけなので費用はかからない） */
  const changeScene = (v: Scene) => {
    if (v === scene) return;
    setScene(v);
    window.history.replaceState(null, "", urlFor(urlQ.current, selRef.current, urlExtra.current));
  };

  /** ジャンルを選ぶ（もう一度押すと「すべて」）。手元で絞り込むだけで、再検索しない */
  const changeGenre = (g: string | null) => {
    setGenre(g);
    setPeekId(null);
    window.history.replaceState(null, "", urlFor(urlQ.current, selRef.current, urlExtra.current));
  };

  /** 選んだジャンルが今の結果にないとき: そのジャンルで検索し直す（押したときだけ1リクエスト） */
  const searchGenre = (key = genre) => {
    const g = key ? (chips.find((c) => c.key === key) ?? genreByKey(key)) : null;
    if (!g) return;
    // 今の街（検索語からジャンルの語を除いたもの）。現在地のまわりで探していたら、現在地で探し直す
    const near = lastLive.current?.near;
    if (near && !urlQ.current) {
      run(g.word, { fit: true, near });
      return;
    }
    const town = townPart(urlQ.current) || urlQ.current.trim();
    const q = `${town} ${g.word}`.trim();
    setQuery(q);
    run(q, { fit: true });
  };

  // ジャンルのチップ: 主なジャンルを常に出す。結果にあるものはその場で絞り込み、ないものは検索し直す
  const genreButtons = useMemo(() => {
    const have = new Set(chips.map((c) => c.key));
    return MAIN_GENRE_KEYS.flatMap((k) => {
      const g = genreByKey(k);
      return g ? [{ ...g, have: have.has(k) }] : [];
    });
  }, [chips]);

  const openPrefs = () => {
    rankAtOpen.current = rankIds.join();
    setPrefsOpen(true);
  };
  const closePrefs = () => setPrefsOpen(false);

  // マイ条件を閉じたとき、並びが変わっていたら1.5秒だけ知らせる
  const prevPrefsOpen = useRef(false);
  useEffect(() => {
    const was = prevPrefsOpen.current;
    prevPrefsOpen.current = prefsOpen;
    if (!was || prefsOpen || !rankIds.length) return;
    if (rankIds.join() !== rankAtOpen.current) setToast("並びが変わりました");
  }, [prefsOpen, rankIds]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  /** 友だちとモードで外した語のうち、この店の口コミに出ていたもの（詳細の1行に使う） */
  const sceneNote = (() => {
    if (scene !== "friends" || !selected) return null;
    const off = prefs.good.filter((w) => prefs.soloOnly.includes(w));
    const hit = wordHits(selected.place.reviews ?? [], off).map((h) => h.word);
    return hit.length
      ? `友だちとモードのため${hit.map((w) => `「${w}」`).join("")}は数えていません`
      : null;
  })();
  const mapView = mobile && view === "map";

  // スマホで詳細を全画面で開いている間は、後ろのページをスクロールさせない
  useEffect(() => {
    if (!mobile || !selId) return;
    const el = document.documentElement;
    const prev = el.style.overflow;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = prev;
    };
  }, [mobile, selId]);

  return (
    <div
      // overflow は clip（hidden だとフォーカスの移動でこの箱がずれて、ヘッダーの下に中身が潜る）
      className={`flex flex-col bg-bg text-ink md:h-dvh md:overflow-clip ${
        view === "map" ? "max-md:h-dvh max-md:overflow-clip" : "max-md:min-h-dvh"
      }`}
    >
      {/* 上部バーとシーンの切り替えは、リストをスクロールしても上に残す */}
      <div className="sticky top-0 z-30">
        <header className="relative z-30 flex items-center gap-2 border-line border-b bg-surface pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-2 pl-[max(0.75rem,env(safe-area-inset-left))] md:relative md:gap-3 md:px-4">
          <Logo compact />
          <SearchBox
            demo={demo}
            value={query}
            onChange={setQuery}
            onSearch={onSearch}
            onPickPlace={onPickPlace}
            onNear={onNear}
          />
          <button
            type="button"
            onClick={openPrefs}
            aria-label="マイ条件"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-2.5 font-medium text-sm hover:bg-surface-2 md:px-3"
          >
            <TuneIcon className="size-5" />
            <span className="hidden sm:inline">マイ条件</span>
          </button>
          <Link
            href="/#how"
            className="hidden h-10 shrink-0 items-center rounded-full px-3 font-medium text-sm hover:bg-surface-2 lg:inline-flex"
          >
            しくみ
          </Link>
        </header>
        {/* 「誰と」「最低点」「ジャンル」を1行の横スクロールにまとめる（スマホで高さを取らない） */}
        <div className="scrollbar-none flex items-center gap-2 overflow-x-auto border-line border-b bg-surface py-1.5 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] md:px-4">
          {/* ひとりで／友だちと。押すとすぐ並び直す（再検索しない） */}
          <fieldset className="flex shrink-0 rounded-full bg-surface-2 p-0.5">
            <legend className="sr-only">誰と行くか</legend>
            {(
              [
                ["solo", "ひとりで"],
                ["friends", "友だちと"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={scene === v}
                onClick={() => changeScene(v)}
                className={`h-10 whitespace-nowrap rounded-full px-3.5 font-medium text-sm transition-colors md:h-8 ${
                  scene === v ? "bg-brand text-on-brand shadow-e1" : "text-muted hover:text-ink"
                }`}
              >
                {l}
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            aria-expanded={minOpen}
            aria-controls="min-score-bar"
            onClick={() => setMinOpen((v) => !v)}
            className={`h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 font-medium text-[13px] tabular-nums md:h-8 ${
              prefs.minScore
                ? "border-brand bg-brand text-on-brand"
                : "border-line hover:bg-surface-2"
            }`}
          >
            {prefs.minScore ? `${prefs.minScore}点以上` : "点数: すべて"}
          </button>
          {(places.length > 0 || title) && (
            <>
              <span className="h-6 w-px shrink-0 bg-line" aria-hidden="true" />
              <nav aria-label="ジャンルで絞り込む" className="flex shrink-0 gap-1.5">
                {[{ key: "", label: "すべて", have: true }, ...genreButtons].map((c) => {
                  const on = (genre ?? "") === c.key;
                  return (
                    <button
                      key={c.key || "all"}
                      type="button"
                      aria-pressed={on}
                      title={
                        c.have ? undefined : "今の結果にないので、このジャンルで検索し直します"
                      }
                      onClick={() => {
                        if (!c.key || on) changeGenre(null);
                        else if (c.have) changeGenre(c.key);
                        // 結果にないジャンルは、今の街＋ジャンルで検索し直す（1リクエスト）
                        else searchGenre(c.key);
                      }}
                      className={`h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] transition-colors md:h-8 ${
                        on
                          ? "border-brand bg-brand font-bold text-on-brand"
                          : "border-line bg-surface hover:bg-surface-2"
                      }`}
                    >
                      {c.label}
                      {!c.have && (
                        <SearchIcon className="ml-1 inline size-3.5 align-[-2px] opacity-60" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </>
          )}
        </div>
        {minOpen && (
          <div id="min-score-bar" className="border-line border-b bg-surface px-4 pb-3">
            <MinScoreSlider
              id="min-score-inline"
              value={prefs.minScore}
              onChange={(minScore) => update((p) => ({ ...p, minScore }))}
            />
          </div>
        )}
      </div>

      {offline && !pinnedDemo && (
        // 圏外: Google の店は出せないので、通信なしのデモへ案内する（外枠は Service Worker が持っている）
        <div className="z-20 flex items-center gap-2 bg-lo-soft px-4 py-2 text-sm" role="status">
          <InfoIcon className="size-4 shrink-0 text-lo" />
          <span className="min-w-0 flex-1">
            通信が必要です。
            <a href="/map?demo=1" className="ml-1 font-bold underline">
              通信なしのデモはこちら
            </a>
          </span>
        </div>
      )}
      {fellBack ? (
        <div
          className="z-20 flex items-center gap-2 bg-accent-soft px-4 py-1.5 text-xs"
          role="status"
        >
          <InfoIcon className="size-4 shrink-0 text-mid" />
          <span className="min-w-0 flex-1">
            Google に接続できないため、<b>サンプルの街</b>で表示中（店・口コミは架空）
          </span>
          <button
            type="button"
            onClick={retry}
            className="h-10 shrink-0 rounded-full border border-line bg-surface px-3 font-medium hover:bg-surface-2 md:h-8"
          >
            もう一度試す
          </button>
        </div>
      ) : (
        demo && (
          <div
            className="z-20 flex items-center gap-2 bg-accent-soft px-4 py-1.5 text-xs"
            role="note"
          >
            <InfoIcon className="size-4 shrink-0 text-mid" />
            <span>
              {pinnedDemo ? (
                <>
                  <b>通信なしのデモ</b>です（街・店・口コミは架空。Google には接続しません）。
                </>
              ) : (
                <>
                  <b>デモデータ</b>
                  で動いています（街・店・口コミは架空）。Google
                  マップのキーを設定すると実際の店で動きます。
                </>
              )}
            </span>
          </div>
        )
      )}

      <main className="relative flex flex-1 flex-col md:min-h-0 md:flex-row">
        <section
          aria-label="地図"
          // スマホのリスト表示のときも地図は裏で作っておく（display: none だとタイルを読まず、
          // 切り替えた瞬間から読み始めて遅い）。見えない・押せない形で画面いっぱいに置く
          className={`relative md:visible md:z-auto md:order-2 md:flex md:flex-1 ${
            view === "map"
              ? "max-md:flex max-md:min-h-[240px] max-md:flex-1"
              : "max-md:pointer-events-none max-md:invisible max-md:fixed max-md:inset-0 max-md:-z-10"
          }`}
          aria-hidden={mobile && view === "list" ? true : undefined}
        >
          {demo || mapLimited ? (
            // デモ、または今日の地図の上限に達したとき: 点の配置だけの簡易地図（検索と一覧はそのまま使える）
            <DemoMapView
              note={
                mapLimited && !demo
                  ? "今日の地図の表示上限に達しました（一覧は使えます）"
                  : fellBack
                    ? "サンプルの街（架空）の地図です"
                    : "Google マップのキーを設定すると実際の地図になります"
              }
              items={visible}
              rankIds={rankIds}
              selId={selId ?? peekId}
              hoverId={hoverId}
              onSelect={onPin}
              onHover={setHoverId}
            />
          ) : (
            <GoogleMapView
              items={visible}
              rankIds={rankIds}
              selId={selId ?? peekId}
              hoverId={hoverId}
              fitKey={fitKey}
              onSelect={onPin}
              onHover={setHoverId}
              onUserMove={onUserMove}
              onFail={fallBack}
              onMapLimit={onMapLimit}
              boundsRef={boundsRef}
              me={me}
              meKey={meKey}
              route={route}
            />
          )}
          {!demo && !mapLimited && (
            <button
              type="button"
              aria-label="現在地を表示"
              onClick={() => locate()}
              className={`absolute right-3 z-10 grid size-11 place-items-center rounded-full bg-surface text-ink shadow-e2 hover:bg-surface-2 ${
                mapView && peek && !selected
                  ? "bottom-[calc(10rem+env(safe-area-inset-bottom))]"
                  : "bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6"
              }`}
            >
              <MyLocationIcon className="size-6" />
            </button>
          )}
          {!demo && moved && status.kind !== "loading" && (
            <button
              type="button"
              onClick={searchArea}
              className="anim-pop-in absolute top-3 left-1/2 z-10 flex h-10 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-4 font-medium text-sm shadow-e2 hover:bg-surface-2"
            >
              <SearchIcon className="size-4" />
              このエリアで再検索
              <span className="text-muted text-xs tabular-nums">
                （今日の残り{searchesLeft()}回）
              </span>
            </button>
          )}
          {mapView && route && !selected && (
            <div className="absolute inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex items-center gap-2 rounded-2xl border border-line bg-surface p-3 shadow-e2">
              <p className="min-w-0 flex-1 truncate text-[15px]">
                <b>{route.name}</b>まで {route.mode === "WALKING" ? "徒歩" : "電車"}
                {route.minutes ? ` 約${route.minutes}分` : ""}
              </p>
              <button
                type="button"
                onClick={() => setRoute(null)}
                className="h-10 shrink-0 rounded-full border border-line px-3.5 font-medium text-sm hover:bg-surface-2"
              >
                経路を消す
              </button>
            </div>
          )}
          {mapView && peek && !selected && !route && (
            <div className="absolute inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10">
              <PeekCard
                s={peek}
                rank={rankIds.indexOf(peek.place.id) + 1}
                words={words}
                onOpen={() => onSelect(peek.place.id)}
                onClose={() => setPeekId(null)}
              />
            </div>
          )}
        </section>

        <aside
          aria-label={selected ? `${placeName(selected.place)}の詳細` : "店の一覧"}
          // スマホの詳細シート（fixed, z-50）がヘッダーより上に出るよう、スマホでは重なりの箱を作らない
          className={`flex flex-col bg-surface md:relative md:z-10 md:order-1 md:min-h-0 md:w-[400px] md:flex-none md:border-line md:border-r ${
            view === "map" && !selected ? "max-md:hidden" : "max-md:flex-1"
          }`}
        >
          <div
            ref={scrollRef}
            className={`md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain ${
              selected
                ? "max-md:fixed max-md:inset-0 max-md:z-50 max-md:w-full max-md:max-w-full max-md:overflow-x-clip max-md:overflow-y-auto max-md:overscroll-contain max-md:touch-pan-y max-md:bg-surface"
                : ""
            }`}
          >
            {selected ? (
              <DetailPanel
                key={selected.place.id}
                s={selected}
                rank={rank}
                sceneNote={sceneNote}
                route={route?.placeId === selected.place.id ? route : null}
                routeState={routeState?.placeId === selected.place.id ? routeState : null}
                onRoute={onRoute}
                onClearRoute={() => setRoute(null)}
                words={words}
                demo={demo}
                onBack={onBack}
              />
            ) : (
              // 地図から戻ったときだけ短く出す（作り直しても状態は親にあるので消えない）
              <div key={view} className={mobile ? "anim-view-in" : ""}>
                <ListPanel
                  demo={demo}
                  busy={busy}
                  title={title}
                  status={status}
                  ranked={shown}
                  order={hasGoogleRank ? order : "mine"}
                  onOrder={hasGoogleRank ? setOrder : null}
                  myRanks={myRanks}
                  lineUrl={lineUrl}
                  minScore={prefs.minScore}
                  onMinScore={(minScore) => update((p) => ({ ...p, minScore }))}
                  hidden={ranked.length - visible.length}
                  hiddenWhy={[
                    genre ? "ほかのジャンル" : "",
                    !showAll && inGenre.length > visible.length ? `${prefs.minScore}点未満` : "",
                  ]
                    .filter(Boolean)
                    .join("・")}
                  scoreTip={scoreTip && !onboardOpen}
                  onCloseScoreTip={closeScoreTip}
                  onClearGenre={genre ? () => changeGenre(null) : null}
                  onSolo={scene === "friends" ? () => changeScene("solo") : null}
                  onShowAll={() => {
                    setShowAll(true);
                    changeGenre(null);
                  }}
                  genreLabel={genreLabel}
                  genreEmpty={!!genre && inGenre.length === 0}
                  onGenreSearch={() => searchGenre()}
                  nearby={demo ? [] : nearbyQueries(urlQ.current)}
                  onSearchArea={demo || !boundsRef.current ? null : searchArea}
                  words={words}
                  hoverId={hoverId}
                  onOpenPrefs={openPrefs}
                  onSelect={onSelect}
                  onHover={setHoverId}
                  onNear={demo ? null : () => onNear("飲食店")}
                  onPickExample={(q) => {
                    setQuery(q);
                    onSearch(q);
                  }}
                />
              </div>
            )}
          </div>
        </aside>
      </main>

      <PrefsSheet
        open={prefsOpen}
        prefs={prefs}
        update={update}
        onReset={onReset}
        onClose={closePrefs}
        onRestart={() => {
          closePrefs();
          setOnboardOpen(true);
        }}
      />
      {/* iPhone の Safari だけ: 検索を1回したあとに「ホーム画面に追加」の案内（はじめの設定や詳細の最中は出さない） */}
      <InstallHint ready={searchedOnce && !onboardOpen && !selected && !pinnedDemo} />
      <Onboarding
        open={onboardOpen}
        prefs={prefs}
        update={update}
        onClose={() => setOnboardOpen(false)}
      />
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(7rem+env(safe-area-inset-top))] z-50 flex justify-center"
      >
        {toast && (
          <p className="anim-pop-in rounded-full bg-brand px-4 py-2 font-medium text-on-brand text-sm shadow-e2">
            {toast}
          </p>
        )}
      </div>

      {/* スマホ: 地図とリストの切り替え。親指で届く画面下の中央に浮かせる */}
      {!selected && (
        <button
          type="button"
          onClick={toggleView}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-brand px-5 font-bold text-[15px] text-on-brand shadow-e2 md:hidden"
        >
          {view === "list" ? <MapIcon className="size-5" /> : <ListIcon className="size-5" />}
          {view === "list" ? "地図で見る" : "リストで見る"}
        </button>
      )}
    </div>
  );
}
