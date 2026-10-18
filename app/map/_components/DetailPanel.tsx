"use client";

import { useEffect, useRef } from "react";
import { type Money, type Place, placeName, type Review } from "@/lib/jibunmap/place";
import {
  band,
  keyQuote,
  partyText,
  reasonChips,
  reviewText,
  type Scored,
  verdict,
  type WordLists,
  whoText,
} from "@/lib/jibunmap/score";
import { Author, Highlighted } from "./Highlighted";
import { BackIcon } from "./Icons";
import { BAND_TEXT, GoogleRankBadge } from "./ListPanel";
import { PlacePhotoImg } from "./PlacePhotoImg";

const BAND_COLOR = { hi: "var(--hi)", mid: "var(--mid)", lo: "var(--lo)" } as const;

/** 小さな半円のゲージ（店名の横に置く） */
function Gauge({ v }: { v: number }) {
  const b = band(v);
  // 半円（左端から右端まで、長さ π×r）
  const r = 80;
  const len = Math.PI * r;
  return (
    <div className="relative w-24 shrink-0" title="自分の意思で選ぶ人が集まる度">
      <svg viewBox="0 0 200 112" className="w-full" aria-hidden="true">
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={18}
          strokeLinecap="round"
        />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={BAND_COLOR[b]}
          strokeWidth={18}
          strokeLinecap="round"
          strokeDasharray={`${(len * v) / 100} ${len}`}
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className={`font-bold text-2xl tabular-nums leading-none ${BAND_TEXT[b]}`}>{v}</div>
        <div className="text-[10px] text-muted">/ 100</div>
      </div>
    </div>
  );
}

function ReviewItem({ r, words }: { r: Review; words: WordLists }) {
  const text = reviewText(r);
  if (!text) return null;
  return (
    <li className="rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2 text-muted text-xs">
        <span className="truncate">
          <Author name={r.authorAttribution?.displayName} uri={r.authorAttribution?.uri} />
        </span>
        {r.relativePublishTimeDescription && (
          <span className="shrink-0">{r.relativePublishTimeDescription}</span>
        )}
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed md:text-sm">
        <Highlighted text={text} words={words} />
      </p>
    </li>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-line border-t pt-2">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg font-bold [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="inline-block text-muted text-xs transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        {title}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function yen(m?: Money): string | null {
  if (!m?.units) return null;
  const n = Number(m.units);
  if (!Number.isFinite(n)) return null;
  return m.currencyCode && m.currencyCode !== "JPY"
    ? `${n.toLocaleString("ja-JP")} ${m.currencyCode}`
    : `¥${n.toLocaleString("ja-JP")}`;
}

const PRICE_WORD: Record<string, string> = {
  PRICE_LEVEL_FREE: "無料",
  PRICE_LEVEL_INEXPENSIVE: "安め",
  PRICE_LEVEL_MODERATE: "ふつう",
  PRICE_LEVEL_EXPENSIVE: "高め",
  PRICE_LEVEL_VERY_EXPENSIVE: "とても高い",
};

function priceText(p: Place): string | null {
  const lo = yen(p.priceRange?.startPrice);
  const hi = yen(p.priceRange?.endPrice);
  if (lo) return hi ? `${lo}〜${hi}` : `${lo}〜`;
  return p.priceLevel ? (PRICE_WORD[p.priceLevel] ?? null) : null;
}

/** 営業時間。今日の分を強調し、全曜日は畳む（Google の文言は月曜始まり） */
function Hours({ list }: { list: string[] }) {
  const today = (new Date().getDay() + 6) % 7;
  const t = list[today];
  return (
    <div>
      {t && (
        <p className="text-[15px] md:text-sm">
          <b>今日</b> {t.replace(/^[^:：]+[:：]\s*/, "")}
        </p>
      )}
      <details className="mt-1">
        <summary className="inline-flex min-h-10 cursor-pointer items-center text-muted text-xs underline">
          すべての曜日
        </summary>
        <ul className="mt-1 grid gap-0.5 text-xs">
          {list.map((d, i) => (
            <li key={d} className={i === today ? "font-bold" : "text-muted"}>
              {d}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** 経路の URL（Google マップの経路検索。店名と place_id で目的地を決める） */
export function directionsUrl(p: Place): string {
  const q = new URLSearchParams({
    api: "1",
    destination: placeName(p),
    destination_place_id: p.id,
  });
  return `https://www.google.com/maps/dir/?${q}`;
}

/**
 * 店の詳細。並びは「写真 → 店名・点数・ひと言の評価 → 人の一文 → 理由 → 決め手の口コミ →
 * 店の情報 → 経路 → 口コミ全文（畳む）」。数値は点数（と Google の検索結果での順番）だけ出す
 */
export function DetailPanel({
  s,
  rank,
  words,
  demo,
  sceneNote,
  onBack,
}: {
  s: Scored;
  rank: number;
  words: WordLists;
  demo: boolean;
  /** 友だちとモードで外した語の説明（なければ null） */
  sceneNote: string | null;
  onBack: () => void;
}) {
  const p = s.place;
  const kq = keyQuote(s);
  const chips = reasonChips(s);
  const price = priceText(p);
  const hours = p.regularOpeningHours?.weekdayDescriptions ?? [];
  const headingRef = useRef<HTMLHeadingElement>(null);

  // 開いたら見出しに移る（読み上げで店名から始まるように）。店ごとに作り直されるので、店が変わるたびに走る
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <article
      className="anim-panel-in px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]"
      aria-labelledby="detail-title"
    >
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-1 bg-surface/95 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 items-center gap-1 rounded-full pr-4 pl-2 font-medium text-[15px] hover:bg-surface-2 md:text-sm"
        >
          <BackIcon />
          戻る
        </button>
      </div>

      {/* 写真（最大4枚、横スクロール）。デモではジャンルのアイコンを置く */}
      <div className="scrollbar-none -mx-4 mt-1 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4">
        {demo || !p.photos?.length ? (
          <PlacePhotoImg place={p} size="large" className="h-44 w-full shrink-0 rounded-2xl" />
        ) : (
          p.photos.map((ph, i) => (
            <PlacePhotoImg
              key={ph.large}
              place={p}
              index={i}
              size="large"
              className="h-44 w-[78%] shrink-0 snap-start rounded-2xl md:w-[85%]"
            />
          ))
        )}
      </div>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {rank > 0 && (
            <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 font-bold text-on-accent text-xs">
              {rank}位
            </span>
          )}
          <GoogleRankBadge rank={p.googleRank} />
        </div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              id="detail-title"
              ref={headingRef}
              tabIndex={-1}
              className="font-bold text-2xl leading-tight outline-none"
            >
              {placeName(p)}
            </h1>
            <p className="mt-1 text-muted text-sm">
              {p.primaryTypeDisplayName?.text ?? "飲食店"}
              {p.formattedAddress ? `・${p.formattedAddress}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center">
            <Gauge v={s.score} />
            <span className={`mt-0.5 font-bold text-xs ${BAND_TEXT[band(s.score)]}`}>
              {verdict(s.score)}
            </span>
          </div>
        </div>
      </header>

      <div className="mt-3 rounded-2xl bg-accent-soft p-3 text-[15px] leading-relaxed md:text-sm">
        <p>{whoText(s)}</p>
        <p className="mt-1">{partyText(s)}。</p>
      </div>
      {p.editorialSummary?.text && (
        <p className="mt-1.5 text-muted text-xs">Google による紹介: {p.editorialSummary.text}</p>
      )}

      {(chips.length > 0 || sceneNote) && (
        <section className="mt-4" aria-label="点数を動かした理由">
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <li
                key={`${c.tone}-${c.text}`}
                className={`rounded-full px-3 py-1 text-[13px] ${
                  c.tone === "plus" ? "bg-hi-soft text-hi" : "bg-lo-soft text-lo"
                }`}
              >
                {c.text}
              </li>
            ))}
          </ul>
          {sceneNote && <p className="mt-2 text-muted text-xs">{sceneNote}</p>}
        </section>
      )}

      <section className="mt-4" aria-labelledby="quote-title">
        <h2 id="quote-title" className="font-bold text-sm">
          決め手の口コミ
        </h2>
        {kq?.quote ? (
          <blockquote className="mt-2 rounded-2xl bg-surface-2 p-3 text-[15px] leading-relaxed md:text-sm">
            「<Highlighted text={kq.quote} words={words} />」
            {kq.author && (
              <span className="ml-1 text-muted text-xs">
                — <Author name={kq.author} uri={kq.authorUri} />
              </span>
            )}
          </blockquote>
        ) : (
          <p className="mt-2 text-muted text-sm">うれしいワードが出た口コミはありません。</p>
        )}
      </section>

      {(hours.length > 0 || price || p.nationalPhoneNumber || p.websiteUri) && (
        <section className="mt-4 grid gap-2 border-line border-t pt-3" aria-label="店の情報">
          {hours.length > 0 && <Hours list={hours} />}
          {price && (
            <p className="text-[15px] md:text-sm">
              <b>価格帯</b> {price}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {p.nationalPhoneNumber && (
              <a
                href={`tel:${p.nationalPhoneNumber.replace(/[^\d+]/g, "")}`}
                className="inline-flex h-10 items-center rounded-full border border-line px-3.5 text-sm hover:bg-surface-2"
              >
                電話 {p.nationalPhoneNumber}
              </a>
            )}
            {p.websiteUri && (
              <a
                href={p.websiteUri}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-10 items-center rounded-full border border-line px-3.5 text-sm hover:bg-surface-2"
              >
                Web サイト ↗
              </a>
            )}
          </div>
        </section>
      )}

      {!demo && (
        <a
          href={directionsUrl(p)}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 flex h-11 items-center justify-center rounded-full bg-brand font-bold text-on-brand text-sm hover:opacity-90"
        >
          経路を見る（Google マップ）
        </a>
      )}

      {p.reviews && p.reviews.length > 0 && (
        <div className="mt-4">
          <Fold title={`口コミ全文（${demo ? "架空" : "Google マップ"}）`}>
            <p className="mb-2 text-muted text-xs">
              この口コミから判定しています。
              <mark className="jm-mark-good">緑</mark>
              はうれしいワード、
              <mark className="jm-mark-ng">赤</mark>は NG ワード。
              すぐ後ろで打ち消された語（「入りにくい」など）は数えません。
            </p>
            <ul className="grid gap-2">
              {p.reviews.map((r, i) => (
                <ReviewItem key={r.name ?? `${r.publishTime}-${i}`} r={r} words={words} />
              ))}
            </ul>
          </Fold>
        </div>
      )}
    </article>
  );
}
