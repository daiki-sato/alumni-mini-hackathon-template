"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_GOOD_WORDS,
  DEFAULT_NG_WORDS,
  DEFAULT_SOLO_ONLY,
  MAX_WORD_LENGTH,
  MAX_WORDS,
} from "@/lib/jibunmap/score";

// 保存するのは2つの語のリストと「ひとりのときだけ」の印だけ（店のデータ・シーンは保存しない）
const KEY = "jibunmap-v1";
/** 保存形式の版。2 で soloOnly（ひとりのときだけ数える語）を足し、判断軸（axes）をやめた */
const VERSION = 2;

export type Prefs = { good: string[]; ng: string[]; soloOnly: string[] };

export const DEFAULT_PREFS: Prefs = {
  good: DEFAULT_GOOD_WORDS,
  ng: DEFAULT_NG_WORDS,
  soloOnly: DEFAULT_SOLO_ONLY,
};

function cleanWords(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const w of v) {
    if (typeof w !== "string") continue;
    const t = w.trim().slice(0, MAX_WORD_LENGTH);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, MAX_WORDS);
}

/**
 * 保存された値を今の形に直す。版のない古い形式（v1）には soloOnly がないので、
 * 初期値の4語のうち、うれしいワードに残っている語に印を付ける。v1 の axes は読み捨てる
 */
export function migrate(d: Record<string, unknown>): Prefs {
  const good = cleanWords(d.good) ?? DEFAULT_PREFS.good;
  const solo = cleanWords(d.soloOnly) ?? DEFAULT_SOLO_ONLY;
  return {
    good,
    ng: cleanWords(d.ng) ?? DEFAULT_PREFS.ng,
    soloOnly: solo.filter((w) => good.includes(w)),
  };
}

function load(): Prefs | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return null;
  }
}

function save(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...p }));
  } catch {
    // 保存できない環境（プライベートモードなど）でも動くようにする
  }
}

/**
 * サーバーと最初の描画は初期値で揃え、読み込みはマウント後にする（hydration のずれを防ぐ）
 */
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const loaded = useRef(false);

  useEffect(() => {
    const p = load();
    if (p) setPrefs(p);
    loaded.current = true;
  }, []);

  const update = useCallback((fn: (p: Prefs) => Prefs) => {
    setPrefs((prev) => {
      const next = fn(prev);
      if (loaded.current) save(next);
      return next;
    });
  }, []);

  return { prefs, update };
}
