/* ==========================================================================
   PT. DEPO PRG — UI ENHANCE (v39, hanya untuk admin.html)
   ==========================================================================
   Peningkatan UX yang BERSIFAT TAMBAHAN dan tidak menyentuh data/Store:
   1. Breadcrumb di setiap judul halaman ("Admin › Nama Halaman").
   2. Pencarian cepat di atas setiap tabel (memfilter baris yang sudah
      dirender oleh admin.js — tidak mengubah data apa pun).
   3. Label kolom pada tiap sel (data-label) agar tabel tampil sebagai kartu
      di HP, bukan harus digeser ke samping.
   4. Empty state otomatis jika tidak ada baris yang cocok dengan pencarian.
   Tabel yang diberi atribut data-no-enhance (mis. tabel dashboard yang sudah
   punya toolbar sendiri) dilewati. Tidak memakai library, tidak ada ID DOM
   baru yang dipakai file lain.
   ========================================================================== */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    try { addBreadcrumbs(); document.querySelectorAll(".data-table:not([data-no-enhance])").forEach(enhanceTable); }
    catch (e) { if (window.console) console.warn("ui-enhance:", e); }
  });

  function addBreadcrumbs() {
    document.querySelectorAll("[data-page] > .page-title").forEach((title) => {
      const h = title.querySelector("h2");
      if (!h || title.querySelector(".crumbs")) return;
      const nav = document.createElement("nav");
      nav.className = "crumbs";
      nav.setAttribute("aria-label", "Breadcrumb");
      nav.innerHTML = "<span>Admin</span><span aria-hidden=\"true\">›</span><span aria-current=\"page\"></span>";
      nav.lastChild.textContent = h.textContent;
      (h.parentNode).insertBefore(nav, h);
    });
  }

  function enhanceTable(table) {
    const tbody = table.tBodies[0];
    const wrap = table.closest(".table-wrap");
    if (!tbody || !wrap) return;
    const heads = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent.trim());
    const card = wrap.parentNode;

    // Toolbar pencarian (dilewati jika kartu sudah punya kolom cari sendiri).
    let input = null;
    if (!card.querySelector('input[type="search"]')) {
      const bar = document.createElement("div");
      bar.className = "toolbar";
      bar.innerHTML = '<div class="toolbar__search"><input type="search" placeholder="Cari di tabel ini…" aria-label="Cari di tabel" /></div><span class="toolbar__count text-sm text-muted" aria-live="polite"></span>';
      card.insertBefore(bar, wrap);
      input = bar.querySelector("input");
      input.addEventListener("input", apply);
    }
    const counter = card.querySelector(".toolbar__count");

    let busy = false;
    function isDataRow(tr) { return tr.cells.length > 1 && !tr.hasAttribute("data-enhance-empty"); }

    function apply() {
      if (busy) return;
      busy = true;
      try {
        const q = input ? input.value.trim().toLowerCase() : "";
        let shown = 0, total = 0;
        Array.from(tbody.rows).forEach((tr) => {
          if (tr.hasAttribute("data-enhance-empty")) { tr.remove(); return; }
          if (!isDataRow(tr)) return;
          total++;
          Array.from(tr.cells).forEach((td, i) => { if (heads[i] && !td.hasAttribute("data-label")) td.setAttribute("data-label", heads[i]); });
          const match = !q || tr.textContent.toLowerCase().indexOf(q) !== -1;
          tr.hidden = !match;
          if (match) shown++;
        });
        if (q && total > 0 && shown === 0) {
          const tr = document.createElement("tr");
          tr.setAttribute("data-enhance-empty", "");
          tr.innerHTML = '<td colspan="' + heads.length + '"><div class="empty-state">Tidak ada data yang cocok dengan “' + q.replace(/[&<>"]/g, "") + '”.</div></td>';
          tbody.appendChild(tr);
        }
        if (counter) counter.textContent = q ? shown + " dari " + total : (total ? total + " data" : "");
      } finally { busy = false; if (obs) obs.takeRecords(); } // buang mutasi buatan sendiri (cegah loop)
    }
    let obs = null;

    // admin.js merender ulang isi <tbody> kapan saja -> terapkan ulang.
    obs = new MutationObserver(() => { if (!busy) apply(); });
    obs.observe(tbody, { childList: true });
    apply();
  }
})();
