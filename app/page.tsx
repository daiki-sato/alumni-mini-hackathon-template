import Link from "next/link";
import {
  BASE_POINT,
  DEFAULT_GOOD_WORDS,
  DEFAULT_NG_WORDS,
  GOOD_MAX,
  GOOD_PER_AUTHOR,
  GOOD_POINT,
  NG_MAX,
  NG_POINT,
  RECENT_DAYS,
  REPEAT_WEIGHT,
  verdict,
} from "@/lib/jibunmap/score";
import { LIVE_EXAMPLES } from "@/lib/jibunmap/suggest";
import { Logo, LogoMark } from "./_components/Logo";

/** 入口のボタンと発表のリンクは、この URL（開いた瞬間に1回だけ検索する） */
const TRY_HREF = `/map?q=${encodeURIComponent("高円寺 ラーメン")}`;

function OpenMap({ className = "" }: { className?: string }) {
  return (
    <Link
      href={TRY_HREF}
      className={`inline-flex h-12 items-center justify-center rounded-full bg-brand px-7 font-bold text-on-brand shadow-e1 transition hover:-translate-y-px hover:shadow-e2 dark:bg-accent dark:text-on-accent ${className}`}
    >
      高円寺のラーメン屋を探す
    </Link>
  );
}

/** アプリ画面のプレビュー（画像は使わず CSS と SVG で描く） */
function Preview() {
  const cards = [
    { n: "中華そば 小石", s: 84, w: ["一人", "カウンター", "常連"] },
    { n: "麺処 たけ", s: 84, w: ["食券", "通って"] },
    { n: "定食 まるやま", s: 80, w: ["一人", "常連"] },
  ];
  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-line bg-surface shadow-e2"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 border-line border-b px-3 py-2">
        <LogoMark size={20} />
        <div className="h-7 flex-1 rounded-full bg-surface-2 px-3 text-[11px] text-muted leading-7">
          学生街 ラーメン
        </div>
      </div>
      <div className="grid grid-cols-[1fr] sm:grid-cols-[46%_1fr]">
        <div className="grid content-start gap-2 p-3">
          <div className="rounded-2xl bg-surface-2 p-2.5">
            <div className="font-bold text-[11px]">NGワード</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {["デート", "映え", "大人数"].map((w) => (
                <span key={w} className="rounded-full bg-lo-soft px-1.5 py-0.5 text-[9px] text-lo">
                  {w} ×
                </span>
              ))}
            </div>
          </div>
          <div className="font-bold text-[11px]">点数の高い順</div>
          {cards.map((c, i) => (
            <div
              key={c.n}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2 shadow-e1"
            >
              <span className="grid size-5 place-items-center rounded-full bg-accent font-bold text-[10px] text-on-accent">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-[11px]">{c.n}</span>
                <span className="mt-0.5 flex gap-0.5">
                  {c.w.map((w) => (
                    <span key={w} className="rounded-full bg-hi-soft px-1 text-[8px] text-hi">
                      {w}
                    </span>
                  ))}
                </span>
              </span>
              <span className="rounded-lg bg-hi-soft px-1.5 py-0.5 font-bold text-[11px] text-hi tabular-nums">
                {c.s}
              </span>
            </div>
          ))}
        </div>
        <svg viewBox="0 0 300 260" className="hidden h-full w-full sm:block" aria-hidden="true">
          <rect width="300" height="260" fill="var(--map-ground)" />
          <path
            d="M0 80 L300 70 M0 190 L300 200 M90 0 L100 260 M210 0 L200 260"
            stroke="var(--map-road-edge)"
            strokeWidth="12"
          />
          <path
            d="M0 80 L300 70 M0 190 L300 200 M90 0 L100 260 M210 0 L200 260"
            stroke="var(--map-road)"
            strokeWidth="10"
          />
          <path
            d="M0 240 C80 220 160 250 300 228"
            stroke="var(--map-water)"
            strokeWidth="16"
            fill="none"
          />
          {[
            [30, 30, 40, 26],
            [120, 20, 60, 34],
            [230, 100, 50, 60],
            [20, 110, 50, 50],
            [120, 110, 64, 56],
          ].map(([x, y, w, h]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={w}
              height={h}
              rx="5"
              fill="var(--map-block)"
            />
          ))}
          {[
            [60, 150, "hi"],
            [250, 40, "lo"],
            [170, 230, "mid"],
            [40, 60, "hi"],
            [270, 170, "lo"],
          ].map(([x, y, b]) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="6"
              fill={`var(--${b})`}
              stroke="#fff"
              strokeWidth="2"
            />
          ))}
          {[
            [150, 95, 1],
            [110, 160, 2],
            [215, 140, 3],
          ].map(([x, y, n]) => (
            <g key={n} transform={`translate(${x} ${y})`}>
              <path d="M0 0 L-5 -8 H5 Z" fill="var(--accent)" />
              <rect
                x="-15"
                y="-27"
                width="30"
                height="20"
                rx="10"
                fill="var(--accent)"
                stroke="#fff"
                strokeWidth="2"
              />
              <text
                y="-13"
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="var(--on-accent)"
              >
                {n}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** 課題 → 気づき → 解決 */
const STORY = [
  {
    k: "課題",
    t: "行列で、知らない人が近くて嫌",
    d: "人気の店に並ぶと、前後の知らない人との距離が気になって、食事を楽しめない。",
  },
  {
    k: "気づき",
    t: "嫌なのは距離ではなかった",
    d: "嫌なのは近さそのものではなく、「仲間だと思えない人」との近さ。仲間だと思えるのは、自分の意思で、人があまり選ばない店を選んで来た人です。",
  },
  {
    k: "解決",
    t: "自分の意思で選ぶ人が集まる順に",
    d: "Google マップの飲食店を、口コミの多さや広告の順ではなく、「自分の意思で選ぶ人が集まる度」の点数で並べ替えます。",
  },
];

const FEATURES = [
  {
    t: "点数の高い順に、理由つきで",
    d: "一人客・常連・店の制約の気配で上がり、口コミの多すぎ・急な増え方・チェーンらしさで下がる 0〜100 の点数。決め手の口コミの一文と、Google の検索結果では何番目だったかも見せます。",
  },
  {
    t: "自分だけのうれしいワードと NG ワード",
    d: "「デート」「映え」「大人数」。口コミに出てほしくない語、出てほしい語を足したり外したりできます。並びはすぐ変わります。",
  },
  {
    t: "ひとりで／友だちと",
    d: "友だちと行くときは、「ひとり」「カウンター」など、ひとりのときだけうれしい語を数えずに並べ直します。",
  },
];

const FORMULA: { l: string; v: string; tone: "base" | "plus" | "minus" }[] = [
  { l: "基本", v: String(BASE_POINT), tone: "base" },
  { l: "少数派（口コミ30〜300件がちょうどいい。1000件以上は減点）", v: "+12 〜 −15", tone: "plus" },
  {
    l: `うれしいワードが口コミに出る（1語）`,
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
  { l: "グループ向き（Google の店舗情報）", v: "−6", tone: "minus" },
  { l: "チェーンらしさ（店名から）", v: "−10", tone: "minus" },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="sticky top-0 z-20 border-line border-b bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Logo />
          <nav className="flex items-center gap-1">
            <a
              href="#how"
              className="hidden rounded-full px-4 py-2 text-sm hover:bg-surface-2 sm:block"
            >
              しくみ
            </a>
            <Link
              href="/map"
              className="rounded-full bg-brand px-4 py-2 font-bold text-on-brand text-sm hover:opacity-90 dark:bg-accent dark:text-on-accent"
            >
              マップを開く
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.05fr_1fr] md:px-6 md:py-20">
          <div>
            <p className="font-bold text-mid text-sm">ジブンマップ ― 飲食店さがし</p>
            {/* 句の途中で折り返さないよう、句ごとにまとめて balance で整える */}
            <h1 className="mt-3 text-balance font-bold text-[32px] leading-[1.3] tracking-tight sm:text-[40px] md:text-5xl md:leading-[1.25]">
              <span className="inline-block">行列が嫌なのは、</span>
              <span className="inline-block">近さのせい</span>
              <span className="inline-block">じゃなかった。</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed">
              行きたい街の<b>飲食店</b>を、自分の意思で選ぶ人が集まる順に。
            </p>
            <p className="mt-3 max-w-xl text-muted text-sm leading-relaxed">
              Google マップの店の情報を、口コミの多さや広告の順ではなく、あなたのうれしいワードと NG
              ワードで付けた点数の高い順に並べます。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <OpenMap />
              <a
                href="#how"
                className="inline-flex h-12 items-center rounded-full px-5 font-medium text-sm hover:bg-surface-2"
              >
                しくみを見る
              </a>
            </div>
          </div>
          {/* スマホでは下に回して小さく */}
          <div className="mx-auto w-full max-w-sm md:max-w-none">
            <Preview />
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-14 md:px-6" aria-labelledby="story">
          <h2 id="story" className="sr-only">
            ジブンマップができるまで
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STORY.map((x) => (
              <li key={x.k} className="rounded-3xl border border-line bg-surface p-6 shadow-e1">
                <span className="inline-block rounded-full bg-accent px-3 py-0.5 font-bold text-on-accent text-xs">
                  {x.k}
                </span>
                <h3 className="mt-3 text-balance font-bold text-lg">{x.t}</h3>
                <p className="mt-2 text-muted text-sm leading-relaxed">{x.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6" aria-labelledby="demo">
          <div className="rounded-3xl bg-accent-soft p-6 md:p-8">
            <h2 id="demo" className="font-bold text-2xl">
              デモ: 例のボタンから試す
            </h2>
            <p className="mt-2 text-muted text-sm">
              押すと、その街の飲食店を点数の高い順に並べます。
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {LIVE_EXAMPLES.map((q) => (
                <li key={q}>
                  <Link
                    href={`/map?q=${encodeURIComponent(q)}`}
                    className="inline-flex h-11 items-center rounded-full border border-line bg-surface px-5 font-medium text-sm hover:bg-surface-2"
                  >
                    {q}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6" aria-labelledby="features">
          <h2 id="features" className="font-bold text-2xl">
            特長
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <li key={f.t} className="rounded-3xl border border-line bg-surface p-6 shadow-e1">
                <span className="grid size-9 place-items-center rounded-full bg-surface-2 font-bold tabular-nums">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-bold text-lg">{f.t}</h3>
                <p className="mt-2 text-muted text-sm leading-relaxed">{f.d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="scroll-mt-20 bg-surface py-16">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 md:grid-cols-[1fr_1.2fr] md:px-6">
            <div>
              <h2 className="font-bold text-3xl">しくみ</h2>
              <p className="mt-4 text-muted leading-relaxed">
                嫌なのは知らない人との距離そのものではなく、「仲間だと思えない人」との近さでした。
                仲間だと思えるのは、自分の意思で、人があまり選ばない店を選んで来た人。
              </p>
              <p className="mt-3 text-muted leading-relaxed">
                そこで、Google
                マップから取れる口コミ件数・評価・口コミの本文・支払い方法・予約の可否を材料に、
                その店に「自分の意思で選ぶ人が集まる度」を計算します。点数は Google
                の順位とは別物です。
              </p>
              <div className="mt-6 grid gap-3 text-sm">
                <div>
                  <p className="font-bold">うれしいワード（初期値）</p>
                  <p className="mt-1.5 flex flex-wrap gap-1">
                    {DEFAULT_GOOD_WORDS.map((w) => (
                      <span key={w} className="rounded-full bg-hi-soft px-2 py-0.5 text-hi text-xs">
                        {w}
                      </span>
                    ))}
                  </p>
                </div>
                <div>
                  <p className="font-bold">NGワード（初期値）</p>
                  <p className="mt-1.5 flex flex-wrap gap-1">
                    {DEFAULT_NG_WORDS.map((w) => (
                      <span key={w} className="rounded-full bg-lo-soft px-2 py-0.5 text-lo text-xs">
                        {w}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl bg-surface-2 p-5 md:p-6">
              <h3 className="font-bold">集まる度の計算（0〜100に収める）</h3>
              <ul className="mt-4 grid gap-2">
                {FORMULA.map((f) => (
                  <li
                    key={f.l}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3 text-sm"
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
              <p className="mt-4 text-muted text-xs leading-relaxed">
                点数の横には、ひと言の評価を出します（80以上「{verdict(80)}」・60以上「{verdict(60)}
                」・35以上「
                {verdict(35)}」・それ未満「{verdict(0)}」）。 並びは点数の高い順。同点なら Google
                の検索結果の順です。
              </p>
            </div>
          </div>
        </section>

        <section className="bg-brand py-14 text-on-brand">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-4 md:flex-row md:items-center md:px-6">
            <div>
              <p className="font-bold text-2xl md:text-3xl">使うのは行く前だけ。記録はしない。</p>
              <p className="mt-2 text-sm opacity-80">
                並んでいる最中や店を出た後には使いません。保存するのは、あなたの語のリストだけ（この端末の中）。
              </p>
            </div>
            <Link
              href={TRY_HREF}
              className="inline-flex h-12 shrink-0 items-center rounded-full bg-accent px-7 font-bold text-on-accent hover:opacity-90"
            >
              高円寺のラーメン屋を探す
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-line border-t bg-bg">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-muted text-sm md:flex-row md:items-center md:justify-between md:px-6">
          <p>POSSE アルムナイハッカソン2026 チームA</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="/prototypes" className="hover:text-ink hover:underline">
              試作アーカイブ（60本）
            </a>
            <Link href="/dev" className="hover:text-ink hover:underline">
              開発者向け: 接続確認
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
