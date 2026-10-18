import Link from "next/link";
import { type LpShop, lpExample, lpQuoteExamples } from "@/lib/jibunmap/lp";
import {
  BASE_POINT,
  DEFAULT_WORDS,
  GOOD_MAX,
  GOOD_PER_AUTHOR,
  GOOD_POINT,
  NG_MAX,
  NG_POINT,
  RECENT_DAYS,
  REPEAT_WEIGHT,
  verdict,
} from "@/lib/jibunmap/score";
import { Logo, LogoMark } from "./_components/Logo";
import { LpScoreDemo } from "./_components/LpScoreDemo";
import { Highlighted } from "./map/_components/Highlighted";
import {
  CheckIcon,
  MapIcon,
  MyLocationIcon,
  PeopleIcon,
  SearchIcon,
  TuneIcon,
} from "./map/_components/Icons";

/** 入口のボタンと発表のリンクは、この URL（開いた瞬間に1回だけ検索する） */
const TRY_HREF = `/map?q=${encodeURIComponent("高円寺 ラーメン")}`;
const DEMO_HREF = "/map?demo=1";

/* 色はブランドの3色＋生成りの面＋白 */
const INK = "#1F2A26";
const DOT = "#4C5C54";
const AMBER = "#F2A71B";

/* ---------- 飾りの点（マークと同じモチーフ） ---------- */

/** 背景に敷く点の格子。1つだけアンバーのピン。装飾なので読み上げない */
function DotField({ className = "" }: { className?: string }) {
  const cols = 7;
  const rows = 6;
  const pin = { c: 4, r: 1 };
  return (
    <svg viewBox="0 0 280 240" className={className} aria-hidden="true" focusable="false">
      {Array.from({ length: rows }).flatMap((_, r) =>
        Array.from({ length: cols }).map((__, c) =>
          c === pin.c && r === pin.r ? null : (
            <circle
              // biome-ignore lint/suspicious/noArrayIndexKey: 並びが変わらない飾りの点
              key={`${r}-${c}`}
              cx={20 + c * 40}
              cy={20 + r * 40}
              r={7}
              fill={DOT}
            />
          ),
        ),
      )}
      <g transform={`translate(${20 + pin.c * 40},${20 + pin.r * 40 + 4}) scale(0.8)`}>
        <path
          d="M0-22c-12 0-21 9-21 21 0 15 21 33 21 33s21-18 21-33C21-13 12-22 0-22z"
          fill={AMBER}
        />
        <circle cx="0" cy="-1" r="8" fill={INK} />
      </g>
    </svg>
  );
}

/**
 * 人の形（頭の円＋肩の半円。塗りで描く）。x は中心、y は足もと。
 * 自分はアンバー、知らない人は暗い灰緑、仲間はアンバーの輪郭（点のときと同じ色の役割）
 */
function Person({
  x,
  y,
  s = 1,
  fill,
  ring = false,
}: {
  x: number;
  y: number;
  s?: number;
  fill: string;
  ring?: boolean;
}) {
  const w = 12 * s;
  const head = 7 * s;
  const neck = y - 18 * s;
  const stroke = ring ? { stroke: AMBER, strokeWidth: 3, paintOrder: "stroke" as const } : {};
  return (
    <g>
      <path d={`M${x - w} ${y} A${w} ${18 * s} 0 0 1 ${x + w} ${y} Z`} fill={fill} {...stroke} />
      <circle cx={x} cy={neck - head - 2 * s} r={head} fill={fill} {...stroke} />
    </g>
  );
}

/** 物語の絵: 行列。7人が詰めて並び、4人目が自分。friends のときは、両隣が仲間（アンバーの輪郭） */
function QueueArt({ friends = false }: { friends?: boolean }) {
  const n = 7;
  const me = 3;
  const gap = 30;
  return (
    <svg
      viewBox={`0 0 ${gap * (n - 1) + 40} 64`}
      className="w-full max-w-[300px]"
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: n }).map((_, i) => {
        const isMe = i === me;
        const isFriend = friends && Math.abs(i - me) === 1;
        return (
          <Person
            // biome-ignore lint/suspicious/noArrayIndexKey: 並びが変わらない飾りの人
            key={i}
            x={20 + i * gap}
            y={60}
            s={isMe ? 1.08 : 1}
            fill={isMe ? AMBER : DOT}
            ring={isFriend}
          />
        );
      })}
    </svg>
  );
}

/** 物語の絵: 解決。格子に並ぶ人（4×3）のうち、1人の頭の上にアンバーのピン（マークと同じ構図） */
function CrowdArt() {
  const cols = 4;
  const rows = 3;
  const pin = { c: 3, r: 0 };
  return (
    <svg
      viewBox="0 0 200 186"
      className="w-full max-w-[220px]"
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: rows }).flatMap((_, r) =>
        Array.from({ length: cols }).map((__, c) => (
          <Person
            // biome-ignore lint/suspicious/noArrayIndexKey: 並びが変わらない飾りの人
            key={`${r}-${c}`}
            x={30 + c * 46}
            y={70 + r * 52}
            s={0.95}
            fill={c === pin.c && r === pin.r ? AMBER : DOT}
          />
        )),
      )}
      <g transform={`translate(${30 + pin.c * 46},${10}) scale(0.42)`}>
        <path
          d="M0-22c-12 0-21 9-21 21 0 15 21 33 21 33s21-18 21-33C21-13 12-22 0-22z"
          fill={AMBER}
        />
        <circle cx="0" cy="-1" r="8" fill={INK} />
      </g>
    </svg>
  );
}

/** 見出しを句ごとに折り返す（auto-phrase に対応しないブラウザ向けに、句を inline-block で包む） */
function Phrases({ parts }: { parts: string[] }) {
  return (
    <>
      {parts.map((t) => (
        <span key={t} className="inline-block">
          {t}
        </span>
      ))}
    </>
  );
}

/* ---------- ヒーローのモック（今のアプリ画面） ---------- */

function MockCard({ s, rank, big }: { s: LpShop; rank: number; big: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-line bg-surface p-2">
      {big ? (
        <span className="relative grid size-11 shrink-0 place-items-center rounded-lg bg-surface-2 text-lg">
          <span aria-hidden="true">🍜</span>
          <span className="absolute -top-1 -left-1 grid size-5 place-items-center rounded-full border-2 border-surface bg-accent font-bold text-[9px] text-on-accent">
            {rank}
          </span>
        </span>
      ) : (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 font-bold text-[10px]">
          {rank}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-[11px] text-ink">{s.name}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[9px] text-muted">
          <span className="truncate">{s.type}</span>
          <span className="rounded-full bg-hi-soft px-1 font-bold text-hi">営業中</span>
        </span>
        {big && s.quote && (
          <span className="mt-1 block truncate text-[9px] text-ink">
            「<Highlighted text={s.quote} words={DEFAULT_WORDS} />」
          </span>
        )}
        <span className="mt-1 inline-block rounded-full bg-surface-2 px-1.5 text-[8px] text-muted">
          口コミの多さでは{s.popRank}番目
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="rounded-md bg-hi-soft px-1.5 py-0.5 font-bold text-[12px] text-hi tabular-nums">
          {s.score}
        </span>
        <span className="mt-0.5 whitespace-nowrap font-bold text-[8px] text-hi">{s.verdict}</span>
      </span>
    </div>
  );
}

function PhoneMock({ town, top3 }: { town: string; top3: LpShop[] }) {
  return (
    <figure className="mx-auto w-[260px] shrink-0 md:w-[290px]">
      <div className="rounded-[34px] border-[7px] border-black/80 bg-bg p-2 shadow-2xl">
        <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-black/70" aria-hidden="true" />
        <div className="flex items-center gap-1.5">
          <LogoMark size={20} />
          <div className="flex h-7 flex-1 items-center rounded-full bg-surface-2 px-2.5 text-[10px] text-muted">
            {town}
          </div>
          <span className="grid size-7 place-items-center rounded-full bg-brand text-on-brand">
            <SearchIcon className="size-3.5" />
          </span>
        </div>
        <div className="mt-2 flex gap-1">
          <span className="rounded-full bg-brand px-2.5 py-1 font-bold text-[9px] text-on-brand">
            ひとりで
          </span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[9px] text-muted">
            友だちと
          </span>
        </div>
        <p className="mt-2 font-bold text-[10px] text-ink">点数の高い順</p>
        <div className="mt-1 grid gap-1.5">
          {top3.map((s, i) => (
            <MockCard key={s.id} s={s} rank={i + 1} big={i === 0} />
          ))}
        </div>
      </div>
      <figcaption className="mt-3 text-center text-white/60 text-xs">
        画面はデモデータ（架空の店）の例です
      </figcaption>
    </figure>
  );
}

/* ---------- Google の順 vs あなたの順 ---------- */

const MARKS = ["A", "B", "C", "D", "E"];
const ROW = 64;

function CompareRow({
  s,
  mark,
  rank,
  meta,
  short,
}: {
  s: LpShop;
  mark: string;
  rank: number;
  meta: string;
  /** スマホ（2列で幅が狭い）で出す短い補足 */
  short?: string;
}) {
  const hot = mark === "A" || s.mineRank === 1;
  return (
    <li
      className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-2 md:gap-3 md:px-3"
      style={{ height: ROW - 8 }}
    >
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full font-bold text-xs md:size-8 md:text-sm ${
          hot ? "bg-[#F2A71B] text-[#1F2A26]" : "bg-[#4C5C54] text-white"
        }`}
        aria-hidden="true"
      >
        {mark}
      </span>
      <span className="hidden w-6 shrink-0 font-bold text-muted tabular-nums md:block">{rank}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-[13px] md:text-[15px]">
          <span className="text-muted tabular-nums md:hidden">{rank}. </span>
          {s.name}
        </span>
        <span className="hidden truncate text-muted text-xs md:block">{meta}</span>
        {short && <span className="block truncate text-[11px] text-muted md:hidden">{short}</span>}
      </span>
    </li>
  );
}

/** 順位の動き（同じ5軒の中で。順位の差という事実なので数値を出す） */
function moveText(d: number, long: boolean): string {
  if (d > 0) return long ? `↑${d}つ上がった` : `↑${d}`;
  if (d < 0) return long ? `↓${-d}つ下がった` : `↓${-d}`;
  return long ? "→ 同じ" : "→";
}

function Compare({ pop, mine }: { pop: LpShop[]; mine: LpShop[] }) {
  // 同じ店は同じ印（口コミの多い順に A〜E）
  const markOf = new Map(pop.map((s, i) => [s.id, MARKS[i]]));
  return (
    // スマホでも2列で並べ、間を線でつなぐ（線の幅だけ詰める）
    <div className="grid grid-cols-[1fr_28px_1fr] md:grid-cols-[1fr_96px_1fr]">
      <div>
        <h3 className="mb-3 h-7 font-bold text-base md:text-lg">Google の順</h3>
        <ol className="grid gap-2" aria-label="口コミの多い順（Google の順に見立てた例）">
          {pop.map((s, i) => (
            <CompareRow
              key={s.id}
              s={s}
              mark={markOf.get(s.id) ?? ""}
              rank={i + 1}
              meta={`あなたの順では${mine.findIndex((m) => m.id === s.id) + 1}位・${s.score}点`}
              short={`${s.score}点`}
            />
          ))}
        </ol>
      </div>
      {/* 同じ店を線でつなぐ（スマホは幅を詰めて引き伸ばす。線の太さは変えない） */}
      <svg
        className="w-full"
        viewBox={`0 0 96 ${ROW * 5}`}
        preserveAspectRatio="none"
        style={{ marginTop: 40, height: ROW * 5 }}
        aria-hidden="true"
        focusable="false"
      >
        {pop.map((s, i) => {
          const j = mine.findIndex((m) => m.id === s.id);
          const hot = i === 0 || j === 0;
          const y1 = i * ROW + (ROW - 8) / 2;
          const y2 = j * ROW + (ROW - 8) / 2;
          return (
            <path
              key={s.id}
              d={`M0 ${y1} C48 ${y1} 48 ${y2} 96 ${y2}`}
              fill="none"
              stroke={hot ? AMBER : DOT}
              strokeWidth={hot ? 4 : 2.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <div>
        <h3 className="mb-3 h-7 font-bold text-base md:text-lg">あなたの順</h3>
        <ol className="grid gap-2" aria-label="あなたの順（点数の高い順）">
          {mine.map((s, i) => (
            <CompareRow
              key={s.id}
              s={s}
              mark={markOf.get(s.id) ?? ""}
              rank={i + 1}
              meta={`${s.score}点・${s.verdict}・${moveText(pop.findIndex((p) => p.id === s.id) - i, true)}`}
              short={`${s.score}点・${moveText(pop.findIndex((p) => p.id === s.id) - i, false)}`}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ---------- 文言 ---------- */

const CONTEXTS = [
  { k: "好き", d: "同じ一杯や一皿が目当てで来ている" },
  { k: "作法", d: "食券・私語少なめ・食べたら出る" },
  { k: "制約", d: "現金のみ・予約不可" },
  { k: "共通の敵", d: "大人数で騒ぐ客や、映え目当ての行列が苦手" },
  { k: "少数性", d: "人があまり選ばない店を、自分で選んで来た" },
];

const FEATURES = [
  {
    t: "写真",
    d: "店の写真を、Google マップのように一覧と拡大で見られます。",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
        <path d="M5 5h3l1.5-2h5L16 5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm7 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
      </svg>
    ),
  },
  {
    t: "営業中",
    d: "いま開いているか、もうすぐ閉まるかを、一覧で見られます。",
    icon: <CheckIcon className="size-6" />,
  },
  {
    t: "アプリの中で経路",
    d: "現在地からの徒歩・電車の経路を、地図に描きます。",
    icon: <MapIcon className="size-6" />,
  },
  {
    t: "現在地の近く",
    d: "いる場所のまわりで、ジャンルを選んで探せます。",
    icon: <MyLocationIcon className="size-6" />,
  },
  {
    t: "LINE で送る",
    d: "友だちと行くときは、上位3軒をそのまま送れます。",
    icon: <PeopleIcon className="size-6" />,
  },
  {
    t: "マイ条件",
    d: "うれしいワードと NG ワードを、自分の言葉に変えられます。",
    icon: <TuneIcon className="size-6" />,
  },
];

const FORMULA: { l: string; v: string; tone: "base" | "plus" | "minus" }[] = [
  { l: "基本", v: String(BASE_POINT), tone: "base" },
  { l: "少数派（口コミ30〜300件がちょうどいい。1000件以上は減点）", v: "+12 〜 −15", tone: "plus" },
  {
    l: "うれしいワードが口コミに出る（1語）",
    v: `+${GOOD_POINT}（最大 +${GOOD_MAX}）`,
    tone: "plus",
  },
  {
    l: `同じ語が2件以上の口コミに出たら、その語の点は ${REPEAT_WEIGHT} 倍（上限は同じ。同じ人からは +${GOOD_PER_AUTHOR} まで）`,
    v: `×${REPEAT_WEIGHT}`,
    tone: "plus",
  },
  { l: "店の制約（現金のみ・予約不可。Google の店舗情報）", v: "各 +5", tone: "plus" },
  { l: "NGワードが口コミに出る（1語）", v: `−${NG_POINT}（最大 −${NG_MAX}）`, tone: "minus" },
  {
    l: `口コミが不自然（★4.6以上で100件以上／直近${RECENT_DAYS}日に集中）`,
    v: "−5 〜 −20",
    tone: "minus",
  },
  { l: "グループ向き（Google の店舗情報。友だちと行くときは数えない）", v: "−6", tone: "minus" },
  { l: "チェーンらしさ（店名から）", v: "−10", tone: "minus" },
];

const PROMISES = [
  { t: "行く前だけ使う", d: "並んでいる最中や、店を出たあとには使いません。" },
  {
    t: "記録しない",
    d: "位置も検索の履歴も保存しません。残すのは、この端末の中の語のリストだけです。",
  },
  { t: "費用ゼロで動く", d: "Google の無料枠の範囲で動くよう、1日の回数に上限を付けています。" },
];

/* ---------- ページ ---------- */

export default function Home() {
  const ex = lpExample();
  const quotes = lpQuoteExamples();
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="sticky top-0 z-20 border-line border-b bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Logo size={32} />
          <nav className="flex items-center gap-1" aria-label="ページ内のリンク">
            <a
              href="#how"
              className="hidden rounded-full px-4 py-2 text-sm hover:bg-surface-2 sm:block"
            >
              しくみ
            </a>
            <Link
              href="/map"
              className="rounded-full bg-brand px-4 py-2 font-bold text-on-brand text-sm hover:opacity-90"
            >
              マップを開く
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* 1. ヒーロー（深い緑黒の帯） */}
        <section
          className="relative overflow-hidden bg-[#1F2A26] text-white"
          aria-labelledby="hero-title"
        >
          <DotField className="pointer-events-none absolute -top-6 -right-24 w-[520px] opacity-30 md:right-0 md:w-[640px]" />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 md:grid-cols-[1.1fr_1fr] md:px-6 md:py-24">
            <div>
              <p className="font-bold text-[#F2A71B] text-sm">ジブンマップ ― 飲食店さがし</p>
              {/* 句の途中で折り返さないよう、句ごとにまとめて balance で整える */}
              <h1
                id="hero-title"
                className="jm-phrase mt-4 font-bold text-[34px] leading-[1.25] tracking-tight sm:text-[44px] md:text-[56px] md:leading-[1.15]"
              >
                <span className="inline-block">行列が嫌なのは、</span>
                <span className="inline-block">近さのせい</span>
                <span className="inline-block">じゃなかった。</span>
              </h1>
              <p className="mt-6 max-w-xl text-[17px] text-white/85 leading-[1.8]">
                行きたい街の<b className="text-white">飲食店</b>を、自分の意思で選ぶ人が集まる順に。
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={TRY_HREF}
                  className="inline-flex h-12 items-center rounded-full bg-[#F2A71B] px-7 font-bold text-[#1F2A26] transition hover:-translate-y-px hover:opacity-95"
                >
                  高円寺のラーメン屋を探す
                </Link>
                <Link
                  href={DEMO_HREF}
                  className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 font-medium text-white hover:bg-white/10"
                >
                  通信なしのデモ
                </Link>
              </div>
            </div>
            <PhoneMock town={ex.town} top3={ex.top3} />
          </div>
        </section>

        {/* 2. コンセプト */}
        <section className="bg-surface" aria-labelledby="concept-title">
          <div className="mx-auto w-full max-w-3xl px-4 py-16 md:px-6 md:py-20">
            <h2
              id="concept-title"
              className="jm-phrase font-bold text-2xl leading-snug md:text-3xl"
            >
              <Phrases
                parts={[
                  "飲食店を選んでから、",
                  "お店を出るまで。",
                  "そのときの",
                  "あなたの状態に",
                  "合わせて、",
                  "いちばんいい1軒を。",
                ]}
              />
            </h2>
            <p className="mt-5 text-[15px] text-muted leading-[1.8] md:text-base">
              「そのときの状態」は、たとえば
              <b className="text-ink">ひとりで行くか、友だちと行くか</b>
              。切り替えると、同じ店でも点数が変わります（下の「点数のしくみ」で試せます）。
            </p>
            <p className="mt-3 text-muted text-sm leading-[1.8]">
              お店を決めたあとの体験には、アプリは立ち入りません。使うのは行く前だけです。
            </p>
          </div>
        </section>

        {/* 3. 物語（課題 → 気づき → 解決） */}
        <section className="bg-bg" aria-labelledby="story-title">
          <div className="mx-auto w-full max-w-3xl px-4 py-16 md:px-6 md:py-20">
            <h2
              id="story-title"
              className="jm-phrase font-bold text-3xl tracking-tight md:text-4xl"
            >
              <Phrases parts={["なぜ、", "ジブンマップなのか"]} />
            </h2>
            <ol className="mt-10 grid gap-14">
              <li>
                <p className="font-bold text-mid text-sm">課題</p>
                <h3 className="jm-phrase mt-1 font-bold text-2xl">
                  <Phrases parts={["行列で、", "知らない人が", "近くて嫌"]} />
                </h3>
                <div className="mt-5">
                  <QueueArt />
                </div>
                <p className="mt-4 text-[15px] leading-[1.8] md:text-base">
                  飛行機の狭い席は、お金を払えば広い席にできる。混んだ電車は、時間をずらせる。
                  でも、行きたいお店の行列だけは、避けられない。
                </p>
              </li>
              <li>
                <p className="font-bold text-mid text-sm">気づき</p>
                <h3 className="jm-phrase mt-1 font-bold text-2xl">
                  <Phrases parts={["嫌なのは", "距離では", "なかった"]} />
                </h3>
                <div className="mt-5">
                  <QueueArt friends />
                </div>
                <p className="mt-4 text-[15px] leading-[1.8] md:text-base">
                  自分と同じ文脈を持たない人が、意図の読めない近さに来ると、不快になる。
                  同じ側だと感じられる人なら、同じ近さでも気にならない。同じ側だと感じる文脈は、5つありました。
                </p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {CONTEXTS.map((c) => (
                    <li
                      key={c.k}
                      className="flex items-baseline gap-2 rounded-2xl bg-surface px-3 py-2.5"
                    >
                      <span className="shrink-0 rounded-full border-2 border-[#F2A71B] px-2.5 py-0.5 font-bold text-sm">
                        {c.k}
                      </span>
                      <span className="text-muted text-sm leading-relaxed">{c.d}</span>
                    </li>
                  ))}
                </ul>
              </li>
              <li>
                <p className="font-bold text-mid text-sm">解決</p>
                <h3 className="jm-phrase mt-1 font-bold text-2xl">
                  <Phrases parts={["自分の意思で", "選ぶ人が", "集まる店を、", "行く前に選ぶ"]} />
                </h3>
                <div className="mt-5">
                  <CrowdArt />
                </div>
                <p className="mt-4 text-[15px] leading-[1.8] md:text-base">
                  Google
                  マップの飲食店を、口コミの多さや広告の順ではなく、「自分の意思で選ぶ人が集まる度」の点数で並べ替えます。
                  5つの文脈は、口コミの「うれしいワード」（一人・常連・食券・現金のみ
                  など）と、店の制約や口コミの件数として、点数の材料になっています。
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* 4. Google の順 vs あなたの順（山場） */}
        <section className="bg-surface" aria-labelledby="compare-title">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-6 md:py-24">
            <h2
              id="compare-title"
              className="jm-phrase font-bold text-3xl tracking-tight md:text-4xl"
            >
              <Phrases parts={["同じ5軒でも、", "並びが", "こんなに変わる"]} />
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-[1.8] md:text-base">
              Google は口コミの多さや広告で並べます。ジブンマップは、あなたの言葉で並べます。
            </p>
            <div className="mt-10">
              <Compare pop={ex.pop} mine={ex.mine} />
            </div>
            <p className="mt-6 text-muted text-xs leading-relaxed">
              {ex.town}（デモデータ・架空の街）の例です。デモの店には Google
              の順位がないため、「Google の順」は口コミの多い順に見立てています。
              点数はアプリと同じ計算（初期のうれしいワード・NG ワード）です。
            </p>
          </div>
        </section>

        {/* 5. 点数のしくみ */}
        <section id="how" className="scroll-mt-20 bg-bg" aria-labelledby="how-title">
          <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
            <div>
              <h2
                id="how-title"
                className="jm-phrase font-bold text-3xl tracking-tight md:text-4xl"
              >
                点数のしくみ
              </h2>
              <p className="mt-4 text-[15px] leading-[1.8] md:text-base">
                口コミに、あなたの「うれしいワード」が出れば点数が上がり、「NG
                ワード」が出れば下がります。 0〜100 の点数と、ひと言の評価（{verdict(80)}／
                {verdict(60)}／{verdict(35)}／{verdict(0)}）で並べます。
              </p>
              <figure className="mt-6 grid gap-2">
                <blockquote className="rounded-2xl bg-surface p-4 text-[15px] leading-[1.8]">
                  「<Highlighted text={quotes.good.text} words={DEFAULT_WORDS} />」
                  <span className="ml-1 text-muted text-xs">— {quotes.good.place}（架空）</span>
                </blockquote>
                <blockquote className="rounded-2xl bg-surface p-4 text-[15px] leading-[1.8]">
                  「<Highlighted text={quotes.ng.text} words={DEFAULT_WORDS} />」
                  <span className="ml-1 text-muted text-xs">— {quotes.ng.place}（架空）</span>
                </blockquote>
                <figcaption className="text-muted text-xs">
                  <mark className="jm-mark-good">緑</mark> はうれしいワード、
                  <mark className="jm-mark-ng">赤</mark> は NG ワード。
                </figcaption>
              </figure>
            </div>
            <div className="grid content-start gap-4">
              <LpScoreDemo />
              <details className="group rounded-3xl bg-surface p-5">
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 font-bold [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden="true"
                    className="inline-block text-muted text-xs transition-transform group-open:rotate-90"
                  >
                    ▸
                  </span>
                  くわしい計算式
                </summary>
                <ul className="mt-3 grid gap-2">
                  {FORMULA.map((f) => (
                    <li
                      key={f.l}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-surface-2 px-4 py-3 text-sm"
                    >
                      <span>{f.l}</span>
                      <span
                        className={`shrink-0 font-bold tabular-nums ${
                          f.tone === "plus"
                            ? "text-hi"
                            : f.tone === "minus"
                              ? "text-lo"
                              : "text-muted"
                        }`}
                      >
                        {f.v}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-muted text-xs leading-relaxed">
                  合計は 0〜100 に収めます。並びは点数の高い順、同点なら Google の検索結果の順です。
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* 6. できること */}
        <section className="bg-surface" aria-labelledby="features-title">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-6 md:py-20">
            <h2 id="features-title" className="jm-phrase font-bold text-3xl tracking-tight">
              できること
            </h2>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.t} className="flex gap-3 rounded-2xl border border-line bg-bg p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#1F2A26] text-[#F2A71B]">
                    {f.icon}
                  </span>
                  <span>
                    <span className="block font-bold">{f.t}</span>
                    <span className="mt-0.5 block text-muted text-sm leading-relaxed">{f.d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 7. アプリのように使う */}
        <section className="bg-[#1F2A26] text-white" aria-labelledby="pwa-title">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-6 md:py-20">
            <h2 id="pwa-title" className="jm-phrase font-bold text-3xl tracking-tight">
              アプリのように使う
            </h2>
            <p className="mt-3 text-white/80 leading-[1.8]">
              iPhone では、ホーム画面に追加すると全画面で開けます。
            </p>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              <li className="rounded-2xl bg-white/5 p-5">
                <span className="text-[#F2A71B] text-sm">1</span>
                <span
                  className="mt-3 grid size-12 place-items-center rounded-full bg-white/10"
                  aria-hidden="true"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="currentColor" />
                  </svg>
                </span>
                <p className="mt-3 font-bold">Safari で開く</p>
              </li>
              <li className="rounded-2xl bg-white/5 p-5">
                <span className="text-[#F2A71B] text-sm">2</span>
                <span
                  className="mt-3 grid size-12 place-items-center rounded-full bg-white/10"
                  aria-hidden="true"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3v11M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
                  </svg>
                </span>
                <p className="mt-3 font-bold">共有ボタンを押す</p>
              </li>
              <li className="rounded-2xl bg-white/5 p-5">
                <span className="text-[#F2A71B] text-sm">3</span>
                <span className="mt-3 block">
                  <LogoMark size={48} />
                </span>
                <p className="mt-3 font-bold">「ホーム画面に追加」</p>
              </li>
            </ol>
            <p className="mt-5 text-sm text-white/70">
              Android は、メニューから「アプリをインストール」。
            </p>
          </div>
        </section>

        {/* 8. 約束 */}
        <section className="bg-bg" aria-labelledby="promise-title">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-6 md:py-20">
            <h2 id="promise-title" className="jm-phrase font-bold text-3xl tracking-tight">
              約束
            </h2>
            <ul className="mt-8 grid gap-3 md:grid-cols-3">
              {PROMISES.map((p) => (
                <li key={p.t} className="rounded-2xl border border-line bg-surface p-5">
                  <p className="font-bold text-lg">{p.t}</p>
                  <p className="mt-1 text-muted text-sm leading-[1.8]">{p.d}</p>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href={TRY_HREF}
                className="inline-flex h-12 items-center rounded-full bg-brand px-7 font-bold text-on-brand hover:opacity-90"
              >
                高円寺のラーメン屋を探す
              </Link>
              <Link
                href={DEMO_HREF}
                className="inline-flex h-12 items-center rounded-full border border-line px-6 font-medium hover:bg-surface-2"
              >
                通信なしのデモ
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-line border-t bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-muted text-sm md:flex-row md:items-center md:justify-between md:px-6">
          <div className="grid gap-2">
            <Logo size={28} />
            <p>POSSE アルムナイハッカソン2026 チーム Connect Spirit</p>
            <p className="text-xs">1+1=10 / 感情を大切に</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="そのほかのリンク">
            <a href="/prototypes" className="hover:text-ink hover:underline">
              試作アーカイブ（60本）
            </a>
            <Link href={DEMO_HREF} className="hover:text-ink hover:underline">
              通信なしのデモ
            </Link>
            <Link href="/dev" className="hover:text-ink hover:underline">
              開発者向け: 接続確認
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
