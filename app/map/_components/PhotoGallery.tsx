"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Place } from "@/lib/jibunmap/place";
import { BackIcon, CloseIcon } from "./Icons";
import { PhotoCredit, PlacePhotoImg } from "./PlacePhotoImg";

/**
 * 写真の全画面ギャラリー。開いた写真だけを大きいサイズ（最大 1200px）で読む。
 * スマホは左右スワイプ、デスクトップは ← → とボタンで送る。Esc・×・ブラウザの戻るで閉じる
 * （開くときに履歴を1つ積み、URL に &photo= を足す）
 */
export function PhotoGallery({
  place,
  start,
  onClose,
}: {
  place: Place;
  start: number;
  onClose: () => void;
}) {
  const photos = place.photos ?? [];
  const [i, setI] = useState(start);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  /** StrictMode で effect が2回走っても、履歴は1つだけ積む */
  const pushed = useRef(false);
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), []);
  const next = useCallback(() => setI((x) => Math.min(photos.length - 1, x + 1)), [photos.length]);

  /** 閉じるときは、開くときに積んだ履歴を戻る（popstate で onClose が呼ばれる） */
  const close = useCallback(() => window.history.back(), []);

  // 開いたら履歴を積む。ブラウザの戻るで閉じる
  useEffect(() => {
    if (!pushed.current) {
      pushed.current = true;
      const u = new URL(window.location.href);
      u.searchParams.set("photo", String(start));
      window.history.pushState(null, "", `${u.pathname}${u.search}`);
    }
    const onPop = () => {
      if (!new URLSearchParams(window.location.search).has("photo")) onClose();
    };
    window.addEventListener("popstate", onPop);
    closeRef.current?.focus();
    return () => window.removeEventListener("popstate", onPop);
  }, [start, onClose]);

  // キー操作。詳細を閉じる Escape より先に受けて止める（capture で受け、preventDefault する）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, prev, next]);

  const photo = photos[i];
  if (!photo) return null;
  // body に出す（パネルの中だと、親の transform や重なり順に閉じ込められて全画面にならない）
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${place.displayName?.text ?? "店"}の写真`}
      className="fixed inset-0 z-[100] box-border flex w-full max-w-full flex-col overflow-x-clip bg-black text-white"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const x0 = touchX.current;
        const x1 = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (x0 === null || x1 === undefined) return;
        if (x1 - x0 > 50) prev();
        else if (x0 - x1 > 50) next();
      }}
    >
      <div className="flex items-center justify-end pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))]">
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="写真を閉じる"
          className="grid size-11 place-items-center rounded-full hover:bg-white/15"
        >
          <CloseIcon className="size-6" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <PlacePhotoImg
          key={photo.full}
          place={place}
          index={i}
          size="full"
          credit={false}
          className="absolute inset-0 size-full bg-black"
        />
        {i > 0 && (
          <button
            type="button"
            onClick={prev}
            aria-label="前の写真"
            className="absolute top-1/2 left-2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/70"
          >
            <BackIcon className="size-6" />
          </button>
        )}
        {i < photos.length - 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="次の写真"
            className="absolute top-1/2 right-2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/70"
          >
            <BackIcon className="size-6 rotate-180" />
          </button>
        )}
      </div>
      {/* 写真の帰属表示（規約で必要）。拡大画面でも左下に出す */}
      <div className="px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] [&_*]:text-white">
        <PhotoCredit photo={photo} />
      </div>
    </div>,
    document.body,
  );
}
