import Link from "next/link";
import { BrandMark } from "./BrandMark";

/**
 * マークのタイル（角丸 22%）。ダークではヘッダーの地色と近くなるので、明るめの細い輪郭を付けて沈まないようにする
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 overflow-hidden dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
      aria-hidden="true"
    >
      <BrandMark size={size} />
    </span>
  );
}

/**
 * ロゴ（マークのタイル＋「ジブンマップ」）。size はマークの一辺で、文字の行の高さもそろえる
 * （アプリのヘッダーは 28、入口ページのヘッダーは 32）
 */
export function Logo({
  href = "/",
  compact = false,
  size = 28,
}: {
  href?: string;
  compact?: boolean;
  size?: number;
}) {
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-2 rounded-full pr-2 font-bold text-ink tracking-tight"
      aria-label="ジブンマップ トップへ"
    >
      <LogoMark size={size} />
      <span
        className={compact ? "hidden text-lg sm:inline" : "text-lg"}
        style={{ lineHeight: `${size}px` }}
      >
        ジブンマップ
      </span>
    </Link>
  );
}
