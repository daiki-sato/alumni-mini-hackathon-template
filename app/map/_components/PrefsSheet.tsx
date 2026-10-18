"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_WORD_LENGTH, MAX_WORDS } from "@/lib/jibunmap/score";
import { CloseIcon, PlusIcon } from "./Icons";
import { MIN_SCORE_MAX, MIN_SCORE_STEP, type Prefs } from "./usePrefs";

/* ---------- 語のリスト ---------- */

function WordEditor({
  title,
  hint,
  kind,
  words,
  onChange,
  soloOnly,
  onSoloOnly,
}: {
  title: string;
  hint: string;
  kind: "good" | "ng";
  words: string[];
  onChange: (w: string[]) => void;
  /** うれしいワードだけ:「ひとりのときだけ」の印が付いた語 */
  soloOnly?: string[];
  onSoloOnly?: (w: string[]) => void;
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
      <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <h3 className="font-bold text-[15px] md:text-sm">{title}</h3>
        <span className="min-w-0 text-muted text-xs">{hint}</span>
      </div>
      <ul className="mt-2 flex min-w-0 flex-wrap gap-1.5" aria-label={title}>
        {words.map((w) => {
          const solo = soloOnly?.includes(w) ?? false;
          return (
            <li
              key={w}
              className={`flex min-w-0 max-w-full items-center gap-0.5 rounded-full border py-0.5 pr-0.5 pl-1 text-[15px] md:text-[13px] ${tone}`}
            >
              {onSoloOnly && (
                <button
                  type="button"
                  aria-pressed={solo}
                  aria-label={`「${w}」をひとりのときだけ数える`}
                  title="ひとりのときだけ数える"
                  onClick={() =>
                    onSoloOnly(
                      solo ? (soloOnly ?? []).filter((x) => x !== w) : [...(soloOnly ?? []), w],
                    )
                  }
                  className={`-my-1.5 grid h-10 min-w-10 shrink-0 place-items-center rounded-full px-1.5 text-[11px] md:h-6 md:min-w-6 ${
                    solo ? "font-bold" : "opacity-50"
                  }`}
                >
                  <span
                    className={`rounded-full px-1.5 py-0.5 ${solo ? "bg-hi text-surface" : "border border-current"}`}
                  >
                    ひとり
                  </span>
                </button>
              )}
              <span className={`min-w-0 truncate ${onSoloOnly ? "" : "pl-1.5"}`}>{w}</span>
              <button
                type="button"
                aria-label={`「${w}」を${title}から外す`}
                onClick={() => {
                  onChange(words.filter((x) => x !== w));
                  if (solo) onSoloOnly?.((soloOnly ?? []).filter((x) => x !== w));
                }}
                className="-my-1.5 grid size-10 shrink-0 place-items-center rounded-full hover:bg-black/10 md:my-0 md:size-6 dark:hover:bg-white/10"
              >
                <CloseIcon className="size-3.5" />
              </button>
            </li>
          );
        })}
        {!words.length && <li className="text-muted text-xs">まだありません</li>}
      </ul>
      <form
        className="mt-2 flex min-w-0 gap-1.5"
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
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-3 text-base outline-none focus:border-[var(--focus)] md:text-sm"
        />
        <button
          type="submit"
          aria-label={`${title}に足す`}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink hover:bg-surface-3 disabled:opacity-40"
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

/** 表示する最低点のスライダー（マイ条件と、一覧の上のチップで共通） */
export function MinScoreSlider({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-4">
      <label className="flex items-baseline justify-between gap-2" htmlFor={id}>
        <span className="font-bold text-[15px] md:text-sm">表示する最低点</span>
        <span className="font-bold text-sm tabular-nums">
          {value ? `${value}点以上` : "すべて表示"}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={MIN_SCORE_MAX}
        step={MIN_SCORE_STEP}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        // つまみが端で半分切れないよう、左右につまみの半径分の余白を取る
        className="mt-2 box-border h-10 w-full px-3 accent-[var(--brand)]"
      />
      <p className="text-muted text-xs">これより低い店は、一覧と地図に出しません。</p>
    </div>
  );
}

/**
 * マイ条件。検索画面からは外し、ヘッダーのボタンで開く面で編集する。
 * デスクトップは右から出るドロワー、スマホは全画面のシート（どちらも <dialog> の showModal で、
 * フォーカスの閉じ込めと Escape はブラウザに任せる）
 */
export function PrefsSheet({
  open,
  prefs,
  update,
  onReset,
  onClose,
  onRestart,
}: {
  /** はじめの設定をやり直す */
  onRestart: () => void;
  open: boolean;
  prefs: Prefs;
  update: (fn: (p: Prefs) => Prefs) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal は最初のボタン（閉じる）にフォーカスを当て、iPhone では輪が出たままになる。見出しに移す
      titleRef.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="prefs-title"
      onClose={onClose}
      onClick={(e) => {
        // 外側（背景）をクリックしたら閉じる
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      // スマホは画面にぴったりの全画面（dialog の既定の幅・余白を打ち消す）。横にはみ出したら切る
      className="fixed inset-0 m-0 box-border h-dvh max-h-none w-full max-w-full overflow-x-hidden bg-surface p-0 text-ink backdrop:bg-black/40 md:left-auto md:w-[420px] md:border-line md:border-l md:shadow-e2"
    >
      <div className="flex h-full w-full min-w-0 flex-col overflow-x-clip">
        <div className="flex items-center justify-between border-line border-b px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
          <h2
            id="prefs-title"
            ref={titleRef}
            tabIndex={-1}
            className="font-bold text-lg outline-none"
          >
            マイ条件
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="マイ条件を閉じる"
            className="grid size-10 place-items-center rounded-full hover:bg-surface-2"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-clip px-4 pt-4 pb-6">
          <p className="text-muted text-sm">
            口コミにこの語が出ると、点数が上がったり下がったりします。この端末の中にだけ保存します。
          </p>
          <MinScoreSlider
            id="min-score-sheet"
            value={prefs.minScore}
            onChange={(minScore) => update((p) => ({ ...p, minScore }))}
          />
          <div className="mt-5 grid gap-5 border-line border-t pt-4">
            <WordEditor
              title="うれしいワード"
              hint="「ひとり」の印は、友だちと行くときに数えない"
              kind="good"
              words={prefs.good}
              onChange={(good) => update((p) => ({ ...p, good }))}
              soloOnly={prefs.soloOnly}
              onSoloOnly={(soloOnly) => update((p) => ({ ...p, soloOnly }))}
            />
            <WordEditor
              title="NGワード"
              hint="口コミに出たら減点"
              kind="ng"
              words={prefs.ng}
              onChange={(ng) => update((p) => ({ ...p, ng }))}
            />
          </div>
        </div>
        {/* 下部の帯: 不透明の地に細い線。主ボタンは1行、ほかは上に小さな文字リンク。ホームバーの分だけ余白 */}
        <div className="shrink-0 border-line border-t bg-surface px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap justify-center gap-x-4">
            <button
              type="button"
              onClick={onReset}
              className="min-h-10 text-muted text-sm underline underline-offset-2"
            >
              初期値に戻す
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="min-h-10 text-muted text-sm underline underline-offset-2"
            >
              はじめの設定をやり直す
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 h-11 w-full whitespace-nowrap rounded-full bg-brand px-5 font-bold text-on-brand text-sm hover:opacity-90"
          >
            この条件で並べる
          </button>
        </div>
      </div>
    </dialog>
  );
}
