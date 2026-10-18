"use client";

import { useEffect, useRef, useState } from "react";
import { boundsOf, type GLatLngBounds, importLibrary, MAP_ID } from "@/lib/jibunmap/google";
import type { Bounds } from "@/lib/jibunmap/place";
import { placeName } from "@/lib/jibunmap/place";
import { type Scored, verdict } from "@/lib/jibunmap/score";

/* Maps JavaScript API の最小限の型（npm の型パッケージは足さない） */
type Listener = { remove(): void };
type LatLngLiteral = { lat: number; lng: number };
type GMap = {
  fitBounds(b: unknown, padding?: number): void;
  panTo(ll: LatLngLiteral): void;
  setCenter(ll: LatLngLiteral): void;
  setZoom(z: number): void;
  getBounds(): GLatLngBounds | undefined;
  addListener(ev: string, fn: () => void): Listener;
};
type GBounds = { extend(ll: LatLngLiteral): void; contains(ll: LatLngLiteral): boolean };
type MapsLib = { Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap };
type CoreLib = { LatLngBounds: new () => GBounds };
type Marker = {
  map: GMap | null;
  zIndex?: number | null;
  title: string;
  position: LatLngLiteral | null;
  addEventListener(ev: string, fn: () => void): void;
};
type MarkerLib = { AdvancedMarkerElement: new (opts: Record<string, unknown>) => Marker };

const TOKYO = { lat: 35.681, lng: 139.767 };
/** 地図の読み込みがこれ以上かかったら、Google に届いていないとみなす */
const LOAD_TIMEOUT_MS = 12_000;

/** 上位いくつを大きなピンにするか（一覧の写真つきカードと同じ数） */
const BIG_PINS = 3;

/** マーカーの中身を描き直す（要素は使い回す）。上位3つは番号と点数の大きなピン、4位以下は番号だけの小さなピン */
function paint(el: HTMLElement, s: Scored, rank: number): void {
  if (rank && rank <= BIG_PINS) {
    el.className = "jm-marker jm-marker-top";
    el.innerHTML = `<span class="jm-marker-no">${rank}</span><span class="jm-marker-score">${s.score}</span>`;
  } else {
    el.className = "jm-marker jm-marker-small";
    el.textContent = rank ? String(rank) : "";
  }
}

function markerTitle(s: Scored, rank: number): string {
  return `${rank ? `${rank}位 ` : ""}${placeName(s.place)}（集まる度 ${s.score}・${verdict(s.score)}）`;
}

type Entry = { m: Marker; el: HTMLElement; rank: number };

export function GoogleMapView({
  items,
  rankIds,
  selId,
  hoverId,
  fitKey,
  onSelect,
  onHover,
  onUserMove,
  onFail,
  boundsRef,
}: {
  items: Scored[];
  rankIds: string[];
  selId: string | null;
  hoverId: string | null;
  fitKey: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onUserMove: () => void;
  /** 読み込めなかったとき（呼ぶ側でデモに切り替える） */
  onFail: (why: string, detail?: unknown) => void;
  boundsRef: React.RefObject<Bounds | null>;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const libs = useRef<{ core: CoreLib; marker: MarkerLib } | null>(null);
  const markers = useRef(new Map<string, Entry>());
  const programmatic = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  // 最新のコールバックを ref で持つ（地図のリスナーは一度だけ登録するため）
  const cb = useRef({ onSelect, onHover, onUserMove, onFail });
  cb.current = { onSelect, onHover, onUserMove, onFail };

  useEffect(() => {
    let cancelled = false;
    const subs: Listener[] = [];
    const timer = setTimeout(() => {
      if (cancelled || mapRef.current) return;
      setError(true);
      cb.current.onFail(`地図の読み込みが ${LOAD_TIMEOUT_MS / 1000} 秒で終わらない`);
    }, LOAD_TIMEOUT_MS);
    (async () => {
      try {
        const [maps, core, marker] = await Promise.all([
          importLibrary<MapsLib>("maps"),
          importLibrary<CoreLib>("core"),
          importLibrary<MarkerLib>("marker"),
        ]);
        if (cancelled || !divRef.current) return;
        const map = new maps.Map(divRef.current, {
          center: TOKYO,
          zoom: 14,
          mapId: MAP_ID,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        mapRef.current = map;
        libs.current = { core, marker };
        subs.push(
          map.addListener("idle", () => {
            const b = map.getBounds();
            if (b) boundsRef.current = boundsOf(b);
            programmatic.current = false;
          }),
          map.addListener("dragstart", () => cb.current.onUserMove()),
          map.addListener("zoom_changed", () => {
            if (!programmatic.current) cb.current.onUserMove();
          }),
        );
        clearTimeout(timer);
        setReady(true);
      } catch (e) {
        clearTimeout(timer);
        if (cancelled) return;
        setError(true);
        cb.current.onFail(
          "Maps JavaScript API のスクリプトを読み込めない（ネットワーク・キー・API の有効化を確認）",
          e,
        );
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      for (const s of subs) s.remove();
    };
  }, [boundsRef]);

  // マーカーは差分で更新する（毎回作り直すと、条件を変えるたびにちらつくため）
  useEffect(() => {
    const map = mapRef.current;
    const L = libs.current;
    if (!ready || !map || !L) return;
    const seen = new Set<string>();
    for (const s of items) {
      const loc = s.place.location;
      if (!loc) continue;
      const id = s.place.id;
      const rank = rankIds.indexOf(id) + 1;
      const position = { lat: loc.latitude, lng: loc.longitude };
      seen.add(id);
      let e = markers.current.get(id);
      if (!e) {
        const el = document.createElement("div");
        const m = new L.marker.AdvancedMarkerElement({
          map,
          position,
          content: el,
          gmpClickable: true,
        });
        m.addEventListener("gmp-click", () => cb.current.onSelect(id));
        el.addEventListener("mouseenter", () => cb.current.onHover(id));
        el.addEventListener("mouseleave", () => cb.current.onHover(null));
        e = { m, el, rank };
        markers.current.set(id, e);
      } else {
        e.m.position = position;
      }
      e.rank = rank;
      paint(e.el, s, rank);
      e.m.title = markerTitle(s, rank);
    }
    for (const [id, e] of markers.current) {
      if (seen.has(id)) continue;
      e.m.map = null;
      markers.current.delete(id);
    }
  }, [ready, items, rankIds]);

  // 地図を外すときだけ、マーカーをすべて消す
  useEffect(() => {
    const all = markers.current;
    return () => {
      for (const e of all.values()) e.m.map = null;
      all.clear();
    };
  }, []);

  // 選択とホバーは見た目のクラスと重なり順だけ付け替える。選択中は最前面に出す
  // biome-ignore lint/correctness/useExhaustiveDependencies: items・rankIds で描き直したあとも付け直す
  useEffect(() => {
    for (const [id, e] of markers.current) {
      const sel = id === selId;
      const hot = id === hoverId;
      e.el.classList.toggle("is-sel", sel);
      e.el.classList.toggle("is-hot", hot);
      // 上位ほど前に出す。選択中とホバー中はさらに前
      e.m.zIndex = sel ? 1000 : hot ? 500 : e.rank ? 100 - e.rank : 1;
    }
  }, [selId, hoverId, items, rankIds]);

  // 新しい検索結果に合わせて表示範囲を動かす
  // biome-ignore lint/correctness/useExhaustiveDependencies: fitKey が変わったときだけ動かす（items の並び替えでは動かさない）
  useEffect(() => {
    const map = mapRef.current;
    const L = libs.current;
    if (!ready || !map || !L) return;
    const locs = items.flatMap((s) => (s.place.location ? [s.place.location] : []));
    if (!locs.length) return;
    programmatic.current = true;
    if (locs.length === 1) {
      map.setCenter({ lat: locs[0].latitude, lng: locs[0].longitude });
      map.setZoom(16);
      return;
    }
    const b = new L.core.LatLngBounds();
    for (const l of locs) b.extend({ lat: l.latitude, lng: l.longitude });
    map.fitBounds(b, 56);
  }, [ready, fitKey]);

  // 選んだ店が画面の外なら寄せる
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selId) return;
    const loc = items.find((s) => s.place.id === selId)?.place.location;
    if (!loc) return;
    const ll = { lat: loc.latitude, lng: loc.longitude };
    const b = map.getBounds() as unknown as GBounds | undefined;
    if (b && !b.contains(ll)) {
      programmatic.current = true;
      map.panTo(ll);
    }
  }, [ready, selId, items]);

  return (
    <div className="absolute inset-0">
      <div ref={divRef} className="absolute inset-0 bg-surface-2" />
      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center text-muted text-sm">
          地図を読み込んでいます…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm">
          <div className="max-w-sm rounded-2xl bg-surface p-5 shadow-e1">
            <p className="font-bold">地図を読み込めませんでした</p>
            <p className="mt-1 text-muted">通信の状態を確かめて、もう一度開いてください。</p>
          </div>
        </div>
      )}
    </div>
  );
}
