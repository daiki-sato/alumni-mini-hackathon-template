import Link from "next/link";
import { notFound } from "next/navigation";

import { AddOrderForm } from "@/app/components/AddOrderForm";
import { DeadlineWatcher } from "@/app/components/DeadlineWatcher";
import {
  attachShipping,
  countPeople,
  formatDateTime,
  formatYen,
  isClosed,
  splitShipping,
  tallyItems,
} from "@/lib/bento/calc";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const orderRows = orders ?? [];
  const closed = isClosed(event.closed_at);
  const peopleCount = countPeople(orderRows);
  const { perPerson, remainder } = splitShipping(event.shipping_fee, peopleCount);
  const rows = attachShipping(orderRows, perPerson);
  const itemTotal = rows.reduce((sum, row) => sum + row.item_price, 0);
  const tally = closed ? tallyItems(rows) : [];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm underline opacity-70">
        ← 注文会の一覧
      </Link>

      <h1 className="mt-4 text-2xl font-bold">{event.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        {event.menu_url && (
          <a
            href={event.menu_url}
            target="_blank"
            rel="noreferrer noopener"
            className="font-bold text-amber-800 underline dark:text-amber-300"
          >
            メニューを見る
          </a>
        )}
        {event.closed_at && (
          <span className="opacity-70">
            {formatDateTime(event.closed_at)} まで{" "}
            {closed ? (
              <span className="font-bold text-red-700 dark:text-red-400">締め切りました</span>
            ) : (
              <DeadlineWatcher closedAt={event.closed_at} />
            )}
          </span>
        )}
      </div>

      {closed ? (
        <p className="mt-8 rounded border border-stone-300 bg-stone-100 px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-800">
          締切を過ぎたため、注文は確定しました。変更したいときは幹事に伝えてください。
        </p>
      ) : (
        <section className="mt-10">
          <h2 className="border-b border-stone-300 pb-2 text-lg font-bold dark:border-stone-700">
            注文する
          </h2>
          <div className="mt-5">
            <AddOrderForm slug={event.slug} />
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="border-b border-stone-300 pb-2 text-lg font-bold dark:border-stone-700">
          {closed ? "確定した注文" : "みんなの注文"}（{rows.length}件）
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
                  <th className="py-2 pr-4 text-right font-bold">弁当代</th>
                  <th className="py-2 pr-4 text-right font-bold">送料</th>
                  <th className="py-2 text-right font-bold">支払う額</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-stone-200 dark:border-stone-800">
                    <td className="py-2 pr-4">{row.person_name}</td>
                    <td className="py-2 pr-4">{row.item_name}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatYen(row.item_price)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums opacity-70">
                      {formatYen(row.shipping)}
                    </td>
                    <td className="py-2 text-right font-bold tabular-nums">{formatYen(row.due)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td className="py-3" colSpan={2}>
                    合計
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{formatYen(itemTotal)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatYen(event.shipping_fee)}
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {formatYen(itemTotal + event.shipping_fee)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {remainder > 0 && (
          <p className="mt-3 text-xs opacity-70">
            送料 {formatYen(event.shipping_fee)} を {peopleCount}人で頭割りすると{" "}
            {formatYen(remainder)} 足りません。この分は幹事の負担です。
          </p>
        )}
      </section>

      {tally.length > 0 && (
        <section className="mt-12">
          <h2 className="border-b border-stone-300 pb-2 text-lg font-bold dark:border-stone-700">
            お弁当ごとの数
          </h2>
          <p className="mt-2 text-sm opacity-70">お店に頼むときはこの数を伝えてください。</p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-300 text-left dark:border-stone-700">
                  <th className="py-2 pr-4 font-bold">お弁当</th>
                  <th className="py-2 pr-4 text-right font-bold">単価</th>
                  <th className="py-2 pr-4 text-right font-bold">個数</th>
                  <th className="py-2 text-right font-bold">小計</th>
                </tr>
              </thead>
              <tbody>
                {tally.map((item) => (
                  <tr
                    key={`${item.itemName}-${item.unitPrice}`}
                    className="border-b border-stone-200 dark:border-stone-800"
                  >
                    <td className="py-2 pr-4">{item.itemName}</td>
                    <td className="py-2 pr-4 text-right tabular-nums opacity-70">
                      {formatYen(item.unitPrice)}
                    </td>
                    <td className="py-2 pr-4 text-right font-bold tabular-nums">{item.count}個</td>
                    <td className="py-2 text-right tabular-nums">{formatYen(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td className="py-3 pr-4" colSpan={2}>
                    合計
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{rows.length}個</td>
                  <td className="py-3 text-right tabular-nums">{formatYen(itemTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <p className="mt-12 text-sm">
        <Link href={`/o/${event.slug}/manage`} className="underline opacity-70">
          幹事の人はこちら（集金の管理）
        </Link>
      </p>
    </main>
  );
}
