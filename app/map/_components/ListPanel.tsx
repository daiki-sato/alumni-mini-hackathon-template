"use client";

import { useState } from "react";
import { DEMO_TOWNS } from "@/lib/jibunmap/demo";
import { placeName } from "@/lib/jibunmap/place";
import {
  AXES,
  type AxisKey,
  axisObj,
  band,
  constraintTags,
  keyQuote,
  MAX_AXES,
  MAX_WORD_LENGTH,
  MAX_WORDS,
  type Scored,
  type WordLists,
} from "@/lib/jibunmap/score";
import { LIVE_EXAMPLES } from "@/lib/jibunmap/suggest";
import { Highlighted } from "./Highlighted";
import { CloseIcon, InfoIcon, PlusIcon } from "./Icons";
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
              className="grid size-8 place-items-center rounded-full hover:bg-black/10 md:size-6 dark:hover:bg-white/10"
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
          className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface px-3 text-sm outline-none focus:border-[var(--focus)]"
        />
        <button
          type="submit"
          aria-label={`${title}に足す`}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink hover:bg-surface-3 disabled:opacity-40"
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

/** 畳んだときの1行の要約（例: 判断軸: うれしい多・NG少・口コミ自然／NG 8語） */
export function prefsSummary(prefs: Prefs): string {
  const axes = prefs.axes.flatMap((k) => {
    const a = axisObj(k);
    return a ? [a.s] : [];
  });
  return `判断軸: ${axes.join("・") || "なし"}／NG ${prefs.ng.length}語`;
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
  const [hint, setHint] = useState("");
  const full = prefs.axes.length >= MAX_AXES;

  function toggle(k: AxisKey) {
    const on = prefs.axes.includes(k);
    if (!on && full) {
      setHint("判断軸は3つまで。1つ外すと別の軸を選べます。");
      return;
    }
    setHint("");
    update((p) => ({ ...p, axes: on ? p.axes.filter((x) => x !== k) : [...p.axes, k] }));
  }

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
          className="h-9 shrink-0 rounded-full border border-line bg-surface px-3.5 font-medium text-[13px] hover:bg-surface-3"
        >
          {open ? "閉じる" : "条件を変える"}
        </button>
      </div>

      {open && (
        <div id="cond-body">
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold text-sm">判断軸</h3>
              <span className="text-muted text-xs tabular-nums">
                {prefs.axes.length}/{MAX_AXES} 選択中
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AXES.map((a) => {
                const on = prefs.axes.includes(a.k);
                return (
                  <button
                    key={a.k}
                    type="button"
                    aria-pressed={on}
                    aria-disabled={!on && full}
                    onClick={() => toggle(a.k)}
                    className={`h-8 rounded-full border px-3 text-[13px] transition-colors ${
                      on
                        ? "border-brand bg-brand text-on-brand"
                        : `border-line bg-surface text-ink ${full ? "opacity-50" : "hover:bg-surface-3"}`
                    }`}
                  >
                    {on && <span aria-hidden="true">✓ </span>}
                    {a.l}
                  </button>
                );
              })}
            </div>
            {hint && (
              <p className="mt-1.5 text-lo text-xs" role="status">
                {hint}
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-4 border-line border-t pt-4">
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
              className="rounded-full px-3 py-1.5 text-muted text-xs hover:bg-surface-3"
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
    ...(s.signals.ng.length ? [{ t: `NG ${s.signals.ng.length}語`, ng: true }] : []),
    ...constraintTags(s.signals).map((t) => ({ t, ng: false })),
  ].slice(0, 2);
  const kq = keyQuote(s);
  return (
    <li className="w-[86%] min-w-0 shrink-0 snap-start md:w-auto">
      <button
        type="button"
        data-place-card={s.place.id}
        onClick={() => onSelect(s.place.id)}
        {...hoverProps({ s, onHover })}
        className={`group flex h-full w-full gap-3 rounded-2xl border bg-surface p-3 text-left shadow-e1 transition hover:shadow-e2 ${
          hot ? "border-brand ring-1 ring-brand" : "border-line"
        }`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-bold text-on-accent tabular-nums">
          {rank}
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
          {typeof s.place.rating === "number" && (
            <span className="text-[10px] text-muted tabular-nums" title="Google の評価（比較用）">
              G ★{s.place.rating.toFixed(1)}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function Row({ s, hot, onSelect, onHover }: CardProps) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        data-place-card={s.place.id}
        onClick={() => onSelect(s.place.id)}
        {...hoverProps({ s, onHover })}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2 ${
          hot ? "bg-surface-2 ring-1 ring-brand" : ""
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{placeName(s.place)}</span>
          <span className="block truncate text-muted text-xs">
            {s.place.primaryTypeDisplayName?.text ?? "飲食店"}
            {s.place.googleRank ? `・Google ${s.place.googleRank}番目` : ""}
            {s.signals.ng.length ? `・NG${s.signals.ng.length}語` : ""}
          </span>
        </span>
        <ScoreBadge v={s.score} />
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

/* ---------- 一覧パネル ---------- */

export function ListPanel({
  demo,
  busy,
  title,
  status,
  total,
  top,
  others,
  prefs,
  words,
  hoverId,
  condOpen,
  othersOpen,
  onCondOpen,
  onOthersOpen,
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
  total: number;
  top: Scored[];
  others: Scored[];
  prefs: Prefs;
  words: WordLists;
  hoverId: string | null;
  condOpen: boolean;
  othersOpen: boolean;
  onCondOpen: (v: boolean) => void;
  onOthersOpen: (v: boolean) => void;
  update: (fn: (p: Prefs) => Prefs) => void;
  onReset: () => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onPickExample: (q: string) => void;
}) {
  // 読み上げ: 件数と検索の状態だけを、静かに伝える
  const live =
    status.kind === "loading"
      ? `「${title ?? ""}」を検索しています`
      : status.kind === "error"
        ? status.message
        : title
          ? `${title}の店 ${total}軒。今日の3軒を出しました`
          : "";
  return (
    <div className="anim-panel-in grid min-w-0 grid-cols-1 gap-5 px-4 pt-3 pb-8 md:pt-4">
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
            <p className="mt-0.5 text-muted text-sm">
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
            Google の順位（口コミの多さ・広告）ではなく、<b>あなたの条件</b>で並べています。
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
                className={`h-8 shrink-0 rounded-full border px-3 text-[13px] ${
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
        aria-labelledby="top-title"
        aria-busy={status.kind === "loading"}
      >
        <h2 id="top-title" className="flex items-baseline gap-2 font-bold">
          今日の3軒
          <span className="font-normal text-muted text-xs">判断軸の合計が高い順</span>
        </h2>
        <div className="mt-2">
          {status.kind === "loading" ? (
            <Skeleton />
          ) : status.kind === "error" ? (
            <p className="rounded-2xl bg-lo-soft p-4 text-lo text-sm">{status.message}</p>
          ) : top.length ? (
            // モバイルでは横にスクロールするカード、広い画面では縦に並べる
            <ol className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-1 md:overflow-visible md:px-0 md:pb-0">
              {top.map((s, i) => (
                <TopCard
                  key={s.place.id}
                  s={s}
                  rank={i + 1}
                  words={words}
                  hot={hoverId === s.place.id}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              ))}
            </ol>
          ) : (
            <div className="rounded-2xl bg-surface-2 p-4 text-sm">
              {title ? (
                <p className="text-muted">この条件に合う店がありません。別の街で探してください。</p>
              ) : (
                <>
                  <p className="text-muted">検索すると、ここに3軒だけ出ます。例から試せます。</p>
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="検索の例">
                    {LIVE_EXAMPLES.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => onPickExample(q)}
                          className="h-9 rounded-full border border-line bg-surface px-3.5 text-[13px] hover:bg-surface-3"
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

      <ConditionCard
        prefs={prefs}
        update={update}
        onReset={onReset}
        open={condOpen}
        onOpen={onCondOpen}
      />

      {others.length > 0 && status.kind === "ok" && (
        <section className="min-w-0" aria-labelledby="others-title">
          <h2 id="others-title" className="flex items-baseline gap-2 font-bold">
            ほかの候補
            <span className="font-normal text-muted text-xs">判断軸の合計が高い順</span>
          </h2>
          {othersOpen && (
            <ul id="others-list" className="-mx-2 mt-1">
              {others.map((s) => (
                <Row
                  key={s.place.id}
                  s={s}
                  hot={hoverId === s.place.id}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              ))}
            </ul>
          )}
          <button
            type="button"
            aria-expanded={othersOpen}
            aria-controls="others-list"
            onClick={() => onOthersOpen(!othersOpen)}
            className="mt-2 h-9 rounded-full border border-line px-4 font-medium text-[13px] hover:bg-surface-2"
          >
            {othersOpen ? "たたむ" : `あと${others.length}軒を見る`}
          </button>
        </section>
      )}

      <p className="text-[11px] text-muted leading-relaxed">
        {demo
          ? "サンプルのデータです。街・店名・口コミ・数値はすべて架空です。"
          : "店舗情報と口コミ: Google マップ。並び順と集まる度はジブンマップが計算したものです。"}
      </p>
    </div>
  );
}
