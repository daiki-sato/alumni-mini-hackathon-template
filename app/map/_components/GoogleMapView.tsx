"use client";

import { useEffect, useRef, useState } from "react";
import { boundsOf, type GLatLngBounds, importLibrary, MAP_ID } from "@/lib/jibunmap/google";
import type { Bounds } from "@/lib/jibunmap/place";
import { placeName } from "@/lib/jibunmap/place";
import { band, type Scored } from "@/lib/jibunmap/score";

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
  zIndex?: number;
  addEventListener(ev: string, fn: () => void): void;
};
type MarkerLib = { AdvancedMarkerElement: new (opts: Record<string, unknown>) => Marker };

const TOKYO = { lat: 35.681, lng: 139.767 };

function markerContent(s: Scored, rank: number): HTMLElement {
  const el = document.createElement("div");
  if (rank) {
    el.className = "jm-marker jm-marker-top";
    el.innerHTML = `<span class="jm-marker-no">${rank}</span><span class="jm-marker-score">${s.score}</span>`;
  } else {
    el.className = `jm-marker jm-marker-dot jm-${band(s.score)}`;
  }
  return el;
}

export function GoogleMapView({
  items,
  topIds,
  selId,
  hoverId,
  fitKey,
  onSelect,
  onHover,
  onUserMove,
  boundsRef,
}: {
  items: Scored[];
  topIds: string[];
  selId: string | null;
  hoverId: string | null;
  fitKey: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onUserMove: () => void;
  boundsRef: React.RefObject<Bounds | null>;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const libs = useRef<{ core: CoreLib; marker: MarkerLib } | null>(null);
  const markers = useRef<Marker[]>([]);
  const contents = useRef(new Map<string, HTMLElement>());
  const programmatic = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 最新のコールバックを ref で持つ（地図のリスナーは一度だけ登録するため）
  const cb = useRef({ onSelect, onHover, onUserMove });
  cb.current = { onSelect, onHover, onUserMove };

  useEffect(() => {
    let cancelled = false;
    const subs: Listener[] = [];
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
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "地図を読み込めませんでした");
      }
    })();
    return () => {
      cancelled = true;
      for (const s of subs) s.remove();
    };
  }, [boundsRef]);

  // マーカー（20件以下なので、結果か順位が変わったら作り直す）
  useEffect(() => {
    const map = mapRef.current;
    const L = libs.current;
    if (!ready || !map || !L) return;
    for (const m of markers.current) m.map = null;
    markers.current = [];
    contents.current.clear();
    for (const s of items) {
      const loc = s.place.location;
      if (!loc) continue;
      const id = s.place.id;
      const rank = topIds.indexOf(id) + 1;
      const content = markerContent(s, rank);
      const m = new L.marker.AdvancedMarkerElement({
        map,
        position: { lat: loc.latitude, lng: loc.longitude },
        title: `${rank ? `今日の3軒の${rank}番 ` : ""}${placeName(s.place)}（集まる度 ${s.score}）`,
        content,
        gmpClickable: true,
        zIndex: rank ? 100 - rank : 1,
      });
      m.addEventListener("gmp-click", () => cb.current.onSelect(id));
      content.addEventListener("mouseenter", () => cb.current.onHover(id));
      content.addEventListener("mouseleave", () => cb.current.onHover(null));
      markers.current.push(m);
      contents.current.set(id, content);
    }
    return () => {
      for (const m of markers.current) m.map = null;
    };
  }, [ready, items, topIds]);

  // 選択とホバーは見た目のクラスだけ付け替える（作り直すと点滅するため）
  // biome-ignore lint/correctness/useExhaustiveDependencies: items・topIds が変わってマーカーを作り直したあとも付け直す
  useEffect(() => {
    for (const [id, el] of contents.current) {
      el.classList.toggle("is-sel", id === selId);
      el.classList.toggle("is-hot", id === hoverId);
    }
  }, [selId, hoverId, items, topIds]);

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
            <p className="mt-1 text-muted">
              {error}。キーの HTTP リファラ制限と、Maps JavaScript API が有効かを確かめてください。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
