"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isClosed } from "@/lib/bento/calc";
import { generateSlug } from "@/lib/bento/slug";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string } | null;

function text(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

/**
 * datetime-local はタイムゾーンを持たない文字列を送ってくる。
 * Vercel のサーバーは UTC で動くため、そのまま解釈すると幹事の入力から9時間ずれる。
 * ブラウザが送ってきたオフセット（分）を足して、入力した人の時刻として保存する。
 */
function toIsoWithOffset(localValue: string, offsetMinutes: string) {
  if (!localValue) {
    return null;
  }

  const offset = Number(offsetMinutes);
  const parsed = Date.parse(`${localValue}:00Z`);

  if (!Number.isFinite(offset) || Number.isNaN(parsed)) {
    return new Date(localValue).toISOString();
  }

  return new Date(parsed + offset * 60_000).toISOString();
}

function yen(formData: FormData, key: string) {
  const value = Number(text(formData, key) || "0");

  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

export async function createOrderEvent(_: ActionState, formData: FormData): Promise<ActionState> {
  const title = text(formData, "title");
  const menuUrl = text(formData, "menu_url");
  const shippingFee = yen(formData, "shipping_fee");
  const closedAt = text(formData, "closed_at");

  if (!title) {
    return { error: "注文会の名前を入力してください。" };
  }

  if (shippingFee === null) {
    return { error: "送料は0以上の数字で入力してください。" };
  }

  const supabase = await createClient();
  const slug = generateSlug();

  const { error } = await supabase.from("order_events").insert({
    slug,
    title,
    menu_url: menuUrl || null,
    shipping_fee: shippingFee,
    closed_at: toIsoWithOffset(closedAt, text(formData, "tz_offset")),
  });

  if (error) {
    return { error: `注文会を作れませんでした（${error.message}）` };
  }

  redirect(`/o/${slug}/manage`);
}

export async function addOrder(_: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "slug");
  const personName = text(formData, "person_name");
  const itemName = text(formData, "item_name");
  const itemPrice = yen(formData, "item_price");

  if (!personName || !itemName) {
    return { error: "名前とお弁当の名前を入力してください。" };
  }

  if (itemPrice === null) {
    return { error: "金額は0以上の数字で入力してください。" };
  }

  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from("order_events")
    .select("id, closed_at")
    .eq("slug", slug)
    .single();

  if (eventError || !event) {
    return { error: "この注文会は見つかりませんでした。" };
  }

  if (isClosed(event.closed_at)) {
    return { error: "締切を過ぎたため、注文を受け付けられません。" };
  }

  const { error } = await supabase.from("orders").insert({
    event_id: event.id,
    person_name: personName,
    item_name: itemName,
    item_price: itemPrice,
  });

  if (error) {
    return { error: `注文を登録できませんでした（${error.message}）` };
  }

  revalidatePath(`/o/${slug}`);
  revalidatePath(`/o/${slug}/manage`);

  return null;
}

export async function togglePaid(formData: FormData) {
  const slug = text(formData, "slug");
  const orderId = Number(text(formData, "order_id"));
  const paid = text(formData, "paid") === "true";

  const supabase = await createClient();
  await supabase.from("orders").update({ paid }).eq("id", orderId);

  revalidatePath(`/o/${slug}/manage`);
}

export async function deleteOrder(formData: FormData) {
  const slug = text(formData, "slug");
  const orderId = Number(text(formData, "order_id"));

  const supabase = await createClient();
  await supabase.from("orders").delete().eq("id", orderId);

  revalidatePath(`/o/${slug}`);
  revalidatePath(`/o/${slug}/manage`);
}

export async function closeNow(formData: FormData) {
  const slug = text(formData, "slug");

  const supabase = await createClient();
  await supabase
    .from("order_events")
    .update({ closed_at: new Date().toISOString() })
    .eq("slug", slug);

  revalidatePath(`/o/${slug}`);
  revalidatePath(`/o/${slug}/manage`);
}
