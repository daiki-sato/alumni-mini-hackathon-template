import { highlight, type WordLists } from "@/lib/jibunmap/score";

/** 口コミの本文。うれしいワードは緑、NG ワードは赤で印を付ける */
export function Highlighted({ text, words }: { text: string; words: WordLists }) {
  const segs = highlight(text, words);
  let pos = 0;
  return (
    <>
      {segs.map((s) => {
        const key = `${pos}-${s.kind ?? "t"}`;
        pos += s.text.length;
        return s.kind ? (
          <mark
            key={key}
            className={`rounded px-0.5 font-bold ${
              s.kind === "good" ? "bg-hi-soft text-hi" : "bg-lo-soft text-lo"
            }`}
          >
            {s.text}
          </mark>
        ) : (
          <span key={key}>{s.text}</span>
        );
      })}
    </>
  );
}

/** 口コミを書いた人（Google の帰属表示。リンクがあれば付ける） */
export function Author({ name, uri }: { name?: string; uri?: string }) {
  if (!name) return null;
  return uri ? (
    <a href={uri} target="_blank" rel="noreferrer noopener" className="underline">
      {name}
    </a>
  ) : (
    <span>{name}</span>
  );
}
