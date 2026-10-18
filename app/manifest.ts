import type { MetadataRoute } from "next";
import { ICON_BG } from "./_components/appIcon";

// ホーム画面に追加したときのアプリ情報（App Store には出さない）
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ジブンマップ",
    short_name: "ジブンマップ",
    description: "行きたい街の飲食店を、自分の意思で選ぶ人が集まる順に。",
    start_url: "/map",
    scope: "/",
    display: "standalone",
    lang: "ja",
    // 面の色（ライト）。起動時の画面とステータスバーの色
    background_color: ICON_BG,
    theme_color: "#ffffff",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
