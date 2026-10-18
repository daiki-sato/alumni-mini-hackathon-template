"use client";

import { placeName, type Review } from "@/lib/jibunmap/place";
import {
  type AxisKey,
  axisObj,
  band,
  constraintTags,
  type Evidence,
  flags,
  highlight,
  partyChance,
  reviewText,
  type Scored,
  type WordLists,
  whoText,
} from "@/lib/jibunmap/score";
import { BackIcon, CheckIcon, PeopleIcon, PersonIcon, WarnIcon } from "./Icons";
import { BAND_TEXT } from "./ListPanel";

const BAND_COLOR = { hi: "var(--hi)", mid: "var(--mid)", lo: "var(--lo)" } as const;
const BAND_WORD = { hi: "高い", mid: "ふつう", lo: "低い" } as const;

function Gauge({ v }: { v: number }) {
  const b = band(v);
  // 半円（左端から右端まで、長さ π×r）
  const r = 80;
  const len = Math.PI * r;
  return (
    <div className="relative mx-auto w-56">
      <svg viewBox="0 0 200 112" className="w-full" aria-hidden="true">
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={16}
          strokeLinecap="round"
        />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={BAND_COLOR[b]}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${(len * v) / 100} ${len}`}
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className={`font-bold text-5xl tabular-nums leading-none ${BAND_TEXT[b]}`}>{v}</div>
        <div className="mt-1 text-muted text-xs">/ 100・{BAND_WORD[b]}</div>
      </div>
    </div>
  );
}

function Highlighted({ text, words }: { text: string; words: WordLists }) {
  const segs = highlight(text, words);
  let pos = 0;
  return (
    <>
      {segs.map((s) => {
        const key = `${pos}-${s.kind ?? "t"}`;
        pos += s.text.length;
        return s.kind ? (
          <mark
            key={key}
            className={`rounded px-0.5 font-bold ${
              s.kind === "good" ? "bg-hi-soft text-hi" : "bg-lo-soft text-lo"
            }`}
          >
            {s.text}
          </mark>
        ) : (
          <span key={key}>{s.text}</span>
        );
      })}
    </>
  );
}

function Author({ name, uri }: { name?: string; uri?: string }) {
  if (!name) return null;
  return uri ? (
    <a href={uri} target="_blank" rel="noreferrer noopener" className="underline">
      {name}
    </a>
  ) : (
    <span>{name}</span>
  );
}

function EvidenceList({ items, words }: { items: Evidence[]; words: WordLists }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1.5 grid gap-1 pl-1">
      {items.map((e) => (
        <li key={`${e.text}-${e.quote ?? ""}`} className="text-muted text-xs leading-relaxed">
          {e.quote ? (
            <>
              <span className="text-ink">
                「<Highlighted text={e.quote} words={words} />」
              </span>
              {e.author && (
                <span className="ml-1">
                  — <Author name={e.author} uri={e.authorUri} />
                </span>
              )}
            </>
          ) : (
            e.text
          )}
        </li>
      ))}
    </ul>
  );
}

function PartsBars({ s, words }: { s: Scored; words: WordLists }) {
  // 横棒は左右に振り分け、25点で半分の幅
  const SCALE = 25;
  return (
    <ul className="grid gap-3">
      {s.parts.map((p) => {
        const v = p.value;
        const w = Math.min(50, (Math.abs(v) / SCALE) * 50);
        const isBase = p.key === "base";
        return (
          <li key={p.key}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>{p.label}</span>
              <span
                className={`font-bold tabular-nums ${
                  isBase ? "text-muted" : v > 0 ? "text-hi" : v < 0 ? "text-lo" : "text-muted"
                }`}
              >
                {isBase ? v : v > 0 ? `+${v}` : v === 0 ? "±0" : `−${Math.abs(v)}`}
              </span>
            </div>
            {!isBase && (
              <div className="relative mt-1 h-2 rounded-full bg-surface-2" aria-hidden="true">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                {v !== 0 && (
                  <span
                    className={`absolute inset-y-0 rounded-full transition-all duration-500 ${v > 0 ? "bg-hi" : "bg-lo"}`}
                    style={
                      v > 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }
                    }
                  />
                )}
              </div>
            )}
            <EvidenceList items={p.reasons} words={words} />
          </li>
        );
      })}
      <li className="flex items-center justify-between border-line border-t pt-2 font-bold text-sm">
        <span>合計（0〜100に収める）</span>
        <span className="tabular-nums">{s.score}</span>
      </li>
    </ul>
  );
}

function Party({ s }: { s: Scored }) {
  const pc = partyChance(s.signals);
  const n = 10;
  const good = Math.round(pc.good * n);
  const icons = Array.from({ length: n }, (_, i) => i < good);
  return (
    <div>
      <div
        className="flex items-center gap-1"
        role="img"
        aria-label={`10組中${good}組が仲間の見込み`}
      >
        {icons.map((g, i) =>
          g ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: 並びが変わらない飾りのアイコン
            <PersonIcon key={i} className="size-6 text-hi" />
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: 並びが変わらない飾りのアイコン
            <PeopleIcon key={i} className="size-6 text-muted opacity-60" />
          ),
        )}
      </div>
      <p className="mt-2 text-sm">
        前後に並ぶ組が「仲間」（うれしいワード側の客）である見込みは
        <b className="mx-1 text-hi tabular-nums">{Math.round(pc.good * 100)}%</b>。
      </p>
      <p className="mt-0.5 text-muted text-xs">
        口コミに出たうれしいワード{s.signals.good.length}語と、NGワード{s.signals.ng.length}語
        {s.signals.goodForGroups ? "・グループ向き" : ""}からの推定です（どちらも0なら50%）。
      </p>
    </div>
  );
}

function ReviewItem({ r, words }: { r: Review; words: WordLists }) {
  const text = reviewText(r);
  if (!text) return null;
  return (
    <li className="rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2 text-muted text-xs">
        <span className="truncate">
          <Author name={r.authorAttribution?.displayName} uri={r.authorAttribution?.uri} />
        </span>
        <span className="shrink-0 tabular-nums">
          {typeof r.rating === "number" ? `★${r.rating}` : ""}
          {r.relativePublishTimeDescription ? `・${r.relativePublishTimeDescription}` : ""}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">
        <Highlighted text={text} words={words} />
      </p>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-line border-t pt-4">
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function DetailPanel({
  s,
  rank,
  axes,
  words,
  demo,
  onBack,
}: {
  s: Scored;
  rank: number;
  axes: AxisKey[];
  words: WordLists;
  demo: boolean;
  onBack: () => void;
}) {
  const p = s.place;
  const fl = flags(s);
  const tags = constraintTags(s.signals);
  return (
    <article className="anim-panel-in px-4 pt-2 pb-8" aria-labelledby="detail-title">
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-surface/95 px-2 py-2 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          aria-label="一覧に戻る"
          className="grid size-10 place-items-center rounded-full hover:bg-surface-2"
        >
          <BackIcon />
        </button>
        <span className="truncate text-muted text-sm">一覧に戻る</span>
      </div>

      <header className="mt-1">
        {rank > 0 && (
          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 font-bold text-on-accent text-xs">
            今日の3軒・{rank}番
          </span>
        )}
        <h1 id="detail-title" className="font-bold text-2xl leading-tight">
          {placeName(p)}
        </h1>
        <p className="mt-1 text-muted text-sm">
          {p.primaryTypeDisplayName?.text ?? "飲食店"}
          {p.formattedAddress ? `・${p.formattedAddress}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {typeof p.rating === "number" && (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted tabular-nums">
              比較用: Google ★{p.rating.toFixed(1)}・{p.userRatingCount ?? 0}件
            </span>
          )}
          {p.googleMapsUri && (
            <a
              href={p.googleMapsUri}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-line px-3 py-1 font-medium hover:bg-surface-2"
            >
              Google マップで開く ↗
            </a>
          )}
        </div>
      </header>

      <div className="mt-4 rounded-3xl bg-surface-2 p-4 text-center">
        <p className="font-bold text-sm">自分の意思で選ぶ人が集まる度</p>
        <div className="mt-2">
          <Gauge v={s.score} />
        </div>
        {axes.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {axes.map((k) => {
              const a = axisObj(k);
              return a ? (
                <span key={k} className="rounded-full bg-surface px-2.5 py-1 text-xs">
                  <span className="text-muted">{a.l}: </span>
                  {a.w(s)}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-5">
        <Section title="なぜこの点数か（計算の内訳）">
          <PartsBars s={s} words={words} />
        </Section>

        <Section title="並ぶ人の予想">
          <Party s={s} />
        </Section>

        <Section title="口コミの怪しい点">
          {fl.length ? (
            <ul className="grid gap-1.5">
              {fl.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <WarnIcon className="mt-0.5 size-4 shrink-0 text-lo" />
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm">
              <CheckIcon className="size-4 text-hi" />
              高評価への偏りや、口コミの急増は見当たりません
            </p>
          )}
        </Section>

        <Section title="店の制約">
          {tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-full border border-line px-3 py-1 text-sm">
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">目立つ制約はありません</p>
          )}
        </Section>

        <Section title="ここに並ぶのはこんな人たち">
          <p className="rounded-2xl bg-accent-soft p-3 text-sm leading-relaxed">{whoText(s)}</p>
          {p.editorialSummary?.text && (
            <p className="mt-2 text-muted text-xs">Google による紹介: {p.editorialSummary.text}</p>
          )}
        </Section>

        {p.reviews && p.reviews.length > 0 && (
          <Section title={demo ? "口コミ（架空）" : "口コミ（Google マップ）"}>
            <p className="mb-2 text-muted text-xs">
              <mark className="rounded bg-hi-soft px-1 text-hi">緑</mark>
              はうれしいワード、
              <mark className="rounded bg-lo-soft px-1 text-lo">赤</mark>は NG ワード。
            </p>
            <ul className="grid gap-2">
              {p.reviews.map((r, i) => (
                <ReviewItem key={r.name ?? `${r.publishTime}-${i}`} r={r} words={words} />
              ))}
            </ul>
          </Section>
        )}
      </div>
    </article>
  );
}
