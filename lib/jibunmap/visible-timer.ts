// ページが見えているあいだだけ進むタイマー。
// 裏のタブ（document.hidden）ではブラウザが読み込みや setTimeout を絞るので、そのあいだは数えない。
// このファイルは何も import しない（node の型除去だけで検証スクリプトから読むため）。

export type TimerEnv = {
  isHidden(): boolean;
  onVisibilityChange(fn: () => void): () => void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  now(): number;
};

export function browserTimerEnv(): TimerEnv {
  return {
    isHidden: () => document.hidden,
    onVisibilityChange: (fn) => {
      document.addEventListener("visibilitychange", fn);
      return () => document.removeEventListener("visibilitychange", fn);
    },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id as number),
    now: () => Date.now(),
  };
}

/**
 * 見えているあいだの時間が ms に達したら onTimeout を呼ぶ。隠れたら止め、見えたら残り時間から再開する。
 * 戻り値で取り消す
 */
export function visibleTimeout(
  ms: number,
  onTimeout: () => void,
  env: TimerEnv = browserTimerEnv(),
): () => void {
  let left = ms;
  let started = 0;
  let id: unknown = null;
  let done = false;

  const start = () => {
    if (done || id !== null) return;
    started = env.now();
    id = env.setTimeout(() => {
      id = null;
      done = true;
      off();
      onTimeout();
    }, left);
  };
  const pause = () => {
    if (id === null) return;
    env.clearTimeout(id);
    id = null;
    left = Math.max(0, left - (env.now() - started));
  };
  const off = env.onVisibilityChange(() => {
    if (env.isHidden()) pause();
    else start();
  });
  if (!env.isHidden()) start();

  return () => {
    done = true;
    pause();
    off();
  };
}
