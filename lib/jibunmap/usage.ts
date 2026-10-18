// 費用の安全策: Google の有料の呼び出しの回数を「このブラウザで1日あたり」数える。
// localStorage の日付キー（jibunmap-usage-YYYY-MM-DD）に回数だけを置く（Places のデータは置かない）。
// タブを開き直しても回数は消えない。日付は端末のローカル日付で、前日以前のキーは読むときに消す。
// このファイルは何も import しない（node の型除去だけで検証スクリプトから読むため）。

export type UsageKind = "search" | "route" | "photo" | "map";

/** 1日あたりの上限 */
export const DAILY_LIMITS: Record<UsageKind, number> = {
  search: 30,
  route: 30,
  photo: 100,
  map: 50,
};

export const USAGE_PREFIX = "jibunmap-usage-";

type Store = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  key(i: number): string | null;
  readonly length: number;
};

let storeOverride: Store | null | undefined;
let clock: () => Date = () => new Date();
/** 保存できない環境（プライベートモードなど）では、メモリ上で数える */
const mem = new Map<string, Record<UsageKind, number>>();

/** 検証用: 保存先と時計を差し替える（null で「保存できない環境」） */
export function setUsageEnv(store: Store | null | undefined, now?: () => Date): void {
  storeOverride = store;
  if (now) clock = now;
  mem.clear();
}

function store(): Store | null {
  if (storeOverride !== undefined) return storeOverride;
  try {
    return (globalThis as { localStorage?: Store }).localStorage ?? null;
  } catch {
    return null;
  }
}

/** 端末のローカル日付（YYYY-MM-DD） */
export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const empty = (): Record<UsageKind, number> => ({ search: 0, route: 0, photo: 0, map: 0 });

function todayKey(): string {
  return `${USAGE_PREFIX}${localDate(clock())}`;
}

function read(): Record<UsageKind, number> {
  const key = todayKey();
  const s = store();
  const m = mem.get(key) ?? empty();
  if (!s) return m;
  try {
    // 前日以前のキーは消す
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k?.startsWith(USAGE_PREFIX) && k !== key) s.removeItem(k);
    }
    const v = JSON.parse(s.getItem(key) ?? "{}") as Partial<Record<UsageKind, unknown>>;
    const out = empty();
    for (const kind of Object.keys(out) as UsageKind[]) {
      const n = Number(v[kind]);
      // 保存が書き換えられても、メモリで数えた分より減らさない
      out[kind] = Math.max(Number.isFinite(n) ? n : 0, m[kind]);
    }
    return out;
  } catch {
    return m;
  }
}

function write(v: Record<UsageKind, number>): void {
  const key = todayKey();
  mem.set(key, v);
  try {
    store()?.setItem(key, JSON.stringify(v));
  } catch {
    // 保存できなくてもメモリ上で数える
  }
}

/** 今日これまでに使った回数 */
export function usageCount(kind: UsageKind): number {
  return read()[kind];
}

/** 今日の残り回数 */
export function usageLeft(kind: UsageKind): number {
  return Math.max(0, DAILY_LIMITS[kind] - usageCount(kind));
}

/** 1回分を足す */
export function addUsage(kind: UsageKind): void {
  const v = read();
  v[kind]++;
  write(v);
}
