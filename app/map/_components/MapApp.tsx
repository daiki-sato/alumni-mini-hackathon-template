"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/app/_components/Logo";
import {
  DEMO_NOW,
  DEMO_PLACES,
  DEMO_TOWNS,
  demoSearch,
  demoSearchBounds,
} from "@/lib/jibunmap/demo";
import { BROWSER_KEY, SearchLimitError, searchesLeft, searchPlaces } from "@/lib/jibunmap/google";
import type { Bounds, Place } from "@/lib/jibunmap/place";
import { MAX_QUERY_LENGTH, placeName } from "@/lib/jibunmap/place";
import { computeTop, type Scored, scorePlace } from "@/lib/jibunmap/score";
import { foodQuery } from "@/lib/jibunmap/suggest";
import { DemoMapView } from "./DemoMapView";
import { DetailPanel } from "./DetailPanel";
import { GoogleMapView } from "./GoogleMapView";
import { InfoIcon, ListIcon, SearchIcon } from "./Icons";
import { ListPanel } from "./ListPanel";
import { SearchBox } from "./SearchBox";
import { DEFAULT_PREFS, usePrefs } from "./usePrefs";

// キーはビルド時に埋め込まれる。サーバーとブラウザで同じ値なので、最初の描画がずれない
const HAS_KEY = !!BROWSER_KEY;
const FIRST_DEMO_TOWN = DEMO_TOWNS[0].name;
/** URL（?q=検索語&place=店の id）。検索語と選んだ店を、共有と戻るボタンのために載せる */
function urlFor(q: string, place: string | null): string {
  const sp = new URLSearchParams();
  if (q.trim()) sp.set("q", q.trim());
  if (place) sp.set("place", place);
  const s = sp.toString();
  return `${window.location.pathname}${s ? `?${s}` : ""}`;
}

/** 検索がこれ以上かかったら、Google に届いていないとみなしてデモに切り替える */
const SEARCH_TIMEOUT_MS = 12_000;

type Status = { kind: "idle" | "loading" | "ok" } | { kind: "error"; message: string };

class TimeoutError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${ms}ms で応答がありません`)), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

export function MapApp() {
  const { prefs, update } = usePrefs();
  // キーがあっても、Google に届かなければデモに切り替える（fellBack）
  const [demo, setDemoState] = useState(!HAS_KEY);
  const [fellBack, setFellBack] = useState(false);
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
  /** 検索中に来た次の検索の語（前の検索が終わったら自動で探す。表示にも使う） */
  const [busy, setBusy] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [moved, setMoved] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  const boundsRef = useRef<Bounds | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searching = useRef(false);
  type RunOpts = { bounds?: Bounds; fit: boolean; select?: string };
  /** 検索中に来た、いちばん新しい検索（古い保留は上書きして捨てる） */
  const pending = useRef<{ q: string; opts: RunOpts } | null>(null);
  const runRef = useRef<(q: string, opts: RunOpts) => void>(() => {});
  /** いちばん新しい検索の番号。古い検索の結果やエラーは捨てる */
  const seq = useRef(0);
  /** 最後に Google で探した語（「もう一度試す」用） */
  const lastLive = useRef<{ q: string; select?: string } | null>(null);
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

  const words = useMemo(() => ({ good: prefs.good, ng: prefs.ng }), [prefs.good, prefs.ng]);
  const scored = useMemo(() => places.map((p) => scorePlace(p, now, words)), [places, now, words]);
  const ranked = useMemo(() => computeTop(scored, prefs.axes), [scored, prefs.axes]);
  const top = useMemo(() => ranked.slice(0, 3), [ranked]);
  const topIds = useMemo(() => top.map((s) => s.place.id), [top]);
  // ほかの候補も今日の3軒と同じ基準（判断軸の合計）で並べる
  const others = useMemo(() => ranked.slice(3), [ranked]);
  const selected: Scored | undefined = scored.find((s) => s.place.id === selId);

  // 一覧と詳細を切り替えたら、パネルを上まで戻す
  // biome-ignore lint/correctness/useExhaustiveDependencies: 選んだ店が変わったときだけ
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [selId]);

  /** Google に届かないとき: デモの店と SVG の地図に切り替える。詳しい理由は console にだけ出す */
  const fallBack = useCallback(
    (why: string, detail?: unknown) => {
      if (demoRef.current) return;
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
      setSelId(null);
      setMoved(false);
      // URL の検索語は入力した語のまま残す（「もう一度試す」や再読み込みで Google に聞き直せるように）
      placePushed.current = false;
      fromCard.current = null;
      window.history.replaceState(null, "", urlFor(urlQ.current, null));
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
    [setDemo],
  );

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
      const label = q.trim() || "このエリア";
      setSelId(null);
      setOthersOpen(false);
      setMoved(false);
      fromCard.current = null;
      placePushed.current = false;
      if (!opts.bounds) urlQ.current = q;
      const found0 = (found: Place[]) => {
        const sel = opts.select && found.some((p) => p.id === opts.select) ? opts.select : null;
        window.history.replaceState(null, "", urlFor(urlQ.current, sel));
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
      if (!opts.bounds) lastLive.current = { q, select: opts.select };
      searching.current = true;
      setStatus({ kind: "loading" });
      setTitle(label);
      try {
        // 地図が出ているときは、表示中の範囲に寄せる（絞り込みではない）
        const { places: found } = await withTimeout(
          searchPlaces(q, opts.bounds ?? boundsRef.current ?? undefined, {
            area: !!opts.bounds,
            textQuery: foodQuery(q || "飲食店"),
          }),
          SEARCH_TIMEOUT_MS,
        );
        if (my !== seq.current) return;
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
    [fallBack],
  );
  runRef.current = run;

  // /map?q=... で開いたら、その語で1回だけ探す（&place= があれば、結果の中にあれば詳細を開く）。
  // StrictMode で effect が2回走っても二重に検索しないよう、ref で実行済みを覚える
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("q")?.trim().slice(0, MAX_QUERY_LENGTH);
    if (!q) return;
    // デモデータに当たらない語（例: 高円寺）なら、最初のサンプルの街のままにする
    if (demoRef.current && !demoSearch(q).length) return;
    setQuery(q);
    run(q, { fit: true, select: sp.get("place") ?? undefined });
  }, [run]);

  /** デモから Google に戻してもう一度探す */
  const retry = useCallback(() => {
    setDemo(false);
    setFellBack(false);
    setPlaces([]);
    setTitle(null);
    setStatus({ kind: "idle" });
    const last = lastLive.current;
    if (last?.q.trim()) {
      setQuery(last.q);
      run(last.q, { fit: true, select: last.select });
    } else {
      setQuery("");
    }
  }, [run, setDemo]);

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
  const onSelect = useCallback(
    (id: string) => {
      if (selRef.current === id) return;
      if (selRef.current) {
        window.history.replaceState(null, "", urlFor(urlQ.current, id));
      } else {
        window.history.pushState(null, "", urlFor(urlQ.current, id));
        placePushed.current = true;
        fromCard.current = id;
      }
      if (!topIds.includes(id)) setOthersOpen(true);
      setSelId(id);
    },
    [topIds],
  );

  /** 詳細を閉じる。積んだ履歴があればそれを戻る（popstate で閉じる） */
  const onBack = useCallback(() => {
    if (!selRef.current) return;
    if (placePushed.current) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, "", urlFor(urlQ.current, null));
    setSelId(null);
  }, []);

  // ブラウザの戻る・進む: URL の place に合わせて詳細を開け閉めする（ここでは履歴を積まない）
  useEffect(() => {
    const onPop = () => {
      const place = new URLSearchParams(window.location.search).get("place");
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
  }, []);

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

  const rank = selected ? topIds.indexOf(selected.place.id) + 1 : 0;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-ink">
      <header className="relative z-30 flex items-center gap-3 border-line border-b bg-surface px-3 py-2 md:px-4">
        <Logo compact />
        <SearchBox
          demo={demo}
          value={query}
          onChange={setQuery}
          onSearch={onSearch}
          onPickPlace={onPickPlace}
        />
        <Link
          href="/#how"
          className="shrink-0 rounded-full px-3 py-2 font-medium text-sm hover:bg-surface-2"
        >
          しくみ
        </Link>
      </header>

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
            className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 font-medium hover:bg-surface-2"
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
              <b>デモデータ</b>
              で動いています（街・店・口コミは架空）。Google
              マップのキーを設定すると実際の店で動きます。
            </span>
          </div>
        )
      )}

      <main className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <section
          aria-label="地図"
          className="relative h-[42dvh] shrink-0 md:order-2 md:h-auto md:flex-1"
        >
          {demo ? (
            <DemoMapView
              note={
                fellBack
                  ? "サンプルの街（架空）の地図です"
                  : "Google マップのキーを設定すると実際の地図になります"
              }
              items={scored}
              topIds={topIds}
              selId={selId}
              hoverId={hoverId}
              onSelect={onSelect}
              onHover={setHoverId}
            />
          ) : (
            <GoogleMapView
              items={scored}
              topIds={topIds}
              selId={selId}
              hoverId={hoverId}
              fitKey={fitKey}
              onSelect={onSelect}
              onHover={setHoverId}
              onUserMove={onUserMove}
              onFail={fallBack}
              boundsRef={boundsRef}
            />
          )}
          {!demo && moved && status.kind !== "loading" && (
            <button
              type="button"
              onClick={searchArea}
              className="anim-pop-in absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-surface px-4 py-2 font-medium text-sm shadow-e2 hover:bg-surface-2"
            >
              <SearchIcon className="size-4" />
              このエリアで再検索
              <span className="text-muted text-xs tabular-nums">（残り{searchesLeft()}回）</span>
            </button>
          )}
        </section>

        <aside
          aria-label={selected ? `${placeName(selected.place)}の詳細` : "店の一覧"}
          className="relative z-10 -mt-4 flex min-h-0 flex-1 flex-col rounded-t-3xl border-line bg-surface shadow-e2 md:order-1 md:mt-0 md:w-[400px] md:flex-none md:rounded-none md:border-r md:shadow-none"
        >
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {selected ? (
              <DetailPanel
                key={selected.place.id}
                s={selected}
                rank={rank}
                axes={prefs.axes}
                words={words}
                demo={demo}
                onBack={onBack}
              />
            ) : (
              <ListPanel
                demo={demo}
                busy={busy}
                title={title}
                status={status}
                total={scored.length}
                top={top}
                others={others}
                prefs={prefs}
                words={words}
                hoverId={hoverId}
                condOpen={condOpen}
                othersOpen={othersOpen}
                onCondOpen={setCondOpen}
                onOthersOpen={setOthersOpen}
                update={update}
                onReset={onReset}
                onSelect={onSelect}
                onHover={setHoverId}
                onPickExample={(q) => {
                  setQuery(q);
                  onSearch(q);
                }}
              />
            )}
          </div>
          {selected && (
            <div className="border-line border-t p-2 md:hidden">
              <button
                type="button"
                onClick={onBack}
                className="flex w-full items-center justify-center gap-2 rounded-full py-2 font-medium text-sm hover:bg-surface-2"
              >
                <ListIcon />
                一覧に戻る
              </button>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
