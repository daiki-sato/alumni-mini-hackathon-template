-- `npm run db:reset` のたびに流し込まれる開発用データ。
-- 本番（Supabase のクラウド側）には流れません。
insert into public.order_events (slug, title, menu_url, shipping_fee, closed_at) values
  ('demo-lunch', '10/15 アルムナイ会ランチ', 'https://example.com/menu', 500, now() + interval '3 days');

insert into public.orders (event_id, person_name, item_name, item_price, paid)
select e.id, v.person_name, v.item_name, v.item_price, v.paid
from public.order_events e
cross join (values
  ('さとう', '唐揚げ弁当', 780, true),
  ('たなか', '幕の内弁当', 900, false),
  ('すずき', 'のり弁当', 650, false)
) as v(person_name, item_name, item_price, paid)
where e.slug = 'demo-lunch';
