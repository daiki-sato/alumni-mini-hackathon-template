"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "./Icons";

const CLOSED_KEY = "jibunmap-a2hs-closed";

/** iPhone・iPad の Safari で、まだホーム画面のアプリとして開いていないか */
function shouldOffer(): boolean {
  try {
    if (localStorage.getItem(CLOSED_KEY) === "1") return false;
  } catch {
    return false;
  }
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  // Chrome・Firefox など iOS のほかのブラウザでは、ホーム画面に追加の手順が違うので出さない
  const safari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return ios && safari && !standalone;
}

/** Safari の共有ボタンの形 */
function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="inline size-5 align-[-4px]" aria-hidden="true">
      <path
        d="M12 3v11M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 「ホーム画面に追加」の案内。iPhone の Safari で、まだアプリとして開いていないときだけ、
 * 検索を1回したあとに画面の下に小さく出す（はじめの設定の直後には出さない）。閉じたら二度と出さない
 */
export function InstallHint({ ready }: { ready: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (ready) setShow(shouldOffer());
  }, [ready]);
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(CLOSED_KEY, "1");
    } catch {
      // 保存できなくても、このページでは閉じたままにする
    }
  };
  return (
    <div
      role="note"
      className="anim-pop-in fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex items-start gap-2 rounded-2xl border border-line bg-surface p-3 text-sm shadow-e2 md:hidden"
    >
      <p className="min-w-0 flex-1 leading-relaxed">
        共有ボタン <ShareGlyph /> →「ホーム画面に追加」でアプリのように使えます。
        <span className="mt-0.5 block text-muted text-xs">
          設定（NG ワードなど）は、ホーム画面のアプリとは別に保存されます。
        </span>
      </p>
      <button
        type="button"
        onClick={close}
        aria-label="案内を閉じる"
        className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}
