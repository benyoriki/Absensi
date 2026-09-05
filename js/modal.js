/* ==========================================================================
   RAKABU ATTENDANCE — MODAL MANAGER (v7)
   ==========================================================================
   Perbaikan atas bug lama: modal bertumpuk, overlay gelap nyangkut, tombol
   tidak merespons, klik dua kali menjalankan dua proses, modal masih
   terbuka setelah submit.

   ATURAN:
   - Hanya SATU modal yang boleh aktif di satu waktu. Membuka modal baru
     otomatis menutup modal lain.
   - Semua modal HARUS dibuka lewat Modal.show(id) dan ditutup lewat
     Modal.hide(id) / Modal.hideAll() — jangan mengatur `hidden` secara
     langsung dari kode halaman.
   - ESC menutup modal aktif (kecuali modal ditandai data-no-esc).
   - Klik area gelap (overlay) menutup modal aktif (kecuali modal ditandai
     data-no-overlay-close, dipakai untuk modal proses/loading yang tidak
     boleh ditutup paksa).
   - Modal.runOnce(button, fn) mencegah sebuah tombol men-submit dua kali
     akibat klik ganda / tap ganda di layar sentuh: tombol otomatis
     di-disable selama fn() berjalan dan diberi status loading.
   ========================================================================== */

const Modal = (function () {
  "use strict";

  let activeId = null;
  const busyButtons = new WeakSet();

  function allOverlays() {
    return Array.from(document.querySelectorAll(".modal-overlay"));
  }

  function show(id) {
    const target = document.getElementById(id);
    if (!target) return;
    // Tutup semua modal lain dulu — mencegah tumpukan overlay/modal.
    allOverlays().forEach((m) => { if (m !== target) m.hidden = true; });
    target.hidden = false;
    activeId = id;
  }

  function hide(id) {
    const target = document.getElementById(id);
    if (target) target.hidden = true;
    if (activeId === id) activeId = null;
  }

  function hideAll() {
    allOverlays().forEach((m) => { m.hidden = true; });
    activeId = null;
  }

  function isOpen(id) {
    const target = document.getElementById(id);
    return !!target && !target.hidden;
  }

  /**
   * Menjalankan fn (bisa async) sambil mencegah klik ganda pada button.
   * Menampilkan state loading pada button selama proses berjalan, dan
   * mengembalikan label asal setelah selesai (baik sukses maupun gagal).
   */
  async function runOnce(button, fn, loadingLabel) {
    if (!button || busyButtons.has(button)) return;
    busyButtons.add(button);
    const originalHtml = button.innerHTML;
    const originalDisabled = button.disabled;
    button.disabled = true;
    if (loadingLabel !== false) {
      button.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:-2px;margin-right:.4em"></span>' + (loadingLabel || "Memproses…");
    }
    try {
      await fn();
    } finally {
      busyButtons.delete(button);
      button.disabled = originalDisabled;
      button.innerHTML = originalHtml;
    }
  }

  function initGlobalHandlers() {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !activeId) return;
      const target = document.getElementById(activeId);
      if (target && target.dataset.noEsc !== "true") hide(activeId);
    });
    allOverlays().forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target !== overlay) return;
        if (overlay.dataset.noOverlayClose === "true") return;
        hide(overlay.id);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initGlobalHandlers);

  return { show, hide, hideAll, isOpen, runOnce };
})();
