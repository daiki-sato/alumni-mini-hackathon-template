"use client";

import { useActionState } from "react";

import { type ActionState, createOrderEvent } from "@/app/actions";

import { SubmitButton } from "./SubmitButton";

const FIELD =
  "w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-amber-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100";

export function CreateEventForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createOrderEvent, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* サーバーは UTC で動くので、締切をこの人の時刻として保存するために時差を渡す。 */}
      <input type="hidden" name="tz_offset" value={-new Date().getTimezoneOffset()} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">注文会の名前</span>
        <input name="title" required placeholder="10/15 アルムナイ会ランチ" className={FIELD} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">
          メニューのURL <span className="font-normal opacity-60">（任意）</span>
        </span>
        <input
          name="menu_url"
          type="url"
          placeholder="https://example.com/menu"
          className={FIELD}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">送料の総額</span>
          <input
            name="shipping_fee"
            type="number"
            min={0}
            step={1}
            defaultValue={0}
            className={FIELD}
          />
          <span className="text-xs opacity-60">注文した人数で頭割りします</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">
            締切 <span className="font-normal opacity-60">（任意）</span>
          </span>
          <input name="closed_at" type="datetime-local" className={FIELD} />
          <span className="text-xs opacity-60">この時刻を過ぎると自動で締め切られます</span>
        </label>
      </div>

      {state?.error && (
        <p className="rounded border border-red-600/40 bg-red-600/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div>
        <SubmitButton>この内容で作る</SubmitButton>
      </div>
    </form>
  );
}
