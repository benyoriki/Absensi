/* ==========================================================================
   RAKABU ATTENDANCE — EKSPOR LAPORAN (CSV / Excel / PDF)
   ==========================================================================
   Modul mandiri dipakai oleh menu "⬇️ Export" di halaman Rekap Absensi &
   Laporan.

   CATATAN PERFORMA: pustaka Excel (SheetJS) dan PDF (jsPDF + AutoTable)
   SENGAJA TIDAK dimuat di <head> — itu akan menambah ~1MB unduhan di setiap
   pembukaan halaman padahal fitur ekspor jarang dipakai. Sebagai gantinya,
   pustaka baru diunduh dari CDN (lazy-load) tepat saat pengguna memilih
   format Excel/PDF, lalu di-cache browser sehingga percobaan berikutnya
   instan. Format CSV tidak butuh pustaka apa pun sehingga selalu instan.
   ========================================================================== */
const ReportExport = (function () {
  "use strict";

  const CDN = {
    xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    autotable: "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
  };
  const loadedScripts = {};

  function loadScript(url) {
    if (loadedScripts[url]) return loadedScripts[url];
    loadedScripts[url] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Gagal memuat pustaka ekspor. Periksa koneksi internet Anda."));
      document.head.appendChild(s);
    });
    return loadedScripts[url];
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function toCsv(rows, filename) {
    const csv = rows.map((r) => r.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\n");
    triggerDownload(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), filename);
  }

  /** sheets = [{ name, rows: [[...header],[...row], ...] }] */
  async function toExcel(filename, sheets) {
    await loadScript(CDN.xlsx);
    const wb = XLSX.utils.book_new();
    sheets.forEach((sheet) => {
      const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
      const colCount = sheet.rows.reduce((m, r) => Math.max(m, r.length), 0);
      ws["!cols"] = Array.from({ length: colCount }, (_, i) => {
        const longest = sheet.rows.reduce((m, r) => Math.max(m, String(r[i] == null ? "" : r[i]).length), 8);
        return { wch: Math.min(38, longest + 2) };
      });
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
    });
    XLSX.writeFile(wb, filename);
  }

  /**
   * config = {
   *   title, subtitle, filename, orientation,
   *   meta: [[label, value], ...],
   *   table: { head: [...cols], body: [[...cells], ...] }
   * }
   * Menghasilkan PDF dengan kop bermerek Rakabu, tabel bergaya rapi
   * (AutoTable), dan nomor halaman — bukan sekadar dump tabel polos.
   */
  async function toPdf(config) {
    await loadScript(CDN.jspdf);
    await loadScript(CDN.autotable);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: config.orientation || "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const BRAND = [140, 35, 23];
    const GOLD = [183, 121, 30];
    const INK = [58, 45, 38];

    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageWidth, 68, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("PT. RAKABU SAPI KITA", 40, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text(config.title || "Laporan", 40, 45);
    doc.setFontSize(8);
    doc.text("Dicetak " + new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }), 40, 58);
    doc.setFillColor(...GOLD);
    doc.rect(0, 68, pageWidth, 3, "F");

    let y = 92;
    if (config.subtitle) {
      doc.setTextColor(...INK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(config.subtitle, 40, y);
      y += 16;
    }
    if (config.meta && config.meta.length) {
      doc.setFontSize(9);
      config.meta.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND);
        doc.text(String(label) + ":", 40, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...INK);
        doc.text(String(value), 150, y);
        y += 14;
      });
      y += 6;
    }

    doc.autoTable({
      head: [config.table.head],
      body: config.table.body,
      startY: y,
      margin: { left: 40, right: 40, bottom: 40 },
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 6, lineColor: [225, 216, 207], lineWidth: 0.6, textColor: INK },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold", halign: "left" },
      alternateRowStyles: { fillColor: [250, 247, 243] }
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(150, 140, 130);
      doc.text("Rakabu Attendance", 40, pageHeight - 18);
      doc.text("Halaman " + i + " / " + totalPages, pageWidth - 40, pageHeight - 18, { align: "right" });
    }

    doc.save(config.filename);
  }

  return { toCsv, toExcel, toPdf };
})();
