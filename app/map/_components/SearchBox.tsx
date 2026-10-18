"use client";

import { useId, useMemo, useRef, useState } from "react";
import { DEMO_PLACES, DEMO_TOWNS, demoSearch } from "@/lib/jibunmap/demo";
import { MAX_QUERY_LENGTH, placeName } from "@/lib/jibunmap/place";
import {
  DEMO_EXAMPLES,
  DEMO_GENRE_NAMES,
  GENRE_WORDS,
  LIVE_EXAMPLES,
  suggestQueries,
  type Town,
} from "@/lib/jibunmap/suggest";
import { CloseIcon, PinIcon, SearchIcon } from "./Icons";

type Item =
  | { kind: "query"; q: string }
  | { kind: "suggest"; q: string }
  | { kind: "place"; id: string; name: string; sub: string };

const DEMO_SUGGEST_TOWNS: Town[] = DEMO_TOWNS.map((t) => ({
  name: t.name,
  readings: [t.label, ...t.keywords],
}));
const DEMO_GENRES = GENRE_WORDS.filter((g) => DEMO_GENRE_NAMES.includes(g.name));

/**
 * 検索欄。入力のたびには検索しない（費用のため）。Enter・検索ボタン・候補を選んだときだけ onSearch を呼ぶ。
 * 候補は手元の街とジャンルのリストから作る（通信なし）。検索した語の履歴は残さない
 */
export function SearchBox({
  demo,
  value,
  onChange,
  onSearch,
  onPickPlace,
}: {
  demo: boolean;
  value: string;
  onChange: (v: string) => void;
  onSearch: (q: string) => void;
  onPickPlace: (id: string, q: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<Item[]>(() => {
    const q = value.trim();
    if (!q) {
      return (demo ? DEMO_EXAMPLES : LIVE_EXAMPLES).map((x) => ({
        kind: "suggest" as const,
        q: x,
      }));
    }
    const out: Item[] = [{ kind: "query", q }];
    const sug = demo ? suggestQueries(q, DEMO_SUGGEST_TOWNS, DEMO_GENRES) : suggestQueries(q);
    for (const x of sug) out.push({ kind: "suggest", q: x });
    if (demo) {
      const hits = demoSearch(q).slice(0, 3);
      for (const p of hits) {
        out.push({
          kind: "place",
          id: p.id,
          name: placeName(p),
          sub: `${p.primaryTypeDisplayName?.text ?? ""}・${p.formattedAddress ?? ""}`,
        });
      }
      // 店名の一部だけでも当たるように（例:「汽笛」）
      if (!hits.length) {
        for (const p of DEMO_PLACES.filter((x) => placeName(x).includes(q)).slice(0, 3)) {
          out.push({ kind: "place", id: p.id, name: placeName(p), sub: p.formattedAddress ?? "" });
        }
      }
    }
    return out;
  }, [value, demo]);

  function choose(it: Item) {
    setOpen(false);
    inputRef.current?.blur();
    if (it.kind === "place") {
      onPickPlace(it.id, it.name);
      return;
    }
    onChange(it.q);
    onSearch(it.q);
  }

  function submit() {
    const q = value.trim();
    if (!q) return;
    choose({ kind: "query", q });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      // 日本語の変換を確定する Enter では検索しない
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      const it = open ? items[active] : undefined;
      if (it) choose(it);
      else submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && items.length > 0;
  const empty = !value.trim();

  return (
    <div className="relative min-w-0 flex-1 md:max-w-xl">
      <div
        className={`flex h-11 items-center gap-1 rounded-full bg-surface-2 pr-1 pl-1 transition-shadow ${
          showList ? "rounded-b-none rounded-t-3xl bg-surface shadow-e2" : "hover:shadow-e1"
        }`}
      >
        <button
          type="button"
          aria-label="検索する"
          disabled={empty}
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted enabled:hover:bg-surface-3 enabled:hover:text-ink disabled:cursor-default"
        >
          <SearchIcon className="size-5" />
        </button>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          aria-label="街・店名・ジャンルで探す"
          placeholder={
            demo
              ? "街・店名・ジャンル（例: 学生街 ラーメン）"
              : "街と食べたいもの（例: 高円寺 ラーメン）"
          }
          maxLength={MAX_QUERY_LENGTH}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            aria-label="検索欄を空にする"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-3"
          >
            <CloseIcon />
          </button>
        )}
        <button
          type="button"
          disabled={empty}
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
          className="h-9 shrink-0 rounded-full bg-brand px-4 font-bold text-on-brand text-sm transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          検索
        </button>
      </div>
      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="検索の候補"
          className="anim-pop-in absolute inset-x-0 top-full z-40 overflow-hidden rounded-b-3xl border-line border-t bg-surface pb-2 shadow-e2"
        >
          {empty && (
            <p className="px-4 pt-3 pb-1 font-medium text-muted text-xs">
              {demo ? "サンプルの街で試す" : "検索の例"}
            </p>
          )}
          {items.map((it, i) => {
            const selected = i === active;
            const icon =
              it.kind === "place" ? (
                <PinIcon className="size-5" />
              ) : (
                <SearchIcon className="size-5" />
              );
            const label =
              it.kind === "query" ? `「${it.q}」で探す` : it.kind === "suggest" ? it.q : it.name;
            const sub = it.kind === "place" ? it.sub : "";
            return (
              <div
                key={`${it.kind}-${label}`}
                id={`${listId}-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={selected}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(it);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${selected ? "bg-surface-2" : ""}`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                  {icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{label}</span>
                  {sub && <span className="block truncate text-muted text-xs">{sub}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
