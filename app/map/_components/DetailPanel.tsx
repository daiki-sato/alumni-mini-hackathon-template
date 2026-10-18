"use client";

import { useEffect, useRef } from "react";
import { placeName, type Review } from "@/lib/jibunmap/place";
import {
  type AxisKey,
  axisObj,
  band,
  type Evidence,
  keyQuote,
  partyChance,
  reviewText,
  type Scored,
  verdict,
  type WordLists,
  whoText,
} from "@/lib/jibunmap/score";
import { Author, Highlighted } from "./Highlighted";
import { BackIcon } from "./Icons";
import { BAND_TEXT, GoogleRankBadge } from "./ListPanel";

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

function EvidenceList({ items, words }: { items: Evidence[]; words: WordLists }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1.5 grid gap-1 pl-1">
      {items.map((e) => (
        <li key={`${e.text}-${e.quote ?? ""}`} className="text-muted text-xs leading-relaxed">
          {e.quote ? (
            <>
              <span className="text-ink">
                「<Highlighted text={e.quote} words={words} />」
              </span>
              {e.author && (
                <span className="ml-1">
                  — <Author name={e.author} uri={e.authorUri} />
                </span>
              )}
            </>
          ) : (
            e.text
          )}
        </li>
      ))}
    </ul>
  );
}

/** 計算の内訳。±0 の行は出さない */
function PartsBars({ s, words }: { s: Scored; words: WordLists }) {
  // 横棒は左右に振り分け、25点で半分の幅
  const SCALE = 25;
  return (
    <ul className="grid gap-3">
      {s.parts
        .filter((p) => p.key === "base" || p.value !== 0)
        .map((p) => {
          const v = p.value;
          const w = Math.min(50, (Math.abs(v) / SCALE) * 50);
          const isBase = p.key === "base";
          return (
            <li key={p.key}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>{p.label}</span>
                <span
                  className={`font-bold tabular-nums ${
                    isBase ? "text-muted" : v > 0 ? "text-hi" : "text-lo"
                  }`}
                >
                  {isBase ? v : v > 0 ? `+${v}` : `−${Math.abs(v)}`}
                </span>
              </div>
              {!isBase && (
                <div className="relative mt-1 h-2 rounded-full bg-surface-2" aria-hidden="true">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                  <span
                    className={`absolute inset-y-0 rounded-full transition-all duration-500 ${v > 0 ? "bg-hi" : "bg-lo"}`}
                    style={
                      v > 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }
                    }
                  />
                </div>
              )}
              <EvidenceList items={p.reasons} words={words} />
            </li>
          );
        })}
      <li className="flex items-center justify-between border-line border-t pt-2 font-bold text-sm">
        <span>合計（0〜100に収める）</span>
        <span className="tabular-nums">{s.score}</span>
      </li>
    </ul>
  );
}

/** 並ぶ人の予想（ゲージと役目が重なるので、内訳の中に小さく置く） */
function Party({ s }: { s: Scored }) {
  const pc = partyChance(s.signals);
  return (
    <p className="text-muted text-xs leading-relaxed">
      前後に並ぶ組が「仲間」（うれしいワード側の客）である見込みは
      <b className="mx-0.5 text-ink tabular-nums">{Math.round(pc.good * 100)}%</b>。 うれしいワード
      {s.signals.good.length}語と NG ワード{s.signals.ng.length}語
      {s.signals.goodForGroups ? "・グループ向き" : ""}からの推定です（どちらも0なら50%）。
    </p>
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
        <span className="shrink-0 tabular-nums">
          {typeof r.rating === "number" ? `★${r.rating}` : ""}
          {r.relativePublishTimeDescription ? `・${r.relativePublishTimeDescription}` : ""}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">
        <Highlighted text={text} words={words} />
      </p>
    </li>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-line border-t pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 font-bold [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="inline-block text-muted text-xs transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/**
 * 店の詳細。並びは「結論（店名と点数）→ 人の一文 → 理由 → 決め手の口コミ → 内訳（畳む）→ 口コミ全文（畳む）」
 */
export function DetailPanel({
  s,
  rank,
  axes,
  words,
  demo,
  onBack,
}: {
  s: Scored;
  rank: number;
  axes: AxisKey[];
  words: WordLists;
  demo: boolean;
  onBack: () => void;
}) {
  const p = s.place;
  const kq = keyQuote(s);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // 開いたら見出しに移る（読み上げで店名から始まるように）。店ごとに作り直されるので、店が変わるたびに走る
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <article className="anim-panel-in px-4 pt-2 pb-8" aria-labelledby="detail-title">
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-surface/95 px-2 py-2 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          aria-label="一覧に戻る"
          className="grid size-10 place-items-center rounded-full hover:bg-surface-2"
        >
          <BackIcon />
        </button>
        <span className="truncate text-muted text-sm">一覧に戻る</span>
      </div>

      <header className="mt-1">
        {rank > 0 && (
          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 font-bold text-on-accent text-xs">
            今日の3軒・{rank}番
          </span>
        )}
        <div className="flex items-start justify-between gap-3">
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
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <GoogleRankBadge rank={p.googleRank} />
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted tabular-nums">
            口コミ{s.signals.reviewsUsed}件から判定
          </span>
          {typeof p.rating === "number" && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted tabular-nums">
              比較用: Google ★{p.rating.toFixed(1)}・{p.userRatingCount ?? 0}件
            </span>
          )}
        </div>
        {p.googleMapsUri && (
          <a
            href={p.googleMapsUri}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block rounded-full border border-line px-3 py-1 font-medium text-xs hover:bg-surface-2"
          >
            Google マップで開く ↗
          </a>
        )}
      </header>

      <p className="mt-4 rounded-2xl bg-accent-soft p-3 text-sm leading-relaxed">{whoText(s)}</p>
      {p.editorialSummary?.text && (
        <p className="mt-1.5 text-muted text-xs">Google による紹介: {p.editorialSummary.text}</p>
      )}

      {axes.length > 0 && (
        <section className="mt-4" aria-labelledby="why-title">
          <h2 id="why-title" className="font-bold text-sm">
            いまの判断軸で見ると
          </h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {axes.map((k) => {
              const a = axisObj(k);
              return a ? (
                <li key={k} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                  <span className="text-muted">{a.l}: </span>
                  {a.w(s)}
                </li>
              ) : null;
            })}
          </ul>
        </section>
      )}

      <section className="mt-4" aria-labelledby="quote-title">
        <h2 id="quote-title" className="font-bold text-sm">
          決め手の口コミ
        </h2>
        {kq?.quote ? (
          <blockquote className="mt-2 rounded-2xl bg-surface-2 p-3 text-sm leading-relaxed">
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

      <div className="mt-5 grid gap-3">
        <Fold title={`なぜ${s.score}点か`}>
          <PartsBars s={s} words={words} />
          <div className="mt-3">
            <Party s={s} />
          </div>
        </Fold>

        {p.reviews && p.reviews.length > 0 && (
          <Fold
            title={`口コミ全文（${demo ? "架空" : "Google マップ"}・${s.signals.reviewsUsed}件）`}
          >
            <p className="mb-2 text-muted text-xs">
              <mark className="rounded bg-hi-soft px-1 text-hi">緑</mark>
              はうれしいワード、
              <mark className="rounded bg-lo-soft px-1 text-lo">赤</mark>は NG ワード。
              すぐ後ろで打ち消された語（「入りにくい」など）は数えません。
            </p>
            <ul className="grid gap-2">
              {p.reviews.map((r, i) => (
                <ReviewItem key={r.name ?? `${r.publishTime}-${i}`} r={r} words={words} />
              ))}
            </ul>
          </Fold>
        )}
      </div>
    </article>
  );
}
