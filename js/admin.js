/* ==========================================================================
   RAKABU ATTENDANCE — ADMIN DASHBOARD LOGIC
   ========================================================================== */
(function () {
  "use strict";

  const admin = Store.currentUser();
  if (!admin || admin.role !== "admin") {
    window.location.replace("index.html");
    return;
  }

  const el = {};
  let confirmCallback = null;
  let rejectContext = null; // { kind: 'user'|'leave'|'overtime', id }

  document.addEventListener("DOMContentLoaded", () => {
    cacheDom();
    bindNav();
    bindGlobalEvents();
    el.avatarBtn.textContent = initials(admin.name);
    initClock();
    renderAll();
  });

  function cacheDom() {
    [
      "stat-cards","attendance-donut","attendance-legend","weekly-bar-chart","recent-activity-list",
      "pendaftaran-tbody","pendaftaran-empty","karyawan-search","karyawan-tbody",
      "absensi-tbody","export-attendance-btn",
      "cuti-tbody","lembur-tbody",
      "gaji-tbody","gaji-period-label","export-gaji-btn",
      "laporan-summary","laporan-tbody",
      "notif-list","mark-all-read-btn","notif-dot",
      "more-btn","more-modal","more-close-btn","more-logout-btn","sidebar-logout","sidebar-pending-badge",
      "employee-modal","employee-modal-content",
      "reject-modal","reject-modal-title","reject-modal-close","reject-form","reject-reason",
      "confirm-modal","confirm-title","confirm-message","confirm-cancel-btn","confirm-ok-btn",
      "avatar-btn"
    ].forEach((id) => { el[toCamel(id)] = document.getElementById(id); });
  }
  function toCamel(id) { return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

  function renderAll() {
    renderDashboard();
    renderPendaftaran();
    renderKaryawan();
    renderAbsensi("today");
    renderCuti();
    renderLembur();
    renderGaji();
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
    el.moreBtn.addEventListener("click", () => { el.moreModal.hidden = false; });
    el.moreCloseBtn.addEventListener("click", closeMore);
    el.moreModal.addEventListener("click", (e) => { if (e.target === el.moreModal) closeMore(); });
    function closeMore() { el.moreModal.hidden = true; }
    window.addEventListener("hashchange", () => route(location.hash.replace("#", "")));
  }
  function route(page) {
    const valid = ["dashboard","pendaftaran","karyawan","absensi","cuti","lembur","gaji","laporan","notifikasi"];
    if (!valid.includes(page)) page = "dashboard";
    document.querySelectorAll("[data-page]").forEach((sec) => { sec.hidden = sec.dataset.page !== page; });
    document.querySelectorAll("[data-nav]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.nav === page));
    if (page === "notifikasi") { Store.markAllRead("admin"); renderNotifications(); updateNotifBadge(); }
    location.hash = page;
  }

  function bindGlobalEvents() {
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
    el.exportAttendanceBtn.addEventListener("click", exportAttendanceCsv);
    el.exportGajiBtn.addEventListener("click", exportGajiCsv);

    el.rejectModalClose.addEventListener("click", () => el.rejectModal.hidden = true);
    el.rejectForm.addEventListener("submit", onSubmitReject);
    el.confirmCancelBtn.addEventListener("click", () => el.confirmModal.hidden = true);
    el.confirmOkBtn.addEventListener("click", () => {
      if (confirmCallback) confirmCallback();
      el.confirmModal.hidden = true;
    });
    [el.employeeModal, el.rejectModal, el.confirmModal].forEach((overlay) => {
      overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.hidden = true; });
    });
  }

  function doLogout() { Store.logout(); window.location.replace("index.html"); }
  function askConfirm(title, message, onConfirm) {
    el.confirmTitle.textContent = title;
    el.confirmMessage.textContent = message;
    confirmCallback = onConfirm;
    el.confirmModal.hidden = false;
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
  function renderDashboard() {
    const users = Store.getUsers().filter((u) => u.role === "employee");
    const active = users.filter((u) => u.status === "active");
    const todayKey = Store.localDateKey();
    const todayAtt = Store.getAttendance().filter((a) => a.date === todayKey);
    const hadir = todayAtt.filter((a) => a.status === "hadir").length;
    const terlambat = todayAtt.filter((a) => a.status === "terlambat").length;
    const sudahAbsenIds = new Set(todayAtt.map((a) => a.userId));
    const belumAbsen = active.filter((u) => !sudahAbsenIds.has(u.id)).length;
    const cutiHariIni = Store.getLeave().filter((l) => l.status === "approved" && todayKey >= l.startDate && todayKey <= l.endDate).length;
    const lemburBulanIni = Store.getOvertime().filter((o) => o.status === "approved" && o.date.slice(0, 7) === todayKey.slice(0, 7)).length;

    const cards = [
      { label: "TOTAL KARYAWAN", value: active.length, icon: "users", color: "info" },
      { label: "HADIR HARI INI", value: hadir + terlambat, icon: "checkCircle", color: "success" },
      { label: "TERLAMBAT", value: terlambat, icon: "clock", color: "warning" },
      { label: "BELUM ABSEN", value: belumAbsen, icon: "user", color: "neutral" },
      { label: "CUTI HARI INI", value: cutiHariIni, icon: "umbrella", color: "info" },
      { label: "PENDAFTARAN PENDING", value: Store.getUsers().filter((u) => u.status === "pending").length, icon: "plusCircle", color: "warning" },
      { label: "LEMBUR BULAN INI", value: lemburBulanIni, icon: "chart", color: "info" },
      { label: "TIDAK HADIR", value: Math.max(0, active.length - hadir - terlambat - cutiHariIni - belumAbsen), icon: "slash", color: "danger" }
    ];
    el.statCards.innerHTML = cards.map((c) => `
      <div class="stat-card stat-card--${c.color}">
        <div class="stat-card__top">
          <div class="stat-card__icon" style="background:var(--${c.color === 'neutral' ? 'surface-sunken' : c.color + '-100'});color:var(--${c.color === 'neutral' ? 'text-500' : c.color + '-600'})">${iconSvg(c.icon, 19)}</div>
        </div>
        <div class="stat-card__value">${c.value}</div>
        <div class="stat-card__label">${c.label}</div>
      </div>`).join("");

    const pendingCount = Store.getUsers().filter((u) => u.status === "pending").length;
    el.sidebarPendingBadge.hidden = pendingCount === 0;
    el.sidebarPendingBadge.textContent = pendingCount;

    renderAttendanceDonut(hadir, terlambat, belumAbsen, Math.max(0, active.length - hadir - terlambat - belumAbsen));
    renderWeeklyBarChart();
    renderRecentActivity();
  }

  function renderAttendanceDonut(hadir, terlambat, belumAbsen, lainnya) {
    const total = hadir + terlambat + belumAbsen + lainnya || 1;
    const segments = [
      { value: hadir, color: "#16A34A", label: "Hadir" },
      { value: terlambat, color: "#D97706", label: "Terlambat" },
      { value: belumAbsen, color: "#9298B8", label: "Belum Absen" },
      { value: lainnya, color: "#4F46E5", label: "Cuti/Lainnya" }
    ];
    const cx = 70, cy = 70, r = 55, strokeW = 20;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    let circles = "";
    segments.forEach((s) => {
      const frac = s.value / total;
      const len = frac * circumference;
      circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${strokeW}"
        stroke-dasharray="${len} ${circumference - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
    });
    el.attendanceDonut.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${strokeW}"/>${circles}
      <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="20" fill="var(--text-900)">${total}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="9" fill="var(--text-500)">Karyawan</text>`;
    el.attendanceLegend.innerHTML = segments.map((s) => `
      <div class="legend__item"><span class="legend__swatch" style="background:${s.color}"></span>${s.label}: ${s.value}</div>`).join("");
  }

  function renderWeeklyBarChart() {
    const days = ["Senin","Selasa","Rabu","Kamis","Jumat"];
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const att = Store.getAttendance();
    const values = days.map((_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const key = Store.localDateKey(d);
      return att.filter((a) => a.date === key).length;
    });
    const max = Math.max(1, ...values);
    el.weeklyBarChart.innerHTML = days.map((d, i) => `
      <div class="bar-chart__col">
        <div class="bar-chart__bar" style="height:${(values[i] / max) * 100}%"></div>
        <div class="bar-chart__label">${d.slice(0,3)}</div>
      </div>`).join("");
  }

  function renderRecentActivity() {
    const notifs = Store.getNotifications().filter((n) => n.audience === "admin").slice(0, 8);
    el.recentActivityList.innerHTML = notifs.length ? notifs.map((n) => `
      <li>
        <div class="history-list__dot" style="background:${iconColorForType(n.type)}"></div>
        <div class="history-list__body">
          <div class="history-list__time">${escapeHtml(n.title)}</div>
          <div class="history-list__meta">${escapeHtml(n.message)}</div>
        </div>
        <span class="text-sm text-muted">${timeAgoID(n.createdAt)}</span>
      </li>`).join("") : emptyStateHtml("Belum ada aktivitas.");
  }
  function iconColorForType(type) {
    return { registration: "var(--info-600)", leave: "var(--brand-600)", overtime: "var(--cyan-500)", zone: "var(--danger-600)", info: "var(--text-400)" }[type] || "var(--brand-600)";
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
      el.rejectModal.hidden = false;
    }));
  }

  function onSubmitReject(e) {
    e.preventDefault();
    const reason = el.rejectReason.value.trim();
    if (!rejectContext) return;
    if (rejectContext.kind === "user") Store.rejectUser(rejectContext.id, reason);
    if (rejectContext.kind === "leave") Store.decideLeave(rejectContext.id, "rejected", reason);
    if (rejectContext.kind === "overtime") Store.decideOvertime(rejectContext.id, "rejected", reason);
    el.rejectModal.hidden = true;
    showToast("Pengajuan ditolak.", "warning");
    rejectContext = null;
    renderAll();
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
        <div class="avatar-lg">${initials(u.name)}</div>
        <div><h3>${escapeHtml(u.name)}</h3><p>${escapeHtml(u.position)} · ${escapeHtml(u.department)}</p></div>
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
        <div class="history-list__body"><div class="history-list__time">${l.type} (${l.days} hari)</div><div class="history-list__meta">${l.startDate} s/d ${l.endDate}</div></div></li>`).join("") : emptyStateHtml("Belum ada pengajuan cuti.")}</ul>

      <div class="section-divider"></div>
      <h3 style="font-size:.92rem;margin-bottom:.8em">Kelola Akun</h3>
      <div class="chip-group">
        ${u.status !== "active" ? `<button class="btn btn--primary btn--sm" data-action="activate">Aktifkan</button>` : ""}
        ${u.status === "active" ? `<button class="btn btn--danger-ghost btn--sm" data-action="deactivate">Nonaktifkan</button>` : ""}
        <button class="btn btn--ghost btn--sm" data-action="reset-password">Reset Password</button>
      </div>
      <form id="edit-employee-form" class="mt-1">
        <div class="field-row">
          <div><label for="edit-position">Jabatan</label><input id="edit-position" value="${escapeHtml(u.position)}" /></div>
          <div><label for="edit-department">Departemen</label><input id="edit-department" value="${escapeHtml(u.department)}" /></div>
        </div>
        <button type="submit" class="btn btn--ghost btn--block mt-1">Simpan Perubahan</button>
      </form>
    `;
    el.employeeModal.hidden = false;
    document.getElementById("employee-modal-close").addEventListener("click", () => el.employeeModal.hidden = true);

    const activateBtn = el.employeeModalContent.querySelector('[data-action="activate"]');
    if (activateBtn) activateBtn.addEventListener("click", () => {
      Store.approveUser(u.id); showToast("Karyawan diaktifkan.", "success"); el.employeeModal.hidden = true; renderAll();
    });
    const deactivateBtn = el.employeeModalContent.querySelector('[data-action="deactivate"]');
    if (deactivateBtn) deactivateBtn.addEventListener("click", () => {
      askConfirm("Nonaktifkan Karyawan", `Nonaktifkan akun ${u.name}? Karyawan tidak akan bisa login.`, () => {
        Store.setUserStatus(u.id, "disabled"); showToast("Karyawan dinonaktifkan.", "warning"); el.employeeModal.hidden = true; renderAll();
      });
    });
    const resetBtn = el.employeeModalContent.querySelector('[data-action="reset-password"]');
    if (resetBtn) resetBtn.addEventListener("click", () => {
      askConfirm("Reset Password", `Reset password ${u.name} ke default (123456)?`, () => {
        Store.updateUser(u.id, { password: Store.hashPassword("123456") });
        showToast("Password direset ke 123456.", "success");
      });
    });
    document.getElementById("edit-employee-form").addEventListener("submit", (e) => {
      e.preventDefault();
      Store.updateUser(u.id, {
        position: document.getElementById("edit-position").value.trim(),
        department: document.getElementById("edit-department").value.trim()
      });
      showToast("Data karyawan diperbarui.", "success");
      el.employeeModal.hidden = true;
      renderAll();
    });
  }

  /* ------------------------------------------------------------------ */
  /* REKAP ABSENSI                                                       */
  /* ------------------------------------------------------------------ */
  function renderAbsensi(range) {
    let list = Store.getAttendance();
    const now = new Date();
    if (range === "today") { const key = Store.localDateKey(); list = list.filter((a) => a.date === key); }
    else if (range === "week") { const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7); list = list.filter((a) => new Date(a.date) >= weekAgo); }
    // Bug fix: filter "bulan ini" sebelumnya hanya mencocokkan angka bulan
    // (getMonth()) tanpa memeriksa tahun, sehingga data bulan yang sama dari
    // tahun-tahun sebelumnya ikut tampil sebagai "bulan ini".
    else if (range === "month") { list = list.filter((a) => { const d = new Date(a.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }); }
    list = list.sort((a, b) => b.date.localeCompare(a.date));

    if (!list.length) { el.absensiTbody.innerHTML = `<tr><td colspan="6">${emptyStateBlock("Tidak ada data absensi pada rentang ini.")}</td></tr>`; return; }
    el.absensiTbody.innerHTML = list.map((a) => {
      const u = Store.findUserById(a.userId);
      return `<tr>
        <td>${escapeHtml(u ? u.name : a.userId)}</td>
        <td>${formatDateID(a.date)}</td>
        <td class="mono">${a.checkIn || "—"}</td>
        <td class="mono">${a.checkOut || "—"}</td>
        <td class="mono">${a.checkInDistance != null ? a.checkInDistance.toFixed(1) + " m" : "—"}</td>
        <td>${statusBadge(a.status)}</td>
      </tr>`;
    }).join("");
  }
  function statusBadge(status) {
    const map = { hadir: ["badge--success","Hadir"], terlambat: ["badge--warning","Terlambat"], "tidak-hadir": ["badge--danger","Tidak Hadir"] };
    const [cls, label] = map[status] || ["badge--neutral", status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function exportAttendanceCsv() {
    const rows = [["Nama","ID","Tanggal","Masuk","Pulang","Jarak Masuk (m)","Status"]];
    Store.getAttendance().forEach((a) => {
      const u = Store.findUserById(a.userId);
      rows.push([u ? u.name : a.userId, a.userId, a.date, a.checkIn || "", a.checkOut || "", a.checkInDistance != null ? a.checkInDistance.toFixed(1) : "", a.status]);
    });
    downloadCsv(rows, "rekap-absensi.csv");
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
        <td>${l.startDate} s/d ${l.endDate}</td>
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
      Store.decideLeave(b.dataset.lvApprove, "approved", ""); showToast("Cuti disetujui.", "success"); renderAll();
    }));
    el.cutiTbody.querySelectorAll("[data-lv-reject]").forEach((b) => b.addEventListener("click", () => {
      rejectContext = { kind: "leave", id: b.dataset.lvReject };
      el.rejectModalTitle.textContent = "Tolak Pengajuan Cuti";
      el.rejectReason.value = "";
      el.rejectModal.hidden = false;
    }));
  }
  function leaveStatusPill(status) {
    if (status === "pending") return '<span class="pill pill--warning">🟡 Pending</span>';
    if (status === "approved") return '<span class="pill pill--success">🟢 Approved</span>';
    return '<span class="pill pill--danger">🔴 Rejected</span>';
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
      Store.decideOvertime(b.dataset.otApprove, "approved", ""); showToast("Lembur disetujui.", "success"); renderAll();
    }));
    el.lemburTbody.querySelectorAll("[data-ot-reject]").forEach((b) => b.addEventListener("click", () => {
      rejectContext = { kind: "overtime", id: b.dataset.otReject };
      el.rejectModalTitle.textContent = "Tolak Pengajuan Lembur";
      el.rejectReason.value = "";
      el.rejectModal.hidden = false;
    }));
  }

  /* ------------------------------------------------------------------ */
  /* GAJI (dummy)                                                        */
  /* ------------------------------------------------------------------ */
  function renderGaji() {
    el.gajiPeriodLabel.textContent = "Periode " + Store.currentPeriod() + " (data uji coba)";
    const list = Store.getSalary();
    if (!list.length) { el.gajiTbody.innerHTML = `<tr><td colspan="8">${emptyStateBlock("Belum ada data gaji.")}</td></tr>`; return; }
    el.gajiTbody.innerHTML = list.map((s) => {
      const u = Store.findUserById(s.userId);
      const total = s.basicSalary + s.allowance + s.overtimePay + s.bonus - s.deduction;
      return `<tr>
        <td>${escapeHtml(u ? u.name : s.userId)}</td>
        <td class="mono">${formatRupiah(s.basicSalary)}</td>
        <td class="mono">${formatRupiah(s.allowance)}</td>
        <td class="mono">${formatRupiah(s.overtimePay)}</td>
        <td class="mono">${formatRupiah(s.deduction)}</td>
        <td class="mono">${formatRupiah(s.bonus)}</td>
        <td class="mono" style="font-weight:700">${formatRupiah(total)}</td>
        <td>${s.status === "paid" ? '<span class="pill pill--success">Terbayar</span>' : '<span class="pill pill--warning">Belum Bayar</span>'}</td>
      </tr>`;
    }).join("");
  }
  function exportGajiCsv() {
    const rows = [["Nama","Gaji Pokok","Tunjangan","Lembur","Potongan","Bonus","Total","Status"]];
    Store.getSalary().forEach((s) => {
      const u = Store.findUserById(s.userId);
      const total = s.basicSalary + s.allowance + s.overtimePay + s.bonus - s.deduction;
      rows.push([u ? u.name : s.userId, s.basicSalary, s.allowance, s.overtimePay, s.deduction, s.bonus, total, s.status]);
    });
    downloadCsv(rows, "gaji-karyawan.csv");
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
  function downloadCsv(rows, filename) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
})();
