import Link from "next/link";
import { notFound } from "next/navigation";

import { closeNow, deleteOrder, togglePaid } from "@/app/actions";
import { DeadlineWatcher } from "@/app/components/DeadlineWatcher";
import { ShareLink } from "@/app/components/ShareLink";
import { formatDateTime, formatYen, isClosed, splitShipping } from "@/lib/bento/calc";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("order_events")
    .select("id, slug, title, menu_url, shipping_fee, closed_at")
    .eq("slug", slug)
    .single();

  if (!event) {
    notFound();
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, person_name, item_name, item_price, paid")
    .eq("event_id", event.id)
    .order("created_at");

  const rows = orders ?? [];
  const closed = isClosed(event.closed_at);
  const { perPerson, remainder } = splitShipping(event.shipping_fee, rows.length);

  const dueOf = (price: number) => price + perPerson;
  const collected = rows
    .filter((row) => row.paid)
    .reduce((sum, row) => sum + dueOf(row.item_price), 0);
  const outstanding = rows
    .filter((row) => !row.paid)
    .reduce((sum, row) => sum + dueOf(row.item_price), 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href={`/o/${event.slug}`} className="text-sm underline opacity-70">
        ← 注文のページ
      </Link>

      <h1 className="mt-4 text-2xl font-bold">{event.title}</h1>
      <p className="mt-1 text-sm opacity-70">幹事用の画面です。集金の状況をここで管理します。</p>

      <section className="mt-8">
        <h2 className="text-sm font-bold">みんなに配るURL</h2>
        <div className="mt-2">
          <ShareLink slug={event.slug} />
        </div>
      </section>

      <section className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {event.closed_at ? (
          <span className="opacity-70">
            締切 {formatDateTime(event.closed_at)}{" "}
            {closed ? (
              <span className="font-bold text-red-700 dark:text-red-400">締め切りました</span>
            ) : (
              <DeadlineWatcher closedAt={event.closed_at} />
            )}
          </span>
        ) : (
          <span className="opacity-70">締切は設定されていません</span>
        )}

        {!closed && (
          <form action={closeNow}>
            <input type="hidden" name="slug" value={event.slug} />
            <button
              type="submit"
              className="rounded border border-stone-400 px-3 py-1 text-xs font-bold transition hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
            >
              いま締め切る
            </button>
          </form>
        )}
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-stone-300 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-900">
          <p className="text-xs opacity-70">注文</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{rows.length}件</p>
        </div>
        <div className="rounded border border-green-700/40 bg-green-600/10 px-4 py-3">
          <p className="text-xs opacity-70">集まった</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-green-800 dark:text-green-400">
            {formatYen(collected)}
          </p>
        </div>
        <div className="rounded border border-red-700/40 bg-red-600/10 px-4 py-3">
          <p className="text-xs opacity-70">まだの分</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-red-800 dark:text-red-400">
            {formatYen(outstanding)}
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="border-b border-stone-300 pb-2 text-lg font-bold dark:border-stone-700">
          集金の状況
        </h2>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm opacity-70">まだ誰も注文していません。</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-300 text-left dark:border-stone-700">
                  <th className="py-2 pr-4 font-bold">なまえ</th>
                  <th className="py-2 pr-4 font-bold">お弁当</th>
                  <th className="py-2 pr-4 text-right font-bold">もらう額</th>
                  <th className="py-2 pr-4 font-bold">集金</th>
                  <th className="py-2 font-bold">　</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-stone-200 dark:border-stone-800">
                    <td className="py-2 pr-4">{row.person_name}</td>
                    <td className="py-2 pr-4">
                      {row.item_name}
                      <span className="ml-2 text-xs opacity-60">{formatYen(row.item_price)}</span>
                    </td>
                    <td className="py-2 pr-4 text-right font-bold tabular-nums">
                      {formatYen(dueOf(row.item_price))}
                    </td>
                    <td className="py-2 pr-4">
                      <form action={togglePaid}>
                        <input type="hidden" name="slug" value={event.slug} />
                        <input type="hidden" name="order_id" value={row.id} />
                        <input type="hidden" name="paid" value={String(!row.paid)} />
                        <button
                          type="submit"
                          className={
                            row.paid
                              ? "rounded bg-green-700 px-3 py-1 text-xs font-bold text-white"
                              : "rounded border border-stone-400 px-3 py-1 text-xs font-bold dark:border-stone-600"
                          }
                        >
                          {row.paid ? "受け取り済み" : "まだ"}
                        </button>
                      </form>
                    </td>
                    <td className="py-2">
                      <form action={deleteOrder}>
                        <input type="hidden" name="slug" value={event.slug} />
                        <input type="hidden" name="order_id" value={row.id} />
                        <button
                          type="submit"
                          className="text-xs underline opacity-50 transition hover:opacity-100"
                        >
                          消す
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs opacity-70">
          送料 {formatYen(event.shipping_fee)} を {rows.length}人で頭割りして、1人{" "}
          {formatYen(perPerson)}。
          {remainder > 0 && ` 割り切れない ${formatYen(remainder)} は幹事の負担です。`}
        </p>
      </section>
    </main>
  );
}
