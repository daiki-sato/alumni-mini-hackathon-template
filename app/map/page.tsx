import type { Metadata } from "next";
import { MapApp } from "./_components/MapApp";

export const metadata: Metadata = {
  title: "マップ | ジブンマップ",
  description:
    "Google マップの店を、口コミの多さや広告ではなく、あなたの判断軸と NG ワードで並べ替えます。",
};

export default function MapPage() {
  return <MapApp />;
}
