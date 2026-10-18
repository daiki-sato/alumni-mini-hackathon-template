"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AxisKey,
  DEFAULT_AXES,
  DEFAULT_GOOD_WORDS,
  DEFAULT_NG_WORDS,
  isAxisKey,
  MAX_AXES,
  MAX_WORD_LENGTH,
  MAX_WORDS,
} from "@/lib/jibunmap/score";

// 保存するのは判断軸と2つの語のリストだけ（店のデータは保存しない）
const KEY = "jibunmap-v1";

export type Prefs = { axes: AxisKey[]; good: string[]; ng: string[] };

export const DEFAULT_PREFS: Prefs = {
  axes: DEFAULT_AXES,
  good: DEFAULT_GOOD_WORDS,
  ng: DEFAULT_NG_WORDS,
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

function load(): Prefs | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Record<string, unknown>;
    return {
      axes: Array.isArray(d.axes)
        ? d.axes.filter(isAxisKey).slice(0, MAX_AXES)
        : DEFAULT_PREFS.axes,
      good: cleanWords(d.good) ?? DEFAULT_PREFS.good,
      ng: cleanWords(d.ng) ?? DEFAULT_PREFS.ng,
    };
  } catch {
    return null;
  }
}

function save(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
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
