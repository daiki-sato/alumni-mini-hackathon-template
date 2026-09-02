"use client";

import { useEffect, useState } from "react";

function remainingLabel(ms: number) {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (days > 0) {
    return `${days}日 ${hours}時間 ${minutes}分`;
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 締切をまたいだ瞬間に画面を切り替えるため、サーバーに再取得させる。
 * 締切判定そのものはサーバー側と RLS で行うので、ここは表示だけを担う。
 */
export function Countdown({ closedAt, onExpire }: { closedAt: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() => new Date(closedAt).getTime() - Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const next = new Date(closedAt).getTime() - Date.now();
      setRemaining(next);

      if (next <= 0) {
        clearInterval(timer);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [closedAt, onExpire]);

  if (remaining <= 0) {
    return <span className="font-bold text-red-700 dark:text-red-400">締め切りました</span>;
  }

  return (
    <span className="font-bold tabular-nums text-amber-800 dark:text-amber-300">
      あと {remainingLabel(remaining)}
    </span>
  );
}
