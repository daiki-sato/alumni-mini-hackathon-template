"use client";

import { useEffect, useRef, useState } from "react";
import { photoAllowed } from "@/lib/jibunmap/google";
import type { Place, PlacePhoto } from "@/lib/jibunmap/place";

/** 写真がないとき（デモ・写真なし・上限超え）に出す、ジャンルのアイコン */
function genreIcon(p: Place): string {
  const t = `${p.primaryType ?? ""} ${p.primaryTypeDisplayName?.text ?? ""}`;
  if (/ramen|ラーメン|noodle|そば|うどん/.test(t)) return "🍜";
  if (/cafe|coffee|tea|喫茶|カフェ/.test(t)) return "☕";
  if (/bakery|パン|ベーカリー/.test(t)) return "🥐";
  if (/chinese|dumpling|中華|餃子/.test(t)) return "🥟";
  if (/indian|curry|カレー/.test(t)) return "🍛";
  if (/sushi|寿司/.test(t)) return "🍣";
  if (/bar|pub|izakaya|居酒屋/.test(t)) return "🍶";
  return "🍽";
}

/** 写真の帰属表示（Google の規約で、写真の近くに出す） */
export function PhotoCredit({ photo, className = "" }: { photo?: PlacePhoto; className?: string }) {
  const a = photo?.authorAttributions ?? [];
  if (!a.length) return null;
  return (
    <span className={`block truncate text-[11px] text-muted leading-tight ${className}`}>
      写真:{" "}
      {a.map((x, i) => (
        <span key={x.displayName}>
          {i > 0 && "、"}
          {x.uri ? (
            <a href={x.uri} target="_blank" rel="noreferrer noopener" className="underline">
              {x.displayName}
            </a>
          ) : (
            x.displayName
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * 店の写真1枚。画像を1枚読むごとに課金されるので、上位3つのサムネイルと詳細・拡大でだけ使う。
 * 画面に入ってから初めて上限を確かめて読む（見ない写真は数えず、読みもしない）。
 * 1日の上限を超えたら、写真の代わりにジャンルのアイコンを出す
 */
export function PlacePhotoImg({
  place,
  index = 0,
  size,
  className = "",
  credit = size === "large",
}: {
  place: Place;
  index?: number;
  size: "thumb" | "mid" | "large" | "full";
  className?: string;
  /** 写真の下に帰属表示を出すか（サムネイルでは呼ぶ側がまとめて出す） */
  credit?: boolean;
}) {
  const photo = place.photos?.[index];
  const url = photo ? photo[size] : null;
  const ref = useRef<HTMLElement>(null);
  // "wait": 画面の外 → "loading": 読み込み中 → "done" / "failed"（上限超えも failed）
  const [state, setState] = useState<"wait" | "loading" | "done" | "failed">("wait");

  // 画面に入ったら、上限を確かめてから読む
  useEffect(() => {
    const el = ref.current;
    if (!url || !el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setState(photoAllowed(url) ? "loading" : "failed");
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [url]);

  if (!url || state === "failed") {
    return (
      <span
        className={`grid place-items-center bg-surface-2 ${size === "thumb" ? "text-2xl" : "text-5xl"} ${className}`}
        aria-hidden="true"
      >
        {genreIcon(place)}
      </span>
    );
  }
  return (
    <figure
      ref={ref}
      className={`relative m-0 overflow-hidden bg-surface-2 ${state !== "done" ? "jm-shimmer" : ""} ${className}`}
    >
      {state !== "wait" && (
        // biome-ignore lint/performance/noImgElement: Places の写真 URL は外部のもので、next/image の remotePatterns（next.config）を変えないため
        <img
          src={url}
          alt={`${place.displayName?.text ?? "店"}の写真`}
          // キャッシュ済みの画像は onLoad より先に読み終わることがあるので、付いた時点でも確かめる
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0) setState("done");
          }}
          loading="lazy"
          decoding="async"
          onLoad={() => setState("done")}
          onError={() => setState("failed")}
          className={`size-full transition-opacity ${size === "full" ? "object-contain" : "object-cover"} ${state === "done" ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {credit && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-black/45 px-2 py-0.5 [&_*]:text-white">
          <PhotoCredit photo={photo} />
        </figcaption>
      )}
    </figure>
  );
}
