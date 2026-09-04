/* ==========================================================================
   RAKABU ATTENDANCE — EMPLOYEE DASHBOARD LOGIC
   ========================================================================== */
(function () {
  "use strict";

  // Bug fix (anti-duplikasi): sejumlah tool preview/live-reload (mis. saat
  // menguji lewat editor kode di HP) kadang menyuntikkan ulang skrip ini ke
  // halaman yang sama tanpa memuat ulang dokumen sepenuhnya. Jika ini
  // terjadi, IIFE di bawah bisa berjalan dua kali dan mendaftarkan dua set
  // listener + dua GeoMonitor independen — salah satu gejalanya adalah
  // modal/alarm yang tampak "nyangkut" atau muncul kembali dengan data lama.
  // Penjaga ini memastikan logika dashboard karyawan hanya diinisialisasi
  // sekali per halaman.
  if (window.__rakabuEmployeeInitialized) return;
  window.__rakabuEmployeeInitialized = true;

  const user = Store.currentUser();
  if (!user || user.role !== "employee") {
    window.location.replace("index.html");
    return;
  }

  const el = {};
  const monitor = createGeoMonitor({
    onUpdate: onGeoUpdate,
    onEnterOutside: onEnterOutside,
    onReturnSafe: onReturnSafe,
    onOutsideLimitReached: onOutsideLimitReached,
    onConfigInvalid: onConfigInvalid,
    onError: (msg) => { setLocationNote(msg); }
  });

  let pendingActiveZoneEvent = null;
  let pendingZoneDistance = 0;
  let outsideTickTimer = null;

  document.addEventListener("DOMContentLoaded", () => {
    cacheDom();
    // Bug fix: paksa semua modal ke kondisi tertutup saat halaman baru
    // dimuat. Ini jaring pengaman terhadap kondisi DOM/form yang terwariskan
    // secara tidak sengaja (mis. bfcache browser, atau preview yang tidak
    // benar-benar memuat ulang dokumen), yang sebelumnya bisa membuat modal
    // "Peringatan Keluar Area" tampak terbuka lagi dengan data lama padahal
    // alarm baru belum benar-benar terpicu.
    [el.attendanceModal, el.successModal, el.criticalWarningModal, el.moreModal].forEach((m) => { if (m) m.hidden = true; });
    if (el.reasonSelect) el.reasonSelect.value = "";
    if (el.reasonOtherWrap) el.reasonOtherWrap.hidden = true;
    if (el.reasonOtherText) el.reasonOtherText.value = "";
    if (el.criticalDistance) el.criticalDistance.textContent = "—";

    bindNav();
    bindEvents();
    renderStaticInfo();
    renderDashboardBaseline();
    renderRiwayat("week");
    renderJadwal();
    renderCutiPage();
    renderLemburPage();
    renderProfil();
    renderNotifications();
    updateNotifBadge();
    initClock();
    requestNotificationPermission();
    monitor.start();

    // Pemantauan zona (alarm 5 menit) hanya aktif jika karyawan sudah absen
    // masuk hari ini dan belum absen pulang — dan HANYA jika koordinat
    // kantor sudah dikonfigurasi dengan benar (dicek ulang di dalam
    // monitor.setZoneActive, jadi ini aman dipanggil kapan saja).
    const todayRecordOnLoad = Store.getTodayRecord(user.id);
    monitor.setZoneActive(!!(todayRecordOnLoad && todayRecordOnLoad.checkIn && !todayRecordOnLoad.checkOut));

    if (!isOfficeLocationConfigured()) {
      showConfigWarning();
    }

    route(location.hash.replace("#", "") || "dashboard");
  });

  function cacheDom() {
    [
      "greeting","today-date-label","attendance-status-badge","hero-checkin","hero-checkout",
      "location-status-pill","radar-dot","stat-distance","stat-accuracy","stat-updated",
      "progress-fill","location-permission-note","open-maps-btn",
      "monitor-area-status","monitor-distance","monitor-outside-time","warning-banner","warning-distance","warning-timer",
      "check-in-btn","check-out-btn","check-in-sub","check-out-sub",
      "today-schedule","leave-remaining","leave-used","leave-quota",
      "riwayat-list","jadwal-list",
      "cuti-remaining","cuti-quota","cuti-used","leave-form","leave-type","leave-start","leave-end","leave-reason","leave-form-error","leave-history-list",
      "overtime-form","ot-date","ot-start","ot-end","ot-task","ot-reason","ot-form-error","overtime-history-list",
      "profile-avatar","profile-name","profile-position","profile-id","profile-department","profile-email","profile-phone","profile-status","profile-join",
      "profile-form","profile-phone-input","profile-email-input","logout-btn",
      "notif-list","mark-all-read-btn","notif-btn","notif-dot","avatar-btn",
      "attendance-modal","attendance-modal-body","attendance-modal-close",
      "success-modal","success-name","success-time","success-distance","success-close-btn",
      "critical-warning-modal","critical-distance","reason-form","reason-select","reason-other-wrap","reason-other-text","reason-error",
      "more-btn","more-modal","more-close-btn","more-logout-btn","sidebar-logout"
    ].forEach((id) => { el[toCamel(id)] = document.getElementById(id); });
  }
  function toCamel(id) { return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

  /* ------------------------------------------------------------------ */
  /* NAVIGATION                                                          */
  /* ------------------------------------------------------------------ */
  function bindNav() {
    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => { route(btn.dataset.nav); closeMore(); });
    });
    el.moreBtn.addEventListener("click", () => { el.moreModal.hidden = false; });
    el.moreCloseBtn.addEventListener("click", closeMore);
    el.moreModal.addEventListener("click", (e) => { if (e.target === el.moreModal) closeMore(); });
    function closeMore() { el.moreModal.hidden = true; }
  }

  // Bug fix: menu sidebar "Absensi" memakai data-nav="absensi", tapi tidak
  // ada section data-page="absensi" tersendiri (absen dilakukan dari halaman
  // Dashboard). Sebelumnya ini membuat sistem diam-diam melempar ke
  // Dashboard tanpa menyorot menu yang benar-benar diklik pengguna. Sekarang
  // "absensi" dipetakan eksplisit sebagai alias dari "dashboard".
  const PAGE_ALIASES = { absensi: "dashboard" };
  function route(page) {
    const valid = ["dashboard","riwayat","jadwal","cuti","lembur","profil","notifikasi"];
    let requestedPage = page;
    if (PAGE_ALIASES[page]) page = PAGE_ALIASES[page];
    if (!valid.includes(page)) { page = "dashboard"; requestedPage = "dashboard"; }
    document.querySelectorAll("[data-page]").forEach((sec) => { sec.hidden = sec.dataset.page !== page; });
    document.querySelectorAll("[data-nav]").forEach((btn) => {
      const btnPage = PAGE_ALIASES[btn.dataset.nav] || btn.dataset.nav;
      btn.classList.toggle("is-active", btnPage === page);
    });
    if (page === "notifikasi") { Store.markAllRead(user.id); renderNotifications(); updateNotifBadge(); }
    if (page === "riwayat") renderRiwayat("week");
    if (page === "cuti") renderCutiPage();
    if (page === "lembur") renderLemburPage();
    location.hash = requestedPage;
  }
  window.addEventListener("hashchange", () => route(location.hash.replace("#", "")));

  /* ------------------------------------------------------------------ */
  /* EVENTS                                                              */
  /* ------------------------------------------------------------------ */
  function bindEvents() {
    el.openMapsBtn.addEventListener("click", () => window.open(OFFICE_MAPS_URL, "_blank", "noopener"));
    el.checkInBtn.addEventListener("click", () => runAttendanceFlow("check-in"));
    el.checkOutBtn.addEventListener("click", () => runAttendanceFlow("check-out"));
    el.attendanceModalClose.addEventListener("click", () => el.attendanceModal.hidden = true);
    el.successCloseBtn.addEventListener("click", () => el.successModal.hidden = true);

    el.logoutBtn.addEventListener("click", doLogout);
    el.sidebarLogout.addEventListener("click", doLogout);
    el.moreLogoutBtn.addEventListener("click", doLogout);

    document.querySelectorAll('[data-range]').forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll('[data-range]').forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        renderRiwayat(chip.dataset.range);
      });
    });

    el.leaveForm.addEventListener("submit", onSubmitLeave);
    el.overtimeForm.addEventListener("submit", onSubmitOvertime);
    el.profileForm.addEventListener("submit", onSubmitProfile);
    el.markAllReadBtn.addEventListener("click", () => { Store.markAllRead(user.id); renderNotifications(); updateNotifBadge(); });

    el.reasonSelect.addEventListener("change", () => {
      el.reasonOtherWrap.hidden = el.reasonSelect.value !== "Keperluan lain";
    });
    el.reasonForm.addEventListener("submit", onSubmitZoneReason);
  }

  function doLogout() { Store.logout(); window.location.replace("index.html"); }

  /* ------------------------------------------------------------------ */
  /* STATIC INFO / CLOCK                                                 */
  /* ------------------------------------------------------------------ */
  function renderStaticInfo() {
    el.greeting.textContent = `Selamat datang, ${user.name.split(" ")[0]} 👋`;
    el.avatarBtn.textContent = initials(user.name);
  }

  function initClock() {
    updateClock();
    setInterval(updateClock, 1000);
  }
  function updateClock() {
    const now = new Date();
    const clockTime = document.getElementById("clock-time");
    const clockDate = document.getElementById("clock-date");
    if (clockTime) clockTime.textContent = now.toTimeString().slice(0, 8);
    if (clockDate) clockDate.textContent = now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    el.todayDateLabel.textContent = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  /* ------------------------------------------------------------------ */
  /* DASHBOARD BASELINE (status hari ini, sisa cuti ringkas)             */
  /* ------------------------------------------------------------------ */
  function renderDashboardBaseline() {
    const record = Store.getTodayRecord(user.id);
    updateAttendanceStatusUI(record);
    const fresh = Store.findUserById(user.id);
    el.leaveRemaining.textContent = (fresh.leaveQuota - fresh.leaveUsed);
    el.leaveUsed.textContent = fresh.leaveUsed;
    el.leaveQuota.textContent = fresh.leaveQuota;
  }

  function updateAttendanceStatusUI(record) {
    const badge = el.attendanceStatusBadge;
    if (!record) {
      badge.textContent = "BELUM ABSEN"; badge.className = "badge badge--neutral";
      el.checkInBtn.disabled = false; el.checkInSub.textContent = "Tekan untuk memulai";
      el.checkOutBtn.disabled = true; el.checkOutSub.textContent = "Absen masuk dahulu";
      el.heroCheckin.textContent = "—"; el.heroCheckout.textContent = "—";
      return;
    }
    el.heroCheckin.textContent = record.checkIn || "—";
    el.heroCheckout.textContent = record.checkOut || "—";
    if (record.checkOut) {
      badge.textContent = "SUDAH ABSEN PULANG"; badge.className = "badge badge--info";
      el.checkInBtn.disabled = true; el.checkInSub.textContent = "Sudah absen hari ini";
      el.checkOutBtn.disabled = true; el.checkOutSub.textContent = "Sudah absen pulang";
    } else {
      badge.textContent = record.status === "terlambat" ? "TERLAMBAT" : "SUDAH ABSEN MASUK";
      badge.className = record.status === "terlambat" ? "badge badge--warning" : "badge badge--success";
      el.checkInBtn.disabled = true; el.checkInSub.textContent = "Sudah absen masuk pukul " + record.checkIn;
      el.checkOutBtn.disabled = false; el.checkOutSub.textContent = "Tekan untuk pulang";
    }
  }

  /* ------------------------------------------------------------------ */
  /* GEOLOCATION UI (radar, jarak, monitoring)                           */
  /* ------------------------------------------------------------------ */
  function onGeoUpdate(data) {
    el.statDistance.textContent = data.distance.toFixed(1) + " m";
    el.statAccuracy.textContent = "±" + Math.round(data.accuracy) + " m";
    el.statUpdated.textContent = new Date().toTimeString().slice(0, 8);

    const withinAttendance = data.distance <= OFFICE_LOCATION.attendanceRadius;
    el.locationStatusPill.textContent = withinAttendance ? "Dalam radius absensi" : "Di luar radius absensi";
    el.locationStatusPill.className = "pill " + (withinAttendance ? "pill--success" : "pill--warning");

    setLocationNote(data.accuracy > OFFICE_LOCATION.maxAcceptableAccuracy
      ? "Akurasi lokasi terlalu rendah. Silakan aktifkan GPS dengan akurasi tinggi dan coba lagi."
      : "Akurasi lokasi bergantung pada perangkat, GPS, jaringan, dan kondisi lingkungan.");

    // Radar dot: peta jarak ke radius piksel radar, diskalakan mengikuti
    // warningRadius (bukan angka tetap) supaya tetap akurat kalau radius
    // dikonfigurasi ulang.
    const maxRadar = OFFICE_LOCATION.warningRadius, maxPx = 76;
    const clamped = Math.min(data.distance, maxRadar);
    const pixelDist = (clamped / maxRadar) * maxPx;
    const angle = (Date.now() / 1500) % (Math.PI * 2); // sudut berputar halus agar tidak statis di satu sisi
    const x = 86 + pixelDist * Math.cos(angle);
    const y = 86 + pixelDist * Math.sin(angle);
    el.radarDot.style.left = x + "px";
    el.radarDot.style.top = y + "px";
    el.radarDot.classList.toggle("is-safe", withinAttendance);

    const progressPct = Math.min(100, (data.distance / OFFICE_LOCATION.warningRadius) * 100);
    el.progressFill.style.width = (100 - progressPct) + "%";
    el.progressFill.style.background = withinAttendance
      ? "linear-gradient(90deg,var(--success-600),var(--brand-600))"
      : "linear-gradient(90deg,var(--warning-600),var(--danger-600))";

    el.monitorDistance.textContent = data.distance.toFixed(1) + " m";
    if (!isOfficeLocationConfigured()) {
      el.monitorAreaStatus.innerHTML = '<span class="badge badge--warning">KONFIGURASI LOKASI BELUM VALID</span>';
    } else if (!data.zoneActive) {
      el.monitorAreaStatus.innerHTML = '<span class="badge badge--neutral">MENUNGGU ABSEN MASUK</span>';
    } else if (data.safe) {
      el.monitorAreaStatus.innerHTML = '<span class="badge badge--success">DI AREA KERJA</span>';
    } else {
      el.monitorAreaStatus.innerHTML = '<span class="badge badge--danger">DI LUAR AREA KERJA</span>';
    }
  }

  function setLocationNote(msg) { el.locationPermissionNote.textContent = msg; }

  let configWarningShown = false;
  function showConfigWarning() {
    if (configWarningShown) return;
    configWarningShown = true;
    showToast("Koordinat kantor belum dikonfigurasi dengan benar. Monitoring zona dinonaktifkan sampai admin memperbaikinya.", "warning");
    el.monitorAreaStatus.innerHTML = '<span class="badge badge--warning">KONFIGURASI LOKASI BELUM VALID</span>';
    el.warningBanner.hidden = true;
    stopOutsideTicker();
  }
  function onConfigInvalid() {
    // Dipanggil oleh geo.js jika ada percobaan mengaktifkan alarm zona
    // padahal koordinat kantor belum valid. Ini adalah jaring pengaman
    // terakhir — seharusnya sudah dicegah lebih awal oleh showConfigWarning().
    showConfigWarning();
  }

  function onEnterOutside() {
    el.warningBanner.hidden = false;
    startOutsideTicker();
  }
  function onReturnSafe() {
    el.warningBanner.hidden = true;
    el.monitorOutsideTime.textContent = "00:00";
    stopOutsideTicker();
    showToast("Anda kembali ke area kerja aman.", "success");
  }
  function startOutsideTicker() {
    stopOutsideTicker();
    outsideTickTimer = setInterval(() => {
      const elapsed = monitor.getOutsideDurationSec();
      const remaining = Math.max(0, OFFICE_LOCATION.outsideDurationMs / 1000 - elapsed);
      el.monitorOutsideTime.textContent = formatMMSS(elapsed);
      el.warningTimer.textContent = formatMMSS(remaining);
      el.warningDistance.textContent = el.monitorDistance.textContent.replace(" m", "");
    }, 1000);
  }
  function stopOutsideTicker() { if (outsideTickTimer) clearInterval(outsideTickTimer); outsideTickTimer = null; }
  function formatMMSS(totalSec) {
    const m = Math.floor(totalSec / 60), s = Math.floor(totalSec % 60);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function onOutsideLimitReached({ distance, durationMs }) {
    const safeDistance = (typeof distance === "number" && isFinite(distance)) ? distance : 0;
    triggerZoneAlarm("Peringatan Keluar Area", `Anda telah berada di luar area kerja selama ${Math.round(durationMs / 60000)} menit.`);
    pendingActiveZoneEvent = Store.addZoneEvent({
      userId: user.id, distance: safeDistance, durationMs, startedAt: Date.now() - durationMs
    });
    // Simpan jarak di variabel JS (bukan dibaca ulang dari teks DOM saat
    // submit) — sebelumnya nilai bisa hilang/tampil "—" jika elemen belum
    // sempat ter-render saat pengguna buru-buru mengirim alasan.
    pendingZoneDistance = safeDistance;
    el.criticalDistance.textContent = safeDistance.toFixed(1);
    el.reasonSelect.value = "";
    el.reasonOtherWrap.hidden = true;
    el.reasonOtherText.value = "";
    el.reasonError.textContent = "";
    el.criticalWarningModal.hidden = false;
  }

  function onSubmitZoneReason(e) {
    e.preventDefault();
    const chosen = el.reasonSelect.value;
    if (!chosen) { el.reasonError.textContent = "Silakan pilih alasan."; return; }
    let reasonText = chosen;
    if (chosen === "Keperluan lain") {
      const other = el.reasonOtherText.value.trim();
      if (!other) { el.reasonError.textContent = "Silakan jelaskan alasan Anda."; return; }
      reasonText = other;
    }
    const durationSec = pendingActiveZoneEvent ? (Date.now() - pendingActiveZoneEvent.startedAt) / 1000 : 300;
    const distance = pendingZoneDistance || 0;
    if (pendingActiveZoneEvent) {
      Store.submitZoneReason(pendingActiveZoneEvent.id, reasonText, distance, durationSec);
      pendingActiveZoneEvent = null;
      pendingZoneDistance = 0;
    }
    // Beri jeda 5 menit baru & bersih sejak alasan dikirim, supaya alarm
    // tidak langsung berbunyi lagi akibat noise GPS sesaat setelah ini.
    monitor.acknowledgeOutsideReason();
    el.criticalWarningModal.hidden = true;
    showToast("Alasan berhasil dikirim ke admin.", "success");
  }

  /* ------------------------------------------------------------------ */
  /* CHECK-IN / CHECK-OUT FLOW                                           */
  /* ------------------------------------------------------------------ */
  function runAttendanceFlow(type) {
    document.getElementById("attendance-modal-title").textContent = type === "check-in" ? "Absen Masuk" : "Absen Pulang";
    el.attendanceModalBody.innerHTML = `
      <div class="spinner" style="width:32px;height:32px;border-color:var(--border);border-top-color:var(--brand-600);margin:0 auto 1em"></div>
      <p class="text-muted text-sm">Mengambil lokasi GPS Anda…</p>`;
    el.attendanceModal.hidden = false;

    getCurrentPositionOnce()
      .then((pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const distance = distanceToOffice(latitude, longitude);
        renderAttendanceCheck(type, { lat: latitude, lon: longitude, accuracy, distance });
      })
      .catch((err) => {
        el.attendanceModalBody.innerHTML = `<p style="color:var(--danger-600);font-weight:600">❌ ${escapeHtml(err.message)}</p>`;
      });
  }

  function renderAttendanceCheck(type, meta) {
    const withinRadius = meta.distance <= OFFICE_LOCATION.attendanceRadius;
    const accuracyOk = meta.accuracy <= OFFICE_LOCATION.maxAcceptableAccuracy;
    const canProceed = withinRadius && accuracyOk;

    el.attendanceModalBody.innerHTML = `
      <dl class="stat-list" style="text-align:left;margin-bottom:1em">
        <div class="stat-list__item"><dt>Jarak dari kantor</dt><dd class="mono">${meta.distance.toFixed(1)} m</dd></div>
        <div class="stat-list__item"><dt>Akurasi GPS</dt><dd class="mono">±${Math.round(meta.accuracy)} m</dd></div>
        <div class="stat-list__item"><dt>Jam</dt><dd class="mono">${new Date().toTimeString().slice(0,8)}</dd></div>
        <div class="stat-list__item"><dt>Status Lokasi</dt><dd>${withinRadius ? '<span class="badge badge--success">VALID</span>' : '<span class="badge badge--danger">DI LUAR RADIUS</span>'}</dd></div>
      </dl>
      ${!withinRadius ? `<p style="color:var(--danger-600);font-size:.86rem;font-weight:600">❌ Anda berada ${meta.distance.toFixed(1)} meter dari lokasi kerja. Absensi hanya dapat dilakukan dalam radius ${OFFICE_LOCATION.attendanceRadius} meter.</p>` : ""}
      ${withinRadius && !accuracyOk ? `<p style="color:var(--warning-600);font-size:.86rem;font-weight:600">⚠️ Akurasi lokasi terlalu rendah (±${Math.round(meta.accuracy)} m). Aktifkan GPS akurasi tinggi lalu coba lagi.</p>` : ""}
      <button id="attendance-confirm-btn" type="button" class="btn btn--primary btn--block mt-1" ${canProceed ? "" : "disabled"}>
        ${type === "check-in" ? "Konfirmasi Absen Masuk" : "Konfirmasi Absen Pulang"}
      </button>
      <button id="attendance-retry-btn" type="button" class="btn btn--ghost btn--block mt-1">Coba Lagi</button>
    `;
    const confirmBtn = document.getElementById("attendance-confirm-btn");
    if (confirmBtn) confirmBtn.addEventListener("click", () => finalizeAttendance(type, meta));
    document.getElementById("attendance-retry-btn").addEventListener("click", () => runAttendanceFlow(type));
  }

  function finalizeAttendance(type, meta) {
    let record;
    if (type === "check-in") {
      record = Store.checkIn(user.id, meta);
      // Aktifkan monitoring zona HANYA setelah absen masuk berhasil (dan
      // HANYA jika koordinat kantor valid — dicek di dalam setZoneActive).
      monitor.setZoneActive(true);
      if (monitor.isZoneActive()) {
        showToast("Monitoring lokasi kerja aktif.", "info");
      }
    } else {
      record = Store.checkOut(user.id, meta);
      // Matikan monitoring zona setelah absen pulang — karyawan sudah
      // sah meninggalkan area kerja, jadi tidak boleh lagi dianggap
      // "keluar area" dan dialarm.
      monitor.setZoneActive(false);
      el.warningBanner.hidden = true;
      stopOutsideTicker();
    }
    el.attendanceModal.hidden = true;
    updateAttendanceStatusUI(record);
    renderRiwayat("week");

    el.successName.textContent = user.name;
    el.successTime.textContent = type === "check-in" ? record.checkIn : record.checkOut;
    el.successDistance.textContent = meta.distance.toFixed(1) + " m";
    document.getElementById("success-title").textContent = type === "check-in" ? "Absen Masuk Berhasil" : "Absen Pulang Berhasil";
    el.successModal.hidden = false;
  }

  /* ------------------------------------------------------------------ */
  /* RIWAYAT ABSENSI                                                     */
  /* ------------------------------------------------------------------ */
  function renderRiwayat(range) {
    let list = Store.attendanceByUser(user.id);
    const now = new Date();
    if (range === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      list = list.filter((r) => new Date(r.date) >= weekAgo);
    } else if (range === "month") {
      list = list.filter((r) => new Date(r.date).getMonth() === now.getMonth() && new Date(r.date).getFullYear() === now.getFullYear());
    }
    if (!list.length) {
      el.riwayatList.innerHTML = emptyStateHtml("Belum ada riwayat absensi pada rentang ini.");
      return;
    }
    el.riwayatList.innerHTML = list.map((r) => `
      <li>
        <div class="history-list__dot" style="background:${statusColor(r.status)}"></div>
        <div class="history-list__body">
          <div class="history-list__time">${formatDateID(r.date)}</div>
          <div class="history-list__meta">Masuk ${r.checkIn || "—"} · Pulang ${r.checkOut || "—"} · Jarak ${r.checkInDistance != null ? r.checkInDistance.toFixed(1) + " m" : "—"}</div>
        </div>
        <span class="badge ${badgeClassForStatus(r.status)}">${statusLabel(r.status)}</span>
      </li>`).join("");
  }
  function statusColor(status) {
    return { hadir: "var(--success-600)", terlambat: "var(--warning-600)", "tidak-hadir": "var(--danger-600)" }[status] || "var(--brand-600)";
  }
  function badgeClassForStatus(status) {
    return { hadir: "badge--success", terlambat: "badge--warning", "tidak-hadir": "badge--danger" }[status] || "badge--neutral";
  }
  function statusLabel(status) {
    return { hadir: "Hadir", terlambat: "Terlambat", "tidak-hadir": "Tidak Hadir" }[status] || status;
  }

  /* ------------------------------------------------------------------ */
  /* JADWAL KERJA                                                        */
  /* ------------------------------------------------------------------ */
  function renderJadwal() {
    const days = [
      ["Senin", "08:00 – 17:00"], ["Selasa", "08:00 – 17:00"], ["Rabu", "08:00 – 17:00"],
      ["Kamis", "08:00 – 17:00"], ["Jumat", "08:00 – 17:00"], ["Sabtu", "Libur"], ["Minggu", "Libur"]
    ];
    el.jadwalList.innerHTML = days.map(([d, t]) => `
      <li>
        <div class="history-list__dot" style="background:${t === "Libur" ? "var(--text-400)" : "var(--brand-600)"}"></div>
        <div class="history-list__body"><div class="history-list__time">${d}</div></div>
        <span class="mono text-sm">${t}</span>
      </li>`).join("");
  }

  /* ------------------------------------------------------------------ */
  /* CUTI                                                                */
  /* ------------------------------------------------------------------ */
  function renderCutiPage() {
    const fresh = Store.findUserById(user.id);
    el.cutiRemaining.textContent = fresh.leaveQuota - fresh.leaveUsed;
    el.cutiQuota.textContent = fresh.leaveQuota + " hari";
    el.cutiUsed.textContent = fresh.leaveUsed + " hari";
    const history = Store.leaveByUser(user.id);
    el.leaveHistoryList.innerHTML = history.length ? history.map((l) => `
      <li>
        <div class="history-list__dot" style="background:${statusDotColor(l.status)}"></div>
        <div class="history-list__body">
          <div class="history-list__time">${l.type} · ${l.days} hari</div>
          <div class="history-list__meta">${l.startDate} s/d ${l.endDate} — ${escapeHtml(l.reason)}</div>
        </div>
        ${leaveStatusPill(l.status)}
      </li>`).join("") : emptyStateHtml("Belum ada pengajuan cuti.");
  }
  function statusDotColor(status) {
    return { pending: "var(--warning-600)", approved: "var(--success-600)", rejected: "var(--danger-600)" }[status];
  }
  function leaveStatusPill(status) {
    if (status === "pending") return '<span class="pill pill--warning">🟡 Menunggu</span>';
    if (status === "approved") return '<span class="pill pill--success">🟢 Disetujui</span>';
    return '<span class="pill pill--danger">🔴 Ditolak</span>';
  }

  function onSubmitLeave(e) {
    e.preventDefault();
    el.leaveFormError.textContent = "";
    const type = el.leaveType.value;
    const start = el.leaveStart.value;
    const end = el.leaveEnd.value;
    const reason = el.leaveReason.value.trim();
    if (!start || !end) { el.leaveFormError.textContent = "Tanggal mulai & selesai wajib diisi."; return; }
    if (end < start) { el.leaveFormError.textContent = "Tanggal selesai tidak boleh sebelum tanggal mulai."; return; }
    if (!reason) { el.leaveFormError.textContent = "Alasan wajib diisi."; return; }
    const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;

    Store.submitLeave({ userId: user.id, type, startDate: start, endDate: end, days, reason });
    showToast("Pengajuan cuti terkirim. Menunggu persetujuan admin.", "success");
    el.leaveForm.reset();
    renderCutiPage();
  }

  /* ------------------------------------------------------------------ */
  /* LEMBUR                                                              */
  /* ------------------------------------------------------------------ */
  function renderLemburPage() {
    const history = Store.overtimeByUser(user.id);
    el.overtimeHistoryList.innerHTML = history.length ? history.map((o) => `
      <li>
        <div class="history-list__dot" style="background:${statusDotColor(o.status)}"></div>
        <div class="history-list__body">
          <div class="history-list__time">${formatDateID(o.date)} · ${o.duration} jam</div>
          <div class="history-list__meta">${o.startTime}–${o.endTime} — ${escapeHtml(o.reason)}</div>
        </div>
        ${leaveStatusPill(o.status)}
      </li>`).join("") : emptyStateHtml("Belum ada pengajuan lembur.");
  }

  function onSubmitOvertime(e) {
    e.preventDefault();
    el.otFormError.textContent = "";
    const date = el.otDate.value, start = el.otStart.value, end = el.otEnd.value;
    const task = el.otTask.value.trim(), reason = el.otReason.value.trim();
    if (!date || !start || !end) { el.otFormError.textContent = "Tanggal & jam wajib diisi."; return; }
    if (end <= start) { el.otFormError.textContent = "Jam selesai harus setelah jam mulai."; return; }
    if (!task || !reason) { el.otFormError.textContent = "Lengkapi pekerjaan dan alasan lembur."; return; }
    const duration = Math.round(((new Date("1970-01-01T" + end) - new Date("1970-01-01T" + start)) / 3600000) * 10) / 10;

    Store.submitOvertime({ userId: user.id, date, startTime: start, endTime: end, duration, reason: `${task} — ${reason}` });
    showToast("Pengajuan lembur terkirim. Menunggu persetujuan admin.", "success");
    el.overtimeForm.reset();
    renderLemburPage();
  }

  /* ------------------------------------------------------------------ */
  /* PROFIL                                                              */
  /* ------------------------------------------------------------------ */
  function renderProfil() {
    const fresh = Store.findUserById(user.id);
    el.profileAvatar.textContent = initials(fresh.name);
    el.profileName.textContent = fresh.name;
    el.profilePosition.textContent = fresh.position;
    el.profileId.textContent = fresh.id;
    el.profileDepartment.textContent = fresh.department;
    el.profileEmail.textContent = fresh.email;
    el.profilePhone.textContent = fresh.phone;
    el.profileStatus.innerHTML = '<span class="badge badge--success">Aktif</span>';
    el.profileJoin.textContent = fresh.joinDate ? formatDateID(fresh.joinDate) : "-";
    el.profilePhoneInput.value = fresh.phone;
    el.profileEmailInput.value = fresh.email;
  }

  function onSubmitProfile(e) {
    e.preventDefault();
    Store.updateUser(user.id, { phone: el.profilePhoneInput.value.trim(), email: el.profileEmailInput.value.trim() });
    showToast("Data profil diperbarui.", "success");
    renderProfil();
  }

  /* ------------------------------------------------------------------ */
  /* NOTIFIKASI                                                          */
  /* ------------------------------------------------------------------ */
  function renderNotifications() {
    const list = Store.notificationsFor(user.id);
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
    const count = Store.unreadCount(user.id);
    el.notifDot.hidden = count === 0;
    el.notifDot.textContent = count;
  }

  function emptyStateHtml(msg) {
    return `<li class="history-empty" style="display:block;width:100%">${escapeHtml(msg)}</li>`;
  }
})();
