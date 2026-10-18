// ジブンマップの Service Worker（最小限）。
// キャッシュするのはアプリの外枠（/、/map のページと、/_next/static の静的なファイル）だけ。
// Places・Maps・写真（googleapis.com・gstatic.com など、別のオリジン）は、キャッシュもインターセプトもしない
// （Google の規約で Places のデータは保存しないため。respondWith を呼ばずに素通しにする）。
// 版は登録するときの ?v=（デプロイごとのコミット）。版が変わったら古いキャッシュを消す。

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `jibunmap-shell-${VERSION}`;
const SHELL = ["/", "/map"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("jibunmap-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** この通信を Service Worker で扱うか（扱わないものは素通し） */
function handles(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  // 別のオリジン（googleapis.com・gstatic.com・写真など）は触らない
  if (url.origin !== self.location.origin) return false;
  if (request.mode === "navigate") return url.pathname === "/" || url.pathname === "/map";
  return url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!handles(request)) return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    // ページはネット優先（デプロイの更新をすぐ反映）。圏外のときだけ、取っておいた外枠を返す。
    // ?q= や ?demo=1 が付いていても、同じページの外枠を使う
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(url.pathname, { ignoreSearch: true })
            .then((hit) => hit || caches.match("/map"))
            .then(
              (hit) =>
                hit ||
                new Response("通信が必要です。", {
                  status: 503,
                  headers: { "Content-Type": "text/plain; charset=utf-8" },
                }),
            ),
        ),
    );
    return;
  }

  // /_next/static は中身ごとに名前が変わるので、キャッシュ優先でよい
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
