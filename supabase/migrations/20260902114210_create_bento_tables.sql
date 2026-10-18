-- お弁当注文＆集計ツール。
--
-- 認証を使わない構成のため、anon ロールにポリシーを書く。
-- 役割（幹事 / 一般メンバー）は画面上の自己申告で、DB には保存しない。

create table public.order_events (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  menu_url text,
  shipping_fee integer not null default 0 check (shipping_fee >= 0),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.orders (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.order_events (id) on delete cascade,
  person_name text not null check (length(trim(person_name)) > 0),
  item_name text not null check (length(trim(item_name)) > 0),
  item_price integer not null check (item_price >= 0),
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

create index orders_event_id_idx on public.orders (event_id);

alter table public.order_events enable row level security;
alter table public.orders enable row level security;

create policy "anon can read order_events"
  on public.order_events for select
  to anon
  using (true);

create policy "anon can insert order_events"
  on public.order_events for insert
  to anon
  with check (true);

create policy "anon can update order_events"
  on public.order_events for update
  to anon
  using (true)
  with check (true);

create policy "anon can delete order_events"
  on public.order_events for delete
  to anon
  using (true);

create policy "anon can read orders"
  on public.orders for select
  to anon
  using (true);

-- 締切を過ぎた注文会には行を足せない。
-- 画面側でもフォームを閉じるが、URL を直接叩かれても通らないようにする。
create policy "anon can insert orders before deadline"
  on public.orders for insert
  to anon
  with check (
    exists (
      select 1
      from public.order_events e
      where e.id = orders.event_id
        and (e.closed_at is null or e.closed_at > now())
    )
  );

-- 集金チェックは締切後こそ使うため、期限で縛らない。
create policy "anon can update orders"
  on public.orders for update
  to anon
  using (true)
  with check (true);

create policy "anon can delete orders"
  on public.orders for delete
  to anon
  using (true);
