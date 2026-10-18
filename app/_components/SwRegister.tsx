"use client";

import { useEffect } from "react";

/**
 * Service Worker を登録する。本番（https）でだけ。version はデプロイごとのコミットで、
 * 変わったら sw.js が古いキャッシュを消す
 */
export function SwRegister({ version }: { version: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (window.location.protocol !== "https:" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" })
      .catch((e) => console.warn("[ジブンマップ] Service Worker を登録できませんでした", e));
  }, [version]);
  return null;
}
