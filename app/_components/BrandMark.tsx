// ブランドのマーク「群衆の中の1軒」。並ぶ店（点）の中で、1つだけがあなたのピン。
// 色は3つだけ（深い緑黒・点・アンバー）。文字は入れない。アイコン・ロゴ・プレビューで同じ形を使う

export const MARK_BG = "#1F2A26";
const DOT = "#4C5C54";
const AMBER = "#F2A71B";

/** 3×3 の点のうち、右上（74,26）だけを欠いた8つ */
const DOTS: [number, number][] = [
  [26, 26],
  [50, 26],
  [26, 50],
  [50, 50],
  [74, 50],
  [26, 74],
  [50, 74],
  [74, 74],
];

/** 16px 用の簡略形: 2×2 の点のうち右上を欠いた3つ＋ピン（小さいと 3×3 の点がつぶれるため） */
const DOTS_SMALL: [number, number][] = [
  [30, 30],
  [30, 70],
  [70, 70],
];

/**
 * マーク（viewBox 0 0 100 100）。
 * inner: 点とピンの大きさ（maskable は 0.8 で中央のセーフゾーンに収める。地色は全面に塗る）。
 * small: 16px 用の簡略形
 */
export function BrandMark({
  size,
  inner = 1,
  small = false,
  title,
}: {
  size: number;
  inner?: number;
  small?: boolean;
  title?: string;
}) {
  const dots = small ? DOTS_SMALL : DOTS;
  const r = small ? 11 : 6.5;
  // 簡略形では、ピンを欠けた右上（70,30）に大きめに置く
  const pin = small ? "translate(70,33) scale(0.95)" : "translate(74,30) scale(0.62)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="100" height="100" fill={MARK_BG} />
      <g transform={`translate(50 50) scale(${inner}) translate(-50 -50)`}>
        {dots.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={DOT} />
        ))}
        <g transform={pin}>
          <path
            d="M0-22c-12 0-21 9-21 21 0 15 21 33 21 33s21-18 21-33C21-13 12-22 0-22z"
            fill={AMBER}
          />
          <circle cx="0" cy="-1" r="8" fill={MARK_BG} />
        </g>
      </g>
    </svg>
  );
}
