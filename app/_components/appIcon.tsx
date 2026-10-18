// アプリのアイコン（ホーム画面・manifest・ファビコン用）。ブランドのマークを全面に置く（角丸は OS が付ける）。
// next/og の ImageResponse で PNG にする（追加のパッケージは使わない）

import { ImageResponse } from "next/og";
import { BrandMark, MARK_BG } from "./BrandMark";

/** 地色。manifest の theme_color・background_color もこれにそろえる */
export const ICON_BG = MARK_BG;

/**
 * size: 出力の一辺（px）。
 * inner: 点とピンの大きさ（maskable は 0.8 でセーフゾーン＝中央 80% の円に収める。地色は全面）。
 * small: 16px 用の簡略形（点を 2×2 にする）
 */
export function appIcon(
  size: number,
  opts: { inner?: number; small?: boolean } = {},
): ImageResponse {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: ICON_BG }}>
      <BrandMark size={size} inner={opts.inner} small={opts.small} />
    </div>,
    { width: size, height: size },
  );
}
