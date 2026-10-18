import type { MetadataRoute } from "next";
import { ICON_BG } from "./_components/appIcon";

// ホーム画面に追加したときのアプリ情報（App Store には出さない）
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ジブンマップ",
    short_name: "ジブンマップ",
    description: "行きたい街の飲食店を、あなたの幸福度が高くなりそうな順に。",
    start_url: "/map",
    scope: "/",
    display: "standalone",
    lang: "ja",
    // アイコンの地色にそろえる（起動時の画面とステータスバーの色）
    background_color: ICON_BG,
    theme_color: ICON_BG,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
