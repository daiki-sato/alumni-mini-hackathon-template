import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";

import "./globals.css";
import { SwRegister } from "./_components/SwRegister";

/**
 * Service Worker の版。デプロイごとのコミット（Vercel がビルド時に渡す）。
 * ビルドの中で同じ値になるものを使う（時刻だとページごとに違う値になる）
 */
const SW_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 12);

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ジブンマップ",
  // iPhone のホーム画面に追加したとき、アプリのように全画面で開く
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ジブンマップ" },
  description:
    "行きたい街の飲食店を、自分の意思で選ぶ人が集まる順に。一人客・常連・店の制約・SNS露出から付けた点数の高い順に、理由つきで並べます。",
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
      <body className="flex min-h-full flex-col">
        {children}
        <SwRegister version={SW_VERSION} />
      </body>
    </html>
  );
}
