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
import { placeName } from "@/lib/jibunmap/place";
import { computeTop, type Scored, scorePlace } from "@/lib/jibunmap/score";
import { DemoMapView } from "./DemoMapView";
import { DetailPanel } from "./DetailPanel";
import { GoogleMapView } from "./GoogleMapView";
import { InfoIcon, ListIcon, SearchIcon } from "./Icons";
import { ListPanel } from "./ListPanel";
import { SearchBox } from "./SearchBox";
import { DEFAULT_PREFS, usePrefs } from "./usePrefs";

// キーはビルド時に埋め込まれる。サーバーとブラウザで同じ値なので、最初の描画がずれない
const DEMO = !BROWSER_KEY;
const FIRST_DEMO_TOWN = DEMO_TOWNS[0].name;

type Status = { kind: "idle" | "loading" | "ok" } | { kind: "error"; message: string };

export function MapApp() {
  const { prefs, update } = usePrefs();
  const [query, setQuery] = useState(DEMO ? FIRST_DEMO_TOWN : "");
  const [title, setTitle] = useState<string | null>(DEMO ? FIRST_DEMO_TOWN : null);
  const [places, setPlaces] = useState<Place[]>(() => (DEMO ? demoSearch(FIRST_DEMO_TOWN) : []));
  const [now, setNow] = useState(DEMO_NOW);
  const [status, setStatus] = useState<Status>({ kind: DEMO ? "ok" : "idle" });
  const [selId, setSelId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [moved, setMoved] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const boundsRef = useRef<Bounds | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searching = useRef(false);

  const words = useMemo(() => ({ good: prefs.good, ng: prefs.ng }), [prefs.good, prefs.ng]);
  const scored = useMemo(() => places.map((p) => scorePlace(p, now, words)), [places, now, words]);
  const ranked = useMemo(() => computeTop(scored, prefs.axes), [scored, prefs.axes]);
  const top = useMemo(() => ranked.slice(0, 3), [ranked]);
  const topIds = useMemo(() => top.map((s) => s.place.id), [top]);
  const others = useMemo(
    () => ranked.slice(3).sort((a, b) => b.score - a.score || a.place.id.localeCompare(b.place.id)),
    [ranked],
  );
  const selected: Scored | undefined = scored.find((s) => s.place.id === selId);

  // 一覧と詳細を切り替えたら、パネルを上まで戻す
  // biome-ignore lint/correctness/useExhaustiveDependencies: 選んだ店が変わったときだけ
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [selId]);

  const run = useCallback(
    async (q: string, opts: { bounds?: Bounds; fit: boolean; select?: string }) => {
      if (searching.current) return;
      const label = q.trim() || "このエリア";
      setSelId(null);
      setMoved(false);
      if (DEMO) {
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
        if (opts.select) setSelId(opts.select);
        return;
      }
      searching.current = true;
      setStatus({ kind: "loading" });
      setTitle(label);
      try {
        // 地図が出ているときは、表示中の範囲に寄せる（絞り込みではない）
        const { places: found } = await searchPlaces(
          q,
          opts.bounds ?? boundsRef.current ?? undefined,
        );
        setPlaces(found);
        setNow(Date.now());
        setStatus(
          found.length
            ? { kind: "ok" }
            : { kind: "error", message: `「${label}」で店が見つかりませんでした。` },
        );
        if (opts.fit) setFitKey((k) => k + 1);
        if (q.trim()) setRecent((r) => [q.trim(), ...r.filter((x) => x !== q.trim())].slice(0, 5));
      } catch (e) {
        setStatus({
          kind: "error",
          message:
            e instanceof SearchLimitError
              ? e.message
              : "検索できませんでした。キーの設定（HTTP リファラ制限と Places API (New) の有効化）を確かめてください。",
        });
      } finally {
        searching.current = false;
      }
    },
    [],
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

  const onSelect = useCallback((id: string) => setSelId(id), []);
  const onBack = useCallback(() => setSelId(null), []);
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
          demo={DEMO}
          value={query}
          onChange={setQuery}
          onSearch={onSearch}
          onPickPlace={onPickPlace}
          recent={recent}
        />
        <Link
          href="/#how"
          className="shrink-0 rounded-full px-3 py-2 font-medium text-sm hover:bg-surface-2"
        >
          しくみ
        </Link>
      </header>

      {DEMO && (
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
      )}

      <main className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <section
          aria-label="地図"
          className="relative h-[42dvh] shrink-0 md:order-2 md:h-auto md:flex-1"
        >
          {DEMO ? (
            <DemoMapView
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
              boundsRef={boundsRef}
            />
          )}
          {!DEMO && moved && status.kind !== "loading" && (
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
          <div className="flex justify-center pt-2 md:hidden" aria-hidden="true">
            <span className="h-1 w-9 rounded-full bg-surface-3" />
          </div>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {selected ? (
              <DetailPanel
                key={selected.place.id}
                s={selected}
                rank={rank}
                axes={prefs.axes}
                words={words}
                demo={DEMO}
                onBack={onBack}
              />
            ) : (
              <ListPanel
                demo={DEMO}
                title={title}
                status={status}
                total={scored.length}
                top={top}
                others={others}
                prefs={prefs}
                update={update}
                onReset={onReset}
                onSelect={onSelect}
                onHover={setHoverId}
                onPickTown={(name) => {
                  setQuery(name);
                  onSearch(name);
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
