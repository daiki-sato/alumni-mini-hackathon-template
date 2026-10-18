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
  MAX_AXES,
  MAX_WORD_LENGTH,
  MAX_WORDS,
  type Scored,
} from "@/lib/jibunmap/score";
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
              className="grid size-6 place-items-center rounded-full hover:bg-black/10 dark:hover:bg-white/10"
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

function ConditionCard({
  prefs,
  update,
  onReset,
}: {
  prefs: Prefs;
  update: (fn: (p: Prefs) => Prefs) => void;
  onReset: () => void;
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
    <section className="rounded-3xl bg-surface-2 p-4" aria-labelledby="cond-title">
      <div className="flex items-center justify-between">
        <h2 id="cond-title" className="font-bold">
          あなたの条件
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full px-3 py-1 text-muted text-xs hover:bg-surface-3"
        >
          初期値に戻す
        </button>
      </div>

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
          hint="口コミに出たら1語 +4（最大 +24）"
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
    </section>
  );
}

/* ---------- 店のカード ---------- */

function TopCard({
  s,
  rank,
  axes,
  onSelect,
  onHover,
}: {
  s: Scored;
  rank: number;
  axes: AxisKey[];
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const tags = constraintTags(s.signals);
  const why = axes.flatMap((k) => {
    const a = axisObj(k);
    return a ? [a.w(s)] : [];
  });
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(s.place.id)}
        onMouseEnter={() => onHover(s.place.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(s.place.id)}
        onBlur={() => onHover(null)}
        className="group flex w-full gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-e1 transition hover:-translate-y-px hover:shadow-e2"
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
          <span className="mt-2 flex flex-wrap gap-1">
            {s.signals.good.slice(0, 3).map((h) => (
              <span
                key={h.word}
                className="rounded-full bg-hi-soft px-2 py-0.5 text-[11px] text-hi"
              >
                {h.word}
              </span>
            ))}
            {s.signals.ng.length > 0 && (
              <span className="rounded-full bg-lo-soft px-2 py-0.5 text-[11px] text-lo">
                NG {s.signals.ng.length}語
              </span>
            )}
            {tags
              .filter((t) => !s.signals.good.some((h) => h.word === t))
              .slice(0, 2)
              .map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
                >
                  {t}
                </span>
              ))}
          </span>
          {why.length > 0 && (
            <span className="mt-1.5 block truncate text-[11px] text-muted">{why.join(" ／ ")}</span>
          )}
        </span>
        <span className="flex flex-col items-end gap-1">
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

function Row({
  s,
  onSelect,
  onHover,
}: {
  s: Scored;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(s.place.id)}
        onMouseEnter={() => onHover(s.place.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(s.place.id)}
        onBlur={() => onHover(null)}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{placeName(s.place)}</span>
          <span className="block truncate text-muted text-xs">
            {s.place.primaryTypeDisplayName?.text ?? "飲食店"}
            {s.signals.good.length ? `・うれしい${s.signals.good.length}語` : ""}
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
  title,
  status,
  total,
  top,
  others,
  prefs,
  update,
  onReset,
  onSelect,
  onHover,
  onPickTown,
}: {
  demo: boolean;
  title: string | null;
  status: { kind: "idle" | "loading" | "ok" } | { kind: "error"; message: string };
  total: number;
  top: Scored[];
  others: Scored[];
  prefs: Prefs;
  update: (fn: (p: Prefs) => Prefs) => void;
  onReset: () => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onPickTown: (name: string) => void;
}) {
  const shown = top.length + others.length;
  return (
    <div className="anim-panel-in grid gap-5 px-4 pt-3 pb-8 md:pt-4">
      <header>
        {title ? (
          <>
            <h1 className="font-bold text-xl">{title}</h1>
            <p className="mt-0.5 text-muted text-sm tabular-nums">
              {shown === total ? `${total}軒` : `${total}軒中 ${shown}軒（ジャンルで絞り込み）`}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-bold text-xl">行きたい街を検索</h1>
            <p className="mt-0.5 text-muted text-sm">
              上の検索欄に「街 + 食べたいもの」を入れて Enter。
            </p>
          </>
        )}
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-accent-soft px-3 py-2 text-xs">
          <InfoIcon className="mt-px size-4 shrink-0 text-mid" />
          <span>
            Google の順位（口コミの多さ・広告）ではなく、<b>あなたの条件</b>で並べています。
          </span>
        </p>
      </header>

      {demo && (
        <nav aria-label="デモの街">
          <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4">
            {DEMO_TOWNS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={title === t.name}
                onClick={() => onPickTown(t.name)}
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

      <ConditionCard prefs={prefs} update={update} onReset={onReset} />

      <section aria-labelledby="top-title" aria-busy={status.kind === "loading"}>
        <h2 id="top-title" className="flex items-baseline gap-2 font-bold">
          今日の3軒
          <span className="font-normal text-muted text-xs">判断軸の合計が高い順</span>
        </h2>
        <div className="mt-2">
          {status.kind === "loading" ? (
            <Skeleton />
          ) : status.kind === "error" ? (
            <p className="rounded-2xl bg-lo-soft p-4 text-lo text-sm" role="alert">
              {status.message}
            </p>
          ) : top.length ? (
            <ol className="grid gap-2">
              {top.map((s, i) => (
                <TopCard
                  key={s.place.id}
                  s={s}
                  rank={i + 1}
                  axes={prefs.axes}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              ))}
            </ol>
          ) : (
            <p className="rounded-2xl bg-surface-2 p-4 text-muted text-sm">
              {title
                ? "この条件に合う店がありません。ジャンルを「すべて」に戻すか、別の街で探してください。"
                : "検索すると、ここに3軒だけ出ます。"}
            </p>
          )}
        </div>
      </section>

      {others.length > 0 && status.kind === "ok" && (
        <section aria-labelledby="others-title">
          <h2 id="others-title" className="flex items-baseline gap-2 font-bold">
            ほかの候補
            <span className="font-normal text-muted text-xs">集まる度の高い順</span>
          </h2>
          <ul className="-mx-2 mt-1">
            {others.map((s) => (
              <Row key={s.place.id} s={s} onSelect={onSelect} onHover={onHover} />
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-muted leading-relaxed">
        {demo
          ? "デモデータです。街・店名・口コミ・数値はすべて架空のサンプルです。"
          : "店舗情報と口コミ: Google マップ。並び順と集まる度はジブンマップが計算したものです。"}
      </p>
    </div>
  );
}
