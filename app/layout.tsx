import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";

import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ジブンマップ",
  description:
    "行きたい街で、自分の意思で選ぶ人が集まる店を探せる地図。一人客・常連・店の制約・SNS露出から、行く前に今日の3軒を選びます。",
};

// 画面の端（ノッチ・ホームバー）まで描き、余白は env(safe-area-inset-*) で取る
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
