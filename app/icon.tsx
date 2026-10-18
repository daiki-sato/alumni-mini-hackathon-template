import { appIcon } from "./_components/appIcon";

// ファビコンと、ホーム画面・manifest 用のアイコン（/icon/16・32・192・512・maskable）
export function generateImageMetadata() {
  return [
    { id: "16", contentType: "image/png", size: { width: 16, height: 16 } },
    { id: "32", contentType: "image/png", size: { width: 32, height: 32 } },
    { id: "192", contentType: "image/png", size: { width: 192, height: 192 } },
    { id: "512", contentType: "image/png", size: { width: 512, height: 512 } },
    { id: "maskable", contentType: "image/png", size: { width: 512, height: 512 } },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const i = String(await id);
  // 16px は点がつぶれるので簡略形
  if (i === "16") return appIcon(16, { small: true });
  if (i === "32") return appIcon(32);
  if (i === "192") return appIcon(192);
  // maskable は点とピンを 0.8 倍にして、中央 80% の円に収める
  if (i === "maskable") return appIcon(512, { inner: 0.8 });
  return appIcon(512);
}
