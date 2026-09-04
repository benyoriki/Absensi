/* ==========================================================================
   RAKABU ATTENDANCE — UI HELPERS BERSAMA
   Dipakai di semua halaman: toast, tema terang/gelap, util kecil.
   ========================================================================== */

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
  const saved = (window.Store && Store.getTheme()) || null;
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
  if (window.Store) Store.setTheme(theme);
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
});

