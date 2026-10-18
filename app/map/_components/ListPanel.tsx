"use client";

import { useState } from "react";
import { DEMO_TOWNS } from "@/lib/jibunmap/demo";
import { placeName } from "@/lib/jibunmap/place";
import {
  band,
  constraintTags,
  keyQuote,
  MAX_WORD_LENGTH,
  MAX_WORDS,
  type Scored,
  verdict,
  type WordLists,
} from "@/lib/jibunmap/score";
import { LIVE_EXAMPLES } from "@/lib/jibunmap/suggest";
import { Highlighted } from "./Highlighted";
import { CloseIcon, InfoIcon, PlusIcon } from "./Icons";
import { PhotoCredit, PlacePhotoImg } from "./PlacePhotoImg";
import type { Prefs } from "./usePrefs";

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

/* ---------- 語のリスト ---------- */

function WordEditor({
  title,
  hint,
  kind,
  words,
  onChange,
}: {
  title: string;
  hint: string;
  kind: "good" | "ng";
  words: string[];
  onChange: (w: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState("");
  const tone =
    kind === "good" ? "bg-hi-soft text-hi border-hi/30" : "bg-lo-soft text-lo border-lo/30";

  function add() {
    const w = draft.trim();
    if (!w) return;
    if (words.includes(w)) return setMsg(`「${w}」はもう入っています`);
    if (words.length >= MAX_WORDS) return setMsg(`${MAX_WORDS}語までです`);
    onChange([...words, w]);
    setDraft("");
    setMsg("");
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold text-sm">{title}</h3>
        <span className="text-muted text-xs">{hint}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={title}>
        {words.map((w) => (
          <li
            key={w}
            className={`flex items-center gap-0.5 rounded-full border py-0.5 pr-0.5 pl-2.5 text-[13px] ${tone}`}
          >
            {w}
            <button
              type="button"
              aria-label={`「${w}」を${title}から外す`}
              onClick={() => onChange(words.filter((x) => x !== w))}
              className="-my-1.5 grid size-10 place-items-center rounded-full hover:bg-black/10 md:my-0 md:size-6 dark:hover:bg-white/10"
            >
              <CloseIcon className="size-3.5" />
            </button>
          </li>
        ))}
        {!words.length && <li className="text-muted text-xs">まだありません</li>}
      </ul>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setMsg("");
          }}
          maxLength={MAX_WORD_LENGTH}
          aria-label={`${title}に足す語`}
          placeholder="語を足す"
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-3 text-base outline-none focus:border-[var(--focus)] md:h-9 md:text-sm"
        />
        <button
          type="submit"
          aria-label={`${title}に足す`}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink hover:bg-surface-3 disabled:opacity-40 md:size-9"
          disabled={!draft.trim()}
        >
          <PlusIcon className="size-5" />
        </button>
      </form>
      {msg && (
        <p className="mt-1 text-lo text-xs" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

/* ---------- 条件カード ---------- */

/** 畳んだときの1行の要約（例: うれしいワード 9語／NG 8語） */
export function prefsSummary(prefs: Prefs): string {
  return `うれしいワード ${prefs.good.length}語／NG ${prefs.ng.length}語`;
}

function ConditionCard({
  prefs,
  update,
  onReset,
  open,
  onOpen,
}: {
  prefs: Prefs;
  update: (fn: (p: Prefs) => Prefs) => void;
  onReset: () => void;
  open: boolean;
  onOpen: (v: boolean) => void;
}) {
  return (
    <section className="min-w-0 rounded-3xl bg-surface-2 p-4" aria-labelledby="cond-title">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="cond-title" className="font-bold">
            あなたの条件
          </h2>
          {!open && <p className="mt-0.5 truncate text-muted text-xs">{prefsSummary(prefs)}</p>}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="cond-body"
          onClick={() => onOpen(!open)}
          className="h-10 shrink-0 rounded-full border border-line bg-surface px-3.5 font-medium text-[13px] hover:bg-surface-3 md:h-9"
        >
          {open ? "閉じる" : "条件を変える"}
        </button>
      </div>

      {open && (
        <div id="cond-body">
          <div className="mt-4 grid gap-4">
            <WordEditor
              title="うれしいワード"
              hint="口コミに出たら1語 +4（1人 +4・合計 +24 まで）"
              kind="good"
              words={prefs.good}
              onChange={(good) => update((p) => ({ ...p, good }))}
            />
            <WordEditor
              title="NGワード"
              hint="口コミに出たら1語 −5（最大 −25）"
              kind="ng"
              words={prefs.ng}
              onChange={(ng) => update((p) => ({ ...p, ng }))}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onReset}
              className="h-10 rounded-full px-3 text-muted text-xs hover:bg-surface-3 md:h-8"
            >
              初期値に戻す
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- 店のカード ---------- */

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
          <span className="mt-0.5 block truncate text-muted text-xs">
            {s.place.primaryTypeDisplayName?.text ?? "飲食店"}
            {s.place.formattedAddress ? `・${s.place.formattedAddress}` : ""}
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

/** 4位以下の小さめの行。写真は出さない（写真は1枚ごとに課金されるため、上位3つだけ） */
function Row({
  s,
  rank,
  words,
  hot,
  onSelect,
  onHover,
}: CardProps & { rank: number; words: WordLists }) {
  const kq = keyQuote(s);
  return (
    <li className="min-w-0">
      <button
        type="button"
        data-place-card={s.place.id}
        onClick={() => onSelect(s.place.id)}
        {...hoverProps({ s, onHover })}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-2 ${
          hot ? "bg-surface-2 ring-1 ring-brand" : ""
        }`}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 font-bold text-muted text-sm tabular-nums">
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] md:text-sm">{placeName(s.place)}</span>
          <span className="block truncate text-muted text-xs">
            {s.place.primaryTypeDisplayName?.text ?? "飲食店"}
            {s.place.googleRank ? `・Google の検索結果では${s.place.googleRank}番目` : ""}
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
  prefs,
  words,
  hoverId,
  condOpen,
  onCondOpen,
  update,
  onReset,
  onSelect,
  onHover,
  onPickExample,
}: {
  demo: boolean;
  /** 前の検索が終わったら探す語 */
  busy: string | null;
  title: string | null;
  status: { kind: "idle" | "loading" | "ok" } | { kind: "error"; message: string };
  /** 点数の高い順に並べた全件 */
  ranked: Scored[];
  prefs: Prefs;
  words: WordLists;
  hoverId: string | null;
  condOpen: boolean;
  onCondOpen: (v: boolean) => void;
  update: (fn: (p: Prefs) => Prefs) => void;
  onReset: () => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onPickExample: (q: string) => void;
}) {
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
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-accent-soft px-3 py-2 text-xs">
          <InfoIcon className="mt-px size-4 shrink-0 text-mid" />
          <span>
            Google の順位（口コミの多さ・広告）ではなく、<b>あなたの条件</b>
            で付けた点数の高い順に並べています。
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

      <ConditionCard
        prefs={prefs}
        update={update}
        onReset={onReset}
        open={condOpen}
        onOpen={onCondOpen}
      />

      <section
        className="min-w-0"
        aria-labelledby="list-title"
        aria-busy={status.kind === "loading"}
      >
        <h2 id="list-title" className="font-bold">
          点数の高い順
        </h2>
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
              {title ? (
                <p className="text-muted">店が見つかりませんでした。別の街で探してください。</p>
              ) : (
                <>
                  <p className="text-[15px] text-muted md:text-sm">
                    検索すると、点数の高い順にここに並びます。例から試せます。
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="検索の例">
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

      <p className="text-[11px] text-muted leading-relaxed">
        {demo
          ? "サンプルのデータです。街・店名・口コミ・数値はすべて架空です。"
          : "店舗情報と口コミ・写真: Google マップ。並び順と点数はジブンマップが計算したものです。"}
      </p>
    </div>
  );
}
