/* ==========================================================================
   RAKABU ATTENDANCE — UI HELPERS BERSAMA
   Dipakai di semua halaman: toast, tema terang/gelap, util kecil.
   ========================================================================== */

/* ==========================================================================
   LOADING SCREEN — sembunyikan begitu halaman + semua asetnya (font, dst.)
   selesai dimuat, dengan durasi tampil minimum supaya tidak "berkedip"
   kalau perangkat sangat cepat (durasi minimum ini murni untuk kenyamanan
   visual, bukan menunda fungsi apa pun).
   ========================================================================== */
(function initLoadingScreen() {
  const MIN_VISIBLE_MS = 6000;
  const shownAt = Date.now();
  function hide() {
    const el = document.getElementById("app-loading-screen");
    if (!el) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
    setTimeout(() => {
      el.classList.add("is-hidden");
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
    }, wait);
  }
  if (document.readyState === "complete") hide();
  else window.addEventListener("load", hide);
  // Jaring pengaman: kalau karena sebab apa pun event "load" tidak pernah
  // tertembak (mis. ada request pihak ketiga yang menggantung), jangan
  // sampai loading screen menutupi halaman selamanya. Diberi jeda lebih
  // lama dari MIN_VISIBLE_MS supaya tidak memotong durasi tampil normal.
  setTimeout(hide, 9000);
})();

/* ==========================================================================
   SERVICE WORKER — supaya situs ini benar-benar bisa di-"Install" ke Home
   Screen HP (bukan cuma bookmark/shortcut) dan tetap bisa dibuka walau
   koneksi terputus. Didaftarkan secara diam-diam; kalau browser tidak
   mendukung (atau dibuka langsung dari file:// tanpa server), diabaikan
   tanpa mengganggu apa pun.
   ========================================================================== */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    try {
      navigator.serviceWorker.register("sw.js").catch(() => { /* diam-diam abaikan; app tetap jalan normal tanpa SW */ });
    } catch (e) { /* lingkungan tak lazim (mis. WebView tertentu) — abaikan, tidak kritikal */ }
  });
}

/* ==========================================================================
   PELACAK ERROR YANG TERLIHAT DI LAYAR (bukan hanya console)
   ==========================================================================
   Sebelumnya, kalau ada skrip yang gagal dimuat (mis. karena preview/hosting
   tertentu tidak mendukung query string "?v=..." pada <script src>, atau
   ada bug JavaScript lain yang tak tertangani), halaman jadi "mati total"
   tanpa petunjuk apa pun bagi pengguna — semua tombol tampak tidak
   merespons dan tidak ada cara mengetahui sebabnya tanpa membuka console
   developer. Fungsi ini menampilkan pesan error mencolok LANGSUNG DI ATAS
   HALAMAN begitu ada error, supaya masalah (dan solusinya) langsung
   terlihat oleh siapa pun yang sedang menguji aplikasi, bukan cuma
   developer.
   ========================================================================== */
function showFatalErrorBanner(message) {
  let banner = document.getElementById("fatal-error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "fatal-error-banner";
    banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:#dc2626;color:#fff;padding:.9em 1.1em;font:600 13px/1.5 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25)";
    document.documentElement.appendChild(banner);
  }
  banner.textContent = "⚠️ Terjadi kesalahan teknis: " + message + " — Coba muat ulang halaman. Jika masih terjadi, hubungi admin/pengembang dengan menyertakan pesan ini.";
}

(function installGlobalErrorReporter() {
  window.addEventListener("error", (e) => {
    showFatalErrorBanner((e && e.message) || "Skrip gagal dijalankan.");
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e && e.reason;
    showFatalErrorBanner((reason && reason.message) ? reason.message : "Proses gagal (promise ditolak).");
  });
  // Bug fix: error runtime JS (mis. "X is not defined") memang otomatis
  // muncul lewat listener di atas, TAPI kegagalan MEMUAT resource itu
  // sendiri (<script src> atau <link> yang 404 / gagal diambil — misalnya
  // karena cache browser yang basi menimpa nama file yang sama) memakai
  // event "error" versi lain yang HANYA terdeteksi lewat capturing phase.
  // Tanpa ini, skrip yang gagal dimuat akan diam-diam membuat seluruh
  // halaman berhenti berfungsi tanpa pesan apa pun.
  //
  // Bug fix (v8): SEBELUMNYA listener ini bereaksi terhadap SEMUA <script>
  // dan <link> yang gagal dimuat, TERMASUK resource kosmetik pihak ketiga
  // seperti font Google (fonts.googleapis.com/fonts.gstatic.com). Kalau
  // jaringan pengguna memblokir domain Google Fonts (ad-blocker, DNS
  // privasi, firewall kantor/sekolah, koneksi lambat, dsb. — situasi yang
  // sangat umum), banner merah "Terjadi kesalahan teknis" akan muncul
  // menutupi bagian atas layar SETIAP KALI halaman dibuka, padahal seluruh
  // tombol dan fitur di baliknya sebenarnya berfungsi normal (font hanya
  // memengaruhi tampilan huruf, bukan logika aplikasi). Ini membuat
  // pengguna mengira seluruh aplikasi "rusak total" padahal tidak.
  //
  // Sekarang:
  // - HANYA resource SATU-ORIGIN (file aplikasi sendiri: js/*.js,
  //   css/style.css) yang dianggap kegagalan fatal, karena tanpa file-file
  //   itu aplikasi memang benar-benar tidak bisa berjalan.
  // - Resource PIHAK KETIGA/lintas-origin (font Google, CDN, dsb.) yang
  //   gagal dimuat hanya dicatat ke console sebagai peringatan ringan —
  //   TIDAK menampilkan banner fatal, karena kegagalannya tidak
  //   memengaruhi fungsi tombol/absensi sama sekali.
  window.addEventListener("error", (e) => {
    const target = e && e.target;
    if (!target || (target.tagName !== "SCRIPT" && target.tagName !== "LINK")) return;
    const src = target.src || target.href || "";
    if (!isSameOriginResource(src)) {
      console.warn("Resource pihak ketiga gagal dimuat (diabaikan, tidak fatal):", src || "(tidak diketahui)");
      return;
    }
    showFatalErrorBanner("Gagal memuat berkas: " + (src || "(tidak diketahui)") + ". Coba muat ulang halaman dengan paksa (hard refresh) untuk membersihkan cache lama.");
  }, true);

  function isSameOriginResource(url) {
    if (!url) return false;
    try {
      const resolved = new URL(url, window.location.href);
      return resolved.origin === window.location.origin;
    } catch (e) {
      // URL relatif yang gagal di-parse tetap dianggap satu-origin (lebih
      // aman salah menganggap fatal daripada diam-diam mengabaikan file
      // sendiri yang benar-benar gagal dimuat).
      return true;
    }
  }
})();

/**
 * Dipanggil di baris PALING ATAS setiap skrip halaman (auth.js, register.js,
 * employee.js, admin.js) untuk memastikan skrip-skrip pustaka (config.js,
 * store.js, modal.js, dst.) benar-benar berhasil dimuat SEBELUM kode
 * halaman mencoba memakainya. Kalau ada yang belum terdefinisi, tampilkan
 * pesan yang jelas alih-alih membiarkan seluruh halaman diam-diam berhenti
 * bekerja tanpa penjelasan.
 */
function assertDependenciesLoaded(names) {
  const missing = names.filter((n) => {
    try {
      // eslint-disable-next-line no-eval
      return eval("typeof " + n) === "undefined";
    } catch (e) {
      return true;
    }
  });
  if (missing.length) {
    showFatalErrorBanner(
      "Berkas berikut gagal dimuat: " + missing.map((n) => n + ".js").join(", ") +
      " (folder js/ mungkin tidak lengkap, atau server preview tidak mendukung path yang dipakai)."
    );
    return false;
  }
  return true;
}


function showToast(message, type) {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = "toast" + (type ? " toast--" + type : "");
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    toast.style.transition = "opacity .2s ease, transform .2s ease";
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function initTheme() {
  const saved = (typeof Store !== "undefined" && Store.getTheme()) || null;
  const preferred = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(preferred);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  if (typeof Store !== "undefined") Store.setTheme(theme);
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.innerHTML = theme === "dark"
      ? '<circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
      : '<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>';
  }
}

function initPasswordToggles() {
  document.querySelectorAll(".pw-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.toggleFor);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      btn.textContent = input.type === "password" ? "👁" : "🙈";
    });
  });
}

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0] || "")[0] || "") .toUpperCase() + ((parts[1] || "")[0] || "").toUpperCase();
}

function formatRupiah(n) {
  return "Rp " + Math.round(n || 0).toLocaleString("id-ID");
}

function formatDateID(dateKey) {
  if (!dateKey) return "-";
  const d = new Date(dateKey + "T00:00:00");
  const days = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function timeAgoID(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const d = Math.floor(hr / 24);
  return `${d} hari lalu`;
}

/* ==========================================================================
   RAKABU ATTENDANCE — ICON SYSTEM
   Ikon SVG konsisten (stroke-based) menggantikan emoji agar tampilan lebih
   rapi & seragam lintas perangkat/OS (emoji dirender berbeda-beda tiap OS).
   ========================================================================== */
const Icons = {
  home: '<path d="M4 11.5 12 4l8 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9h12v-9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 19v-5h4v5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  pin: '<path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="9" r="2.4" stroke="currentColor" stroke-width="1.8"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2.4" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M8 3.5v3M16 3.5v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  umbrella: '<path d="M4 12a8 8 0 0 1 16 0Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 12v7.2a2 2 0 0 1-3.6 1.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 4V2.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  clock: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3.2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  user: '<circle cx="12" cy="8.4" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M4.6 20c1-3.6 4-5.6 7.4-5.6s6.4 2 7.4 5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  users: '<circle cx="9" cy="8.6" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M2.8 19.5c.9-3.3 3.4-5 6.2-5s5.3 1.7 6.2 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15.4 6a3.2 3.2 0 0 1 0 6.2M18.4 19.5c-.5-1.9-1.5-3.3-2.9-4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  logout: '<path d="M9 20H5.4A1.4 1.4 0 0 1 4 18.6V5.4A1.4 1.4 0 0 1 5.4 4H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 16l4-4-4-4M20 12H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.5 17a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="1.7"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  arrowRight: '<path d="M4 12h15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowLeft: '<path d="M20 12H5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M11 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  checkCircle: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M8 12.3l2.6 2.6L16 9.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  alertTriangle: '<path d="M12 3.5 22 20.5H2L12 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1" fill="currentColor"/>',
  clipboard: '<rect x="6" y="4.5" width="12" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 4.5V3.8A1.8 1.8 0 0 1 10.8 2h2.4A1.8 1.8 0 0 1 15 3.8v.7" stroke="currentColor" stroke-width="1.8"/><path d="M9 11h6M9 15h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  dollar: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v10M15 9.5c0-1.4-1.3-2.2-3-2.2s-3 .9-3 2.2 1.2 1.9 3 2.2c1.9.3 3 1 3 2.3S13.7 16.2 12 16.2s-3-.7-3-2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  fileText: '<path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3.5V8h4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12.5h6M9 16h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  plusCircle: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  satellite: '<path d="M14 4l3 3-2.2 2.2-3-3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.7 9.3l3 3-3 3-3-3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M11.8 9.2l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 20l3-3M17 3l1.6-1.6M20 6.4 18.4 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  slash: '<path d="M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 3.5A8.5 8.5 0 1 0 20.5 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.7"/><circle cx="17.1" cy="6.9" r="1.1" fill="currentColor"/>',
  none: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" opacity=".4"/>'
};

function iconSvg(name, size) {
  size = size || 18;
  const path = Icons[name] || Icons.none;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${path}</svg>`;
}

function hydrateIcons(root) {
  (root || document).querySelectorAll("[data-icon]").forEach((node) => {
    if (node.dataset.iconDone) return;
    const size = parseInt(node.dataset.iconSize || "18", 10);
    node.innerHTML = iconSvg(node.dataset.icon, size);
    node.dataset.iconDone = "1";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initPasswordToggles();
  hydrateIcons();
  // Catatan: manajemen modal (buka/tutup, anti-tumpuk, ESC, klik overlay,
  // anti klik-ganda) sekarang SEPENUHNYA dipusatkan di js/modal.js (lihat
  // objek global `Modal`). Jangan menambahkan logika modal terpisah di
  // sini lagi supaya tidak ada dua sistem modal yang saling tumpang tindih.
});

