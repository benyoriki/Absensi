/* ==========================================================================
   RAKABU ATTENDANCE — SERVICE WORKER (v11)
   ==========================================================================
   Tujuan: (1) memenuhi syarat "installable PWA" di Chrome/Edge/Android
   (Add to Home Screen benar-benar muncul sebagai app, bukan cuma shortcut
   browser biasa), dan (2) app-shell tetap bisa dibuka walau koneksi
   internet putus (semua data absensi memang sudah tersimpan di
   localStorage perangkat, bukan di server, jadi caching file statis di
   sini AMAN — tidak ada risiko data "basi").

   STRATEGI: cache-first untuk file sendiri (HTML/CSS/JS/ikon), selalu
   fallback ke jaringan untuk apa pun yang tidak dikenali (mis. font
   Google) — supaya assets pihak ketiga tidak pernah ikut disangka wajib
   ada demi app tetap bisa dibuka.

   CARA UPDATE CACHE SETELAH DEPLOY ULANG:
   Ubah CACHE_VERSION di bawah (naikkan angkanya). Service worker lama
   otomatis membuang cache versi sebelumnya saat diaktifkan kembali.
   ========================================================================== */

const CACHE_VERSION = "rakabu-shell-v14";
const APP_SHELL = [
  "index.html",
  "register.html",
  "employee.html",
  "admin.html",
  "css/style.css?v=14",
  "js/config.js?v=14",
  "js/store.js?v=14",
  "js/ui-common.js?v=14",
  "js/modal.js?v=14",
  "js/geo.js?v=14",
  "js/auth.js?v=14",
  "js/employee.js?v=14",
  "js/admin.js?v=14",
  "js/register.js?v=14",
  "manifest.webmanifest",
  "assets/logo-192.png",
  "assets/logo-512.png",
  "assets/logo-maskable-512.png",
  "assets/logo-32.png",
  "assets/logo-48.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll akan gagal seluruhnya kalau SATU saja request gagal (mis.
      // saat install pertama dan offline) — pakai Promise.allSettled
      // supaya file yang berhasil tetap ter-cache walau ada yang gagal.
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // jangan cache POST/dll (tidak relevan di app ini, tapi tetap aman)

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) {
    // Resource pihak ketiga (mis. font Google): selalu coba jaringan dulu,
    // jangan pernah diblokir/diandalkan cache-nya sebagai syarat wajib.
    event.respondWith(fetch(req).catch(() => new Response("", { status: 504 })));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) {
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      }).catch(() => cached); // offline & tidak ada di cache -> biarkan gagal wajar
      // Cache-first: kalau sudah ada di cache, tampilkan langsung (instan),
      // sambil tetap memperbarui cache di latar belakang dari jaringan.
      return cached || network;
    })
  );
});
