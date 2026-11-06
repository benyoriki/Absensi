/* ==========================================================================
   DEPO PRG ATTENDANCE — UI HELPERS BERSAMA
   Dipakai di semua halaman: toast, tema terang/gelap, util kecil.
   ========================================================================== */

/* ==========================================================================
   LOADING SCREEN — sembunyikan begitu halaman + semua asetnya (font, dst.)
   selesai dimuat, dengan durasi tampil minimum supaya tidak "berkedip"
   kalau perangkat sangat cepat (durasi minimum ini murni untuk kenyamanan
   visual, bukan menunda fungsi apa pun).
   ========================================================================== */
(function initLoadingScreen() {
  // Durasi loading screen: 4 detik (ubah angka ini bila ingin lebih cepat/lambat).
  const LOADING_MS = 4000;
  const STEPS = ["Menyiapkan lokasi GPS", "Memuat data karyawan", "Menyinkronkan jadwal kerja", "Siap digunakan"];
  const shownAt = Date.now();
  const el = document.getElementById("app-loading-screen");
  if (!el) return;
  const bar = document.getElementById("loading-progress-bar");
  const percentEl = document.getElementById("loading-progress-percent");
  const statusEl = document.getElementById("loading-status-text");
  const stepEls = el.querySelectorAll("[data-ld-step]");
  let rafId = null, finished = false, hiding = false, lastStep = -1;

  function paint(pct) {
    const p = Math.max(0, Math.min(100, pct));
    // transform (bukan width) supaya ringan di PC lama / Windows 7
    if (bar) bar.style.transform = "scaleX(" + (p / 100) + ")";
    if (percentEl) percentEl.textContent = Math.round(p) + "%";
    const step = p < 28 ? 0 : p < 58 ? 1 : p < 90 ? 2 : 3;
    if (step !== lastStep) {
      lastStep = step;
      if (statusEl) statusEl.textContent = STEPS[step];
      for (let i = 0; i < stepEls.length; i++) {
        stepEls[i].className = "ld-step" + (i < step ? " is-done" : i === step ? " is-now" : "");
      }
    }
  }
  // Progress naik mengikuti waktu (ease-out ringan), ditahan di 96% sampai
  // halaman benar-benar selesai dimuat.
  function tick() {
    if (finished) return;
    const t = Math.min(1, (Date.now() - shownAt) / LOADING_MS);
    const eased = 1 - Math.pow(1 - t, 1.6);
    paint(Math.min(96, eased * 96));
    rafId = requestAnimationFrame(tick);
  }
  paint(0);
  rafId = requestAnimationFrame(tick);

  function hide() {
    if (hiding) return;
    hiding = true;
    const wait = Math.max(0, LOADING_MS - (Date.now() - shownAt));
    setTimeout(() => {
      finished = true;
      if (rafId) cancelAnimationFrame(rafId);
      paint(100);
      for (let i = 0; i < stepEls.length; i++) stepEls[i].className = "ld-step is-done";
      setTimeout(() => {
        el.classList.add("is-hidden");
        document.documentElement.classList.add("app-ready");
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 600);
      }, 280);
    }, wait);
  }
  if (document.readyState === "complete") hide();
  else window.addEventListener("load", hide);
  // Jaring pengaman bila event "load" tidak pernah tertembak.
  setTimeout(hide, LOADING_MS + 2500);
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
  // - HANYA resource SATU-ORIGIN (file aplikasi sendiri: *.js,
  //   style.css) yang dianggap kegagalan fatal, karena tanpa file-file
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
      " (ada file yang belum terunggah lengkap, atau server preview tidak mendukung path yang dipakai)."
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

const PW_EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>';
const PW_EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3l18 18M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 3.9M6.6 7.3A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-1M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/* Peringatan "Ubah sandi Anda" (Google Password Manager) muncul karena Chrome
   memeriksa kolom <input type="password"> saat login berhasil, dan sandi demo
   (123456 / admin123) memang ada di daftar kebocoran publik. Situs tidak bisa
   mematikan peringatan itu, tetapi kolom yang diberi data-no-leak="1" dibuat
   sebagai kolom teks yang disamarkan CSS (-webkit-text-security), sehingga
   Chrome tidak menganggapnya sebagai form sandi dan tidak memeriksanya.
   Set false untuk kembali ke kolom sandi biasa (mis. setelah memakai sandi kuat). */
const SUPPRESS_BROWSER_PW_CHECK = true;
function supportsTextSecurity() {
  try { return !!(window.CSS && CSS.supports && CSS.supports("-webkit-text-security", "disc")); } catch (e) { return false; }
}
function initPasswordToggles() {
  const mask = SUPPRESS_BROWSER_PW_CHECK && supportsTextSecurity();
  document.querySelectorAll(".pw-toggle").forEach((btn) => {
    const input = document.getElementById(btn.dataset.toggleFor);
    if (mask && input && input.dataset.noLeak === "1") {
      input.type = "text";
      input.classList.add("pw-mask");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocapitalize", "off");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("spellcheck", "false");
      input.setAttribute("data-lpignore", "true");
      input.setAttribute("data-1p-ignore", "true");
    }
    btn.innerHTML = PW_EYE;
    btn.addEventListener("click", () => {
      if (!input) return;
      let shown;
      if (input.classList.contains("pw-mask")) {
        shown = !input.classList.contains("is-revealed");
        input.classList.toggle("is-revealed", shown);
      } else {
        input.type = input.type === "password" ? "text" : "password";
        shown = input.type !== "password";
      }
      btn.innerHTML = shown ? PW_EYE_OFF : PW_EYE;
      btn.setAttribute("aria-label", shown ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
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

/** Nama lengkap + gelar akademik (kalau diisi), format umum Indonesia:
 *  "Riki Hermawan, S.Kom". Dipakai di tampilan formal (kartu ID, detail
 *  karyawan) — bukan di sapaan santai seperti "Selamat datang, Riki". */
function displayName(user) {
  if (!user || !user.name) return "-";
  return user.degree ? `${user.name}, ${user.degree}` : user.name;
}

/** Markup avatar terpadu dipakai di header, sidebar/profil, dan modal detail
 *  karyawan: kalau user sudah punya foto profil (base64 dari upload),
 *  tampilkan foto itu (object-fit:cover mengikuti bentuk wadahnya lewat
 *  CSS); kalau belum, fallback ke inisial nama seperti sebelumnya. */
function avatarMarkup(user) {
  if (user && user.photo) return `<img src="${user.photo}" alt="" />`;
  return escapeHtml(initials(user ? user.name : ""));
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

/* ==========================================================================
   SHIFT KERJA — helper tampilan (dipakai admin.js & employee.js)
   ========================================================================== */
const SHIFT_DAY_LABELS = { 1: "Sen", 2: "Sel", 3: "Rab", 4: "Kam", 5: "Jum", 6: "Sab", 7: "Min" };
const SHIFT_DAY_LABELS_FULL = { 1: "Senin", 2: "Selasa", 3: "Rabu", 4: "Kamis", 5: "Jumat", 6: "Sabtu", 7: "Minggu" };

/** Ringkasan hari kerja shift, mis. "Sen–Jum" untuk [1,2,3,4,5] berurutan,
 *  atau "Sen, Sel, Kam" untuk hari yang tidak berurutan. */
function shiftDaysLabel(days) {
  if (!Array.isArray(days) || !days.length) return "-";
  const sorted = [...days].sort((a, b) => a - b);
  const isConsecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isConsecutive && sorted.length > 1) {
    return `${SHIFT_DAY_LABELS[sorted[0]]}–${SHIFT_DAY_LABELS[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => SHIFT_DAY_LABELS[d]).join(", ");
}

/** Opsi <select> shift kerja untuk form admin (assign karyawan / filter). */
function shiftOptionsHtml(selectedId) {
  const shifts = Store.getShifts();
  if (!shifts.length) return `<option value="">Belum ada shift</option>`;
  return shifts.map((s) => `<option value="${escapeHtml(s.id)}" ${s.id === selectedId ? "selected" : ""}>${escapeHtml(s.name)} (${s.start}–${s.end})</option>`).join("");
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
   DEPO PRG ATTENDANCE — ICON SYSTEM
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
  shield: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  camera: '<path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h1.6l.9-1.4a1.5 1.5 0 0 1 1.26-.6h5.48c.5 0 .97.23 1.26.6l.9 1.4h1.6A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.4" stroke="currentColor" stroke-width="1.6"/>',
  chat: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 4v-4H5.5A1.5 1.5 0 0 1 4 14.5v-9Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="8.3" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15.7" cy="10" r="1" fill="currentColor"/>',
  chatGroup: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h11A1.5 1.5 0 0 1 17 6.5v6A1.5 1.5 0 0 1 15.5 14H9l-3.4 3v-3H4.5A1.5 1.5 0 0 1 3 12.5v-6Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M19.5 8.2c.9.24 1.5 1.05 1.5 2v4.3a1.5 1.5 0 0 1-1.5 1.5h-.6v2.6l-2.7-2.6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  send: '<path d="M4 12 20.5 4 14 20l-2.7-6.3L4 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/><path d="M11.3 13.7 20.5 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  paperclip: '<path d="M16.5 6.5 8.8 14.2a3 3 0 0 0 4.24 4.24l7.4-7.4a5 5 0 0 0-7.07-7.07l-7.4 7.4a7 7 0 0 0 9.9 9.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  checkSingle: '<path d="M5 12.5 9.5 17 19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  checkDouble: '<path d="M1.5 12.5 6 17 11 11.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 12.5 12.5 17 22 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  trash: '<path d="M5 7h14M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M7 7l.7 12a2 2 0 0 0 2 1.9h4.6a2 2 0 0 0 2-1.9L17 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 9.5h17M9 9.5V19.5M15 9.5V19.5" stroke="currentColor" stroke-width="1.6"/>',
  fingerprint: '<path d="M6.5 10.2A5.8 5.8 0 0 1 12 6a5.8 5.8 0 0 1 5.5 4.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M5 14.5c.4-1.6.6-2.7.7-3.6M9 19c.7-1.3 1.3-3.3 1.5-5.6a1.6 1.6 0 0 1 3.2 0c.1 2.2-.2 4.1-.9 6M12 20c1-1.7 1.5-3.5 1.7-5.4M16.2 18.6c.8-1.9 1.1-3.9 1-6.1M3.5 9.5A9 9 0 0 1 12 3.5a9 9 0 0 1 8.5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  userIn: '<circle cx="10" cy="8.5" r="3.3" stroke="currentColor" stroke-width="1.8"/><path d="M3.6 19.5c.8-3.3 3.2-5 6.4-5 1.3 0 2.4.3 3.4.8M17 14.5l2.5 2.5-2.5 2.5M19.5 17H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  userOut: '<circle cx="10" cy="8.5" r="3.3" stroke="currentColor" stroke-width="1.8"/><path d="M3.6 19.5c.8-3.3 3.2-5 6.4-5 1.3 0 2.4.3 3.4.8M16 14.5l-2.5 2.5 2.5 2.5M13.5 17H19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  ruler: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  target: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4.6" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  gpsSignal: '<path d="M12 20.5v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7.5 15.5a6.4 6.4 0 0 1 0-9M16.5 15.5a6.4 6.4 0 0 0 0-9M4.6 18.4a10.4 10.4 0 0 1 0-14.8M19.4 18.4a10.4 10.4 0 0 0 0-14.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" transform="translate(0 0)"/>',
  refresh: '<path d="M20 11.5A8 8 0 0 0 5.8 7M4 4.5V8h3.5M4 12.5A8 8 0 0 0 18.2 17M20 19.5V16h-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  mapPinBox: '<rect x="4" y="4" width="16" height="16" rx="3.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 17s3.4-2.7 3.4-5.6a3.4 3.4 0 1 0-6.8 0C8.6 14.3 12 17 12 17Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  xCircle: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  calendarCheck: '<rect x="4" y="5.5" width="16" height="15" rx="2.4" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M8 3.5v3M16 3.5v3M9 15l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  barChart: '<path d="M5 20V12M12 20V5M19 20v-9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6" stroke="currentColor" stroke-width="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" stroke="currentColor" stroke-width="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" stroke="currentColor" stroke-width="1.8"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2.4" stroke="currentColor" stroke-width="1.8"/><path d="M11 18h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  userPlus: '<circle cx="9.5" cy="8.4" r="3.4" stroke="currentColor" stroke-width="1.8"/><path d="M3.2 19.5c.9-3.3 3.3-5 6.3-5s5.4 1.7 6.3 5M18 8v6M15 11h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  gamepad: '<rect x="3" y="7.5" width="18" height="10" rx="5" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5v4M6 12.5h4M15.5 11.5h.01M17.5 13.5h.01" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  logIn: '<path d="M15 4h3.6A1.4 1.4 0 0 1 20 5.4v13.2a1.4 1.4 0 0 1-1.4 1.4H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 16l4-4-4-4M14 12H4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
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
  // anti klik-ganda) sekarang SEPENUHNYA dipusatkan di modal.js (lihat
  // objek global `Modal`). Jangan menambahkan logika modal terpisah di
  // sini lagi supaya tidak ada dua sistem modal yang saling tumpang tindih.
});



/* ==========================================================================
   TOMBOL INSTAL APLIKASI (PWA)
   ==========================================================================
   Semua elemen [data-install-btn] dikendalikan di sini.
   - Chrome/Edge/Android: memakai event beforeinstallprompt (dialog instal asli).
   - iOS Safari / browser tanpa dukungan: menampilkan petunjuk manual.
   - Sudah terpasang (mode standalone): tombol disembunyikan.
   - Tombol di header (ikon) hanya muncul kalau dialog instal tersedia.
   ========================================================================== */
(function () {
  "use strict";
  var deferred = null;
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function platform() {
    var ua = navigator.userAgent || "";
    if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
    if (/android/i.test(ua)) return "android";
    if (/firefox/i.test(ua)) return "firefox";
    if (/edg\//i.test(ua)) return "edge";
    if (/chrome|chromium/i.test(ua)) return "chrome";
    if (/safari/i.test(ua)) return "safari";
    return "other";
  }
  function steps() {
    switch (platform()) {
      case "ios": return ["Buka halaman ini di <b>Safari</b>.", "Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).", "Pilih <b>Tambah ke Layar Utama</b>, lalu ketuk <b>Tambah</b>."];
      case "android": return ["Ketuk menu <b>\u22EE</b> di pojok kanan atas Chrome.", "Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.", "Ketuk <b>Instal</b>. Ikon PT. Depo PRG muncul di layar utama."];
      case "edge": return ["Klik ikon <b>Aplikasi</b> di ujung kanan kolom alamat, atau menu <b>\u22EF</b> \u2192 <b>Aplikasi</b>.", "Pilih <b>Instal situs ini sebagai aplikasi</b>.", "Klik <b>Instal</b>. Aplikasi terbuka di jendelanya sendiri."];
      case "firefox": return ["Firefox desktop belum mendukung instal aplikasi web.", "Gunakan <b>Google Chrome</b> atau <b>Microsoft Edge</b> untuk memasang aplikasi ini di PC.", "Di Android, menu <b>\u22EE</b> \u2192 <b>Instal</b> tersedia di Firefox."];
      case "safari": return ["Di Safari (macOS Sonoma+): menu <b>File</b> \u2192 <b>Tambahkan ke Dock</b>.", "Atau gunakan Chrome / Edge, lalu klik ikon <b>Instal</b> di kolom alamat."];
      default: return ["Klik ikon <b>Instal</b> (monitor dengan panah) di ujung kanan kolom alamat Chrome.", "Atau buka menu <b>\u22EE</b> \u2192 <b>Transmisikan, simpan, dan bagikan</b> \u2192 <b>Instal halaman sebagai aplikasi</b>.", "Klik <b>Instal</b>. Aplikasi terbuka di jendelanya sendiri."];
    }
  }
  function buttons() { return Array.prototype.slice.call(document.querySelectorAll("[data-install-btn]")); }
  function refresh() {
    var hide = isStandalone();
    buttons().forEach(function (b) { b.hidden = hide; b.classList.toggle("is-ready", !!deferred); });
    if (hide) { var box = document.querySelector(".install-box"); if (box) box.hidden = true; }
  }
  function closeSheet() {
    var s = document.getElementById("install-sheet");
    if (s && s.parentNode) s.parentNode.removeChild(s);
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") closeSheet(); }
  function openSheet() {
    closeSheet();
    var w = document.createElement("div");
    w.id = "install-sheet";
    w.className = "ins-overlay";
    w.innerHTML =
      '<div class="ins-sheet" role="dialog" aria-modal="true" aria-labelledby="ins-title">' +
        '<button type="button" class="ins-close" aria-label="Tutup">\u2715</button>' +
        '<div class="ins-hero"><span class="ins-app"><img src="logo-192.png" alt="" width="56" height="56"></span>' +
        '<div><h2 id="ins-title">Pasang aplikasi PT. Depo PRG</h2><p>Buka lebih cepat dari layar utama / desktop, tampil layar penuh, tetap ringan.</p></div></div>' +
        '<ol class="ins-steps">' + steps().map(function (t) { return "<li><span>" + t + "</span></li>"; }).join("") + "</ol>" +
        '<button type="button" class="btn btn--primary btn--block ins-ok">Mengerti</button>' +
      "</div>";
    document.body.appendChild(w);
    w.addEventListener("click", function (e) { if (e.target === w || (e.target.closest && (e.target.closest(".ins-close") || e.target.closest(".ins-ok")))) closeSheet(); });
    document.addEventListener("keydown", onKey);
    var ok = w.querySelector(".ins-ok"); if (ok) ok.focus();
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; refresh(); });
  window.addEventListener("appinstalled", function () { deferred = null; refresh(); if (typeof showToast === "function") showToast("Aplikasi berhasil dipasang.", "success"); });
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-install-btn]");
    if (!btn) return;
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; refresh(); }).catch(function () {});
      return;
    }
    openSheet();
  });
  document.addEventListener("DOMContentLoaded", refresh);
})();


/* ==========================================================================
   DETEKSI "SITUS DESKTOP" DI HP  (v35)
   ==========================================================================
   Saat HP membuka situs dalam mode "Situs desktop", browser memakai lebar
   layar ~980px sehingga seluruh tampilan terlihat mengecil. Solusinya:
   1) tandai <html class="dop"> -> CSS memaksa tata letak versi HP
      (bottom-nav, tanpa sidebar), dan
   2) skala ukuran huruf dasar (rem) sebesar rasio viewport/layar, sehingga
      ukuran semua elemen (yang kini berbasis rem) kembali sama seperti
      tampilan HP biasa. Tidak perlu lagi mematikan "Situs desktop".
   ========================================================================== */
(function () {
  "use strict";
  var root = document.documentElement;
  function apply() {
    try {
      var touch = (navigator.maxTouchPoints || 0) > 0;
      var sw = Math.min(screen.width, screen.height);
      var vw = window.innerWidth || root.clientWidth || 0;
      var shown = (sw <= 600 && !(window.matchMedia && window.matchMedia("(orientation:landscape)").matches)) ? sw : 0;
      if (touch && sw <= 600 && vw >= 800 && shown) {
        var ratio = Math.max(1, Math.min(3, vw / shown));
        root.classList.add("dop");
        root.style.fontSize = (ratio * 100).toFixed(1) + "%";
        root.style.setProperty("--dopz", ratio.toFixed(2));
      } else if (root.classList.contains("dop")) {
        root.classList.remove("dop");
        root.style.fontSize = "";
        root.style.removeProperty("--dopz");
      }
    } catch (e) { /* abaikan */ }
  }
  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", function () { setTimeout(apply, 250); });
})();
