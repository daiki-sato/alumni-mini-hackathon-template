"use client";

import { useEffect, useState } from "react";

export function ShareLink({ slug }: { slug: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // 本番とプレビューでドメインが変わるため、実際に開いているURLから組み立てる。
  useEffect(() => setUrl(`${window.location.origin}/o/${slug}`), [slug]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={url}
        className="min-w-0 flex-1 rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="rounded border border-amber-700 px-4 py-2 text-sm font-bold text-amber-800 transition hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-stone-800"
      >
        {copied ? "コピーしました" : "コピー"}
      </button>
    </div>
  );
}
