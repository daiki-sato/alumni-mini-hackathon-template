import { appIcon } from "./_components/appIcon";

// iPhone のホーム画面のアイコン（apple-touch-icon、180px）。角丸は iOS が付ける
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180);
}
