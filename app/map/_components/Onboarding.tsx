"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_GOOD_WORDS, DEFAULT_NG_WORDS, MAX_WORDS } from "@/lib/jibunmap/score";
import { CloseIcon } from "./Icons";
import type { Prefs } from "./usePrefs";

/** 初回の設定を終えたかの記録（語のリストとは別に、この端末にだけ残す） */
const DONE_KEY = "jibunmap-onboarded";

const GOOD_CANDIDATES = [...DEFAULT_GOOD_WORDS, "撮影禁止", "私語", "老舗", "ロット"];
const NG_CANDIDATES = [...DEFAULT_NG_WORDS, "SNS", "騒がしい", "観光客", "テレビ"];

export function onboardingDone(): boolean {
  try {
    // 前から使っていて条件を保存している人には出さない（初めての人だけ）
    return localStorage.getItem(DONE_KEY) === "1" || localStorage.getItem("jibunmap-v1") !== null;
  } catch {
    // 読めない環境では毎回出さない
    return true;
  }
}

function markDone(): void {
  try {
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    // 保存できなくても動くようにする
  }
}

function Chips({
  all,
  picked,
  tone,
  onToggle,
}: {
  all: string[];
  picked: string[];
  tone: "good" | "ng";
  onToggle: (w: string) => void;
}) {
  return (
    <ul className="mt-3 flex min-w-0 flex-wrap gap-2">
      {all.map((w) => {
        const on = picked.includes(w);
        return (
          <li key={w}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(w)}
              className={`h-10 rounded-full border px-4 text-[15px] transition-colors ${
                on
                  ? tone === "good"
                    ? "border-transparent bg-[var(--mark-good-bg)] font-bold text-[var(--mark-good-ink)]"
                    : "border-transparent bg-[var(--mark-ng-bg)] font-bold text-[var(--mark-ng-ink)]"
                  : "border-line bg-surface text-muted hover:bg-surface-2"
              }`}
            >
              {on && <span aria-hidden="true">✓ </span>}
              {w}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 初めて使う人だけに出す3ステップの設定（① うれしいワード ② NG ワード ③ 完了）。
 * スキップできる。終えたら記録し、マイ条件からいつでもやり直せる
 */
export function Onboarding({
  open,
  prefs,
  update,
  onClose,
}: {
  open: boolean;
  prefs: Prefs;
  update: (fn: (p: Prefs) => Prefs) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [good, setGood] = useState<string[]>(prefs.good);
  const [ng, setNg] = useState<string[]>(prefs.ng);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 開くたびに、いまの語から始める
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setGood(prefs.good);
    setNg(prefs.ng);
  }, [open, prefs.good, prefs.ng]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ステップが変わったら見出しへ移る
  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open, step]);

  if (!open) return null;

  const toggle = (list: string[], set: (v: string[]) => void, w: string) =>
    set(list.includes(w) ? list.filter((x) => x !== w) : [...list, w].slice(0, MAX_WORDS));

  const finish = () => {
    // 候補にない自分の語は残し、候補の語は選んだものだけにする
    const keepGood = prefs.good.filter((w) => !GOOD_CANDIDATES.includes(w));
    const keepNg = prefs.ng.filter((w) => !NG_CANDIDATES.includes(w));
    update((p) => {
      const g = [...new Set([...good, ...keepGood])].slice(0, MAX_WORDS);
      return {
        ...p,
        good: g,
        ng: [...new Set([...ng, ...keepNg])].slice(0, MAX_WORDS),
        soloOnly: p.soloOnly.filter((w) => g.includes(w)),
      };
    });
    markDone();
    onClose();
  };
  const skip = () => {
    markDone();
    onClose();
  };

  const steps = [
    {
      title: "口コミに出てほしい語は？",
      body: "選んだ語が口コミに出る店ほど、点数が上がります。",
      chips: (
        <Chips
          all={GOOD_CANDIDATES}
          picked={good}
          tone="good"
          onToggle={(w) => toggle(good, setGood, w)}
        />
      ),
    },
    {
      title: "出てほしくない語は？",
      body: "選んだ語が口コミに出る店ほど、点数が下がります。",
      chips: (
        <Chips all={NG_CANDIDATES} picked={ng} tone="ng" onToggle={(w) => toggle(ng, setNg, w)} />
      ),
    },
    {
      title: "準備ができました",
      body: "この条件で、点数の高い順に並べます。語は「マイ条件」からいつでも変えられます。",
      chips: null,
    },
  ];
  const cur = steps[step];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-title"
      className="fixed inset-0 z-[80] grid bg-black/40 md:place-items-center"
    >
      <div className="box-border flex h-full w-full min-w-0 max-w-full flex-col overflow-x-clip bg-surface text-ink md:h-auto md:max-h-[85dvh] md:w-[480px] md:rounded-3xl md:shadow-e2">
        <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1">
          <span className="text-muted text-xs" aria-hidden="true">
            はじめの設定 {step + 1} / 3
          </span>
          <button
            type="button"
            onClick={skip}
            aria-label="はじめの設定をスキップ"
            className="grid size-10 place-items-center rounded-full hover:bg-surface-2"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="jm-sheet-scroll min-h-0 flex-1 px-5 pb-4">
          <h2
            id="onboard-title"
            ref={titleRef}
            tabIndex={-1}
            className="font-bold text-xl outline-none"
          >
            {cur.title}
          </h2>
          <p className="mt-1 text-[15px] text-muted">{cur.body}</p>
          {cur.chips}
        </div>
        <div className="flex items-center justify-between gap-2 border-line border-t bg-surface px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          {step < 2 ? (
            <button
              type="button"
              onClick={skip}
              className="h-11 rounded-full px-4 text-muted text-sm hover:bg-surface-2"
            >
              スキップ
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => (step < 2 ? setStep(step + 1) : finish())}
            className="h-11 rounded-full bg-brand px-6 font-bold text-on-brand text-sm hover:opacity-90"
          >
            {step < 2 ? "次へ" : "完了"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
