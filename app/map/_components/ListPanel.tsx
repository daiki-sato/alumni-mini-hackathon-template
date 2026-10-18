"use client";

import { useState } from "react";
import { DEMO_TOWNS } from "@/lib/jibunmap/demo";
import { OPEN_LABEL, openStatus } from "@/lib/jibunmap/hours";
import { type Place, placeName } from "@/lib/jibunmap/place";
import {
  band,
  constraintTags,
  keyQuote,
  type Scored,
  verdict,
  type WordLists,
} from "@/lib/jibunmap/score";
import { LIVE_EXAMPLES } from "@/lib/jibunmap/suggest";
import { Highlighted } from "./Highlighted";
import { CloseIcon, InfoIcon, MyLocationIcon, SearchIcon } from "./Icons";
import { PhotoCredit, PlacePhotoImg } from "./PlacePhotoImg";
import { MinScoreSlider } from "./PrefsSheet";

export const BAND_TEXT = { hi: "text-hi", mid: "text-mid", lo: "text-lo" } as const;
export const BAND_BG = { hi: "bg-hi-soft", mid: "bg-mid-soft", lo: "bg-lo-soft" } as const;

export function ScoreBadge({ v, size = "md" }: { v: number; size?: "md" | "lg" }) {
  const b = band(v);
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl font-bold tabular-nums ${BAND_BG[b]} ${BAND_TEXT[b]} ${
        size === "lg" ? "h-12 w-14 text-xl" : "h-9 w-11 text-base"
      }`}
      title="自分の意思で選ぶ人が集まる度"
    >
      {v}
    </span>
  );
}

/* ---------- 店のカード ---------- */

const OPEN_TONE = {
  open: "bg-hi-soft text-hi",
  closing: "bg-mid-soft text-mid",
  closed: "bg-surface-2 text-muted",
} as const;

/** 営業中・もうすぐ閉店・営業時間外のバッジ。取ってある営業時間から手元で計算する（分からなければ出さない） */
export function OpenBadge({ place, className = "" }: { place: Place; className?: string }) {
  const st = openStatus(place.regularOpeningHours?.periods, new Date());
  if (!st) return null;
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-1.5 py-px font-bold text-[11px] ${OPEN_TONE[st]} ${className}`}
    >
      {OPEN_LABEL[st]}
    </span>
  );
}

/** Google の並び順。デモのデータ（順番がない）では出さない */
export function GoogleRankBadge({ rank }: { rank?: number }) {
  if (!rank) return null;
  return (
    <span className="inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted tabular-nums">
      Google の検索結果では{rank}番目
    </span>
  );
}

type CardProps = {
  s: Scored;
  hot: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

function hoverProps({ s, onHover }: Pick<CardProps, "s" | "onHover">) {
  return {
    onMouseEnter: () => onHover(s.place.id),
    onMouseLeave: () => onHover(null),
    onFocus: () => onHover(s.place.id),
    onBlur: () => onHover(null),
  };
}

function TopCard({
  s,
  rank,
  words,
  hot,
  onSelect,
  onHover,
}: CardProps & { rank: number; words: WordLists }) {
  // タグは2つまで（NG が出ていればそれを先に）
  const tags = [
    ...(s.signals.ng.length ? [{ t: "NGワードあり", ng: true }] : []),
    ...constraintTags(s.signals).map((t) => ({ t, ng: false })),
  ].slice(0, 2);
  const kq = keyQuote(s);
  const photo = s.place.photos?.[0];
  const credit = !!photo?.authorAttributions.length;
  return (
    <li className="relative min-w-0">
      <button
        type="button"
        data-place-card={s.place.id}
        onClick={() => onSelect(s.place.id)}
        {...hoverProps({ s, onHover })}
        className={`group flex h-full w-full gap-3 rounded-2xl border bg-surface p-3 text-left shadow-e1 transition hover:shadow-e2 ${
          hot ? "border-brand ring-1 ring-brand" : "border-line"
        }`}
      >
        <span className="flex w-16 shrink-0 flex-col">
          <span className="relative size-16">
            <PlacePhotoImg place={s.place} size="thumb" className="size-16 rounded-xl" />
            <span className="absolute -top-1.5 -left-1.5 grid size-7 place-items-center rounded-full border-2 border-surface bg-accent font-bold text-on-accent text-sm tabular-nums">
              {rank}
            </span>
          </span>
          {/* 写真の帰属表示を置く場所（リンクはボタンの中に置けないので、下で重ねる） */}
          {credit && <span className="h-4" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold group-hover:underline">
            {placeName(s.place)}
          </span>
          {/* 住所は詳細だけに出す。カードはジャンルと営業状況 */}
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-muted text-xs">
            <span className="truncate">{s.place.primaryTypeDisplayName?.text ?? "飲食店"}</span>
            <OpenBadge place={s.place} />
          </span>
          {s.place.googleRank && (
            <span className="mt-1 block">
              <GoogleRankBadge rank={s.place.googleRank} />
            </span>
          )}
          {kq?.quote && (
            <span className="mt-1.5 block truncate text-xs">
              「<Highlighted text={kq.quote} words={words} />」
            </span>
          )}
          {tags.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {tags.map(({ t, ng }) => (
                <span
                  key={t}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    ng ? "bg-lo-soft text-lo" : "bg-surface-2 text-muted"
                  }`}
                >
                  {t}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <ScoreBadge v={s.score} />
          <span className={`whitespace-nowrap font-bold text-[11px] ${BAND_TEXT[band(s.score)]}`}>
            {verdict(s.score)}
          </span>
        </span>
      </button>
      {credit && (
        // 写真の帰属表示（規約で必要）。カードの中、写真の直下に1行で
        <PhotoCredit photo={photo} className="absolute bottom-2 left-3 w-16" />
      )}
    </li>
  );
}

/** 4位以下の小さめの行。写真は小さいサムネイル（160px）で、行が画面に入ったときだけ読む */
function Row({
  s,
  rank,
  words,
  hot,
  onSelect,
  onHover,
}: CardProps & { rank: number; words: WordLists }) {
  const kq = keyQuote(s);
  const photo = s.place.photos?.[0];
  const credit = !!photo?.authorAttributions.length;
  return (
    <li className="relative min-w-0">
      <button
        type="button"
        data-place-card={s.place.id}
        onClick={() => onSelect(s.place.id)}
        {...hoverProps({ s, onHover })}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-2 ${
          hot ? "bg-surface-2 ring-1 ring-brand" : ""
        }`}
      >
        <span className="flex w-12 shrink-0 flex-col">
          <span className="relative size-12">
            <PlacePhotoImg place={s.place} size="thumb" className="size-12 rounded-lg" />
            <span className="absolute -top-1 -left-1 grid size-6 place-items-center rounded-full border-2 border-surface bg-surface-2 font-bold text-[11px] text-ink tabular-nums">
              {rank}
            </span>
          </span>
          {credit && <span className="h-3.5" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] md:text-sm">{placeName(s.place)}</span>
          <span className="block truncate text-muted text-xs">
            {s.place.primaryTypeDisplayName?.text ?? "飲食店"}
            {s.place.googleRank ? `・Google の検索結果では${s.place.googleRank}番目` : ""}
            <OpenBadge place={s.place} className="ml-1.5" />
          </span>
          {kq?.quote && (
            <span className="mt-0.5 block truncate text-xs">
              「<Highlighted text={kq.quote} words={words} />」
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <ScoreBadge v={s.score} />
          <span className={`whitespace-nowrap font-bold text-[11px] ${BAND_TEXT[band(s.score)]}`}>
            {verdict(s.score)}
          </span>
        </span>
      </button>
      {credit && (
        // 写真の帰属表示（規約で必要）。リンクはボタンの中に置けないので、サムネイルの直下に重ねる
        <PhotoCredit photo={photo} className="absolute bottom-1.5 left-2 w-12 text-[10px]" />
      )}
    </li>
  );
}

function Skeleton() {
  return (
    <ul className="grid gap-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />
      ))}
    </ul>
  );
}

/** スマホの地図全画面で、ピンを押したときに下に出す小さなカード（タップで詳細） */
export function PeekCard({
  s,
  rank,
  words,
  onOpen,
  onClose,
}: {
  s: Scored;
  rank: number;
  words: WordLists;
  onOpen: () => void;
  onClose: () => void;
}) {
  const kq = keyQuote(s);
  return (
    <div className="anim-pop-in relative rounded-2xl border border-line bg-surface shadow-e2">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 p-3 pr-12 text-left"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-bold text-on-accent tabular-nums">
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-[15px]">{placeName(s.place)}</span>
          <span className={`block font-bold text-xs ${BAND_TEXT[band(s.score)]}`}>
            {s.score}点・{verdict(s.score)}
          </span>
          {kq?.quote && (
            <span className="mt-0.5 block truncate text-xs">
              「<Highlighted text={kq.quote} words={words} />」
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="カードを閉じる"
        className="absolute top-1 right-1 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}

/* ---------- 一覧パネル ---------- */

/** 上位いくつを、写真つきの大きめのカードにするか */
export const BIG_CARDS = 3;

export function ListPanel({
  demo,
  busy,
  title,
  status,
  ranked,
  words,
  hoverId,
  onOpenPrefs,
  onSelect,
  onHover,
  onPickExample,
  onNear,
  minScore,
  onMinScore,
  hidden,
  hiddenWhy,
  onShowAll,
  genreLabel,
  genreEmpty,
  onGenreSearch,
  nearby,
  onSearchArea,
}: {
  demo: boolean;
  /** 前の検索が終わったら探す語 */
  busy: string | null;
  title: string | null;
  status: { kind: "idle" | "loading" | "ok" } | { kind: "error"; message: string };
  /** 点数の高い順に並べた全件 */
  ranked: Scored[];
  words: WordLists;
  hoverId: string | null;
  /** マイ条件の画面を開く */
  onOpenPrefs: () => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onPickExample: (q: string) => void;
  /** 現在地の近くで探す（デモでは null） */
  onNear: (() => void) | null;
  /** 表示する最低点（0 なら全部） */
  minScore: number;
  onMinScore: (v: number) => void;
  /** 最低点で隠している件数（一時的に全部出しているときは 0） */
  hidden: number;
  /** 隠している理由（例: ほかのジャンル・60点未満） */
  hiddenWhy: string;
  onShowAll: () => void;
  /** 選んでいるジャンル（なければ null） */
  genreLabel: string | null;
  /** 選んだジャンルが今の結果に1軒もない */
  genreEmpty: boolean;
  onGenreSearch: () => void;
  /** 隣の街で同じジャンルを探す語（「もっと探す」に出す。デモでは空） */
  nearby: string[];
  /** 地図のいまの範囲で探し直す（範囲がまだないときは null） */
  onSearchArea: (() => void) | null;
}) {
  const [sliderOpen, setSliderOpen] = useState(false);
  const total = ranked.length;
  // 読み上げ: 件数と検索の状態だけを、静かに伝える
  const live =
    status.kind === "loading"
      ? `「${title ?? ""}」を検索しています`
      : status.kind === "error"
        ? status.message
        : title
          ? `${title}の店 ${total}軒を、点数の高い順に出しました`
          : "";
  return (
    <div className="anim-panel-in grid min-w-0 grid-cols-1 gap-5 px-4 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-4 md:pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="min-w-0">
        <p className="sr-only" aria-live="polite">
          {live}
        </p>
        {title ? (
          <>
            <h1 className="font-bold text-xl">{title}</h1>
            <p className="mt-0.5 text-muted text-sm tabular-nums">
              {status.kind === "loading" ? "検索しています…" : `${total}軒`}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-bold text-xl">行きたい街を検索</h1>
            <p className="mt-0.5 text-[15px] text-muted md:text-sm">
              上の検索欄に「街 + 食べたいもの」を入れて検索。
            </p>
          </>
        )}
        <div aria-live="polite">
          {busy && (
            <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-xs">
              前の検索が終わったら「{busy}」を探します。
            </p>
          )}
        </div>
        {/* 初めて来た人のために1行だけ。条件の編集は別の画面（マイ条件） */}
        <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-accent-soft px-3 py-1.5 text-xs">
          <InfoIcon className="size-4 shrink-0 text-mid" />
          <span>
            あなたの条件で並べています（
            <button
              type="button"
              onClick={onOpenPrefs}
              className="-my-2 inline-flex min-h-10 items-center font-bold underline"
            >
              マイ条件
            </button>
            で変更）
          </span>
        </p>
      </header>

      {demo && (
        <nav aria-label="サンプルの街" className="min-w-0">
          <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4">
            {DEMO_TOWNS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={title === t.name}
                onClick={() => onPickExample(t.name)}
                className={`h-10 shrink-0 rounded-full border px-3 text-[13px] md:h-8 ${
                  title === t.name
                    ? "border-accent bg-accent-soft font-bold"
                    : "border-line hover:bg-surface-2"
                }`}
              >
                {t.name}
                <span className="ml-1 text-muted text-xs">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      <section
        className="min-w-0"
        aria-labelledby="list-title"
        aria-busy={status.kind === "loading"}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="list-title" className="font-bold">
            点数の高い順
            {genreLabel && (
              <span className="ml-1.5 font-normal text-muted text-sm">・{genreLabel}</span>
            )}
          </h2>
          <button
            type="button"
            aria-expanded={sliderOpen}
            aria-controls="min-score-inline-box"
            onClick={() => setSliderOpen((v) => !v)}
            className="inline-flex h-10 items-center rounded-full border border-line px-3.5 font-medium text-[13px] tabular-nums hover:bg-surface-2 md:h-8"
          >
            {minScore ? `${minScore}点以上` : "すべての点数"}
          </button>
        </div>
        {sliderOpen && (
          <div id="min-score-inline-box" className="rounded-2xl bg-surface-2 px-3 pb-3">
            <MinScoreSlider id="min-score-inline" value={minScore} onChange={onMinScore} />
          </div>
        )}
        {hidden > 0 && status.kind === "ok" && (
          <button
            type="button"
            onClick={onShowAll}
            className="mt-1 inline-flex min-h-10 items-center text-muted text-xs underline"
          >
            {hidden}軒を非表示（{hiddenWhy}）・押すと一時的に全部表示
          </button>
        )}
        <div className="mt-2">
          {status.kind === "loading" ? (
            <Skeleton />
          ) : status.kind === "error" ? (
            <p className="rounded-2xl bg-lo-soft p-4 text-lo text-sm">{status.message}</p>
          ) : total ? (
            <ol className="grid min-w-0 grid-cols-1 gap-2">
              {ranked.map((s, i) =>
                i < BIG_CARDS ? (
                  <TopCard
                    key={s.place.id}
                    s={s}
                    rank={i + 1}
                    words={words}
                    hot={hoverId === s.place.id}
                    onSelect={onSelect}
                    onHover={onHover}
                  />
                ) : (
                  <Row
                    key={s.place.id}
                    s={s}
                    rank={i + 1}
                    words={words}
                    hot={hoverId === s.place.id}
                    onSelect={onSelect}
                    onHover={onHover}
                  />
                ),
              )}
            </ol>
          ) : (
            <div className="rounded-2xl bg-surface-2 p-4 text-sm">
              {title && genreEmpty ? (
                <>
                  <p className="text-muted">「{genreLabel}」は今の結果にありません。</p>
                  <button
                    type="button"
                    onClick={onGenreSearch}
                    className="mt-2 h-10 rounded-full bg-brand px-4 font-bold text-on-brand text-sm hover:opacity-90"
                  >
                    このジャンルで検索し直す
                  </button>
                </>
              ) : title ? (
                <p className="text-muted">
                  {hidden > 0
                    ? `${minScore}点以上の店はありません。最低点を下げるか、上のボタンで全部表示できます。`
                    : "店が見つかりませんでした。別の街で探してください。"}
                </p>
              ) : (
                <>
                  <p className="text-[15px] text-muted md:text-sm">
                    検索すると、点数の高い順にここに並びます。例から試せます。
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="検索の例">
                    {onNear && (
                      <li>
                        <button
                          type="button"
                          onClick={onNear}
                          className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 font-medium text-[13px] hover:bg-surface-3"
                        >
                          <MyLocationIcon className="size-4" />
                          現在地の近くで探す
                        </button>
                      </li>
                    )}
                    {LIVE_EXAMPLES.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => onPickExample(q)}
                          className="h-10 rounded-full border border-line bg-surface px-3.5 text-[13px] hover:bg-surface-3"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {status.kind === "ok" && total > 0 && (nearby.length > 0 || onSearchArea) && (
        <section className="min-w-0 rounded-2xl bg-surface-2 p-4" aria-labelledby="more-title">
          <h2 id="more-title" className="font-bold text-[15px] md:text-sm">
            もっと探す
          </h2>
          <p className="mt-0.5 text-muted text-xs">
            Google の検索は1回20件までです。近くの街や、地図の範囲を変えて探せます。
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {nearby.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => onPickExample(q)}
                  className="h-10 rounded-full border border-line bg-surface px-3.5 text-[13px] hover:bg-surface-3"
                >
                  {q}
                </button>
              </li>
            ))}
            {onSearchArea && (
              <li>
                <button
                  type="button"
                  onClick={onSearchArea}
                  className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] hover:bg-surface-3"
                >
                  <SearchIcon className="size-4" />
                  地図のこのエリアで再検索
                </button>
              </li>
            )}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-muted leading-relaxed">
        {demo
          ? "サンプルのデータです。街・店名・口コミ・数値はすべて架空です。"
          : "店舗情報と口コミ・写真: Google マップ。並び順と点数はジブンマップが計算したものです。"}
      </p>
    </div>
  );
}
