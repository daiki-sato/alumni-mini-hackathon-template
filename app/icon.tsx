import { appIcon } from "./_components/appIcon";

// ホーム画面と manifest 用のアイコン（/icon/192・/icon/512・/icon/maskable）
export function generateImageMetadata() {
  return [
    { id: "192", contentType: "image/png", size: { width: 192, height: 192 } },
    { id: "512", contentType: "image/png", size: { width: 512, height: 512 } },
    { id: "maskable", contentType: "image/png", size: { width: 512, height: 512 } },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const i = String(await id);
  if (i === "192") return appIcon(192);
  // maskable は端が切られても欠けないよう、ピンを小さめにする
  if (i === "maskable") return appIcon(512, 0.5);
  return appIcon(512);
}
