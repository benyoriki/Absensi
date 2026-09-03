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
    salary: "rakabu_salary",
    zoneEvents: "rakabu_zone_events",
    session: "rakabu_session",
    theme: "rakabu_theme",
    seeded: "rakabu_seeded_v1"
  };

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
        username: "LKN001",
        password: hashPassword("123456"),
        email: "riki.hermawan@rakabusapikita.co.id",
        phone: "081234567890",
        position: "Staff IT",
        department: "IT",
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
        title: "Selamat datang di Rakabu Attendance",
        message: "Akun Anda telah aktif. Selamat bekerja!",
        read: true, createdAt: now - 300 * day
      }
    ];

    const salary = [
      {
        id: uid("sal"), userId: "LKN001", period: currentPeriod(),
        basicSalary: 5500000, allowance: 750000, overtimePay: 300000,
        deduction: 150000, bonus: 0, status: "unpaid"
      },
      {
        id: uid("sal"), userId: "LKN002", period: currentPeriod(),
        basicSalary: 4800000, allowance: 600000, overtimePay: 0,
        deduction: 100000, bonus: 200000, status: "paid"
      }
    ];

    write(KEYS.users, users);
    write(KEYS.attendance, attendance);
    write(KEYS.leave, leave);
    write(KEYS.overtime, overtime);
    write(KEYS.notifications, notifications);
    write(KEYS.salary, salary);
    write(KEYS.zoneEvents, []);
    write(KEYS.seeded, true);
  }

  function todayKeyOffset(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
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
    if (users.some(u => u.username.toLowerCase() === data.username.toLowerCase())) {
      return { ok: false, error: "ID Karyawan sudah terdaftar. Gunakan ID lain atau hubungi admin." };
    }
    if (users.some(u => u.email && u.email.toLowerCase() === data.email.toLowerCase())) {
      return { ok: false, error: "Email sudah terdaftar." };
    }
    const newUser = {
      id: data.username,
      role: "employee",
      name: data.name,
      username: data.username,
      password: hashPassword(data.password),
      email: data.email,
      phone: data.phone,
      position: data.position,
      department: data.department,
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
    updateUser(userId, { status: "active", joinDate: new Date().toISOString().slice(0, 10) });
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
    const key = new Date().toISOString().slice(0, 10);
    return getAttendance().find(a => a.userId === userId && a.date === key) || null;
  }

  function checkIn(userId, meta) {
    const list = getAttendance();
    const dateKey = new Date().toISOString().slice(0, 10);
    let record = list.find(a => a.userId === userId && a.date === dateKey);
    const timeStr = new Date().toTimeString().slice(0, 5);
    const isLate = timeStr > "08:15";
    if (!record) {
      record = {
        id: uid("att"), userId, date: dateKey, checkIn: timeStr, checkOut: null,
        status: isLate ? "terlambat" : "hadir",
        checkInDistance: meta.distance, checkInAccuracy: meta.accuracy,
        checkInLat: meta.lat, checkInLon: meta.lon
      };
      list.push(record);
    } else {
      record.checkIn = timeStr;
      record.status = isLate ? "terlambat" : "hadir";
      record.checkInDistance = meta.distance;
    }
    saveAttendanceList(list);
    return record;
  }

  function checkOut(userId, meta) {
    const list = getAttendance();
    const dateKey = new Date().toISOString().slice(0, 10);
    let record = list.find(a => a.userId === userId && a.date === dateKey);
    const timeStr = new Date().toTimeString().slice(0, 5);
    if (!record) return null;
    record.checkOut = timeStr;
    record.checkOutDistance = meta.distance;
    record.checkOutAccuracy = meta.accuracy;
    saveAttendanceList(list);
    return record;
  }

  function attendanceByUser(userId) {
    return getAttendance().filter(a => a.userId === userId).sort((a, b) => b.date.localeCompare(a.date));
  }

  /* ------------------------------------------------------------------ */
  /* ZONE / GEOFENCE EVENTS (karyawan keluar area kerja)                */
  /* ------------------------------------------------------------------ */
  function getZoneEvents() { return read(KEYS.zoneEvents, []); }
  function addZoneEvent(evt) {
    const list = getZoneEvents();
    const record = Object.assign({ id: uid("zone"), createdAt: Date.now(), reasonGiven: false }, evt);
    list.unshift(record);
    write(KEYS.zoneEvents, list);
    return record;
  }
  function updateZoneEvent(id, patch) {
    const list = getZoneEvents();
    const idx = list.findIndex(z => z.id === id);
    if (idx === -1) return null;
    list[idx] = Object.assign({}, list[idx], patch);
    write(KEYS.zoneEvents, list);
    return list[idx];
  }
  function submitZoneReason(id, reason, distance, durationSec) {
    const updated = updateZoneEvent(id, { reasonGiven: true, reason, distance, durationSec });
    if (updated) {
      const user = findUserById(updated.userId);
      addNotification({
        audience: "admin", type: "zone",
        title: (user ? user.name : updated.userId) + " keluar area kerja",
        message: `Durasi: ${formatDuration(durationSec)} — Jarak maksimum: ${distance.toFixed(1)} m — Alasan: ${reason}`,
        refId: updated.id
      });
    }
    return updated;
  }
  function formatDuration(sec) {
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return `${m} menit ${s} detik`;
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
  /* SALARY (dummy)                                                     */
  /* ------------------------------------------------------------------ */
  function getSalary() { return read(KEYS.salary, []); }
  function salaryByUser(userId) { return getSalary().filter(s => s.userId === userId); }

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
  /* THEME                                                              */
  /* ------------------------------------------------------------------ */
  function getTheme() { return read(KEYS.theme, null); }
  function setTheme(t) { write(KEYS.theme, t); }

  seedIfNeeded();

  return {
    KEYS, uid, hashPassword,
    getUsers, saveUsers, findUserByUsername, findUserById, registerEmployee,
    login, logout, currentUser, getSession, updateUser, approveUser, rejectUser, setUserStatus,
    getAttendance, getTodayRecord, checkIn, checkOut, attendanceByUser,
    getZoneEvents, addZoneEvent, updateZoneEvent, submitZoneReason, formatDuration,
    getLeave, leaveByUser, submitLeave, decideLeave,
    getOvertime, overtimeByUser, submitOvertime, decideOvertime,
    getSalary, salaryByUser, currentPeriod,
    getNotifications, addNotification, notificationsFor, unreadCount, markAllRead, markRead,
    getTheme, setTheme
  };
})();
