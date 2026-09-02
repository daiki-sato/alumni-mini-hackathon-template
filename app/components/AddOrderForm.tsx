"use client";

import { useActionState, useEffect, useRef } from "react";

import { type ActionState, addOrder } from "@/app/actions";

import { SubmitButton } from "./SubmitButton";

const FIELD =
  "w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-amber-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100";

export function AddOrderForm({ slug }: { slug: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(addOrder, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_140px]">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">おなまえ</span>
          <input name="person_name" required placeholder="さとう" className={FIELD} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">お弁当の名前</span>
          <input name="item_name" required placeholder="唐揚げ弁当" className={FIELD} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">金額</span>
          <input
            name="item_price"
            type="number"
            min={0}
            step={1}
            required
            placeholder="780"
            className={FIELD}
          />
        </label>
      </div>

      {state?.error && (
        <p className="rounded border border-red-600/40 bg-red-600/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div>
        <SubmitButton>注文する</SubmitButton>
      </div>
    </form>
  );
}
