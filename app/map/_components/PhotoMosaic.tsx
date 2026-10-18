"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Place } from "@/lib/jibunmap/place";
import { BackIcon } from "./Icons";
import { PhotoGallery } from "./PhotoGallery";
import { PlacePhotoImg } from "./PlacePhotoImg";

/** モザイクで見せる枚数。デスクトップは大1＋小4、スマホは大1＋小3 */
const DESKTOP_SHOWN = 5;
const MOBILE_SHOWN = 4;

function Tile({
  place,
  index,
  size,
  className,
  onOpen,
  more,
}: {
  place: Place;
  index: number;
  size: "mid" | "large";
  className: string;
  onOpen: (i: number) => void;
  /** 「すべての写真」を重ねる（"desktop" / "mobile" / 両方 / なし） */
  more?: { desktop: boolean; mobile: boolean; onAll: () => void };
}) {
  return (
    <div className={`relative min-h-0 overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => onOpen(index)}
        aria-label={`写真を大きく見る（${index + 1}枚目）`}
        className="block size-full"
      >
        <PlacePhotoImg place={place} index={index} size={size} credit className="size-full" />
      </button>
      {more && (more.desktop || more.mobile) && (
        <button
          type="button"
          onClick={more.onAll}
          className={`absolute inset-0 place-items-center bg-black/50 font-bold text-sm text-white ${
            more.desktop && more.mobile
              ? "grid"
              : more.desktop
                ? "hidden md:grid"
                : "grid md:hidden"
          }`}
        >
          すべての写真
        </button>
      )}
    </div>
  );
}

/**
 * 詳細の上部の写真。Google マップのようなモザイク（デスクトップは大1＋小2×2、スマホは大1＋小3）。
 * 写真が少ない店は、ある分だけで崩れない配置にする。読むのは画面に入った写真だけ
 */
export function PhotoMosaic({ place }: { place: Place }) {
  const n = place.photos?.length ?? 0;
  const [gallery, setGallery] = useState<number | null>(null);
  const [grid, setGrid] = useState(false);
  const closeGallery = useCallback(() => setGallery(null), []);
  const closeGrid = useCallback(() => setGrid(false), []);
  const open = setGallery;
  const all = () => setGrid(true);

  if (!n) {
    return <PlacePhotoImg place={place} size="large" className="h-44 w-full rounded-2xl" />;
  }

  // 小さい枠: デスクトップは最大4、スマホは最大3
  const smallD = Math.min(n - 1, DESKTOP_SHOWN - 1);
  const smallM = Math.min(n - 1, MOBILE_SHOWN - 1);
  const smalls = Array.from({ length: smallD }, (_, k) => k + 1);

  return (
    <>
      {n === 1 ? (
        <div className="h-56 overflow-hidden rounded-2xl md:h-60">
          <Tile place={place} index={0} size="large" className="size-full" onOpen={open} />
        </div>
      ) : n === 2 ? (
        <div className="grid h-48 grid-cols-2 gap-1 overflow-hidden rounded-2xl md:h-56">
          <Tile place={place} index={0} size="large" className="size-full" onOpen={open} />
          <Tile place={place} index={1} size="large" className="size-full" onOpen={open} />
        </div>
      ) : (
        <div className="grid grid-rows-[11rem_5.5rem] gap-1 overflow-hidden rounded-2xl md:h-60 md:grid-cols-[3fr_2fr] md:grid-rows-1">
          <Tile place={place} index={0} size="large" className="size-full" onOpen={open} />
          {/* 小さい枠。スマホは横一列（最大3）、デスクトップは2段（3枚以上は 2×2） */}
          <div
            className={`grid grid-cols-[repeat(var(--m),minmax(0,1fr))] gap-1 md:grid-rows-2 ${
              smallD >= 3 ? "md:grid-cols-2" : "md:grid-cols-1"
            }`}
            style={{ "--m": smallM } as React.CSSProperties}
          >
            {smalls.map((i, k) => (
              <Tile
                key={place.photos?.[i]?.mid ?? i}
                place={place}
                index={i}
                size="mid"
                // スマホは3枚まで（4枚目はデスクトップだけ）。デスクトップで3枚のときは最後を横長に
                className={`size-full ${k >= smallM ? "max-md:hidden" : ""} ${
                  smallD === 3 && k === 2 ? "md:col-span-2" : ""
                }`}
                onOpen={open}
                more={{
                  desktop: k === smallD - 1 && n > DESKTOP_SHOWN,
                  mobile: k === smallM - 1 && n > MOBILE_SHOWN,
                  onAll: all,
                }}
              />
            ))}
          </div>
        </div>
      )}
      {grid && <PhotoGrid place={place} onClose={closeGrid} />}
      {gallery !== null && <PhotoGallery place={place} start={gallery} onClose={closeGallery} />}
    </>
  );
}

/**
 * 写真の一覧（全画面のグリッド。3列、スマホは2列）。サムネイルは 400px で、画面に入ったものだけ読む。
 * 押すと拡大ギャラリー。戻る／Esc で「拡大 → 一覧 → 詳細」の順に戻る（開くとき履歴を1つ積む）
 */
function PhotoGrid({ place, onClose }: { place: Place; onClose: () => void }) {
  const photos = place.photos ?? [];
  const [gallery, setGallery] = useState<number | null>(null);
  const galleryOpen = useRef(false);
  galleryOpen.current = gallery !== null;
  const closeGallery = useCallback(() => setGallery(null), []);
  const pushed = useRef(false);
  const backRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => window.history.back(), []);

  useEffect(() => {
    if (!pushed.current) {
      pushed.current = true;
      const u = new URL(window.location.href);
      u.searchParams.set("photos", "1");
      window.history.pushState(null, "", `${u.pathname}${u.search}`);
    }
    const onPop = () => {
      if (!new URLSearchParams(window.location.search).has("photos")) onClose();
    };
    window.addEventListener("popstate", onPop);
    backRef.current?.focus();
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose]);

  // Esc: 拡大を開いている間は拡大の側で受ける。一覧だけのときは一覧を閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || galleryOpen.current) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  // body に出す（パネルの中だと全画面にならない）。拡大（z-100）より下、ヘッダーより上
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${place.displayName?.text ?? "店"}のすべての写真`}
      className="fixed inset-0 z-[90] box-border flex w-full max-w-full flex-col overflow-x-clip bg-surface text-ink"
    >
      <div className="flex items-center gap-1 border-line border-b px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button
          ref={backRef}
          type="button"
          onClick={close}
          className="flex h-10 items-center gap-1 rounded-full pr-4 pl-2 font-medium text-[15px] hover:bg-surface-2 md:text-sm"
        >
          <BackIcon />
          戻る
        </button>
        <h2 className="truncate font-bold">すべての写真</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <ul className="grid grid-cols-2 gap-1 md:grid-cols-3">
          {photos.map((ph, i) => (
            <li key={ph.mid} className="aspect-square overflow-hidden">
              <button
                type="button"
                onClick={() => setGallery(i)}
                aria-label={`写真を大きく見る（${i + 1}枚目）`}
                className="block size-full"
              >
                <PlacePhotoImg place={place} index={i} size="mid" credit className="size-full" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {gallery !== null && <PhotoGallery place={place} start={gallery} onClose={closeGallery} />}
    </div>,
    document.body,
  );
}
