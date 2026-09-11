/* ==========================================================================
   RAKABU ATTENDANCE — DATA LAYER (DEMO ONLY)
   ==========================================================================
   Semua data disimpan di localStorage sebagai pengganti sementara backend
   nyata. Modul ini sengaja dipisah dari UI (bukan tercampur di app.js) agar
   nantinya mudah diganti dengan panggilan API sungguhan (mis. Firebase
   Authentication + Firestore/Realtime Database, atau REST API sendiri).

   CARA MENGGANTI KE BACKEND SUNGGUHAN:
   - Ganti isi setiap fungsi di bawah ini (mis. Store.login, Store.addUser,
     Store.saveAttendance) dengan `fetch()` / SDK Firebase.
   - Pertahankan nama & bentuk data (shape) yang sama supaya UI (auth.js,
     employee.js, admin.js) TIDAK perlu diubah.
   - Jangan pernah menyimpan password apa adanya (plaintext) di backend
     produksi. Fungsi hashPassword() di bawah HANYA berupa contoh sederhana
     dan tidak aman untuk produksi.
   ========================================================================== */

const Store = (function () {
  "use strict";

  const KEYS = {
    users: "rakabu_users",
    attendance: "rakabu_attendance",
    leave: "rakabu_leave",
    overtime: "rakabu_overtime",
    notifications: "rakabu_notifications",
    shifts: "rakabu_shifts",
    officeSettings: "rakabu_office_settings",
    zoneEvents: "rakabu_zone_events",
    presence: "rakabu_presence",
    outsideRequests: "rakabu_outside_requests",
    session: "rakabu_session",
    theme: "rakabu_theme",
    chatMessages: "rakabu_chat_messages",
    chatReads: "rakabu_chat_reads",
    chatTyping: "rakabu_chat_typing",
    seeded: "rakabu_seeded_v1"
  };

  // Grup chat menyimpan paling banyak sekian pesan terbaru saja — supaya
  // localStorage (kuota terbatas, biasanya 5–10MB per origin) tidak
  // membengkak oleh riwayat obrolan yang terus bertambah, dan supaya
  // render daftar pesan di layar tetap ringan/cepat walau dipakai
  // bertahun-tahun. Pesan yang lebih lama dari batas ini otomatis "digulung"
  // (dibuang dari penyimpanan) setiap kali ada pesan baru masuk.
  const CHAT_MESSAGE_LIMIT = 300;
  // Lampiran foto di chat DIKOMPRES di sisi klien (lihat js/chat.js) sebelum
  // disimpan, tapi tetap diberi batas keras di sini sebagai jaring pengaman
  // kedua supaya satu foto yang lolos kompres tidak menghabiskan kuota.
  const CHAT_IMAGE_MAX_BYTES = 350 * 1024;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("Gagal menyimpan data:", e);
      return false;
    }
  }
  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Menambah `mins` menit ke waktu berformat "HH:MM" (dipakai untuk
  // menghitung batas telat = jam masuk shift + toleransi). Membungkus
  // lewat tengah malam dengan aman (mis. shift malam 23:50 + 15 = 00:05).
  function addMinutesToTime(hhmm, mins) {
    const [h, m] = String(hhmm || "00:00").split(":").map(Number);
    let total = (h * 60 + m + (mins || 0)) % 1440;
    if (total < 0) total += 1440;
    const H = String(Math.floor(total / 60)).padStart(2, "0");
    const M = String(total % 60).padStart(2, "0");
    return `${H}:${M}`;
  }

  /**
   * Bug fix: sebelumnya seluruh "date key" (untuk absensi harian, dsb)
   * dihasilkan dengan `new Date().toISOString().slice(0,10)`, yang memakai
   * tanggal UTC — BUKAN tanggal lokal perangkat. Di Indonesia (UTC+7/8/9),
   * ini bisa membuat absensi dini hari (00:00–06:59 waktu lokal) tercatat
   * dengan tanggal KEMARIN, sehingga status "Absen Hari Ini" tampak keliru.
   * Semua date-key sekarang memakai kalender LOKAL perangkat secara konsisten.
   */
  function localDateKey(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // NOTE: DEMO ONLY. Bukan hashing yang aman — hanya agar password tidak
  // tersimpan sebagai teks polos di localStorage demo ini.
  function hashPassword(pw) {
    let h = 0;
    for (let i = 0; i < pw.length; i++) { h = (h << 5) - h + pw.charCodeAt(i); h |= 0; }
    return "demo_" + Math.abs(h).toString(36) + "_" + pw.length;
  }

  /* ------------------------------------------------------------------ */
  /* SEED DATA                                                          */
  /* ------------------------------------------------------------------ */
  function seedIfNeeded() {
    if (read(KEYS.seeded, false)) return;

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // ------------------------------------------------------------------
    // SHIFT KERJA — jadwal jam kerja yang bisa ditambah/diedit admin lewat
    // menu "Shift Kerja". Setiap karyawan (field `shiftId` pada user)
    // ditautkan ke salah satu shift di bawah ini. `days` berisi indeks hari
    // kerja (1=Senin … 7=Minggu, ISO) — hari di luar daftar ini dianggap
    // libur untuk shift tsb.
    const shifts = [
      {
        id: "SHIFT_REGULER",
        name: "Reguler (Kantor)",
        start: "08:00",
        end: "17:00",
        days: [1, 2, 3, 4, 5],
        color: "brand",
        note: "Jadwal standar Senin–Jumat.",
        createdAt: now - 400 * day
      },
      {
        id: "SHIFT_PAGI",
        name: "Shift Pagi (Operasional)",
        start: "06:00",
        end: "14:00",
        days: [1, 2, 3, 4, 5, 6],
        color: "success",
        note: "Untuk tim kandang & operasional pagi.",
        createdAt: now - 400 * day
      },
      {
        id: "SHIFT_SIANG",
        name: "Shift Siang (Operasional)",
        start: "14:00",
        end: "22:00",
        days: [1, 2, 3, 4, 5, 6],
        color: "warning",
        note: "Lanjutan shift pagi untuk tim operasional.",
        createdAt: now - 400 * day
      }
    ];

    const users = [
      {
        id: "ADM001",
        role: "admin",
        name: "Admin Rakabu",
        username: "admin",
        password: hashPassword("admin123"),
        email: "admin@rakabusapikita.co.id",
        phone: "081200000000",
        position: "HR Manager",
        department: "Human Resources",
        status: "active",
        joinDate: "2022-01-10",
        leaveQuota: 0,
        leaveUsed: 0,
        createdAt: now - 400 * day
      },
      {
        id: "LKN001",
        role: "employee",
        name: "Riki Hermawan",
        degree: "S.Kom",
        username: "LKN001",
        password: hashPassword("123456"),
        email: "riki.hermawan@rakabusapikita.co.id",
        phone: "081234567890",
        position: "Staff IT",
        department: "IT",
        shiftId: "SHIFT_REGULER",
        status: "active",
        joinDate: "2023-03-01",
        leaveQuota: 12,
        leaveUsed: 3,
        createdAt: now - 300 * day
      },
      {
        id: "LKN002",
        role: "employee",
        name: "Siti Aminah",
        username: "LKN002",
        password: hashPassword("123456"),
        email: "siti.aminah@rakabusapikita.co.id",
        phone: "081234500001",
        position: "Staff Kandang",
        department: "Operasional",
        shiftId: "SHIFT_PAGI",
        status: "active",
        joinDate: "2023-06-15",
        leaveQuota: 12,
        leaveUsed: 5,
        createdAt: now - 200 * day
      },
      {
        id: "LKN003",
        role: "employee",
        name: "Budi Santoso",
        username: "LKN003",
        password: hashPassword("123456"),
        email: "budi.santoso@rakabusapikita.co.id",
        phone: "081234500002",
        position: "Staff Gudang Pakan",
        department: "Gudang",
        shiftId: "SHIFT_REGULER",
        status: "pending",
        joinDate: null,
        leaveQuota: 12,
        leaveUsed: 0,
        createdAt: now - 1 * day
      }
    ];

    const attendance = [
      {
        id: uid("att"), userId: "LKN001", date: todayKeyOffset(-1),
        checkIn: "07:58", checkOut: "17:04", status: "hadir",
        checkInDistance: 1.8, checkOutDistance: 2.1
      },
      {
        id: uid("att"), userId: "LKN002", date: todayKeyOffset(-1),
        checkIn: "08:12", checkOut: "17:00", status: "terlambat",
        checkInDistance: 0.9, checkOutDistance: 1.4
      }
    ];

    const leave = [
      {
        id: uid("lv"), userId: "LKN002", type: "Cuti Tahunan",
        startDate: todayKeyOffset(4), endDate: todayKeyOffset(6), days: 3,
        reason: "Acara keluarga", status: "pending", note: "", createdAt: now - 1 * day
      }
    ];

    const overtime = [
      {
        id: uid("ot"), userId: "LKN001", date: todayKeyOffset(-2),
        startTime: "17:30", endTime: "19:30", duration: 2,
        reason: "Maintenance server", status: "approved", note: "Disetujui", createdAt: now - 2 * day
      }
    ];

    const notifications = [
      {
        id: uid("ntf"), audience: "admin", type: "registration",
        title: "Pendaftaran karyawan baru",
        message: "Budi Santoso mendaftar sebagai Staff Gudang Pakan.",
        read: false, createdAt: now - 1 * day, refId: "LKN003"
      },
      {
        id: uid("ntf"), audience: "admin", type: "leave",
        title: "Pengajuan cuti baru",
        message: "Siti Aminah mengajukan Cuti Tahunan (3 hari).",
        read: false, createdAt: now - 1 * day, refId: leave[0].id
      },
      {
        id: uid("ntf"), audience: "LKN001", type: "info",
        title: "Selamat datang di Rakabu Sapi Kita",
        message: "Akun Anda telah aktif. Selamat bekerja!",
        read: true, createdAt: now - 300 * day
      }
    ];

    write(KEYS.users, users);
    write(KEYS.attendance, attendance);
    write(KEYS.leave, leave);
    write(KEYS.overtime, overtime);
    write(KEYS.notifications, notifications);
    write(KEYS.shifts, shifts);
    write(KEYS.zoneEvents, []);
    write(KEYS.seeded, true);
  }

  function todayKeyOffset(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return localDateKey(d);
  }
  function currentPeriod() {
    const d = new Date();
    const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    return months[d.getMonth()] + " " + d.getFullYear();
  }

  /* ------------------------------------------------------------------ */
  /* USERS / AUTH                                                       */
  /* ------------------------------------------------------------------ */
  function getUsers() { return read(KEYS.users, []); }
  function saveUsers(list) { return write(KEYS.users, list); }

  function findUserByUsername(username) {
    return getUsers().find(u => u.username.toLowerCase() === String(username).toLowerCase());
  }
  function findUserById(id) {
    return getUsers().find(u => u.id === id);
  }

  function registerEmployee(data) {
    const users = getUsers();
    const wantedId = String(data.username || "").toLowerCase();
    // Bug fix: sebelumnya tidak ada pengecekan terhadap ID/username admin,
    // sehingga karyawan bisa (sengaja/tidak sengaja) mendaftar memakai ID
    // yang sama dengan akun admin. Sekarang ID admin (baik yang sudah ada
    // di data maupun kata kunci umum "admin") ditolak secara eksplisit.
    const isAdminWord = wantedId === "admin";
    const clashesWithAdmin = users.some(u => u.role === "admin" && u.username.toLowerCase() === wantedId);
    if (isAdminWord || clashesWithAdmin) {
      return { ok: false, error: "ID Karyawan tidak boleh menggunakan ID admin." };
    }
    if (users.some(u => u.username.toLowerCase() === wantedId)) {
      return { ok: false, error: "ID Karyawan sudah terdaftar. Gunakan ID lain atau hubungi admin." };
    }
    if (users.some(u => u.email && u.email.toLowerCase() === data.email.toLowerCase())) {
      return { ok: false, error: "Email sudah terdaftar." };
    }
    const newUser = {
      id: data.username,
      role: "employee",
      name: data.name,
      degree: data.degree || null,
      username: data.username,
      password: hashPassword(data.password),
      email: data.email,
      phone: data.phone,
      position: data.position,
      department: data.department,
      shiftId: "SHIFT_REGULER",
      status: "pending",
      joinDate: null,
      leaveQuota: 12,
      leaveUsed: 0,
      photo: data.photo || null,
      createdAt: Date.now()
    };
    users.push(newUser);
    saveUsers(users);
    addNotification({
      audience: "admin", type: "registration",
      title: "Pendaftaran karyawan baru",
      message: `${data.name} mendaftar sebagai ${data.position}.`,
      refId: newUser.id
    });
    return { ok: true, user: newUser };
  }

  function login(username, password, expectedRole) {
    const user = findUserByUsername(username);
    if (!user) return { ok: false, error: "ID/Username tidak ditemukan." };
    if (user.password !== hashPassword(password)) return { ok: false, error: "Password salah." };
    if (expectedRole && user.role !== expectedRole) return { ok: false, error: "Akun ini tidak memiliki akses tersebut." };
    if (user.role === "employee") {
      if (user.status === "pending") return { ok: false, error: "Akun Anda masih menunggu persetujuan admin." };
      if (user.status === "rejected") return { ok: false, error: "Pendaftaran Anda ditolak. Alasan: " + (user.rejectReason || "-") };
      if (user.status === "disabled") return { ok: false, error: "Akun Anda dinonaktifkan. Hubungi admin." };
    }
    setSession(user.id);
    return { ok: true, user: user };
  }

  function setSession(userId) { write(KEYS.session, { userId, at: Date.now() }); }
  function getSession() { return read(KEYS.session, null); }
  function currentUser() {
    const s = getSession();
    if (!s) return null;
    return findUserById(s.userId) || null;
  }
  function logout() { localStorage.removeItem(KEYS.session); }

  function updateUser(userId, patch) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return false;
    users[idx] = Object.assign({}, users[idx], patch);
    saveUsers(users);
    return true;
  }

  function approveUser(userId) {
    updateUser(userId, { status: "active", joinDate: localDateKey() });
    addNotification({ audience: userId, type: "info", title: "Pendaftaran disetujui",
      message: "Akun Anda telah disetujui admin. Anda sekarang dapat login." });
  }
  function rejectUser(userId, reason) {
    updateUser(userId, { status: "rejected", rejectReason: reason || "" });
    addNotification({ audience: userId, type: "info", title: "Pendaftaran ditolak",
      message: "Pendaftaran Anda ditolak. Alasan: " + (reason || "-") });
  }
  function setUserStatus(userId, status) { updateUser(userId, { status }); }

  /* ------------------------------------------------------------------ */
  /* ATTENDANCE                                                         */
  /* ------------------------------------------------------------------ */
  function getAttendance() { return read(KEYS.attendance, []); }
  function saveAttendanceList(list) { return write(KEYS.attendance, list); }

  function getTodayRecord(userId) {
    const key = localDateKey();
    return getAttendance().find(a => a.userId === userId && a.date === key) || null;
  }

  function checkIn(userId, meta) {
    const list = getAttendance();
    const dateKey = localDateKey();
    let record = list.find(a => a.userId === userId && a.date === dateKey);
    const timeStr = new Date().toTimeString().slice(0, 5);
    // Batas telat sekarang dihitung dari SHIFT karyawan (jam masuk shift +
    // toleransi), bukan lagi satu angka global — lihat getEffectiveSchedule().
    const user = findUserById(userId);
    const schedule = getEffectiveSchedule(user);
    const lateAfter = schedule.lateAfter || ((typeof CONFIG !== "undefined" && CONFIG.LATE_AFTER) || "08:15");
    const isLate = timeStr > lateAfter;
    if (!record) {
      record = {
        id: uid("att"), userId, date: dateKey, checkIn: timeStr, checkOut: null,
        status: isLate ? "terlambat" : "hadir",
        checkInDistance: meta.distance, checkInAccuracy: meta.accuracy,
        checkInLat: meta.lat, checkInLon: meta.lon,
        // Bug fix (izin lokasi): jika absen ini disetujui lewat izin admin
        // (di luar radius normal), simpan referensinya di record supaya
        // admin bisa melihat jejaknya di Rekap Absensi, bukan cuma di
        // halaman Izin Lokasi.
        checkInViaException: meta.viaException || null
      };
      list.push(record);
    } else {
      record.checkIn = timeStr;
      record.status = isLate ? "terlambat" : "hadir";
      record.checkInDistance = meta.distance;
      record.checkInViaException = meta.viaException || null;
    }
    saveAttendanceList(list);
    return record;
  }

  function checkOut(userId, meta) {
    const list = getAttendance();
    const dateKey = localDateKey();
    let record = list.find(a => a.userId === userId && a.date === dateKey);
    const timeStr = new Date().toTimeString().slice(0, 5);
    if (!record) return null;
    record.checkOut = timeStr;
    record.checkOutDistance = meta.distance;
    record.checkOutAccuracy = meta.accuracy;
    record.checkOutViaException = meta.viaException || null;
    saveAttendanceList(list);
    return record;
  }

  function attendanceByUser(userId) {
    return getAttendance().filter(a => a.userId === userId).sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Koreksi jam masuk / jam pulang oleh admin (mis. karyawan lupa absen,
   * HP mati, GPS gagal, dsb). Membuat record baru kalau belum ada untuk
   * tanggal tsb (absen manual), atau memperbarui record yang sudah ada.
   * Setiap perubahan WAJIB disertai catatan (`note`) dan dicatat sebagai
   * jejak audit (`editedByAdmin`) + notifikasi ke karyawan bersangkutan,
   * supaya perubahan jam kerja selalu transparan.
   */
  function adminUpdateAttendance(userId, dateKey, updates, adminName, note) {
    const list = getAttendance();
    let record = list.find(a => a.userId === userId && a.date === dateKey);
    const isNew = !record;
    if (!record) {
      record = { id: uid("att"), userId, date: dateKey, checkIn: null, checkOut: null, status: "hadir" };
      list.push(record);
    }
    if (updates.checkIn !== undefined) record.checkIn = updates.checkIn || null;
    if (updates.checkOut !== undefined) record.checkOut = updates.checkOut || null;
    if (updates.status !== undefined) record.status = updates.status;
    record.editedByAdmin = {
      by: adminName || "Admin", at: Date.now(), note: note || "", createdRecord: isNew
    };
    saveAttendanceList(list);
    addNotification({
      audience: userId, type: "info",
      title: isNew ? "Absensi ditambahkan admin" : "Jam absensi diperbarui admin",
      message: `Data absensi tanggal ${dateKey} ${isNew ? "ditambahkan" : "dikoreksi"} oleh ${adminName || "Admin"}` + (note ? `. Catatan: ${note}` : ".")
    });
    return record;
  }

  /* ------------------------------------------------------------------ */
  /* SHIFT KERJA                                                        */
  /* ------------------------------------------------------------------ */
  // Bentuk record shift:
  //   { id, name, start ("HH:MM"), end ("HH:MM"), days ([1..7], 1=Senin),
  //     color, note, createdAt }
  function getShifts() { return read(KEYS.shifts, []); }
  function saveShifts(list) { return write(KEYS.shifts, list); }
  function findShiftById(id) { return getShifts().find(s => s.id === id) || null; }

  function addShift(data) {
    const list = getShifts();
    const record = {
      id: uid("shift"),
      name: data.name,
      start: data.start,
      end: data.end,
      days: Array.isArray(data.days) && data.days.length ? data.days : [1, 2, 3, 4, 5],
      color: data.color || "brand",
      note: data.note || "",
      createdAt: Date.now()
    };
    list.push(record);
    saveShifts(list);
    return record;
  }

  function updateShift(id, updates) {
    const list = getShifts();
    const record = list.find(s => s.id === id);
    if (!record) return null;
    Object.assign(record, updates);
    saveShifts(list);
    return record;
  }

  /** Menghapus shift. Karyawan yang masih memakai shift ini otomatis
   *  dipindahkan ke `fallbackShiftId` (jika ada) supaya tidak ada
   *  karyawan yang kehilangan jadwal kerja. */
  function deleteShift(id, fallbackShiftId) {
    const shiftList = getShifts().filter(s => s.id !== id);
    saveShifts(shiftList);
    const users = getUsers();
    let changed = false;
    users.forEach(u => {
      if (u.shiftId === id) { u.shiftId = fallbackShiftId || null; changed = true; }
    });
    if (changed) saveUsers(users);
  }

  function usersCountByShift(shiftId) {
    return getUsers().filter(u => u.role === "employee" && u.shiftId === shiftId).length;
  }

  function assignUserShift(userId, shiftId) {
    return updateUser(userId, { shiftId });
  }

  /**
   * Jadwal kerja EFEKTIF milik seorang karyawan untuk hari ini: dari shift
   * yang ditautkan padanya, atau jadwal cadangan (CONFIG) jika karyawan
   * belum punya shift (mis. akun lama sebelum fitur ini ada).
   * `dayIso` = 1..7 (1=Senin..7=Minggu), default hari ini.
   */
  function getEffectiveSchedule(user, dayIso) {
    const fallback = {
      start: "08:00", end: "17:00", days: [1, 2, 3, 4, 5], name: "Jadwal Standar", isFallback: true
    };
    const shift = user && user.shiftId ? findShiftById(user.shiftId) : null;
    const sched = shift || fallback;
    const iso = dayIso || (new Date().getDay() === 0 ? 7 : new Date().getDay());
    const isWorkday = sched.days.includes(iso);
    const graceMin = (typeof CONFIG !== "undefined" && CONFIG.LATE_GRACE_MINUTES) || 15;
    return {
      name: sched.name || "Jadwal Standar",
      start: sched.start, end: sched.end, days: sched.days,
      isWorkday, isFallback: !!sched.isFallback,
      lateAfter: addMinutesToTime(sched.start, graceMin)
    };
  }

  /* ------------------------------------------------------------------ */
  /* PENGATURAN LOKASI KANTOR (koordinat, radius absensi, dsb.)          */
  /* ------------------------------------------------------------------ */
  // Nilai bawaan (default) diambil sekali dari CONFIG persis saat modul ini
  // pertama kali dimuat — yaitu SEBELUM ada override apa pun diterapkan.
  // Karena config.js selalu dieksekusi ulang dari awal di setiap page
  // load (bukan disimpan), snapshot ini selalu = nilai asli di js/config.js,
  // sehingga bisa dipakai admin untuk "Kembalikan ke Default" kapan saja.
  const DEFAULT_OFFICE_SETTINGS = (typeof CONFIG !== "undefined") ? {
    latitude: CONFIG.OFFICE_LOCATION.latitude,
    longitude: CONFIG.OFFICE_LOCATION.longitude,
    mapsUrl: CONFIG.OFFICE_MAPS_URL,
    attendanceRadius: CONFIG.ATTENDANCE_RADIUS,
    outsideAreaRadius: CONFIG.OUTSIDE_AREA_RADIUS
  } : null;

  function buildGoogleMapsUrl(lat, lon) {
    return `https://www.google.com/maps?q=${lat},${lon}`;
  }

  /** Validasi input form "Edit Lokasi Kantor" sebelum disimpan. Mengembalikan
   *  { ok:true, data } atau { ok:false, error } — TIDAK PERNAH melempar
   *  exception, supaya UI selalu bisa menampilkan pesan yang jelas alih-alih
   *  layar putih/error tak tertangani. */
  function validateOfficeSettings(input) {
    const lat = Number(input.latitude);
    const lon = Number(input.longitude);
    const radius = Number(input.attendanceRadius);
    const outsideRadius = Number(input.outsideAreaRadius);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return { ok: false, error: "Latitude harus berupa angka antara -90 sampai 90." };
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      return { ok: false, error: "Longitude harus berupa angka antara -180 sampai 180." };
    }
    if (lat === 0 && lon === 0) {
      return { ok: false, error: "Koordinat (0, 0) sepertinya belum diisi dengan benar (itu titik di Samudra Atlantik, bukan kantor Anda)." };
    }
    if (!Number.isFinite(radius) || radius < 1 || radius > 1000) {
      return { ok: false, error: "Radius absensi harus angka antara 1–1000 meter." };
    }
    if (!Number.isFinite(outsideRadius) || outsideRadius < 1 || outsideRadius > 2000) {
      return { ok: false, error: "Radius area kerja harus angka antara 1–2000 meter." };
    }
    if (outsideRadius < radius) {
      return { ok: false, error: "Radius area kerja tidak boleh lebih kecil dari radius absensi (karyawan yang baru absen masuk langsung dianggap 'keluar area')." };
    }
    let mapsUrl = String(input.mapsUrl || "").trim();
    if (mapsUrl && !/^https?:\/\//i.test(mapsUrl)) {
      return { ok: false, error: "Link Google Maps harus diawali dengan http:// atau https://" };
    }
    if (!mapsUrl) mapsUrl = buildGoogleMapsUrl(lat, lon);

    return {
      ok: true,
      data: { latitude: lat, longitude: lon, attendanceRadius: Math.round(radius), outsideAreaRadius: Math.round(outsideRadius), mapsUrl }
    };
  }

  function getOfficeSettings() {
    return read(KEYS.officeSettings, null);
  }

  /** Menerapkan pengaturan (dari localStorage atau baru disimpan) ke objek
   *  CONFIG yang sedang aktif. Sengaja MEMODIFIKASI properti di dalam objek
   *  yang sudah ada (bukan mengganti CONFIG.OFFICE_LOCATION dengan objek
   *  baru), supaya alias lama `OFFICE_LOCATION` di config.js — yang
   *  menunjuk ke objek yang sama — tetap ikut ter-update otomatis. */
  function applyOfficeSettingsToConfig(settings) {
    if (!settings || typeof CONFIG === "undefined") return;
    CONFIG.OFFICE_LOCATION.latitude = settings.latitude;
    CONFIG.OFFICE_LOCATION.longitude = settings.longitude;
    CONFIG.ATTENDANCE_RADIUS = settings.attendanceRadius;
    CONFIG.OUTSIDE_AREA_RADIUS = settings.outsideAreaRadius;
    CONFIG.OFFICE_MAPS_URL = settings.mapsUrl;
  }

  /** Simpan pengaturan baru dari form admin. Memberi tahu semua karyawan
   *  aktif lewat notifikasi supaya mereka tidak bingung kalau tiba-tiba
   *  tidak bisa absen (radius/lokasi berubah). */
  function saveOfficeSettings(input, adminName) {
    const result = validateOfficeSettings(input);
    if (!result.ok) return result;
    const settings = { ...result.data, updatedAt: Date.now(), updatedBy: adminName || "Admin" };
    write(KEYS.officeSettings, settings);
    applyOfficeSettingsToConfig(settings);
    getUsers().filter(u => u.role === "employee" && u.status === "active").forEach(u => {
      addNotification({
        audience: u.id, type: "info", title: "Lokasi kantor diperbarui",
        message: `Titik lokasi dan/atau radius absensi kantor telah diperbarui oleh ${adminName || "Admin"}. Muat ulang aplikasi jika absen tiba-tiba gagal.`
      });
    });
    return { ok: true, data: settings };
  }

  function resetOfficeSettings(adminName) {
    if (!DEFAULT_OFFICE_SETTINGS) return { ok: false, error: "Konfigurasi bawaan tidak ditemukan." };
    localStorage.removeItem(KEYS.officeSettings);
    applyOfficeSettingsToConfig(DEFAULT_OFFICE_SETTINGS);
    return { ok: true, data: DEFAULT_OFFICE_SETTINGS };
  }


  // Bentuk record zoneEvent:
  //   { id, userId, status: "active"|"resolved",
  //     outsideSince, reachedAt, returnedAt,
  //     lastLat, lastLon, lastDistance, lastAccuracy, createdAt,
  //     reason, reasonAt }
  function getZoneEvents() { return read(KEYS.zoneEvents, []); }
  function saveZoneEvents(list) { return write(KEYS.zoneEvents, list); }

  function zoneEventsByUser(userId) {
    return getZoneEvents().filter(z => z.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  }
  function activeZoneEventFor(userId) {
    return getZoneEvents().find(z => z.userId === userId && z.status === "active") || null;
  }

  /**
   * Dipanggil ketika ZoneMonitor (geo.js) mendeteksi karyawan berada di
   * luar radius kantor selama CONFIG.OUTSIDE_AREA_MINUTES PENUH. Satu
   * kejadian keluar area = satu event + satu notifikasi admin (tidak
   * berulang setiap detik).
   */
  function createLocationEvent(userId, meta) {
    const list = getZoneEvents();
    const record = {
      id: uid("zone"), userId, status: "active",
      outsideSince: meta.outsideSince, reachedAt: meta.reachedAt, returnedAt: null,
      lastLat: meta.lat, lastLon: meta.lon, lastDistance: meta.distance, lastAccuracy: meta.accuracy,
      reason: null, reasonAt: null,
      createdAt: Date.now()
    };
    list.unshift(record);
    saveZoneEvents(list);

    const user = findUserById(userId);
    const name = user ? user.name : userId;
    addNotification({
      audience: "admin", type: "zone",
      title: "⚠️ Peringatan Lokasi",
      message: `${name} berada di luar area kerja selama ${CONFIG.OUTSIDE_AREA_MINUTES} menit. Jarak terakhir: ${meta.distance.toFixed(1)} m dari kantor.`,
      refId: record.id
    });
    return record;
  }

  /**
   * Dipanggil ketika karyawan mengisi (atau melewati) formulir alasan
   * keluar area yang muncul otomatis setelah alarm berbunyi (lihat
   * employee.js). Alasan ini disimpan pada record zoneEvent yang
   * bersangkutan DAN dikirim sebagai notifikasi terpisah ke admin, supaya
   * admin bisa langsung membaca alasannya tanpa perlu membuka detail
   * riwayat lokasi satu per satu.
   */
  function setLocationEventReason(id, reason) {
    const list = getZoneEvents();
    const idx = list.findIndex(z => z.id === id);
    if (idx === -1) return null;
    const cleanReason = (reason || "").trim() || "(Karyawan tidak mengisi alasan)";
    list[idx] = Object.assign({}, list[idx], { reason: cleanReason, reasonAt: Date.now() });
    saveZoneEvents(list);

    const user = findUserById(list[idx].userId);
    const name = user ? user.name : list[idx].userId;
    addNotification({
      audience: "admin", type: "zone",
      title: "💬 Alasan Keluar Area",
      message: `${name}: "${cleanReason}"`,
      refId: id
    });
    return list[idx];
  }

  /**
   * Dipanggil ketika karyawan kembali ke dalam radius SETELAH event
   * OUTSIDE_AREA tercatat. Menandai event sebagai selesai (resolved) dan
   * mengirim satu notifikasi "kembali ke area" — tidak digabung dengan
   * kejadian keluar-area berikutnya jika karyawan keluar lagi nanti.
   */
  function resolveLocationEvent(id, meta) {
    const list = getZoneEvents();
    const idx = list.findIndex(z => z.id === id);
    if (idx === -1) return null;
    list[idx] = Object.assign({}, list[idx], {
      status: "resolved", returnedAt: Date.now(),
      lastLat: meta ? meta.lat : list[idx].lastLat,
      lastLon: meta ? meta.lon : list[idx].lastLon,
      lastDistance: meta ? meta.distance : list[idx].lastDistance
    });
    saveZoneEvents(list);

    const user = findUserById(list[idx].userId);
    const name = user ? user.name : list[idx].userId;
    addNotification({
      audience: "admin", type: "zone",
      title: "Kembali ke Area Kerja",
      message: `${name} kembali ke area kerja.`,
      refId: id
    });
    return list[idx];
  }

  function formatDuration(ms) {
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(totalSec / 60), s = totalSec % 60;
    return `${m} menit ${s} detik`;
  }

  /* ------------------------------------------------------------------ */
  /* PRESENCE (posisi GPS terakhir karyawan yang sedang bekerja)         */
  /* ------------------------------------------------------------------ */
  // CATATAN JUJUR TENTANG KETERBATASAN LOCALSTORAGE:
  // Presence ini HANYA terlihat oleh admin jika admin membuka dashboard
  // pada PERAMBAN/PERANGKAT YANG SAMA dengan karyawan (LocalStorage tidak
  // disinkronkan lintas perangkat). Ini BUKAN monitoring real-time
  // antar-HP — untuk itu, sistem perlu dipindahkan ke backend sungguhan
  // (mis. Firebase Realtime Database/Firestore) di tahap berikutnya.
  function getPresenceMap() { return read(KEYS.presence, {}); }
  function setPresence(userId, data) {
    const map = getPresenceMap();
    map[userId] = Object.assign({ userId, updatedAt: Date.now() }, data);
    write(KEYS.presence, map);
  }
  function getPresenceFor(userId) { return getPresenceMap()[userId] || null; }

  /* ------------------------------------------------------------------ */
  /* IZIN ABSEN DI LUAR LOKASI (outside-radius exception requests)      */
  /* ------------------------------------------------------------------ */
  // Aturan bisnis: absen masuk/pulang HANYA boleh dilakukan di dalam
  // CONFIG.ATTENDANCE_RADIUS. Jika karyawan berada di luar radius tsb,
  // satu-satunya jalan untuk tetap bisa absen adalah mengajukan izin ke
  // admin (lihat employee.js renderAttendanceCheck) dan menunggu admin
  // menyetujuinya (lihat admin.js renderIzinLokasi). Satu permintaan HANYA
  // berlaku untuk SATU jenis absen (masuk ATAU pulang) pada SATU tanggal —
  // bentuk record:
  //   { id, userId, type: "check-in"|"check-out", date, distance, accuracy,
  //     lat, lon, reason, status: "pending"|"approved"|"rejected", note,
  //     createdAt, decidedAt, usedAt }
  function getOutsideRequests() { return read(KEYS.outsideRequests, []); }
  function saveOutsideRequests(list) { return write(KEYS.outsideRequests, list); }
  function outsideRequestsByUser(userId) {
    return getOutsideRequests().filter(r => r.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  }
  /** Permintaan yang masih menunggu keputusan admin, untuk jenis & hari ini. */
  function pendingOutsideRequestFor(userId, type) {
    const dateKey = localDateKey();
    return getOutsideRequests().find(r => r.userId === userId && r.type === type && r.date === dateKey && r.status === "pending") || null;
  }
  /** Permintaan yang SUDAH disetujui admin, untuk jenis & hari ini, dan
   *  BELUM dipakai untuk absen (supaya satu persetujuan tidak dipakai
   *  berulang kali — meski secara alami absen masuk/pulang hanya bisa
   *  sekali per hari, penjagaan ini tetap eksplisit untuk kejelasan). */
  function approvedOutsideRequestFor(userId, type) {
    const dateKey = localDateKey();
    return getOutsideRequests().find(r => r.userId === userId && r.type === type && r.date === dateKey && r.status === "approved" && !r.usedAt) || null;
  }
  function submitOutsideRequest(data) {
    const list = getOutsideRequests();
    const record = Object.assign({
      id: uid("out"), date: localDateKey(), status: "pending", note: "",
      createdAt: Date.now(), decidedAt: null, usedAt: null
    }, data);
    list.unshift(record);
    saveOutsideRequests(list);
    const user = findUserById(data.userId);
    const label = data.type === "check-in" ? "Absen Masuk" : "Absen Pulang";
    addNotification({
      audience: "admin", type: "outside",
      title: "📍 Izin absen di luar lokasi",
      message: `${user ? user.name : data.userId} meminta izin ${label} di luar radius (±${data.distance.toFixed(1)} m dari kantor).`,
      refId: record.id
    });
    return record;
  }
  function decideOutsideRequest(id, status, note) {
    const list = getOutsideRequests();
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    list[idx].status = status;
    list[idx].note = note || "";
    list[idx].decidedAt = Date.now();
    saveOutsideRequests(list);
    const label = list[idx].type === "check-in" ? "Absen Masuk" : "Absen Pulang";
    addNotification({
      audience: list[idx].userId, type: "outside",
      title: status === "approved" ? "✅ Izin lokasi disetujui" : "❌ Izin lokasi ditolak",
      message: `Permintaan ${label} di luar lokasi Anda ${status === "approved" ? "disetujui. Silakan coba absen lagi." : "ditolak."}` + (note ? " Catatan: " + note : ""),
    });
    return list[idx];
  }
  /** Ditandai "terpakai" begitu absen benar-benar tersimpan lewat izin ini
   *  (lihat finalizeAttendance di employee.js), supaya admin bisa melihat
   *  mana persetujuan yang sudah benar-benar dipakai untuk absen. */
  function consumeOutsideRequest(id) {
    const list = getOutsideRequests();
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    list[idx].usedAt = Date.now();
    saveOutsideRequests(list);
    return list[idx];
  }
  function pendingOutsideRequestsCount() {
    return getOutsideRequests().filter(r => r.status === "pending").length;
  }

  /* ------------------------------------------------------------------ */
  /* LEAVE (CUTI)                                                       */
  /* ------------------------------------------------------------------ */
  function getLeave() { return read(KEYS.leave, []); }
  function leaveByUser(userId) { return getLeave().filter(l => l.userId === userId).sort((a, b) => b.createdAt - a.createdAt); }
  function submitLeave(data) {
    const list = getLeave();
    const record = Object.assign({ id: uid("lv"), status: "pending", note: "", createdAt: Date.now() }, data);
    list.push(record);
    write(KEYS.leave, list);
    const user = findUserById(data.userId);
    addNotification({
      audience: "admin", type: "leave",
      title: "Pengajuan cuti baru",
      message: `${user ? user.name : data.userId} mengajukan ${data.type} (${data.days} hari).`,
      refId: record.id
    });
    return record;
  }
  function decideLeave(id, status, note) {
    const list = getLeave();
    const idx = list.findIndex(l => l.id === id);
    if (idx === -1) return null;
    list[idx].status = status;
    list[idx].note = note || "";
    write(KEYS.leave, list);
    if (status === "approved") {
      updateUser(list[idx].userId, { leaveUsed: (findUserById(list[idx].userId).leaveUsed || 0) + list[idx].days });
    }
    addNotification({
      audience: list[idx].userId, type: "leave",
      title: status === "approved" ? "Cuti disetujui" : "Cuti ditolak",
      message: `Pengajuan ${list[idx].type} Anda ${status === "approved" ? "disetujui" : "ditolak"}.` + (note ? " Catatan: " + note : ""),
    });
    return list[idx];
  }

  /* ------------------------------------------------------------------ */
  /* OVERTIME (LEMBUR)                                                  */
  /* ------------------------------------------------------------------ */
  function getOvertime() { return read(KEYS.overtime, []); }
  function overtimeByUser(userId) { return getOvertime().filter(o => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt); }
  function submitOvertime(data) {
    const list = getOvertime();
    const record = Object.assign({ id: uid("ot"), status: "pending", note: "", createdAt: Date.now() }, data);
    list.push(record);
    write(KEYS.overtime, list);
    const user = findUserById(data.userId);
    addNotification({
      audience: "admin", type: "overtime",
      title: "Pengajuan lembur baru",
      message: `${user ? user.name : data.userId} mengajukan lembur ${data.duration} jam pada ${data.date}.`,
      refId: record.id
    });
    return record;
  }
  function decideOvertime(id, status, note) {
    const list = getOvertime();
    const idx = list.findIndex(o => o.id === id);
    if (idx === -1) return null;
    list[idx].status = status;
    list[idx].note = note || "";
    write(KEYS.overtime, list);
    addNotification({
      audience: list[idx].userId, type: "overtime",
      title: status === "approved" ? "Lembur disetujui" : "Lembur ditolak",
      message: `Pengajuan lembur Anda ${status === "approved" ? "disetujui" : "ditolak"}.` + (note ? " Catatan: " + note : ""),
    });
    return list[idx];
  }

  /* ------------------------------------------------------------------ */
  /* NOTIFICATIONS                                                      */
  /* ------------------------------------------------------------------ */
  function getNotifications() { return read(KEYS.notifications, []); }
  function addNotification(data) {
    const list = getNotifications();
    const record = Object.assign({ id: uid("ntf"), read: false, createdAt: Date.now() }, data);
    list.unshift(record);
    write(KEYS.notifications, list);
    return record;
  }
  function notificationsFor(audience) {
    return getNotifications().filter(n => n.audience === audience).sort((a, b) => b.createdAt - a.createdAt);
  }
  function unreadCount(audience) { return notificationsFor(audience).filter(n => !n.read).length; }
  function markAllRead(audience) {
    const list = getNotifications();
    list.forEach(n => { if (n.audience === audience) n.read = true; });
    write(KEYS.notifications, list);
  }
  function markRead(id) {
    const list = getNotifications();
    const n = list.find(x => x.id === id);
    if (n) { n.read = true; write(KEYS.notifications, list); }
  }

  /* ------------------------------------------------------------------ */
  /* CHAT GRUP (Grup Karyawan)                                          */
  /* ------------------------------------------------------------------ */
  /*
     DEMO ONLY — sama seperti seluruh Store lain di file ini: obrolan
     disimpan di localStorage PERANGKAT/BROWSER INI SAJA. Antar-tab di
     browser yang sama akan tersinkron langsung (lewat event "storage" +
     BroadcastChannel, lihat js/chat.js), tapi dua karyawan yang login dari
     HP masing-masing TIDAK akan saling melihat pesan satu sama lain sampai
     ini dihubungkan ke backend sungguhan (mis. Firebase Realtime Database/
     Firestore, atau WebSocket server sendiri) — cukup ganti isi fungsi di
     bawah ini dengan panggilan API/SDK, bentuk data (shape) dibuat sama
     persis supaya js/chat.js tidak perlu diubah sama sekali.
  */
  function getChatMessages() { return read(KEYS.chatMessages, []); }

  function saveChatMessages(list) { return write(KEYS.chatMessages, list); }

  /** Anggota grup = seluruh admin + karyawan berstatus aktif. Dipakai untuk
   *  panel info grup dan untuk menghitung centang biru ("dibaca semua"). */
  function chatMembers() {
    return getUsers().filter((u) => u.role === "admin" || u.status === "active");
  }

  function sendChatMessage(data) {
    const list = getChatMessages();
    const record = Object.assign({
      id: uid("msg"),
      text: "",
      image: null,
      createdAt: Date.now(),
      readBy: [data.senderId]
    }, data);
    list.push(record);
    // Gulung riwayat lama begitu melewati batas, ambil N terbaru saja.
    const trimmed = list.length > CHAT_MESSAGE_LIMIT ? list.slice(list.length - CHAT_MESSAGE_LIMIT) : list;
    saveChatMessages(trimmed);
    return record;
  }

  function deleteChatMessage(id, requesterId, requesterIsAdmin) {
    const list = getChatMessages();
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    if (list[idx].senderId !== requesterId && !requesterIsAdmin) return false;
    list.splice(idx, 1);
    saveChatMessages(list);
    return true;
  }

  /** Menandai seluruh pesan sampai saat ini sebagai "dibaca" oleh userId —
   *  dipakai untuk badge notifikasi belum-dibaca DAN untuk status centang
   *  (satu abu = terkirim, dua abu = ada yang membaca, dua biru = seluruh
   *  anggota grup aktif sudah membaca). */
  function markChatRead(userId) {
    const list = getChatMessages();
    let changed = false;
    list.forEach((m) => {
      if (!Array.isArray(m.readBy)) m.readBy = [];
      if (!m.readBy.includes(userId)) { m.readBy.push(userId); changed = true; }
    });
    if (changed) saveChatMessages(list);
    const reads = read(KEYS.chatReads, {});
    reads[userId] = Date.now();
    write(KEYS.chatReads, reads);
  }

  function chatLastReadAt(userId) {
    const reads = read(KEYS.chatReads, {});
    return reads[userId] || 0;
  }

  function unreadChatCount(userId) {
    const lastRead = chatLastReadAt(userId);
    return getChatMessages().filter((m) => m.senderId !== userId && m.createdAt > lastRead).length;
  }

  /** Status "sedang mengetik" — entri kedaluwarsa sendiri (dianggap basi)
   *  setelah beberapa detik oleh pembaca (lihat js/chat.js), jadi di sini
   *  cukup dicatat apa adanya tanpa perlu dibersihkan aktif. */
  function setChatTyping(userId, name) {
    const map = read(KEYS.chatTyping, {});
    map[userId] = { name, at: Date.now() };
    write(KEYS.chatTyping, map);
  }
  function clearChatTyping(userId) {
    const map = read(KEYS.chatTyping, {});
    delete map[userId];
    write(KEYS.chatTyping, map);
  }
  function getChatTyping() { return read(KEYS.chatTyping, {}); }

  /* ------------------------------------------------------------------ */
  /* THEME                                                              */
  /* ------------------------------------------------------------------ */
  function getTheme() { return read(KEYS.theme, null); }
  function setTheme(t) { write(KEYS.theme, t); }

  seedIfNeeded();

  // Migrasi untuk instalasi lama (localStorage sudah pernah di-seed
  // SEBELUM fitur Shift Kerja ada): pastikan tetap ada minimal satu shift
  // default, dan karyawan lama tanpa shiftId ditautkan ke shift itu —
  // supaya jadwal & perhitungan telat tidak pernah kosong.
  (function migrateShifts() {
    let shifts = read(KEYS.shifts, []);
    if (!Array.isArray(shifts) || shifts.length === 0) {
      shifts = [{
        id: "SHIFT_REGULER", name: "Reguler (Kantor)", start: "08:00", end: "17:00",
        days: [1, 2, 3, 4, 5], color: "brand", note: "Jadwal standar Senin–Jumat.",
        createdAt: Date.now()
      }];
      write(KEYS.shifts, shifts);
    }
    const defaultId = shifts[0].id;
    const users = read(KEYS.users, []);
    let changed = false;
    users.forEach(u => { if (u.role === "employee" && !u.shiftId) { u.shiftId = defaultId; changed = true; } });
    if (changed) write(KEYS.users, users);
  })();

  // Terapkan override lokasi kantor (jika admin pernah menyimpan lewat menu
  // Pengaturan) ke CONFIG yang aktif saat ini. HARUS dijalankan sebelum
  // geo.js/employee.js/admin.js memakai CONFIG.OFFICE_LOCATION dkk — aman
  // karena store.js selalu dimuat sebelum ketiga file itu di setiap halaman.
  applyOfficeSettingsToConfig(getOfficeSettings());

  return {
    KEYS, uid, hashPassword, localDateKey,
    getUsers, saveUsers, findUserByUsername, findUserById, registerEmployee,
    login, logout, currentUser, getSession, updateUser, approveUser, rejectUser, setUserStatus,
    getAttendance, getTodayRecord, checkIn, checkOut, attendanceByUser, adminUpdateAttendance,
    getShifts, saveShifts, findShiftById, addShift, updateShift, deleteShift,
    usersCountByShift, assignUserShift, getEffectiveSchedule, addMinutesToTime,
    getOfficeSettings, saveOfficeSettings, resetOfficeSettings, validateOfficeSettings,
    buildGoogleMapsUrl, DEFAULT_OFFICE_SETTINGS,
    getZoneEvents, zoneEventsByUser, activeZoneEventFor, createLocationEvent, resolveLocationEvent, setLocationEventReason, formatDuration,
    getPresenceMap, setPresence, getPresenceFor,
    getOutsideRequests, outsideRequestsByUser, pendingOutsideRequestFor, approvedOutsideRequestFor,
    submitOutsideRequest, decideOutsideRequest, consumeOutsideRequest, pendingOutsideRequestsCount,
    getLeave, leaveByUser, submitLeave, decideLeave,
    getOvertime, overtimeByUser, submitOvertime, decideOvertime,
    currentPeriod,
    getNotifications, addNotification, notificationsFor, unreadCount, markAllRead, markRead,
    getTheme, setTheme,
    getChatMessages, chatMembers, sendChatMessage, deleteChatMessage,
    markChatRead, chatLastReadAt, unreadChatCount,
    setChatTyping, clearChatTyping, getChatTyping,
    CHAT_IMAGE_MAX_BYTES
  };
})();
