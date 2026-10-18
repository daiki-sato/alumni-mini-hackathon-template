import type { Metadata } from "next";
import { MapApp } from "./_components/MapApp";

export const metadata: Metadata = {
  title: "マップ | ジブンマップ",
  description:
    "Google マップの店を、口コミの多さや広告ではなく、あなたのうれしいワードと NG ワードで付けた点数の高い順に並べます。",
};

export default function MapPage() {
  return <MapApp />;
}
