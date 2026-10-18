"use client";

import { useId, useMemo, useRef, useState } from "react";
import { DEMO_PLACES, type DemoTown, demoSearch, demoTownSuggestions } from "@/lib/jibunmap/demo";
import { MAX_QUERY_LENGTH, placeName } from "@/lib/jibunmap/place";
import { CityIcon, CloseIcon, PinIcon, SearchIcon } from "./Icons";

type Item =
  | { kind: "query"; q: string }
  | { kind: "example"; q: string }
  | { kind: "town"; town: DemoTown }
  | { kind: "place"; id: string; name: string; sub: string };

const LIVE_EXAMPLES = ["高円寺 ラーメン", "神保町 喫茶", "門前仲町 定食", "蒲田 餃子"];
const DEMO_EXAMPLES = ["学生街 ラーメン", "灯町", "オフィス 定食", "桜ヶ丘 喫茶"];

/**
 * 検索欄。入力のたびには検索しない（費用のため）。Enter か候補を選んだときだけ onSearch を呼ぶ。
 * デモのときは、手元のデモデータから街と店の候補を出す（通信なし）
 */
export function SearchBox({
  demo,
  value,
  onChange,
  onSearch,
  onPickPlace,
  recent,
}: {
  demo: boolean;
  value: string;
  onChange: (v: string) => void;
  onSearch: (q: string) => void;
  onPickPlace: (id: string, q: string) => void;
  recent: string[];
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<Item[]>(() => {
    const q = value.trim();
    if (!q) {
      const ex = demo ? DEMO_EXAMPLES : LIVE_EXAMPLES;
      const rs = recent.filter((r) => !ex.includes(r)).slice(0, 3);
      return [...rs, ...ex].map((x) => ({ kind: "example" as const, q: x }));
    }
    const out: Item[] = [{ kind: "query", q }];
    if (demo) {
      for (const town of demoTownSuggestions(q)) out.push({ kind: "town", town });
      const hits = demoSearch(q).slice(0, 5);
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
        for (const p of DEMO_PLACES.filter((x) => placeName(x).includes(q)).slice(0, 5)) {
          out.push({ kind: "place", id: p.id, name: placeName(p), sub: p.formattedAddress ?? "" });
        }
      }
    }
    return out;
  }, [value, demo, recent]);

  function choose(it: Item) {
    setOpen(false);
    inputRef.current?.blur();
    if (it.kind === "place") {
      onPickPlace(it.id, it.name);
      return;
    }
    const q = it.kind === "town" ? it.town.name : it.q;
    onChange(q);
    onSearch(q);
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
      else if (value.trim()) choose({ kind: "query", q: value.trim() });
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && items.length > 0;

  return (
    <div className="relative min-w-0 flex-1 md:max-w-xl">
      <div
        className={`flex h-11 items-center gap-2 rounded-full bg-surface-2 pr-1 pl-4 transition-shadow ${
          showList ? "rounded-b-none rounded-t-3xl bg-surface shadow-e2" : "hover:shadow-e1"
        }`}
      >
        <SearchIcon className="size-5 shrink-0 text-muted" />
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
      </div>
      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="検索の候補"
          className="anim-pop-in absolute inset-x-0 top-full z-40 overflow-hidden rounded-b-3xl border-line border-t bg-surface pb-2 shadow-e2"
        >
          {!value.trim() && (
            <p className="px-4 pt-3 pb-1 font-medium text-muted text-xs">
              {demo ? "デモの街で試す" : "検索の例"}
            </p>
          )}
          {items.map((it, i) => {
            const selected = i === active;
            const icon =
              it.kind === "town" ? (
                <CityIcon className="size-5" />
              ) : it.kind === "place" ? (
                <PinIcon className="size-5" />
              ) : (
                <SearchIcon className="size-5" />
              );
            const label =
              it.kind === "query"
                ? `「${it.q}」で探す`
                : it.kind === "example"
                  ? it.q
                  : it.kind === "town"
                    ? it.town.name
                    : it.name;
            const sub =
              it.kind === "town" ? `街・${it.town.label}` : it.kind === "place" ? it.sub : "";
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
