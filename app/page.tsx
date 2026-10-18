import Link from "next/link";

import { CreateEventForm } from "@/app/components/CreateEventForm";
import { formatDateTime, isClosed } from "@/lib/bento/calc";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  const { data: events, error } = await supabase
    .from("order_events")
    .select("id, slug, title, closed_at, created_at, orders(count)")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">お弁当注文＆集計</h1>
      <p className="mt-2 text-sm opacity-70">
        注文会を作ってURLを配ると、みんなが自分の注文を入れられます。
      </p>

      <a
        className="mt-6 block rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 font-medium"
        href="/prototypes"
      >
        行列と距離の試作（60本）を見る →
      </a>

      <section className="mt-10">
        <h2 className="border-b border-stone-300 pb-2 text-lg font-bold dark:border-stone-700">
          新しい注文会をつくる
        </h2>
        <div className="mt-5">
          <CreateEventForm />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="border-b border-stone-300 pb-2 text-lg font-bold dark:border-stone-700">
          これまでの注文会
        </h2>

        {error && (
          <p className="mt-4 rounded border border-red-600/40 bg-red-600/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            一覧を読み込めませんでした（{error.message}）
          </p>
        )}

        {events && events.length === 0 && (
          <p className="mt-4 text-sm opacity-70">
            まだありません。上のフォームから作ってください。
          </p>
        )}

        <ul className="mt-4 flex flex-col gap-2">
          {events?.map((event) => {
            const closed = isClosed(event.closed_at);
            const count = event.orders[0]?.count ?? 0;

            return (
              <li key={event.id}>
                <Link
                  href={`/o/${event.slug}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-300 bg-white px-4 py-3 transition hover:border-amber-700 dark:border-stone-700 dark:bg-stone-900"
                >
                  <span className="font-bold">{event.title}</span>
                  <span className="flex items-center gap-3 text-xs opacity-70">
                    <span>{count}件</span>
                    {event.closed_at && (
                      <span>
                        {closed ? "締切済" : "締切"} {formatDateTime(event.closed_at)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
