/* ==========================================================================
   DEPO PRG ATTENDANCE — ADMIN DASHBOARD LOGIC
   ========================================================================== */
(function () {
  "use strict";

  if (window.__rakabuAdminInitialized) return;
  window.__rakabuAdminInitialized = true;

  if (!assertDependenciesLoaded(["Store", "CONFIG", "Modal", "ChatUI", "ReportExport"])) return;

  const admin = Store.currentUser();
  if (!admin || admin.role !== "admin") {
    window.location.replace("index.html");
    return;
  }

  const el = {};
  let confirmCallback = null;
  let rejectContext = null; // { kind: 'user'|'leave'|'overtime', id }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      cacheDom();
      bindNav();
      bindGlobalEvents();
      el.avatarBtn.innerHTML = avatarMarkup(admin);
      initClock();
      renderAll();
      ChatUI.init(admin);
    } catch (err) {
      // Lihat catatan yang sama di employee.js: tampilkan error yang
      // jelas alih-alih membiarkan dashboard admin "mati total" diam-diam.
      showFatalErrorBanner(err && err.message ? err.message : String(err));
    }
  });

  function cacheDom() {
    [
      "stat-cards","attendance-donut","attendance-legend","weekly-bar-chart","recent-activity-list",
      "pendaftaran-tbody","pendaftaran-empty","karyawan-search","karyawan-tbody",
      "absensi-tbody","add-manual-attendance-btn",
      "edit-attendance-modal","edit-attendance-close","edit-attendance-form",
      "ea-user","ea-date","ea-checkin","ea-checkout","ea-status","ea-note",
      "shift-grid","shift-users-tbody","add-shift-btn",
      "shift-modal","shift-modal-close","shift-form","shift-id","shift-name","shift-start","shift-end","shift-days-picker","shift-note","shift-delete-btn",
      "edit-office-location-btn","setting-updated-note",
      "office-location-modal","office-location-close","office-location-form","office-use-my-location-btn","office-geo-status",
      "office-lat","office-lon","office-radius","office-outside-radius","office-maps-url","office-location-error","office-reset-default-btn",
      "calib-banner","calib-banner-btn","office-paste","office-paste-btn","office-paste-status","office-gps-tolerance","setting-tolerance","setting-calibration",
      "monitoring-tbody","riwayat-lokasi-tbody","riwayat-lokasi-search",
      "izin-lokasi-tbody","sidebar-outside-badge",
      "setting-lat","setting-lon","setting-radius","setting-outside-radius","setting-accuracy","setting-outside","setting-late","setting-open-maps-btn",
      "cuti-tbody","lembur-tbody",
      "laporan-summary","laporan-tbody",
      "notif-list","mark-all-read-btn","notif-dot",
      "more-btn","more-modal","more-close-btn","more-logout-btn","sidebar-logout","sidebar-pending-badge",
      "employee-modal","employee-modal-content",
      "reject-modal","reject-modal-title","reject-modal-close","reject-form","reject-reason",
      "confirm-modal","confirm-title","confirm-message","confirm-cancel-btn","confirm-ok-btn",
      "avatar-btn",
      "dash-date","dept-stats","da-search","da-date","da-dept","da-status","da-tbody","da-pager","da-table",
      "att-detail-modal","att-detail-close","att-detail-body",
      "admin-global-search","admin-global-search-form","backup-export-btn","backup-schema-note"
    ].forEach((id) => { el[toCamel(id)] = document.getElementById(id); });
  }
  function toCamel(id) { return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

  function renderAll() {
    renderDashboard();
    renderPendaftaran();
    renderKaryawan();
    renderAbsensi("today");
    renderShift();
    renderIzinLokasi();
    renderCuti();
    renderLembur();
    renderLaporan();
    renderNotifications();
    updateNotifBadge();
  }

  /* ------------------------------------------------------------------ */
  /* NAV                                                                 */
  /* ------------------------------------------------------------------ */
  function bindNav() {
    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => { route(btn.dataset.nav); closeMore(); });
    });
    el.moreBtn.addEventListener("click", () => { Modal.show("more-modal"); });
    el.moreCloseBtn.addEventListener("click", closeMore);
    function closeMore() { Modal.hide("more-modal"); }
    window.addEventListener("hashchange", () => route(location.hash.replace("#", "")));
  }
  function route(page) {
    const valid = ["dashboard","pendaftaran","karyawan","absensi","shift","monitoring","riwayat-lokasi","izin-lokasi","cuti","lembur","laporan","pengaturan","notifikasi","chat"];
    if (!valid.includes(page)) page = "dashboard";
    document.querySelectorAll("[data-page]").forEach((sec) => { sec.hidden = sec.dataset.page !== page; });
    document.querySelectorAll("[data-nav]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.nav === page));
    if (page === "notifikasi") { Store.markAllRead("admin"); renderNotifications(); updateNotifBadge(); }
    if (page === "shift") renderShift();
    if (page === "monitoring") renderMonitoring();
    if (page === "riwayat-lokasi") renderRiwayatLokasi("today");
    if (page === "pengaturan") renderPengaturan();
    if (page === "chat") ChatUI.onOpen();
    location.hash = page;
  }

  function bindGlobalEvents() {
    // --- v39: dashboard (tren, tabel kehadiran, pencarian global, cadangan) ---
    document.querySelectorAll("[data-trend]").forEach((chip) => chip.addEventListener("click", () => {
      document.querySelectorAll("[data-trend]").forEach((c) => c.classList.toggle("is-active", c === chip));
      trendDays = Number(chip.dataset.trend) || 7;
      const td = document.querySelector("#trend-title .trend-days");
      if (td) td.textContent = trendDays + " Hari Terakhir";
      renderTrendChart();
    }));
    ["input", "change"].forEach((ev) => {
      el.daSearch.addEventListener(ev, () => { daState.page = 1; renderDashTable(); });
      el.daDate.addEventListener(ev, () => { daState.page = 1; renderDashTable(); });
      el.daDept.addEventListener(ev, () => { daState.page = 1; renderDashTable(); });
      el.daStatus.addEventListener(ev, () => { daState.page = 1; renderDashTable(); });
    });
    document.querySelectorAll("#da-table .th-sort").forEach((b) => b.addEventListener("click", () => {
      if (daState.sortKey === b.dataset.sort) daState.sortDir *= -1; else { daState.sortKey = b.dataset.sort; daState.sortDir = 1; }
      renderDashTable();
    }));
    el.attDetailClose.addEventListener("click", () => Modal.hide("att-detail-modal"));
    el.adminGlobalSearchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      el.karyawanSearch.value = el.adminGlobalSearch.value.trim();
      route("karyawan");
      el.karyawanSearch.dispatchEvent(new Event("input", { bubbles: true }));
    });
    if (el.backupExportBtn) el.backupExportBtn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(Store.exportBackup(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "depoprg-backup-" + Store.localDateKey() + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Cadangan data diunduh.", "success");
    });
    document.getElementById("sidebar-logout").addEventListener("click", doLogout);
    document.getElementById("more-logout-btn").addEventListener("click", doLogout);
    el.markAllReadBtn.addEventListener("click", () => { Store.markAllRead("admin"); renderNotifications(); updateNotifBadge(); });
    el.karyawanSearch.addEventListener("input", () => renderKaryawan());
    document.querySelectorAll('[data-arange]').forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll('[data-arange]').forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        renderAbsensi(chip.dataset.arange);
      });
    });
    document.querySelectorAll('[data-zrange]').forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll('[data-zrange]').forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        renderRiwayatLokasi(chip.dataset.zrange);
      });
    });
    el.riwayatLokasiSearch.addEventListener("input", () => renderRiwayatLokasi());
    el.settingOpenMapsBtn.addEventListener("click", () => window.open(CONFIG.OFFICE_MAPS_URL, "_blank"));
    bindExportMenus();

    // Edit / Tambah Jam Absensi
    el.addManualAttendanceBtn.addEventListener("click", () => openEditAttendanceModal(null, null));
    el.editAttendanceClose.addEventListener("click", () => Modal.hide("edit-attendance-modal"));
    el.editAttendanceForm.addEventListener("submit", onSubmitEditAttendance);

    // Shift Kerja
    el.addShiftBtn.addEventListener("click", () => openShiftModal(null));
    el.shiftModalClose.addEventListener("click", () => Modal.hide("shift-modal"));
    el.shiftForm.addEventListener("submit", onSubmitShift);
    el.shiftDeleteBtn.addEventListener("click", onDeleteShift);
    el.shiftDaysPicker.querySelectorAll("[data-day]").forEach((chip) => {
      chip.addEventListener("click", () => chip.classList.toggle("is-active"));
    });

    // Ubah Lokasi Kantor
    el.editOfficeLocationBtn.addEventListener("click", openOfficeLocationModal);
    el.officeLocationClose.addEventListener("click", () => Modal.hide("office-location-modal"));
    el.officeLocationForm.addEventListener("submit", onSubmitOfficeLocation);
    el.officeUseMyLocationBtn.addEventListener("click", onUseMyLocation);
    el.officePasteBtn.addEventListener("click", onParseMapsPaste);
    el.calibBannerBtn.addEventListener("click", openOfficeLocationModal);
    el.officePaste.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); onParseMapsPaste(); } });
    el.officeResetDefaultBtn.addEventListener("click", onResetOfficeLocation);

    el.rejectModalClose.addEventListener("click", () => Modal.hide("reject-modal"));
    el.rejectForm.addEventListener("submit", onSubmitReject);
    el.confirmCancelBtn.addEventListener("click", () => Modal.hide("confirm-modal"));
    el.confirmOkBtn.addEventListener("click", () => {
      Modal.runOnce(el.confirmOkBtn, async () => { if (confirmCallback) await confirmCallback(); Modal.hide("confirm-modal"); });
    });

    // Halaman Monitoring Lokasi diperbarui otomatis setiap beberapa detik
    // selama admin sedang membukanya, supaya terasa "hidup" tanpa harus
    // refresh manual (tetap dibatasi pada data yang tersedia di browser
    // yang sama — lihat catatan keterbatasan LocalStorage).
    setInterval(() => {
      if (location.hash.replace("#", "") === "monitoring") renderMonitoring();
    }, 5000);
  }

  function doLogout() { Store.logout(); window.location.replace("index.html"); }

  // Bug fix (anti tumpuk-modal): sebelumnya setiap modal (Menu Lainnya,
  // Detail Karyawan, Tolak, Konfirmasi) hanya mengatur `hidden` pada dirinya
  // sendiri tanpa pernah menutup modal lain yang mungkin masih terbuka.
  // Sekarang SEMUA modal dibuka/ditutup lewat Modal (modal.js), yang
  // memusatkan aturan "hanya satu modal aktif" di satu tempat.

  function askConfirm(title, message, onConfirm) {
    el.confirmTitle.textContent = title;
    el.confirmMessage.textContent = message;
    confirmCallback = onConfirm;
    Modal.show("confirm-modal");
  }

  function initClock() {
    updateClock();
    setInterval(updateClock, 1000);
  }
  function updateClock() {
    const now = new Date();
    const t = document.getElementById("clock-time"), d = document.getElementById("clock-date");
    if (t) t.textContent = now.toTimeString().slice(0, 8);
    if (d) d.textContent = now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  }

  /* ------------------------------------------------------------------ */
  /* DASHBOARD: STATS + CHARTS + ACTIVITY                                */
  /* ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ */
  /* DASHBOARD (v39) — semua angka dari Store.getDailyStats & kawan-kawan */
  /* ------------------------------------------------------------------ */
  let trendDays = 7;
  const daState = { page: 1, perPage: 8, sortKey: "name", sortDir: 1 };
  const STATUS_LABEL = { hadir: "Hadir", terlambat: "Terlambat", cuti: "Cuti / Izin", "tidak-hadir": "Tidak hadir", libur: "Libur" };
  const STATUS_CLASS = { hadir: "badge--success", terlambat: "badge--warning", cuti: "badge--info", "tidak-hadir": "badge--danger", libur: "badge--neutral" };

  function renderDashboard() {
    const todayKey = Store.localDateKey();
    if (el.calibBanner) el.calibBanner.hidden = !!CONFIG.OFFICE_CALIBRATED;
    if (el.dashDate) el.dashDate.textContent = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const users = Store.getUsers().filter((u) => u.role === "employee");
    const st = Store.getDailyStats(todayKey);
    const pend = Store.getPendingApprovalCount();
    const pct = st.total ? Math.round((st.present / st.total) * 100) : 0;

    const pctOf = (n) => (st.total ? Math.round((n / st.total) * 100) : 0);
    const cards = [
      { label: "Total Karyawan", value: st.total, hint: `${users.length} akun`, icon: "users", color: "info" },
      { label: "Hadir Hari Ini", value: st.present, pct: st.total ? `(${pctOf(st.present)}%)` : "", hint: "", icon: "checkCircle", color: "success" },
      { label: "Terlambat", value: st.terlambat, pct: st.total ? `(${pctOf(st.terlambat)}%)` : "", hint: "", icon: "clock", color: "warning" },
      { label: "Tidak Hadir", value: st.tidakHadir, pct: st.total ? `(${pctOf(st.tidakHadir)}%)` : "", hint: "", icon: "xCircle", color: "danger" },
      { label: "Cuti / Izin", value: st.cuti, hint: "disetujui", icon: "umbrella", color: "info", extra: true },
      { label: "Pending Approval", value: pend.total, hint: [[pend.registrations, "daftar"], [pend.leave, "cuti"], [pend.overtime, "lembur"], [pend.outside, "luar lokasi"]].filter((x) => x[0] > 0).map((x) => `${x[0]} ${x[1]}`).join(" · ") || "Tidak ada", icon: "plusCircle", color: "warning", extra: true }
    ];
    el.statCards.innerHTML = cards.map((c) => `
      <div class="stat-card stat-card--${c.color}${c.extra ? " stat-card--extra" : ""}">
        <div class="stat-card__icon" style="background:var(--${c.color}-100);color:var(--${c.color}-600)">${iconSvg(c.icon, 24)}</div>
        <div class="stat-card__body">
          <div class="stat-card__value">${c.value}${c.pct ? `<small class="stat-card__pct">${c.pct}</small>` : ""}</div>
          <div class="stat-card__label">${c.label}</div>
          ${c.hint ? `<div class="stat-card__hint">${escapeHtml(c.hint)}</div>` : ""}
        </div>
      </div>`).join("");

    el.sidebarPendingBadge.hidden = pend.registrations === 0;
    el.sidebarPendingBadge.textContent = pend.registrations;

    renderAttendanceDonut(st);
    renderTrendChart();
    renderDeptStats();
    renderRecentActivity();
    populateDashFilters();
    renderDashTable();
  }

  function renderAttendanceDonut(st) {
    const segments = [
      { value: st.hadir, color: "var(--success-600)", label: "Hadir" },
      { value: st.terlambat, color: "var(--warning-solid)", label: "Terlambat" },
      { value: st.cuti, color: "var(--info-600)", label: "Cuti/Izin" },
      { value: st.tidakHadir, color: "var(--danger-600)", label: "Tidak hadir" }
    ];
    const total = segments.reduce((n, s) => n + s.value, 0);
    const cx = 70, cy = 70, r = 55, strokeW = 18;
    const circumference = 2 * Math.PI * r;
    let offset = 0, circles = "";
    segments.forEach((s) => {
      const len = total ? (s.value / total) * circumference : 0;
      if (len > 0) circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" style="stroke:${s.color}" stroke-width="${strokeW}"
        stroke-dasharray="${len} ${circumference - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"><title>${s.label}: ${s.value}</title></circle>`;
      offset += len;
    });
    const pct = total ? Math.round((st.present / total) * 100) : 0;
    el.attendanceDonut.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" style="stroke:var(--border)" stroke-width="${strokeW}"/>${circles}
      <text x="${cx}" y="${cy + 2}" text-anchor="middle" font-weight="800" font-size="22" style="fill:var(--text-900)">${pct}%</text>
      <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="9" style="fill:var(--text-500)">Hadir</text>`;
    const pctSeg = (n) => (st.total ? Math.round((n / st.total) * 100) : 0);
    el.attendanceLegend.innerHTML = segments.map((s) => `
      <div class="legend__item"><span class="legend__swatch" style="background:${s.color}"></span><span class="legend__name">${s.label}</span><b>${s.value}${st.total ? ` (${pctSeg(s.value)}%)` : ""}</b></div>`).join("")
      + (st.libur ? `<div class="legend__item"><span class="legend__swatch" style="background:var(--border-strong)"></span>Libur: <b>${st.libur}</b></div>` : "");
  }

  // Grafik tren SVG ringan (tanpa library): Hadir, Terlambat, Tidak hadir.
  function renderTrendChart() {
    const rows = Store.getAttendanceTrend(trendDays);
    const narrow = window.innerWidth < 600; // HP: kanvas lebih pendek agar grafik tidak mendominasi
    const W = narrow ? 380 : 640, H = narrow ? 150 : 230, padL = narrow ? 28 : 34, padR = narrow ? 18 : 12, padT = 12, padB = narrow ? 24 : 30;
    const iw = W - padL - padR, ih = H - padT - padB;
    const maxV = Math.max(1, ...rows.map((r) => Math.max(r.present, r.terlambat, r.tidakHadir)));
    const yMax = Math.max(4, Math.ceil((maxV * 1.1) / 4) * 4); // kelipatan 4 -> label sumbu Y bulat & unik
    const xAt = (i) => padL + (rows.length === 1 ? iw / 2 : (i / (rows.length - 1)) * iw);
    const yAt = (v) => padT + ih - (v / yMax) * ih;
    const series = [
      { key: "present", label: "Hadir", color: "var(--blue)", area: true, main: true },
      { key: "terlambat", label: "Terlambat", color: "var(--warning-solid)" },
      { key: "tidakHadir", label: "Tidak hadir", color: "var(--danger-600)" }
    ];
    let grid = "";
    for (let i = 0; i <= 4; i++) {
      const v = Math.round((yMax / 4) * i);
      const y = yAt((yMax / 4) * i);
      grid += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" style="stroke:var(--border)" stroke-dasharray="3 4"/><text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="10" style="fill:var(--text-500)">${v}</text>`;
    }
    const every = rows.length > 14 ? 5 : (narrow && rows.length > 5 ? 2 : 1);
    let labels = "";
    rows.forEach((r, i) => {
      if (i % every !== 0 && i !== rows.length - 1) return;
      const d = r.dateKey.slice(8) + "/" + r.dateKey.slice(5, 7);
      labels += `<text x="${xAt(i)}" y="${H - 9}" text-anchor="middle" font-size="10" style="fill:var(--text-500)">${d}</text>`;
    });
    let paths = "";
    series.forEach((s) => {
      const pts = rows.map((r, i) => [xAt(i), yAt(r[s.key])]);
      const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      if (s.area && pts.length > 1) paths += `<path d="${line} L${pts[pts.length - 1][0].toFixed(1)} ${padT + ih} L${pts[0][0].toFixed(1)} ${padT + ih} Z" style="fill:${s.color}" opacity=".16"/>`;
      paths += `<path d="${line}" fill="none" style="stroke:${s.color}" stroke-width="${s.main ? 2.6 : 1.6}" stroke-linecap="round" stroke-linejoin="round"${s.main ? "" : ' stroke-dasharray="5 4" opacity=".75"'}/>`;
      if (rows.length <= 14) pts.forEach((p, i) => { paths += `<circle cx="${p[0]}" cy="${p[1]}" r="${s.main ? 4 : 2.6}" style="fill:var(--surface);stroke:${s.color}" stroke-width="2"><title>${s.label} ${rows[i].dateKey}: ${rows[i][s.key]}</title></circle>`; });
    });
    el.weeklyBarChart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tren kehadiran ${trendDays} hari">${grid}${paths}${labels}</svg>
      <div class="legend legend--row">${series.map((s) => `<div class="legend__item"><span class="legend__swatch" style="background:${s.color}"></span>${s.label}</div>`).join("")}</div>`;
  }

  function renderDeptStats() {
    const rows = Store.getDepartmentStats();
    if (!rows.length) { el.deptStats.innerHTML = emptyStateBlock("Belum ada karyawan aktif."); return; }
    el.deptStats.innerHTML = rows.map((r) => {
      const t = Math.max(1, r.total);
      const seg = (n, c) => n ? `<span style="width:${(n / t) * 100}%;background:${c}"></span>` : "";
      return `<div class="dept-row">
        <div class="dept-row__head"><strong>${escapeHtml(r.department)}</strong><span class="text-sm text-muted">${r.present}/${r.total} hadir</span></div>
        <div class="dept-row__bar" role="img" aria-label="${escapeHtml(r.department)}: ${r.present} hadir dari ${r.total}">${seg(r.hadir, "var(--success-600)")}${seg(r.terlambat, "var(--warning-solid)")}${seg(r.cuti, "var(--info-600)")}${seg(r.tidakHadir, "var(--danger-600)")}</div>
      </div>`;
    }).join("");
  }

  // Aktivitas: absen hari ini (masuk/pulang) + notifikasi untuk admin, terbaru di atas.
  function renderRecentActivity() {
    const todayKey = Store.localDateKey();
    const items = [];
    Store.getAttendance().filter((a) => a.date === todayKey).forEach((a) => {
      const u = Store.findUserById(a.userId); const nm = u ? u.name : a.userId;
      const base = new Date(todayKey + "T00:00:00").getTime();
      const toTs = (hhmm) => { const p = String(hhmm).split(":").map(Number); return base + ((p[0] || 0) * 60 + (p[1] || 0)) * 60000; };
      if (a.checkIn) items.push({ ts: toTs(a.checkIn), type: "attendance", title: `${nm} absen masuk`, message: `Pukul ${a.checkIn}${a.status === "terlambat" ? " (terlambat)" : ""}` });
      if (a.checkOut) items.push({ ts: toTs(a.checkOut), type: "attendance", title: `${nm} absen pulang`, message: `Pukul ${a.checkOut}` });
    });
    Store.getNotifications().filter((n) => n.audience === "admin").slice(0, 12).forEach((n) => {
      items.push({ ts: n.createdAt || 0, type: n.type, title: n.title, message: n.message });
    });
    items.sort((a, b) => b.ts - a.ts);
    const top = items.slice(0, 8);
    el.recentActivityList.innerHTML = top.length ? top.map((n) => `
      <li>
        <span class="act-ico act-ico--${/terlambat/i.test((n.message || "") + (n.title || "")) ? "late" : escapeHtml(String(n.type || "info"))}">${iconSvg(activityIcon(n), 20)}</span>
        <div class="history-list__body">
          <div class="history-list__time">${escapeHtml(n.title)}</div>
          <div class="history-list__meta">${escapeHtml(n.message)}</div>
        </div>
        <span class="text-sm text-muted">${timeAgoID(n.ts)}</span>
      </li>`).join("") : emptyStateHtml("Belum ada aktivitas.");
  }

  /* ---- Tabel kehadiran di dashboard: cari, filter, urut, halaman ---- */
  function populateDashFilters() {
    if (!el.daDate.value) el.daDate.value = Store.localDateKey();
    const cur = el.daDept.value;
    const depts = Array.from(new Set(Store.getUsers().filter((u) => u.role === "employee" && u.status === "active").map((u) => u.department || "Tanpa Departemen"))).sort();
    el.daDept.innerHTML = '<option value="">Semua dept.</option>' + depts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
    el.daDept.value = depts.includes(cur) ? cur : "";
  }

  function dashRows() {
    const key = el.daDate.value || Store.localDateKey();
    const d = new Date(key + "T00:00:00");
    const iso = d.getDay() === 0 ? 7 : d.getDay();
    const att = Store.getAttendance().filter((a) => a.date === key);
    const leave = Store.getLeave();
    return Store.getUsers().filter((u) => u.role === "employee" && u.status === "active" && !(u.joinDate && u.joinDate > key)).map((u) => {
      const rec = att.find((a) => a.userId === u.id) || null;
      let status;
      if (rec && rec.checkIn && (rec.status === "hadir" || rec.status === "terlambat")) status = rec.status;
      else if ((rec && rec.status === "izin") || leave.some((l) => l.userId === u.id && l.status === "approved" && key >= l.startDate && key <= l.endDate)) status = "cuti";
      else if (!Store.getEffectiveSchedule(u, iso).isWorkday) status = "libur";
      else status = "tidak-hadir";
      return { user: u, rec, status, dateKey: key };
    });
  }

  function renderDashTable() {
    let rows = dashRows();
    const q = (el.daSearch.value || "").trim().toLowerCase();
    const dept = el.daDept.value, stf = el.daStatus.value;
    rows = rows.filter((r) => (!q || (r.user.name + " " + r.user.id + " " + (r.user.department || "")).toLowerCase().includes(q))
      && (!dept || (r.user.department || "Tanpa Departemen") === dept) && (!stf || r.status === stf));
    const keyFn = {
      name: (r) => r.user.name.toLowerCase(), id: (r) => r.user.id.toLowerCase(), dept: (r) => (r.user.department || "").toLowerCase(),
      in: (r) => (r.rec && r.rec.checkIn) || "99:99", out: (r) => (r.rec && r.rec.checkOut) || "99:99", status: (r) => r.status
    }[daState.sortKey] || ((r) => r.user.name);
    rows.sort((a, b) => (keyFn(a) < keyFn(b) ? -1 : keyFn(a) > keyFn(b) ? 1 : 0) * daState.sortDir);

    document.querySelectorAll("#da-table .th-sort").forEach((b) => {
      const on = b.dataset.sort === daState.sortKey;
      b.classList.toggle("is-sorted", on);
      b.setAttribute("aria-sort", on ? (daState.sortDir === 1 ? "ascending" : "descending") : "none");
    });

    const pages = Math.max(1, Math.ceil(rows.length / daState.perPage));
    daState.page = Math.min(daState.page, pages);
    const slice = rows.slice((daState.page - 1) * daState.perPage, daState.page * daState.perPage);

    if (!slice.length) {
      el.daTbody.innerHTML = `<tr><td colspan="8">${emptyStateBlock("Tidak ada karyawan yang cocok dengan filter.")}</td></tr>`;
    } else {
      el.daTbody.innerHTML = slice.map((r) => {
        const a = r.rec;
        const loc = a && a.checkInDistance != null ? a.checkInDistance.toFixed(1) + " m" + (a.checkInViaException ? " · izin" : "") : "—";
        return `<tr>
          <td data-label="Nama"><strong>${escapeHtml(r.user.name)}</strong></td>
          <td data-label="ID" class="mono">${escapeHtml(r.user.id)}</td>
          <td data-label="Departemen">${escapeHtml(r.user.department || "—")}</td>
          <td data-label="Masuk" class="mono">${(a && a.checkIn) || "—"}</td>
          <td data-label="Pulang" class="mono">${(a && a.checkOut) || "—"}</td>
          <td data-label="Status"><span class="badge ${STATUS_CLASS[r.status]}">${STATUS_LABEL[r.status]}</span></td>
          <td data-label="Lokasi" class="mono">${loc}</td>
          <td data-label="Aksi"><button type="button" class="btn btn--ghost btn--sm" data-da-detail="${escapeHtml(r.user.id)}">Detail</button></td>
        </tr>`;
      }).join("");
      el.daTbody.querySelectorAll("[data-da-detail]").forEach((b) => b.addEventListener("click", () => openAttDetail(b.dataset.daDetail)));
    }
    el.daPager.innerHTML = rows.length > daState.perPage
      ? `<span class="text-sm text-muted">${rows.length} karyawan · halaman ${daState.page}/${pages}</span>
         <div><button type="button" class="btn btn--ghost btn--sm" data-da-page="-1" ${daState.page <= 1 ? "disabled" : ""}>‹ Sebelumnya</button>
         <button type="button" class="btn btn--ghost btn--sm" data-da-page="1" ${daState.page >= pages ? "disabled" : ""}>Berikutnya ›</button></div>`
      : `<span class="text-sm text-muted">${rows.length} karyawan</span>`;
    el.daPager.querySelectorAll("[data-da-page]").forEach((b) => b.addEventListener("click", () => { daState.page += Number(b.dataset.daPage); renderDashTable(); }));
  }

  function openAttDetail(userId) {
    const r = dashRows().find((x) => x.user.id === userId);
    if (!r) return;
    const a = r.rec;
    const row = (k, v) => `<div class="stat-list__item"><dt>${k}</dt><dd>${v}</dd></div>`;
    const coord = a && a.checkInLat != null ? `${Number(a.checkInLat).toFixed(6)}, ${Number(a.checkInLon).toFixed(6)}` : "—";
    el.attDetailBody.innerHTML = `
      <div class="detail-head"><div class="avatar-md">${avatarMarkup(r.user)}</div><div><strong>${escapeHtml(r.user.name)}</strong><div class="text-sm text-muted">${escapeHtml(r.user.id)} · ${escapeHtml(r.user.department || "—")}</div></div><span class="badge ${STATUS_CLASS[r.status]}">${STATUS_LABEL[r.status]}</span></div>
      <dl class="stat-list">
        ${row("Tanggal", escapeHtml(formatDateID(r.dateKey)))}
        ${row("Jam masuk", `<span class="mono">${(a && a.checkIn) || "—"}</span>`)}
        ${row("Jam pulang", `<span class="mono">${(a && a.checkOut) || "—"}</span>`)}
        ${row("Jarak saat masuk", a && a.checkInDistance != null ? a.checkInDistance.toFixed(1) + " m" : "—")}
        ${row("Akurasi GPS", a && a.checkInAccuracy != null ? "±" + Math.round(a.checkInAccuracy) + " m" : "—")}
        ${row("Kualitas lokasi", a && a.checkInGps ? escapeHtml(({inside:"Dalam radius",tolerance:"Dalam toleransi GPS (+"+a.checkInGps.bonus+" m)",outside:"Izin admin"}[a.checkInGps.status]||"—")) + (a.checkInGps.trust != null ? " · kepercayaan " + a.checkInGps.trust + "/100" : "") + (a.checkInGps.flags && a.checkInGps.flags.length ? " · ⚠️ " + escapeHtml(a.checkInGps.flags.join(", ")) : "") : "—")}
        ${row("Koordinat", `<span class="mono">${coord}</span>`)}
        ${row("Alamat", escapeHtml((a && a.checkInAddress) || "—"))}
        ${row("Kode verifikasi", `<span class="mono">${escapeHtml((a && (a.checkInPhotoCode || "")) || "—")}</span>`)}
      </dl>
      ${a ? `<div class="detail-photos">${AttendancePhoto.buttonsHtml(a, r.user.name) || '<span class="text-sm text-muted">Tidak ada foto tersimpan di perangkat ini.</span>'}</div>` : ""}`;
    AttendancePhoto.bindViewButtons(el.attDetailBody);
    Modal.show("att-detail-modal");
  }

  function activityIcon(n) {
    if (/terlambat/i.test((n.message || "") + (n.title || ""))) return "alertTriangle";
    return { attendance: "calendarCheck", registration: "userPlus", leave: "calendar", overtime: "clock", zone: "alertTriangle", outside: "alertTriangle" }[n.type] || "bell";
  }
  function iconColorForType(type) {
    return { attendance: "var(--success-600)", registration: "var(--info-600)", leave: "var(--brand-600)", overtime: "var(--gold-500)", zone: "var(--danger-600)", outside: "var(--warning-600)", info: "var(--text-400)" }[type] || "var(--brand-600)";
  }

  /* ------------------------------------------------------------------ */
  /* PENDAFTARAN BARU                                                    */
  /* ------------------------------------------------------------------ */
  function renderPendaftaran() {
    const list = Store.getUsers().filter((u) => u.role === "employee" && u.status === "pending");
    if (!list.length) {
      el.pendaftaranTbody.innerHTML = "";
      el.pendaftaranEmpty.hidden = false;
      el.pendaftaranEmpty.innerHTML = emptyStateBlock("Tidak ada pendaftaran baru saat ini.");
      return;
    }
    el.pendaftaranEmpty.hidden = true;
    el.pendaftaranTbody.innerHTML = list.map((u) => `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td class="mono">${escapeHtml(u.id)}</td>
        <td>${escapeHtml(u.department)}</td>
        <td>${new Date(u.createdAt).toLocaleDateString("id-ID")}</td>
        <td><span class="pill pill--warning">Pending</span></td>
        <td>
          <div style="display:flex;gap:.4em;flex-wrap:wrap">
            <button class="btn btn--ghost btn--sm" data-detail="${u.id}">Detail</button>
            <button class="btn btn--primary btn--sm" data-approve="${u.id}">ACC</button>
            <button class="btn btn--danger-ghost btn--sm" data-reject="${u.id}">Tolak</button>
          </div>
        </td>
      </tr>`).join("");

    el.pendaftaranTbody.querySelectorAll("[data-detail]").forEach((b) => b.addEventListener("click", () => openEmployeeDetail(b.dataset.detail)));
    el.pendaftaranTbody.querySelectorAll("[data-approve]").forEach((b) => b.addEventListener("click", () => {
      askConfirm("Setujui Pendaftaran", "Setujui pendaftaran karyawan ini? Karyawan akan dapat login setelah disetujui.", () => {
        Store.approveUser(b.dataset.approve);
        showToast("Karyawan disetujui.", "success");
        renderAll();
      });
    }));
    el.pendaftaranTbody.querySelectorAll("[data-reject]").forEach((b) => b.addEventListener("click", () => {
      rejectContext = { kind: "user", id: b.dataset.reject };
      el.rejectModalTitle.textContent = "Tolak Pendaftaran";
      el.rejectReason.value = "";
      Modal.show("reject-modal");
    }));
  }

  let rejectSubmitting = false;
  function onSubmitReject(e) {
    e.preventDefault();
    if (rejectSubmitting) return;
    rejectSubmitting = true;
    const reason = el.rejectReason.value.trim();
    if (!rejectContext) { rejectSubmitting = false; return; }
    if (rejectContext.kind === "user") Store.rejectUser(rejectContext.id, reason);
    if (rejectContext.kind === "leave") Store.decideLeave(rejectContext.id, "rejected", reason);
    if (rejectContext.kind === "overtime") Store.decideOvertime(rejectContext.id, "rejected", reason);
    if (rejectContext.kind === "outside") Store.decideOutsideRequest(rejectContext.id, "rejected", reason);
    Modal.hide("reject-modal");
    showToast("Pengajuan ditolak.", "warning");
    rejectContext = null;
    renderAll();
    rejectSubmitting = false;
  }

  /* ------------------------------------------------------------------ */
  /* DATA KARYAWAN                                                       */
  /* ------------------------------------------------------------------ */
  function renderKaryawan() {
    const q = (el.karyawanSearch.value || "").toLowerCase();
    let list = Store.getUsers().filter((u) => u.role === "employee");
    if (q) list = list.filter((u) => (u.name + u.id + u.department).toLowerCase().includes(q));
    if (!list.length) {
      el.karyawanTbody.innerHTML = `<tr><td colspan="6">${emptyStateBlock("Tidak ada data karyawan yang cocok.")}</td></tr>`;
      return;
    }
    el.karyawanTbody.innerHTML = list.map((u) => `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td class="mono">${escapeHtml(u.id)}</td>
        <td>${escapeHtml(u.position)}</td>
        <td>${escapeHtml(u.department)}</td>
        <td>${statusPillForUser(u)}</td>
        <td><button class="btn btn--ghost btn--sm" data-detail="${u.id}">Kelola</button></td>
      </tr>`).join("");
    el.karyawanTbody.querySelectorAll("[data-detail]").forEach((b) => b.addEventListener("click", () => openEmployeeDetail(b.dataset.detail)));
  }
  function statusPillForUser(u) {
    if (u.status === "active") return '<span class="pill pill--success">Aktif</span>';
    if (u.status === "pending") return '<span class="pill pill--warning">Pending</span>';
    if (u.status === "rejected") return '<span class="pill pill--danger">Ditolak</span>';
    return '<span class="pill pill--neutral">Nonaktif</span>';
  }

  function openEmployeeDetail(userId) {
    const u = Store.findUserById(userId);
    if (!u) return;
    const history = Store.attendanceByUser(userId).slice(0, 5);
    const leaves = Store.leaveByUser(userId).slice(0, 5);
    el.employeeModalContent.innerHTML = `
      <div class="modal__head"><h2>Detail Karyawan</h2><button class="icon-btn" id="employee-modal-close" aria-label="Tutup">✕</button></div>
      <div class="profile-head">
        <div class="avatar-lg">${avatarMarkup(u)}</div>
        <div class="profile-head__info"><h3>${escapeHtml(displayName(u))}<button type="button" class="name-edit-btn" id="edit-name-shortcut" aria-label="Edit nama karyawan" title="Edit nama"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" stroke="currentColor" stroke-width="1.8"/></svg></button></h3><p>${escapeHtml(u.position)} · ${escapeHtml(u.department)}</p></div>
      </div>
      <dl class="stat-list">
        <div class="stat-list__item"><dt>ID Karyawan</dt><dd class="mono">${escapeHtml(u.id)}</dd></div>
        <div class="stat-list__item"><dt>Email</dt><dd>${escapeHtml(u.email)}</dd></div>
        <div class="stat-list__item"><dt>Nomor HP</dt><dd>${escapeHtml(u.phone)}</dd></div>
        <div class="stat-list__item"><dt>Status</dt><dd>${statusPillForUser(u)}</dd></div>
        <div class="stat-list__item"><dt>Tanggal Bergabung</dt><dd>${u.joinDate ? formatDateID(u.joinDate) : "-"}</dd></div>
        <div class="stat-list__item"><dt>Sisa Cuti</dt><dd>${(u.leaveQuota - u.leaveUsed)} / ${u.leaveQuota} hari</dd></div>
      </dl>

      <div class="section-divider"></div>
      <h3 style="font-size:.92rem;margin-bottom:.6em">Riwayat Absensi Terakhir</h3>
      <ul class="history-list">${history.length ? history.map((r) => `
        <li><div class="history-list__dot" style="background:var(--brand-600)"></div>
        <div class="history-list__body"><div class="history-list__time">${formatDateID(r.date)}</div><div class="history-list__meta">Masuk ${r.checkIn || "—"} · Pulang ${r.checkOut || "—"}</div></div></li>`).join("") : emptyStateHtml("Belum ada riwayat.")}</ul>

      <div class="section-divider"></div>
      <h3 style="font-size:.92rem;margin-bottom:.6em">Riwayat Cuti Terakhir</h3>
      <ul class="history-list">${leaves.length ? leaves.map((l) => `
        <li><div class="history-list__dot" style="background:var(--brand-600)"></div>
        <div class="history-list__body"><div class="history-list__time">${l.type} (${l.days} hari)</div><div class="history-list__meta">${formatDateRangeID(l.startDate, l.endDate)}</div></div></li>`).join("") : emptyStateHtml("Belum ada pengajuan cuti.")}</ul>

      <div class="section-divider"></div>
      <h3 style="font-size:.92rem;margin-bottom:.8em">Kelola Akun</h3>
      <div class="chip-group">
        ${u.status !== "active" ? `<button class="btn btn--primary btn--sm" data-action="activate">Aktifkan</button>` : ""}
        ${u.status === "active" ? `<button class="btn btn--danger-ghost btn--sm" data-action="deactivate">Nonaktifkan</button>` : ""}
        <button class="btn btn--ghost btn--sm" data-action="reset-password">Reset Password</button>
      </div>
      <form id="edit-employee-form" class="mt-1">
        <div class="field-row field-row--name">
          <div class="field-grow"><label for="edit-name">Nama Lengkap</label><input id="edit-name" value="${escapeHtml(u.name)}" maxlength="60" autocomplete="off" placeholder="Nama lengkap karyawan" required /></div>
          <div class="field-gelar"><label for="edit-degree">Gelar</label><input id="edit-degree" value="${escapeHtml(u.degree || "")}" maxlength="30" autocomplete="off" placeholder="S.Kom" /></div>
        </div>
        <span class="field-error" id="edit-name-error" role="alert"></span>
        <div class="field-row">
          <div><label for="edit-position">Jabatan</label><input id="edit-position" value="${escapeHtml(u.position)}" /></div>
          <div><label for="edit-department">Departemen</label><input id="edit-department" value="${escapeHtml(u.department)}" /></div>
        </div>
        <label for="edit-shift">Shift Kerja</label>
        <select id="edit-shift">${shiftOptionsHtml(u.shiftId)}</select>
        <button type="submit" class="btn btn--ghost btn--block mt-1">Simpan Perubahan</button>
      </form>
    `;
    Modal.show("employee-modal");
    document.getElementById("employee-modal-close").addEventListener("click", () => Modal.hide("employee-modal"));

    const activateBtn = el.employeeModalContent.querySelector('[data-action="activate"]');
    if (activateBtn) activateBtn.addEventListener("click", () => {
      Store.approveUser(u.id); showToast("Karyawan diaktifkan.", "success"); Modal.hide("employee-modal"); renderAll();
    });
    const deactivateBtn = el.employeeModalContent.querySelector('[data-action="deactivate"]');
    if (deactivateBtn) deactivateBtn.addEventListener("click", () => {
      askConfirm("Nonaktifkan Karyawan", `Nonaktifkan akun ${u.name}? Karyawan tidak akan bisa login.`, () => {
        Store.setUserStatus(u.id, "disabled"); showToast("Karyawan dinonaktifkan.", "warning"); Modal.hide("employee-modal"); renderAll();
      });
    });
    const resetBtn = el.employeeModalContent.querySelector('[data-action="reset-password"]');
    if (resetBtn) resetBtn.addEventListener("click", () => {
      askConfirm("Reset Password", `Reset password ${u.name} ke default (123456)?`, () => {
        Store.updateUser(u.id, { password: Store.hashPassword("123456") });
        showToast("Password direset ke 123456.", "success");
      });
    });
    const nameShortcut = document.getElementById("edit-name-shortcut");
    if (nameShortcut) nameShortcut.addEventListener("click", () => {
      const inp = document.getElementById("edit-name");
      if (!inp) return;
      inp.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => { inp.focus(); inp.select(); }, 250);
    });
    document.getElementById("edit-employee-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const newName = document.getElementById("edit-name").value.replace(/\s+/g, " ").trim();
      const nameErr = document.getElementById("edit-name-error");
      if (newName.length < 2) {
        if (nameErr) nameErr.textContent = "Nama minimal 2 karakter.";
        document.getElementById("edit-name").focus();
        return;
      }
      if (nameErr) nameErr.textContent = "";
      const nameChanged = newName !== u.name;
      Store.updateUser(u.id, {
        name: newName,
        degree: document.getElementById("edit-degree").value.trim() || null,
        position: document.getElementById("edit-position").value.trim(),
        department: document.getElementById("edit-department").value.trim(),
        shiftId: document.getElementById("edit-shift").value
      });
      showToast(nameChanged ? "Nama karyawan diperbarui menjadi " + newName + "." : "Data karyawan diperbarui.", "success");
      Modal.hide("employee-modal");
      renderAll();
    });
  }

  /* ------------------------------------------------------------------ */
  /* REKAP ABSENSI                                                       */
  /* ------------------------------------------------------------------ */
  function filterAttendanceByRange(range) {
    let list = Store.getAttendance();
    const now = new Date();
    if (range === "today") { const key = Store.localDateKey(); list = list.filter((a) => a.date === key); }
    else if (range === "week") { const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7); list = list.filter((a) => new Date(a.date) >= weekAgo); }
    else if (range === "month") { list = list.filter((a) => { const d = new Date(a.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }); }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }
  function renderAbsensi(range) {
    const list = filterAttendanceByRange(range);

    if (!list.length) { el.absensiTbody.innerHTML = `<tr><td colspan="7">${emptyStateBlock("Tidak ada data absensi pada rentang ini.")}</td></tr>`; return; }
    el.absensiTbody.innerHTML = list.map((a) => {
      const u = Store.findUserById(a.userId);
      const exceptionNote = (a.checkInViaException || a.checkOutViaException)
        ? ' <span class="text-sm text-muted" title="Absen di luar radius, disetujui admin">📍izin</span>' : "";
      const g = a.checkInGps;
      const gpsNote = g && g.status === "tolerance" ? ' <span class="text-sm text-muted" title="Diterima lewat toleransi akurasi GPS (+' + g.bonus + ' m)">📡toleransi</span>' : "";
      const flagNote = g && g.flags && g.flags.length ? ' <span class="text-sm" style="color:var(--warning-600)" title="Sinyal GPS tidak biasa: ' + escapeHtml(g.flags.join(", ")) + ' (skor kepercayaan ' + g.trust + '/100)">⚠️ tinjau</span>' : "";
      const editedNote = a.editedByAdmin ? ` <span class="text-sm text-muted" title="Dikoreksi oleh ${escapeHtml(a.editedByAdmin.by)}${a.editedByAdmin.note ? ': ' + escapeHtml(a.editedByAdmin.note) : ''}">✏️ dikoreksi</span>` : "";
      return `<tr>
        <td>${escapeHtml(u ? u.name : a.userId)}</td>
        <td>${formatDateID(a.date)}</td>
        <td class="mono">${a.checkIn || "—"}</td>
        <td class="mono">${a.checkOut || "—"}</td>
        <td class="mono">${a.checkInDistance != null ? a.checkInDistance.toFixed(1) + " m" : "—"}${exceptionNote}${gpsNote}${flagNote}</td>
        <td>${statusBadge(a.status)}${editedNote}</td>
        <td><button type="button" class="btn btn--ghost btn--sm" data-edit-attendance="${a.userId}" data-edit-date="${a.date}">Edit</button> ${AttendancePhoto.buttonsHtml(a, u ? u.name : a.userId)}</td>
      </tr>`;
    }).join("");
    AttendancePhoto.bindViewButtons(el.absensiTbody);
    el.absensiTbody.querySelectorAll("[data-edit-attendance]").forEach((btn) => {
      btn.addEventListener("click", () => openEditAttendanceModal(btn.dataset.editAttendance, btn.dataset.editDate));
    });
  }
  const ATTENDANCE_STATUS_MAP = {
    hadir: ["badge--success", "Hadir"], terlambat: ["badge--warning", "Terlambat"],
    izin: ["badge--info", "Izin"], alpa: ["badge--danger", "Alpa"],
    "tidak-hadir": ["badge--danger", "Tidak Hadir"]
  };
  function statusBadge(status) {
    const [cls, label] = ATTENDANCE_STATUS_MAP[status] || ["badge--neutral", status];
    return `<span class="badge ${cls}">${label}</span>`;
  }
  function statusLabel(status) {
    return (ATTENDANCE_STATUS_MAP[status] || [, status])[1];
  }

  /* ------------------------------------------------------------------ */
  /* EDIT / TAMBAH JAM ABSENSI (koreksi admin)                          */
  /* ------------------------------------------------------------------ */
  function populateEaUserSelect(selectedUserId) {
    const employees = Store.getUsers().filter((u) => u.role === "employee").sort((a, b) => a.name.localeCompare(b.name));
    el.eaUser.innerHTML = employees.map((u) => `<option value="${escapeHtml(u.id)}" ${u.id === selectedUserId ? "selected" : ""}>${escapeHtml(u.name)} (${escapeHtml(u.id)})</option>`).join("");
  }

  function openEditAttendanceModal(userId, dateKey) {
    populateEaUserSelect(userId || "");
    const today = Store.localDateKey();
    el.eaDate.value = dateKey || today;
    el.eaDate.max = today;
    const record = userId ? Store.getAttendance().find((a) => a.userId === userId && a.date === (dateKey || today)) : null;
    el.eaCheckin.value = record ? (record.checkIn || "") : "";
    el.eaCheckout.value = record ? (record.checkOut || "") : "";
    el.eaStatus.value = record ? (record.status || "hadir") : "hadir";
    el.eaNote.value = "";
    Modal.show("edit-attendance-modal");
  }

  function onSubmitEditAttendance(e) {
    e.preventDefault();
    const userId = el.eaUser.value;
    const dateKey = el.eaDate.value;
    const note = el.eaNote.value.trim();
    if (!userId || !dateKey) { showToast("Pilih karyawan dan tanggal terlebih dahulu.", "danger"); return; }
    if (!note) { showToast("Catatan koreksi wajib diisi.", "danger"); return; }
    Store.adminUpdateAttendance(userId, dateKey, {
      checkIn: el.eaCheckin.value || null,
      checkOut: el.eaCheckout.value || null,
      status: el.eaStatus.value
    }, admin.name, note);
    showToast("Jam absensi berhasil disimpan.", "success");
    Modal.hide("edit-attendance-modal");
    renderAbsensi(document.querySelector('[data-arange].is-active')?.dataset.arange || "today");
    renderDashboard();
  }

  const ATTENDANCE_RANGE_LABEL = { today: "Hari ini", week: "Minggu ini", month: "Bulan ini", all: "Semua" };

  async function exportAttendance(format) {
    const range = document.querySelector('[data-arange].is-active')?.dataset.arange || "today";
    const rangeLabel = ATTENDANCE_RANGE_LABEL[range] || "Semua";
    const header = ["Nama", "ID", "Tanggal", "Masuk", "Pulang", "Jarak Masuk (m)", "Status"];
    const body = filterAttendanceByRange(range).map((a) => {
      const u = Store.findUserById(a.userId);
      return [
        u ? u.name : a.userId, a.userId, formatDateID(a.date), a.checkIn || "—", a.checkOut || "—",
        a.checkInDistance != null ? a.checkInDistance.toFixed(1) : "—",
        statusLabel(a.status)
      ];
    });
    const filename = "rekap-absensi-" + range;
    await runReportExport(format, {
      csvXlsxRows: [header, ...body],
      sheetName: "Rekap Absensi",
      baseFilename: filename,
      pdf: {
        title: "Rekap Absensi — " + rangeLabel,
        subtitle: "PT. Depo PRG — pantauan kehadiran karyawan",
        meta: [["Rentang", rangeLabel], ["Total Data", String(body.length)]],
        table: { head: header, body }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* MENU EKSPOR (dropdown CSV / Excel / PDF)                            */
  /* ------------------------------------------------------------------ */
  function bindExportMenus() {
    document.querySelectorAll("[data-export-menu]").forEach((menu) => {
      const toggle = menu.querySelector("[data-export-toggle]");
      const list = menu.querySelector("[data-export-list]");
      if (!toggle || !list) return;
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = list.hidden;
        closeAllExportMenus();
        list.hidden = !willOpen;
      });
      list.addEventListener("click", (e) => e.stopPropagation());
      list.querySelectorAll("[data-export-format]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          list.hidden = true;
          const kind = toggle.dataset.exportToggle;
          const format = btn.dataset.exportFormat;
          try {
            if (kind === "attendance") await exportAttendance(format);
            else if (kind === "laporan") await exportLaporan(format);
          } catch (err) {
            showToast(err && err.message ? err.message : "Gagal membuat file ekspor.", "danger");
          }
        });
      });
    });
    document.addEventListener("click", closeAllExportMenus);
  }
  function closeAllExportMenus() {
    document.querySelectorAll("[data-export-list]").forEach((l) => { l.hidden = true; });
  }

  /** Alur bersama untuk ketiga format supaya pesan toast & lazy-load pustaka
   *  konsisten di semua menu ekspor (Rekap Absensi maupun Laporan). */
  async function runReportExport(format, cfg) {
    if (format === "csv") {
      ReportExport.toCsv(cfg.csvXlsxRows, cfg.baseFilename + ".csv");
      showToast("File CSV berhasil diunduh.", "success");
      return;
    }
    if (format === "xlsx") {
      showToast("Menyiapkan file Excel…", "info");
      await ReportExport.toExcel(cfg.baseFilename + ".xlsx", [{ name: cfg.sheetName, rows: cfg.csvXlsxRows }]);
      showToast("File Excel berhasil diunduh.", "success");
      return;
    }
    if (format === "pdf") {
      showToast("Menyiapkan file PDF…", "info");
      await ReportExport.toPdf(Object.assign({ filename: cfg.baseFilename + ".pdf" }, cfg.pdf));
      showToast("File PDF berhasil diunduh.", "success");
    }
  }

  /* ------------------------------------------------------------------ */
  /* SHIFT KERJA                                                         */
  /* ------------------------------------------------------------------ */
  const SHIFT_COLOR_VARS = { brand: "var(--brand-600)", success: "var(--success-600)", warning: "var(--warning-solid)", info: "var(--info-600)", danger: "var(--danger-600)" };
  let editingShiftId = null;

  function renderShift() {
    const shifts = Store.getShifts();
    el.shiftGrid.innerHTML = shifts.length ? shifts.map((s) => {
      const count = Store.usersCountByShift(s.id);
      const accent = SHIFT_COLOR_VARS[s.color] || SHIFT_COLOR_VARS.brand;
      return `
      <div class="card shift-card" style="--accent-color:${accent}">
        <div class="stat-card__top">
          <div>
            <h3 style="font-family:var(--font-display);font-size:1.02rem;margin-bottom:.15em">${escapeHtml(s.name)}</h3>
            <p class="fine-print" style="margin:0">${shiftDaysLabel(s.days)} · ${count} karyawan</p>
          </div>
          <div class="stat-card__icon"><span class="inline-icon" data-icon="clock" data-icon-size="18"></span></div>
        </div>
        <p style="font-family:var(--font-mono);font-size:1.3rem;font-weight:700;letter-spacing:-.01em;margin:.3em 0">${s.start} – ${s.end}</p>
        ${s.note ? `<p class="fine-print" style="margin-bottom:.8em">${escapeHtml(s.note)}</p>` : ""}
        <div class="chip-group">
          <button type="button" class="btn btn--ghost btn--sm" data-shift-edit="${s.id}">Edit</button>
        </div>
      </div>`;
    }).join("") : emptyStateBlock("Belum ada shift. Tambahkan shift pertama Anda.");
    hydrateIcons(el.shiftGrid);
    el.shiftGrid.querySelectorAll("[data-shift-edit]").forEach((b) => b.addEventListener("click", () => openShiftModal(b.dataset.shiftEdit)));

    const employees = Store.getUsers().filter((u) => u.role === "employee").sort((a, b) => a.name.localeCompare(b.name));
    el.shiftUsersTbody.innerHTML = employees.length ? employees.map((u) => {
      const shift = u.shiftId ? Store.findShiftById(u.shiftId) : null;
      return `<tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.department)}</td>
        <td>${shift ? escapeHtml(shift.name) + ` <span class="fine-print">(${shift.start}–${shift.end})</span>` : '<span class="fine-print">Belum diatur</span>'}</td>
        <td><select data-assign-shift="${escapeHtml(u.id)}" class="mono" style="padding:.4em .6em;font-size:.8rem">${shiftOptionsHtml(u.shiftId)}</select></td>
      </tr>`;
    }).join("") : `<tr><td colspan="4">${emptyStateBlock("Belum ada karyawan.")}</td></tr>`;
    el.shiftUsersTbody.querySelectorAll("[data-assign-shift]").forEach((sel) => {
      sel.addEventListener("change", () => {
        Store.assignUserShift(sel.dataset.assignShift, sel.value);
        showToast("Shift karyawan diperbarui.", "success");
        renderShift();
      });
    });
  }

  function openShiftModal(shiftId) {
    editingShiftId = shiftId || null;
    const shift = shiftId ? Store.findShiftById(shiftId) : null;
    document.getElementById("shift-modal-title").textContent = shift ? "Edit Shift" : "Tambah Shift";
    el.shiftId.value = shift ? shift.id : "";
    el.shiftName.value = shift ? shift.name : "";
    el.shiftStart.value = shift ? shift.start : "08:00";
    el.shiftEnd.value = shift ? shift.end : "17:00";
    el.shiftNote.value = shift ? (shift.note || "") : "";
    const activeDays = shift ? shift.days : [1, 2, 3, 4, 5];
    el.shiftDaysPicker.querySelectorAll("[data-day]").forEach((chip) => {
      chip.classList.toggle("is-active", activeDays.includes(Number(chip.dataset.day)));
    });
    document.getElementById("shift-delete-btn").style.display = shift ? "" : "none";
    Modal.show("shift-modal");
  }

  function onSubmitShift(e) {
    e.preventDefault();
    const name = el.shiftName.value.trim();
    const start = el.shiftStart.value;
    const end = el.shiftEnd.value;
    const days = Array.from(el.shiftDaysPicker.querySelectorAll("[data-day].is-active")).map((c) => Number(c.dataset.day));
    if (!name || !start || !end) { showToast("Lengkapi nama shift, jam masuk, dan jam pulang.", "danger"); return; }
    if (!days.length) { showToast("Pilih minimal satu hari kerja.", "danger"); return; }
    const data = { name, start, end, days, note: el.shiftNote.value.trim() };
    if (editingShiftId) {
      Store.updateShift(editingShiftId, data);
      showToast("Shift diperbarui.", "success");
    } else {
      Store.addShift(data);
      showToast("Shift baru ditambahkan.", "success");
    }
    Modal.hide("shift-modal");
    renderShift();
  }

  function onDeleteShift() {
    if (!editingShiftId) return;
    const shifts = Store.getShifts();
    const fallback = shifts.find((s) => s.id !== editingShiftId);
    const count = Store.usersCountByShift(editingShiftId);
    askConfirm("Hapus Shift", `Hapus shift ini? ${count > 0 ? `${count} karyawan akan dipindahkan ke shift lain secara otomatis.` : "Tidak ada karyawan yang memakai shift ini."}`, () => {
      Store.deleteShift(editingShiftId, fallback ? fallback.id : null);
      showToast("Shift dihapus.", "success");
      Modal.hide("shift-modal");
      renderShift();
    });
  }

  /* ------------------------------------------------------------------ */
  /* MONITORING LOKASI (karyawan yang sedang bekerja hari ini)           */
  /* ------------------------------------------------------------------ */

  function renderMonitoring() {
    const todayKey = Store.localDateKey();
    const workingToday = Store.getAttendance().filter((a) => a.date === todayKey && a.checkIn);
    if (!workingToday.length) {
      el.monitoringTbody.innerHTML = `<tr><td colspan="7">${emptyStateBlock("Belum ada karyawan yang absen masuk hari ini.")}</td></tr>`;
      return;
    }
    el.monitoringTbody.innerHTML = workingToday.map((a) => {
      const u = Store.findUserById(a.userId);
      const presence = Store.getPresenceFor(a.userId);
      const activeEvent = Store.activeZoneEventFor(a.userId);
      const { label, cls } = monitoringStatus(a, activeEvent, presence);
      return `<tr>
        <td>${escapeHtml(u ? u.name : a.userId)}</td>
        <td class="mono">${escapeHtml(a.userId)}</td>
        <td class="mono">${a.checkIn}</td>
        <td class="mono">${presence ? presence.distance.toFixed(1) + " m" : "—"}</td>
        <td class="mono">${presence ? "±" + Math.round(presence.accuracy) + " m" : "—"}</td>
        <td><span class="badge ${cls}">${label}</span></td>
        <td class="text-sm text-muted">${presence ? timeAgoID(presence.updatedAt) : "Menunggu data lokasi…"}</td>
      </tr>`;
    }).join("");
  }
  function monitoringStatus(attendanceRecord, activeEvent, presence) {
    if (attendanceRecord.checkOut) return { label: "SUDAH PULANG", cls: "badge--neutral" };
    if (activeEvent) return { label: `PERINGATAN ${CONFIG.OUTSIDE_AREA_MINUTES} MENIT`, cls: "badge--danger" };
    if (!presence) return { label: "GPS TIDAK TERSEDIA", cls: "badge--neutral" };
    // Bug fix: status "DALAM AREA"/"LUAR AREA" di tabel monitoring HARUS
    // memakai CONFIG.OUTSIDE_AREA_RADIUS (radius area kerja, mis. 15m),
    // BUKAN CONFIG.ATTENDANCE_RADIUS (radius absen, mis. 5m). Kalau tetap
    // memakai radius absen yang jauh lebih sempit, hampir semua karyawan
    // akan tampak "LUAR AREA" terus-menerus begitu mereka beranjak sedikit
    // dari titik absen, padahal masih wajar berada di area kerja.
    return presence.distance <= CONFIG.OUTSIDE_AREA_RADIUS
      ? { label: "DALAM AREA", cls: "badge--success" }
      : { label: "LUAR AREA", cls: "badge--warning" };
  }

  /* ------------------------------------------------------------------ */
  /* RIWAYAT LOKASI (kejadian keluar area)                               */
  /* ------------------------------------------------------------------ */
  let riwayatLokasiRange = "today";
  function renderRiwayatLokasi(range) {
    if (range) riwayatLokasiRange = range;
    if (el.riwayatLokasiSubtitle) {
      el.riwayatLokasiSubtitle.textContent = `Riwayat kejadian keluar area kerja (> ${CONFIG.OUTSIDE_AREA_RADIUS} meter selama ${CONFIG.OUTSIDE_AREA_MINUTES} menit).`;
    }
    const now = new Date();
    let list = Store.getZoneEvents();
    const q = (el.riwayatLokasiSearch.value || "").toLowerCase();

    if (riwayatLokasiRange === "today") {
      const key = Store.localDateKey();
      list = list.filter((z) => Store.localDateKey(new Date(z.reachedAt)) === key);
    } else if (riwayatLokasiRange === "yesterday") {
      const y = new Date(now); y.setDate(now.getDate() - 1);
      const key = Store.localDateKey(y);
      list = list.filter((z) => Store.localDateKey(new Date(z.reachedAt)) === key);
    } else if (riwayatLokasiRange === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      list = list.filter((z) => z.reachedAt >= weekAgo.getTime());
    }
    if (q) list = list.filter((z) => { const u = Store.findUserById(z.userId); return ((u ? u.name : "") + z.userId).toLowerCase().includes(q); });

    if (!list.length) { el.riwayatLokasiTbody.innerHTML = `<tr><td colspan="8">${emptyStateBlock("Tidak ada riwayat keluar area pada rentang ini.")}</td></tr>`; return; }
    el.riwayatLokasiTbody.innerHTML = list.map((z) => {
      const u = Store.findUserById(z.userId);
      const durasi = (z.returnedAt || Date.now()) - z.outsideSince;
      return `<tr>
        <td>${escapeHtml(u ? u.name : z.userId)}</td>
        <td class="mono">${escapeHtml(z.userId)}</td>
        <td class="mono">${new Date(z.outsideSince).toLocaleString("id-ID")}</td>
        <td class="mono">${Store.formatDuration(durasi)}</td>
        <td class="mono">${z.lastDistance != null ? z.lastDistance.toFixed(1) + " m" : "—"}</td>
        <td class="mono">${z.returnedAt ? new Date(z.returnedAt).toLocaleString("id-ID") : "—"}</td>
        <td>${z.status === "active" ? '<span class="badge badge--danger">Aktif</span>' : '<span class="badge badge--success">Selesai</span>'}</td>
        <td class="text-sm">${z.reason ? escapeHtml(z.reason) : '<span class="text-muted">Belum diisi</span>'}</td>
      </tr>`;
    }).join("");
  }

  /* ------------------------------------------------------------------ */
  /* IZIN ABSEN DI LUAR LOKASI (approval)                                */
  /* ------------------------------------------------------------------ */
  // Karyawan hanya bisa absen masuk/pulang di dalam CONFIG.ATTENDANCE_RADIUS
  // (lihat employee.js). Kalau mereka di luar radius, satu-satunya jalan
  // adalah mengajukan izin di sini — admin menyetujui/menolak per
  // permintaan (berlaku untuk satu jenis absen, satu hari saja).
  function renderIzinLokasi() {
    const list = Store.getOutsideRequests().sort((a, b) => b.createdAt - a.createdAt);

    const pendingCount = list.filter((r) => r.status === "pending").length;
    if (el.sidebarOutsideBadge) {
      el.sidebarOutsideBadge.hidden = pendingCount === 0;
      el.sidebarOutsideBadge.textContent = pendingCount;
    }

    if (!list.length) { el.izinLokasiTbody.innerHTML = `<tr><td colspan="7">${emptyStateBlock("Belum ada permintaan izin lokasi.")}</td></tr>`; return; }
    el.izinLokasiTbody.innerHTML = list.map((r) => {
      const u = Store.findUserById(r.userId);
      const typeLabel = r.type === "check-in" ? "Absen Masuk" : "Absen Pulang";
      let statusCell = leaveStatusPill(r.status);
      if (r.status === "approved") {
        statusCell += r.usedAt
          ? ' <span class="text-sm text-muted">· sudah dipakai</span>'
          : ' <span class="text-sm text-muted">· belum dipakai</span>';
      }
      return `<tr>
        <td>${escapeHtml(u ? u.name : r.userId)}</td>
        <td>${typeLabel}</td>
        <td>${formatDateID(r.date)}</td>
        <td class="mono">${r.distance.toFixed(1)} m</td>
        <td>${escapeHtml(r.reason)}</td>
        <td>${statusCell}</td>
        <td>${r.status === "pending" ? `
          <div style="display:flex;gap:.4em;flex-wrap:wrap">
            <button class="btn btn--primary btn--sm" data-out-approve="${r.id}">Setujui</button>
            <button class="btn btn--danger-ghost btn--sm" data-out-reject="${r.id}">Tolak</button>
          </div>` : (r.note ? `<span class="text-sm text-muted">${escapeHtml(r.note)}</span>` : "—")}</td>
      </tr>`;
    }).join("");
    el.izinLokasiTbody.querySelectorAll("[data-out-approve]").forEach((b) => b.addEventListener("click", () => {
      if (b.disabled) return; b.disabled = true;
      Store.decideOutsideRequest(b.dataset.outApprove, "approved", "");
      showToast("Izin lokasi disetujui.", "success");
      renderAll();
    }));
    el.izinLokasiTbody.querySelectorAll("[data-out-reject]").forEach((b) => b.addEventListener("click", () => {
      rejectContext = { kind: "outside", id: b.dataset.outReject };
      el.rejectModalTitle.textContent = "Tolak Izin Lokasi";
      el.rejectReason.value = "";
      Modal.show("reject-modal");
    }));
  }

  /* ------------------------------------------------------------------ */
  /* PENGATURAN KANTOR                                                   */
  /* ------------------------------------------------------------------ */
  function renderPengaturan() {
    if (el.backupSchemaNote) el.backupSchemaNote.textContent = "Versi schema data: " + Store.SCHEMA_VERSION + " · penyimpanan: " + Store.ADAPTER_NAME + ".";
    el.settingLat.textContent = CONFIG.OFFICE_LOCATION.latitude.toFixed(7);
    el.settingLon.textContent = CONFIG.OFFICE_LOCATION.longitude.toFixed(7);
    el.settingRadius.textContent = CONFIG.ATTENDANCE_RADIUS + " meter";
    el.settingOutsideRadius.textContent = CONFIG.OUTSIDE_AREA_RADIUS + " meter";
    el.settingAccuracy.textContent = CONFIG.MAX_ACCEPTABLE_ACCURACY + " meter";
    if (el.calibBanner) el.calibBanner.hidden = !!CONFIG.OFFICE_CALIBRATED;
    el.settingTolerance.textContent = "+" + CONFIG.GPS_TOLERANCE_MAX + " m (½ × akurasi) → jarak terjauh diterima " + (CONFIG.ATTENDANCE_RADIUS + CONFIG.GPS_TOLERANCE_MAX) + " m";
    el.settingCalibration.innerHTML = CONFIG.OFFICE_CALIBRATED
      ? '<span class="badge badge--success">Terkalibrasi</span>'
      : '<span class="badge badge--warning">Belum terkalibrasi — gunakan Ubah Lokasi Kantor</span>';
    el.settingOutside.textContent = CONFIG.OUTSIDE_AREA_MINUTES + " menit";
    el.settingLate.textContent = CONFIG.LATE_AFTER;
    const saved = Store.getOfficeSettings();
    el.settingUpdatedNote.style.display = "";
    if (saved && saved.updatedAt) {
      const d = new Date(saved.updatedAt);
      const timeStr = d.toTimeString().slice(0, 5);
      el.settingUpdatedNote.textContent = `Terakhir diubah oleh ${saved.updatedBy || "Admin"} pada ${formatDateID(Store.localDateKey(d))} pukul ${timeStr}.`;
    } else {
      el.settingUpdatedNote.textContent = "Masih memakai koordinat bawaan dari config.js (belum pernah diubah lewat menu ini).";
    }
  }

  /* ------------------------------------------------------------------ */
  /* UBAH LOKASI KANTOR                                                  */
  /* ------------------------------------------------------------------ */
  function openOfficeLocationModal() {
    el.officeLat.value = CONFIG.OFFICE_LOCATION.latitude.toFixed(7);
    el.officeLon.value = CONFIG.OFFICE_LOCATION.longitude.toFixed(7);
    el.officeRadius.value = CONFIG.ATTENDANCE_RADIUS;
    el.officeOutsideRadius.value = CONFIG.OUTSIDE_AREA_RADIUS;
    el.officeGpsTolerance.value = CONFIG.GPS_TOLERANCE_MAX;
    el.officePaste.value = ""; el.officePasteStatus.textContent = "";
    const saved = Store.getOfficeSettings();
    el.officeMapsUrl.value = (saved && saved.mapsUrl) ? saved.mapsUrl : "";
    el.officeGeoStatus.textContent = "";
    el.officeLocationError.style.display = "none";
    el.officeLocationError.textContent = "";
    Modal.show("office-location-modal");
  }

  /** Baca koordinat dari link/teks Google Maps (lihat parseMapsInput di geo.js). */
  function onParseMapsPaste() {
    const raw = el.officePaste.value;
    const r = parseMapsInput(raw);
    if (r.error) { el.officePasteStatus.style.color = "var(--danger-600)"; el.officePasteStatus.textContent = "❌ " + r.error; return; }
    el.officeLat.value = r.lat.toFixed(7);
    el.officeLon.value = r.lon.toFixed(7);
    if (/^https?:\/\//i.test(raw.trim())) el.officeMapsUrl.value = raw.trim();
    const old = haversineDistance(CONFIG.OFFICE_LOCATION.latitude, CONFIG.OFFICE_LOCATION.longitude, r.lat, r.lon);
    const src = { pin: "pin tempat (presisi tinggi)", view: "pusat tampilan peta (pastikan pin tepat di titik absen)", param: "parameter link", text: "koordinat teks" }[r.source];
    el.officePasteStatus.style.color = "var(--success-600)";
    el.officePasteStatus.textContent = `✅ Terbaca dari ${src}: ${r.lat.toFixed(6)}, ${r.lon.toFixed(6)}. Bergeser ${old.toFixed(0)} m dari titik sebelumnya. Cek lagi lalu simpan.`;
  }

  /** Kalibrasi: berdiri di titik absen → kunci GPS ±20 detik, rata-rata berbobot. */
  let calibrating = null;
  function onUseMyLocation() {
    if (typeof getCurrentPositionOnce !== "function") {
      el.officeGeoStatus.textContent = "Fitur lokasi tidak tersedia di perangkat ini.";
      return;
    }
    if (calibrating) { calibrating.cancel(); return; }
    const btn = el.officeUseMyLocationBtn, label = btn.textContent;
    btn.textContent = "⏹ Batalkan kalibrasi";
    el.officeGeoStatus.textContent = "📡 Mengunci GPS… diamkan HP di titik absen.";
    calibrating = getCurrentPositionOnce({
      maxWaitMs: 20000, targetAccuracy: 6, minSamples: 8,
      onProgress: (p) => { el.officeGeoStatus.textContent = `📡 Mengunci GPS… ±${Math.round(p.accuracy)} m · ${p.samples} pembacaan · ${Math.round(p.elapsed / 1000)}/${Math.round(p.maxWait / 1000)} dtk`; }
    });
    calibrating.then((res) => {
      const f = res.fix;
      el.officeLat.value = f.lat.toFixed(7);
      el.officeLon.value = f.lon.toFixed(7);
      const acc = Math.round(f.accuracy);
      const good = f.accuracy <= 15;
      el.officeGeoStatus.style.color = good ? "var(--success-600)" : "var(--warning-600)";
      el.officeGeoStatus.textContent = good
        ? `✅ Terkunci: akurasi ±${acc} m dari ${f.used} pembacaan. Simpan jika Anda berdiri tepat di titik absen.`
        : `⚠️ Akurasi hanya ±${acc} m. Untuk hasil terbaik, ulangi di area terbuka dengan GPS "akurasi tinggi" — atau tempel koordinat dari Google Maps.`;
    }).catch((err) => {
      el.officeGeoStatus.style.color = "var(--danger-600)";
      el.officeGeoStatus.textContent = "❌ " + (err && err.message ? err.message : "Gagal mengambil lokasi.");
    }).finally(() => { calibrating = null; btn.textContent = label; });
  }

  function onSubmitOfficeLocation(e) {
    e.preventDefault();
    const result = Store.saveOfficeSettings({
      latitude: el.officeLat.value,
      longitude: el.officeLon.value,
      attendanceRadius: el.officeRadius.value,
      outsideAreaRadius: el.officeOutsideRadius.value,
      gpsToleranceMax: el.officeGpsTolerance.value,
      mapsUrl: el.officeMapsUrl.value
    }, admin.name);
    if (!result.ok) {
      el.officeLocationError.textContent = result.error;
      el.officeLocationError.style.display = "";
      return;
    }
    el.officeLocationError.style.display = "none";
    showToast("Lokasi kantor berhasil diperbarui. Semua karyawan aktif telah diberi tahu.", "success");
    Modal.hide("office-location-modal");
    renderPengaturan();
  }

  function onResetOfficeLocation() {
    askConfirm("Kembalikan ke Default", "Kembalikan koordinat & radius kantor ke pengaturan bawaan (config.js)? Perubahan kustom akan dihapus.", () => {
      const result = Store.resetOfficeSettings(admin.name);
      if (!result.ok) { showToast(result.error, "danger"); return; }
      showToast("Lokasi kantor dikembalikan ke pengaturan bawaan.", "success");
      Modal.hide("office-location-modal");
      renderPengaturan();
    });
  }

  /* ------------------------------------------------------------------ */
  /* PENGAJUAN CUTI (approval)                                           */
  /* ------------------------------------------------------------------ */
  function renderCuti() {
    const list = Store.getLeave().sort((a, b) => b.createdAt - a.createdAt);
    if (!list.length) { el.cutiTbody.innerHTML = `<tr><td colspan="7">${emptyStateBlock("Belum ada pengajuan cuti.")}</td></tr>`; return; }
    el.cutiTbody.innerHTML = list.map((l) => {
      const u = Store.findUserById(l.userId);
      return `<tr>
        <td>${escapeHtml(u ? u.name : l.userId)}</td>
        <td>${escapeHtml(l.type)}</td>
        <td>${formatDateRangeID(l.startDate, l.endDate)}</td>
        <td>${l.days}</td>
        <td>${escapeHtml(l.reason)}</td>
        <td>${leaveStatusPill(l.status)}</td>
        <td>${l.status === "pending" ? `
          <div style="display:flex;gap:.4em;flex-wrap:wrap">
            <button class="btn btn--primary btn--sm" data-lv-approve="${l.id}">Setujui</button>
            <button class="btn btn--danger-ghost btn--sm" data-lv-reject="${l.id}">Tolak</button>
          </div>` : (l.note ? `<span class="text-sm text-muted">${escapeHtml(l.note)}</span>` : "—")}</td>
      </tr>`;
    }).join("");
    el.cutiTbody.querySelectorAll("[data-lv-approve]").forEach((b) => b.addEventListener("click", () => {
      if (b.disabled) return; b.disabled = true;
      Store.decideLeave(b.dataset.lvApprove, "approved", ""); showToast("Cuti disetujui.", "success"); renderAll();
    }));
    el.cutiTbody.querySelectorAll("[data-lv-reject]").forEach((b) => b.addEventListener("click", () => {
      rejectContext = { kind: "leave", id: b.dataset.lvReject };
      el.rejectModalTitle.textContent = "Tolak Pengajuan Cuti";
      el.rejectReason.value = "";
      Modal.show("reject-modal");
    }));
  }
  function leaveStatusPill(status) {
    if (status === "pending") return '<span class="pill pill--warning">Menunggu</span>';
    if (status === "approved") return '<span class="pill pill--success">Disetujui</span>';
    return '<span class="pill pill--danger">Ditolak</span>';
  }

  /* ------------------------------------------------------------------ */
  /* PENGAJUAN LEMBUR (approval)                                         */
  /* ------------------------------------------------------------------ */
  function renderLembur() {
    const list = Store.getOvertime().sort((a, b) => b.createdAt - a.createdAt);
    if (!list.length) { el.lemburTbody.innerHTML = `<tr><td colspan="7">${emptyStateBlock("Belum ada pengajuan lembur.")}</td></tr>`; return; }
    el.lemburTbody.innerHTML = list.map((o) => {
      const u = Store.findUserById(o.userId);
      return `<tr>
        <td>${escapeHtml(u ? u.name : o.userId)}</td>
        <td>${formatDateID(o.date)}</td>
        <td class="mono">${o.startTime}–${o.endTime}</td>
        <td>${o.duration} jam</td>
        <td>${escapeHtml(o.reason)}</td>
        <td>${leaveStatusPill(o.status)}</td>
        <td>${o.status === "pending" ? `
          <div style="display:flex;gap:.4em;flex-wrap:wrap">
            <button class="btn btn--primary btn--sm" data-ot-approve="${o.id}">Setujui</button>
            <button class="btn btn--danger-ghost btn--sm" data-ot-reject="${o.id}">Tolak</button>
          </div>` : (o.note ? `<span class="text-sm text-muted">${escapeHtml(o.note)}</span>` : "—")}</td>
      </tr>`;
    }).join("");
    el.lemburTbody.querySelectorAll("[data-ot-approve]").forEach((b) => b.addEventListener("click", () => {
      if (b.disabled) return; b.disabled = true;
      Store.decideOvertime(b.dataset.otApprove, "approved", ""); showToast("Lembur disetujui.", "success"); renderAll();
    }));
    el.lemburTbody.querySelectorAll("[data-ot-reject]").forEach((b) => b.addEventListener("click", () => {
      rejectContext = { kind: "overtime", id: b.dataset.otReject };
      el.rejectModalTitle.textContent = "Tolak Pengajuan Lembur";
      el.rejectReason.value = "";
      Modal.show("reject-modal");
    }));
  }

  /* ------------------------------------------------------------------ */
  /* LAPORAN                                                             */
  /* ------------------------------------------------------------------ */
  function renderLaporan() {
    const users = Store.getUsers().filter((u) => u.role === "employee" && u.status === "active");
    const att = Store.getAttendance();
    const leave = Store.getLeave();
    const overtime = Store.getOvertime();

    const totalHadir = att.filter((a) => a.status === "hadir").length;
    const totalTerlambat = att.filter((a) => a.status === "terlambat").length;
    const totalCutiApproved = leave.filter((l) => l.status === "approved").length;
    const totalLemburApproved = overtime.filter((o) => o.status === "approved").length;

    el.laporanSummary.innerHTML = [
      ["TOTAL HADIR", totalHadir, "success"], ["TOTAL TERLAMBAT", totalTerlambat, "warning"],
      ["CUTI DISETUJUI", totalCutiApproved, "info"], ["LEMBUR DISETUJUI", totalLemburApproved, "info"]
    ].map(([label, value, color]) => `
      <div class="stat-card">
        <div class="stat-card__value">${value}</div>
        <div class="stat-card__label">${label}</div>
      </div>`).join("");

    el.laporanTbody.innerHTML = users.length ? users.map((u) => {
      const uAtt = att.filter((a) => a.userId === u.id);
      const uHadir = uAtt.filter((a) => a.status === "hadir").length;
      const uTerlambat = uAtt.filter((a) => a.status === "terlambat").length;
      const uCuti = leave.filter((l) => l.userId === u.id && l.status === "approved").length;
      const uLembur = overtime.filter((o) => o.userId === u.id && o.status === "approved").length;
      return `<tr>
        <td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.department)}</td>
        <td>${uHadir}</td><td>${uTerlambat}</td><td>${uCuti}</td><td>${uLembur}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="6">${emptyStateBlock("Belum ada data karyawan aktif.")}</td></tr>`;
  }

  async function exportLaporan(format) {
    const users = Store.getUsers().filter((u) => u.role === "employee" && u.status === "active");
    const att = Store.getAttendance();
    const leave = Store.getLeave();
    const overtime = Store.getOvertime();
    const header = ["Nama", "Departemen", "Hadir", "Terlambat", "Cuti Disetujui", "Lembur Disetujui"];
    const body = users.map((u) => {
      const uAtt = att.filter((a) => a.userId === u.id);
      return [
        u.name, u.department,
        uAtt.filter((a) => a.status === "hadir").length,
        uAtt.filter((a) => a.status === "terlambat").length,
        leave.filter((l) => l.userId === u.id && l.status === "approved").length,
        overtime.filter((o) => o.userId === u.id && o.status === "approved").length
      ];
    });
    await runReportExport(format, {
      csvXlsxRows: [header, ...body],
      sheetName: "Laporan",
      baseFilename: "laporan-" + Store.currentPeriod().replace(" ", "-").toLowerCase(),
      pdf: {
        title: "Laporan Ringkasan Karyawan",
        subtitle: "PT. Depo PRG — periode " + Store.currentPeriod(),
        meta: [["Total Karyawan Aktif", String(users.length)]],
        table: { head: header, body }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* NOTIFIKASI                                                          */
  /* ------------------------------------------------------------------ */
  function renderNotifications() {
    const list = Store.notificationsFor("admin");
    el.notifList.innerHTML = list.length ? list.map((n) => `
      <li>
        <div class="history-list__dot" style="background:${n.read ? "var(--text-400)" : "var(--brand-600)"}"></div>
        <div class="history-list__body">
          <div class="history-list__time">${escapeHtml(n.title)}</div>
          <div class="history-list__meta">${escapeHtml(n.message)}</div>
        </div>
        <span class="text-sm text-muted">${timeAgoID(n.createdAt)}</span>
      </li>`).join("") : emptyStateHtml("Belum ada notifikasi.");
  }
  function updateNotifBadge() {
    const count = Store.unreadCount("admin");
    el.notifDot.hidden = count === 0;
    el.notifDot.textContent = count;
  }

  /* ------------------------------------------------------------------ */
  /* HELPERS                                                             */
  /* ------------------------------------------------------------------ */
  function emptyStateHtml(msg) { return `<li class="history-empty" style="display:block;width:100%">${escapeHtml(msg)}</li>`; }
  function emptyStateBlock(msg) { return `<div class="empty-state">${escapeHtml(msg)}</div>`; }
})();
