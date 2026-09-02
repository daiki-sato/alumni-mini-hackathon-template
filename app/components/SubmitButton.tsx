"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className }: { children: string; className?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "rounded bg-amber-700 px-5 py-2 font-bold text-white transition hover:bg-amber-800 disabled:opacity-50"
      }
    >
      {pending ? "送信中…" : children}
    </button>
  );
}
