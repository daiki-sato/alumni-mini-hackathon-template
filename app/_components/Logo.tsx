import Link from "next/link";

/** 地図ピン型のマーク */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 2.5c-5.8 0-10.5 4.6-10.5 10.4C5.5 20.6 16 29.5 16 29.5s10.5-8.9 10.5-16.6C26.5 7.1 21.8 2.5 16 2.5Z"
        fill="var(--logo)"
      />
      <circle cx="16" cy="13" r="4.6" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-2 rounded-full pr-2 font-bold text-ink tracking-tight"
      aria-label="ジブンマップ トップへ"
    >
      <LogoMark />
      <span className={compact ? "hidden text-lg sm:inline" : "text-lg"}>ジブンマップ</span>
    </Link>
  );
}
