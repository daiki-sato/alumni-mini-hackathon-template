"use client";

import { useMemo } from "react";
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
    <span className={`block truncate text-[10px] text-muted ${className}`}>
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
 * 店の写真1枚。画像を1枚読むごとに課金されるので、今日の3軒のサムネイルと詳細（最大4枚）だけで使う。
 * セッションの上限を超えたら、写真の代わりにジャンルのアイコンを出す
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
  size: "thumb" | "large";
  className?: string;
  /** 写真の下に帰属表示を出すか（サムネイルでは呼ぶ側がまとめて出す） */
  credit?: boolean;
}) {
  const photo = place.photos?.[index];
  const url = photo ? (size === "thumb" ? photo.thumb : photo.large) : null;
  // 上限の確認は URL ごとに1回（描画のたびに数え直さない）
  const ok = useMemo(() => (url ? photoAllowed(url) : false), [url]);
  if (!url || !ok) {
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
    <figure className={`relative m-0 overflow-hidden bg-surface-2 ${className}`}>
      {/* biome-ignore lint/performance/noImgElement: Places の写真 URL は外部のもので、next/image の remotePatterns（next.config）を変えないため */}
      <img
        src={url}
        alt={`${place.displayName?.text ?? "店"}の写真`}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
      />
      {credit && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-black/45 px-2 py-0.5 [&_*]:text-white">
          <PhotoCredit photo={photo} />
        </figcaption>
      )}
    </figure>
  );
}
