// アプリのアイコン（ホーム画面・manifest 用）。ロゴの地図ピンとアンバーの点を、明るい面の上に描く。
// next/og の ImageResponse で PNG にする（追加のパッケージは使わない）

import { ImageResponse } from "next/og";

/** 面の色（ライト）と、ロゴの色 */
export const ICON_BG = "#f6f7f3";
const INK = "#1f2a26";
const ACCENT = "#f2a71b";

/**
 * size: 出力の一辺（px）。scale: ピンの大きさ（一辺に対する割合）。
 * maskable は、端が切られても欠けないよう小さめに描く（安全域は中央の 80%）
 */
export function appIcon(size: number, scale = 0.72): ImageResponse {
  const pin = Math.round(size * scale);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: ICON_BG,
      }}
    >
      <svg width={pin} height={pin} viewBox="0 0 32 32" role="img" aria-label="ジブンマップ">
        <path
          d="M16 2.5c-5.8 0-10.5 4.6-10.5 10.4C5.5 20.6 16 29.5 16 29.5s10.5-8.9 10.5-16.6C26.5 7.1 21.8 2.5 16 2.5Z"
          fill={INK}
        />
        <circle cx="16" cy="13" r="4.6" fill={ACCENT} />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
