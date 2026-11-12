/* ==========================================================================
   DEPO PRG — GENERATOR DATA DUMMY (v46)
   ==========================================================================
   Tujuan: mengisi aplikasi dengan data yang ramai & tampak nyata untuk uji
   performa dan uji tampilan SEBELUM data asli dipakai.

   Isi (kira-kira 2x lebih sibuk dari perusahaan kecil biasa):
   - 28 akun karyawan aktif + 5 pendaftaran menunggu persetujuan
   - 4 shift kerja, 9 departemen
   - Absensi 45 hari terakhir (±800 catatan) + absensi hari ini yang realistis
   - Cuti, lembur, izin absen luar lokasi, riwayat keluar area (zona)
   - Notifikasi admin & karyawan, obrolan grup (±250 pesan)

   Cara kerja:
   - Berjalan SEKALI per browser (penanda: rakabu_demo_v46). Data asli yang
     sudah ada tidak dihapus; hanya ditambah.
   - Matikan seluruhnya:  CONFIG.DEMO_DATA = false  (config.js)
     atau buka halaman dengan  ?demo=off
   - Muat ulang / hapus dari Admin > Pengaturan > "Data Dummy (uji performa)".
   - Semua catatan dummy memiliki id berawalan "demo_" atau userId LKN004+
     sehingga bisa dibedakan dan dihapus bersih.
   - Data dihasilkan dengan generator acak berbenih tetap (hasil selalu sama).
   ========================================================================== */
const DemoData = (function () {
  "use strict";

  const FLAG = "rakabu_demo_v46";
  const HISTORY_DAYS = 45;
  const DAY = 86400000;

  /* ---------- util ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rnd = mulberry32(46046);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + rnd() * (b - a);
  const intBetween = (a, b) => Math.floor(between(a, b + 1));
  const chance = (p) => rnd() < p;
  const pad = (n) => String(n).padStart(2, "0");
  const hhmm = (mins) => pad(Math.floor(mins / 60) % 24) + ":" + pad(Math.floor(mins % 60));
  const toMin = (s) => { const p = String(s).split(":").map(Number); return p[0] * 60 + (p[1] || 0); };
  const key = (d) => Store.localDateKey(d);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const isoDow = (d) => (d.getDay() === 0 ? 7 : d.getDay());
  let seq = 0;
  const did = (p) => "demo_" + p + "_" + (++seq).toString(36) + Math.floor(rnd() * 46656).toString(36);

  function read(k, fb) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch (e) { return fb; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.error("DemoData: gagal menyimpan", k, e); return false; } }

  /* ---------- master data ---------- */
  const EXTRA_SHIFTS = [
    { id: "SHIFT_GUDANG", name: "Shift Gudang (Distribusi)", start: "07:00", end: "15:00", days: [1, 2, 3, 4, 5, 6], color: "info", note: "Bongkar muat & distribusi harian." }
  ];

  // [nama, gelar, jabatan, departemen, shiftId]
  const PEOPLE = [
    ["Dewi Lestari", "", "Staff Admin", "Human Resources", "SHIFT_REGULER"],
    ["Agus Prasetyo", "", "Supervisor Kandang", "Operasional", "SHIFT_PAGI"],
    ["Rina Kartika", "S.E", "Staff Keuangan", "Keuangan", "SHIFT_REGULER"],
    ["Hendra Wijaya", "", "Operator Forklift", "Gudang", "SHIFT_GUDANG"],
    ["Maya Anggraini", "S.Kom", "Staff IT Support", "IT", "SHIFT_REGULER"],
    ["Fajar Nugroho", "", "Staff Kandang", "Operasional", "SHIFT_PAGI"],
    ["Lia Marlina", "", "Staff Kandang", "Operasional", "SHIFT_SIANG"],
    ["Yoga Pratama", "", "Checker Gudang", "Gudang", "SHIFT_GUDANG"],
    ["Nurul Hidayah", "S.Ak", "Akuntan", "Keuangan", "SHIFT_REGULER"],
    ["Dimas Saputra", "", "Sales Executive", "Marketing", "SHIFT_REGULER"],
    ["Wulan Sari", "", "Staff Marketing", "Marketing", "SHIFT_REGULER"],
    ["Eko Susanto", "", "Driver Distribusi", "Logistik", "SHIFT_GUDANG"],
    ["Rudi Hartono", "", "Driver Distribusi", "Logistik", "SHIFT_GUDANG"],
    ["Tono Sugiarto", "", "Kernet", "Logistik", "SHIFT_GUDANG"],
    ["Ayu Puspita", "S.Pt", "Quality Control", "Quality Control", "SHIFT_PAGI"],
    ["Bagas Setiawan", "", "Analis Mutu", "Quality Control", "SHIFT_REGULER"],
    ["Sari Wulandari", "", "Staff Kandang", "Operasional", "SHIFT_SIANG"],
    ["Joko Widodo Putra", "", "Staff Gudang Pakan", "Gudang", "SHIFT_GUDANG"],
    ["Citra Maharani", "S.H", "Staff Legal & Perizinan", "Human Resources", "SHIFT_REGULER"],
    ["Andi Firmansyah", "", "Security", "Keamanan", "SHIFT_PAGI"],
    ["Slamet Riyadi", "", "Security", "Keamanan", "SHIFT_SIANG"],
    ["Putri Ramadhani", "", "Staff Kandang", "Operasional", "SHIFT_PAGI"],
    ["Iwan Kurniawan", "", "Mekanik", "Operasional", "SHIFT_REGULER"],
    ["Tika Permata", "", "Staff Purchasing", "Keuangan", "SHIFT_REGULER"],
    ["Rizky Maulana", "", "Admin Gudang", "Gudang", "SHIFT_REGULER"],
    ["Hana Safitri", "", "Customer Service", "Marketing", "SHIFT_REGULER"],
    ["Ilham Ramadhan", "", "Staff Kandang", "Operasional", "SHIFT_SIANG"],
    ["Mega Utami", "", "Staff Logistik", "Logistik", "SHIFT_REGULER"]
  ];
  const PENDING_PEOPLE = [
    ["Galih Permana", "", "Staff Kandang", "Operasional", "SHIFT_PAGI"],
    ["Nia Rahmawati", "", "Staff Admin", "Keuangan", "SHIFT_REGULER"],
    ["Bayu Kusuma", "", "Driver Distribusi", "Logistik", "SHIFT_GUDANG"],
    ["Selvi Oktaviani", "S.Kom", "Staff IT", "IT", "SHIFT_REGULER"],
    ["Prasetyo Adi", "", "Checker Gudang", "Gudang", "SHIFT_GUDANG"]
  ];

  const LEAVE_REASONS = {
    "Cuti Tahunan": ["Liburan keluarga", "Acara pernikahan saudara", "Pulang kampung", "Mengurus keperluan pribadi", "Istirahat, kelelahan setelah periode sibuk"],
    "Cuti Sakit": ["Demam dan flu, surat dokter menyusul", "Sakit gigi, perlu perawatan", "Tifus, rawat jalan", "Kontrol dokter rutin", "Radang tenggorokan"],
    "Cuti Penting/Keluarga": ["Orang tua sakit", "Anak sakit, menemani di RS", "Mengurus KK dan KTP", "Wisuda adik", "Kedukaan keluarga"],
    "Tanpa Gaji": ["Urusan keluarga di luar kota", "Mengurus warisan"],
    "Cuti Melahirkan": ["Persalinan"]
  };
  const OT_TASKS = [
    ["Bongkar muat pakan", "Kedatangan truk pakan melebihi jadwal"],
    ["Stock opname bulanan", "Perhitungan stok akhir bulan"],
    ["Maintenance server", "Pembaruan sistem di luar jam kerja"],
    ["Rekap laporan keuangan", "Penutupan buku akhir bulan"],
    ["Pengiriman mendesak", "Permintaan pelanggan prioritas"],
    ["Perbaikan mesin pakan", "Mesin berhenti saat produksi"],
    ["Penyiapan audit", "Dokumen audit internal"],
    ["Pembersihan area gudang", "Persiapan inspeksi dinas"],
    ["Input data penjualan", "Backlog pesanan menumpuk"],
    ["Jaga area saat panen", "Kebutuhan pengamanan tambahan"]
  ];
  const OUTSIDE_REASONS = [
    "Mengantar barang ke pelanggan, belum sempat kembali ke kantor",
    "Ban kendaraan bocor di jalan, terlambat sampai kantor",
    "Meeting di kantor cabang lalu langsung pulang",
    "Sinyal GPS bergeser, posisi saya sebenarnya di depan pintu masuk",
    "Mengambil dokumen di kantor pos",
    "Membeli suku cadang mendesak untuk mesin",
    "Jalan Parung macet parah, masih di luar area",
    "Tugas lapangan ke kandang mitra"
  ];
  const ZONE_REASONS = [
    "Mengambil paket di gerbang depan",
    "Membeli makan siang di warung sebelah",
    "Mengecek truk pakan di area parkir luar",
    "Menemui supplier di depan gerbang",
    "Ke ATM dekat kantor",
    "Mengantar dokumen ke kantor desa",
    "Istirahat sholat di masjid sebelah"
  ];
  const CHAT_SCRIPT = [
    ["Pagi semuanya, jangan lupa absen sebelum jam 08.15 ya 🙏", "admin"],
    ["Pagi Pak, siap", 0], ["Pagi, baru sampai nih", 1], ["Truk pakan sudah masuk gerbang belakang ya", 2],
    ["Siap, tim gudang meluncur", 3], ["Ada yang lihat kunci forklift?", 4], ["Ada di meja checker Pak", 5],
    ["Terima kasih 👍", 4], ["Info: besok ada inspeksi dinas, mohon area kandang dirapikan", "admin"],
    ["Baik Pak, nanti sore kami bersihkan", 6], ["Siap Pak", 7], ["Shift siang jangan lupa serah terima ya", 8],
    ["Laporan stok sudah saya kirim ke email", 9], ["Oke Rina, nanti saya cek", "admin"],
    ["Pak, saya mau ajukan lembur hari Sabtu untuk bongkar muat", 10], ["Silakan ajukan lewat aplikasi, nanti saya setujui", "admin"],
    ["Sudah saya ajukan Pak 🙏", 10], ["Hujan deras di Parung, hati-hati di jalan semuanya", 11],
    ["Aamiin, terima kasih infonya", 12], ["GPS saya agak geser, absen masih ditolak. Gimana?", 13],
    ["Coba refresh lokasi dulu, kalau masih gagal ajukan izin di luar lokasi", "admin"], ["Berhasil Pak, terima kasih", 13],
    ["Rapat evaluasi mingguan jam 15.00 di ruang meeting", "admin"], ["Siap hadir", 14], ["Saya ikut online ya, lagi di gudang", 15],
    ["Yang sudah selesai input data penjualan tolong kabari", 16], ["Sudah selesai kak", 17], ["Mantap 👌", 16],
    ["Besok libur nasional? Jadwal shift gimana?", 18], ["Mengikuti kalender perusahaan, nanti saya umumkan lagi", "admin"]
  ];

  const LAT = -6.456874, LON = 106.729983;
  const ADDRESS = "Jl. Balai Desa Jabon Mekar, Parung, Kab. Bogor, Jawa Barat";

  /* ---------- pembangun data ---------- */
  function buildUsers(existing, now) {
    const used = new Set(existing.map((u) => u.id));
    const out = [];
    let n = 4;
    function mk(p, status) {
      let id; do { id = "LKN" + pad(Math.max(n, 0)).padStart(3, "0"); n++; } while (used.has(id));
      used.add(id);
      const first = p[0].split(" ")[0].toLowerCase();
      const last = p[0].split(" ").slice(-1)[0].toLowerCase();
      const joinYears = intBetween(0, 3);
      const join = new Date(Date.now() - intBetween(40, 365 * 3) * DAY);
      return {
        id, role: "employee", name: p[0], degree: p[1] || undefined, username: id,
        password: Store.hashPassword("123456"),
        email: first + "." + last + "@depoprg.co.id",
        phone: "0812" + String(intBetween(10000000, 99999999)),
        position: p[2], department: p[3], shiftId: p[4],
        status, joinDate: status === "active" ? key(join) : null,
        leaveQuota: 12, leaveUsed: 0,
        createdAt: status === "active" ? join.getTime() : now - intBetween(1, 5) * DAY - intBetween(0, 20) * 3600000,
        _demo: true, _y: joinYears
      };
    }
    PEOPLE.forEach((p) => out.push(mk(p, "active")));
    PENDING_PEOPLE.forEach((p) => out.push(mk(p, "pending")));
    out.forEach((u) => delete u._y);
    return out;
  }

  function personaFor(u) {
    // Sifat tiap karyawan: rajin, sering telat, sering izin, dst. — supaya rekap terlihat nyata.
    const r = rnd();
    return {
      late: r < 0.18 ? 0.30 : r < 0.5 ? 0.08 : 0.02,
      absent: r > 0.92 ? 0.07 : 0.015,
      sick: r > 0.8 ? 0.045 : 0.012,
      overtime: chance(0.4) ? 0.12 : 0.03,
      early: between(-12, 5) // rata-rata datang lebih awal(-) / mepet(+) dalam menit
    };
  }

  function buildLeave(users, now, today) {
    const leave = [], notifs = [];
    const emps = users.filter((u) => u.status === "active");
    emps.forEach((u) => {
      const count = intBetween(0, 3);
      for (let i = 0; i < count; i++) {
        const type = pick(["Cuti Tahunan", "Cuti Tahunan", "Cuti Sakit", "Cuti Penting/Keluarga", "Cuti Sakit", "Tanpa Gaji"]);
        const offset = intBetween(-40, 20);
        let start = addDays(today, offset);
        while (isoDow(start) > 5) start = addDays(start, 1);
        const len = type === "Cuti Sakit" ? intBetween(1, 3) : type === "Tanpa Gaji" ? intBetween(1, 2) : intBetween(1, 4);
        let end = addDays(start, len - 1);
        const sk = key(start), ek = key(end);
        const past = ek < key(today);
        const status = past ? (chance(0.9) ? "approved" : "rejected") : (sk <= key(today) ? "approved" : pick(["pending", "pending", "approved", "rejected"]));
        const created = Math.min(now - 3600000, start.getTime() - intBetween(1, 6) * DAY);
        const rec = {
          id: did("lv"), userId: u.id, type, startDate: sk, endDate: ek, days: len,
          reason: pick(LEAVE_REASONS[type]), status,
          note: status === "approved" ? pick(["Disetujui", "Disetujui, selamat beristirahat", "OK"]) : status === "rejected" ? pick(["Bertepatan dengan stok opname", "Kuota cuti tidak mencukupi", "Tim sedang kekurangan orang"]) : "",
          createdAt: created
        };
        leave.push(rec);
        if (status === "approved" && type === "Cuti Tahunan") u.leaveUsed = Math.min(12, (u.leaveUsed || 0) + len);
        notifs.push({ id: did("ntf"), audience: "admin", type: "leave", title: "Pengajuan cuti baru", message: `${u.name} mengajukan ${type} (${len} hari).`, read: created < now - 3 * DAY || status !== "pending", createdAt: created, refId: rec.id });
        if (status !== "pending") {
          notifs.push({ id: did("ntf"), audience: u.id, type: "leave", title: status === "approved" ? "Cuti disetujui" : "Cuti ditolak", message: `Pengajuan ${type} Anda ${status === "approved" ? "disetujui" : "ditolak"}.` + (rec.note ? " Catatan: " + rec.note : ""), read: created < now - 2 * DAY, createdAt: created + intBetween(1, 20) * 3600000 });
        }
      }
    });
    return { leave, notifs };
  }

  function buildAttendance(users, leaveList, now, today, shiftMap, existingKeys) {
    const att = [], notifs = [];
    const emps = users.filter((u) => u.status === "active");
    const todayKey = key(today);
    const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
    emps.forEach((u) => {
      const sh = shiftMap[u.shiftId] || shiftMap.SHIFT_REGULER;
      const startMin = toMin(sh.start), endMin = toMin(sh.end);
      const lateAfter = startMin + 15;
      const pers = personaFor(u);
      for (let i = HISTORY_DAYS; i >= 0; i--) {
        const d = addDays(today, -i);
        const dk = key(d);
        if (u.joinDate && u.joinDate > dk) continue;
        if (!sh.days.includes(isoDow(d))) continue;
        if (existingKeys.has(u.id + "|" + dk)) continue;
        const onLeave = leaveList.some((l) => l.userId === u.id && l.status === "approved" && dk >= l.startDate && dk <= l.endDate);
        if (onLeave) continue;
        const isToday = i === 0;
        if (isToday && nowMin < startMin - 20) continue;           // shift belum mulai
        if (chance(pers.absent) && !isToday) continue;             // alpa
        if (chance(pers.sick) && !isToday) {                       // izin (tanpa surat cuti)
          att.push({ id: did("att"), userId: u.id, date: dk, checkIn: null, checkOut: null, status: "izin", note: "Izin sakit (dibuat admin)", adminEdited: true });
          continue;
        }
        const late = chance(pers.late);
        let inMin = late ? lateAfter + intBetween(1, 55) : startMin + Math.round(pers.early + between(-14, 6));
        if (!late && inMin > lateAfter) inMin = lateAfter - intBetween(0, 4);
        if (isToday) {
          if (inMin > nowMin) { if (nowMin > lateAfter) { continue; } inMin = Math.max(startMin - 15, nowMin - intBetween(1, 15)); }
        }
        const worked = (isToday && nowMin < endMin) ? null : endMin + (chance(pers.overtime) ? intBetween(30, 150) : intBetween(-3, 16));
        const outMin = worked != null && (!isToday || worked <= nowMin) ? worked : null;
        const dist = Math.round(between(0.4, 8.8) * 10) / 10;
        const rec = {
          id: did("att"), userId: u.id, date: dk, checkIn: hhmm(inMin), checkOut: outMin != null ? hhmm(outMin) : null,
          status: inMin > lateAfter ? "terlambat" : "hadir",
          checkInDistance: dist, checkInAccuracy: Math.round(between(4, 22)),
          checkInLat: LAT + between(-0.00006, 0.00006), checkInLon: LON + between(-0.00006, 0.00006),
          checkInAddress: ADDRESS, checkInHeading: Math.round(between(0, 359)),
          checkInPhoto: null, checkInPhotoCode: "DPR-" + dk.replace(/-/g, "").slice(2) + "-" + u.id.slice(3) + "I"
        };
        if (outMin != null) {
          rec.checkOutDistance = Math.round(between(0.5, 9.2) * 10) / 10;
          rec.checkOutAccuracy = Math.round(between(4, 24));
          rec.checkOutAddress = ADDRESS;
          rec.checkOutPhoto = null;
          rec.checkOutPhotoCode = "DPR-" + dk.replace(/-/g, "").slice(2) + "-" + u.id.slice(3) + "O";
        }
        att.push(rec);
      }
    });
    return { att, notifs };
  }

  function buildOvertime(users, now, today) {
    const list = [], notifs = [];
    const emps = users.filter((u) => u.status === "active");
    emps.forEach((u) => {
      const count = chance(0.55) ? intBetween(1, 4) : 0;
      for (let i = 0; i < count; i++) {
        const off = -intBetween(0, 38);
        const d = addDays(today, off);
        const t = pick(OT_TASKS);
        const sh = u.shiftId === "SHIFT_SIANG" ? ["22:00", "00:00"] : u.shiftId === "SHIFT_PAGI" ? ["14:00", "17:00"] : u.shiftId === "SHIFT_GUDANG" ? ["15:00", "18:00"] : ["17:00", "19:30"];
        const startM = toMin(sh[0]) + pick([0, 15, 30]);
        const dur = pick([1, 1.5, 2, 2, 2.5, 3, 3.5]);
        const status = off > -2 ? pick(["pending", "pending", "approved"]) : (chance(0.88) ? "approved" : "rejected");
        const created = d.getTime() + 12 * 3600000;
        const rec = {
          id: did("ot"), userId: u.id, date: key(d), startTime: hhmm(startM), endTime: hhmm(startM + dur * 60), duration: dur,
          reason: `${t[0]} — ${t[1]}`, status,
          note: status === "approved" ? pick(["Disetujui", "OK, terima kasih", "Disetujui sesuai kebutuhan"]) : status === "rejected" ? pick(["Pekerjaan bisa diselesaikan di jam kerja", "Tidak ada permintaan atasan"]) : "",
          createdAt: Math.min(created, now - 60000)
        };
        list.push(rec);
        notifs.push({ id: did("ntf"), audience: "admin", type: "overtime", title: "Pengajuan lembur baru", message: `${u.name} mengajukan lembur ${dur} jam pada ${rec.date}.`, read: status !== "pending", createdAt: rec.createdAt, refId: rec.id });
        if (status !== "pending") notifs.push({ id: did("ntf"), audience: u.id, type: "overtime", title: status === "approved" ? "Lembur disetujui" : "Lembur ditolak", message: `Pengajuan lembur Anda ${status === "approved" ? "disetujui" : "ditolak"}.` + (rec.note ? " Catatan: " + rec.note : ""), read: off < -3, createdAt: rec.createdAt + 3 * 3600000 });
      }
    });
    return { list, notifs };
  }

  function buildOutside(users, now, today) {
    const list = [], notifs = [];
    const emps = users.filter((u) => u.status === "active");
    const n = 26;
    for (let i = 0; i < n; i++) {
      const u = pick(emps);
      const off = i < 3 ? 0 : -intBetween(0, 30);
      const d = addDays(today, off);
      const type = chance(0.65) ? "check-in" : "check-out";
      const status = off === 0 ? "pending" : (chance(0.75) ? "approved" : chance(0.5) ? "rejected" : "pending");
      const created = off === 0 ? now - intBetween(5, 120) * 60000 : d.getTime() + intBetween(7, 17) * 3600000;
      const dist = Math.round(between(12, 480) * 10) / 10;
      const rec = {
        id: did("out"), userId: u.id, type, date: key(d), distance: dist, accuracy: Math.round(between(5, 25)),
        lat: LAT + between(-0.004, 0.004), lon: LON + between(-0.004, 0.004),
        reason: pick(OUTSIDE_REASONS), status,
        note: status === "approved" ? "Disetujui" : status === "rejected" ? pick(["Tidak ada surat tugas", "Silakan absen di kantor"]) : "",
        createdAt: created, decidedAt: status === "pending" ? null : created + intBetween(3, 90) * 60000,
        usedAt: status === "approved" ? created + intBetween(100, 800) * 1000 : null
      };
      list.push(rec);
      const label = type === "check-in" ? "Absen Masuk" : "Absen Pulang";
      notifs.push({ id: did("ntf"), audience: "admin", type: "outside", title: "📍 Izin absen di luar lokasi", message: `${u.name} meminta izin ${label} di luar radius (±${dist.toFixed(1)} m dari kantor).`, read: status !== "pending", createdAt: created, refId: rec.id });
      if (status !== "pending") notifs.push({ id: did("ntf"), audience: u.id, type: "outside", title: status === "approved" ? "✅ Izin lokasi disetujui" : "❌ Izin lokasi ditolak", message: `Permintaan ${label} di luar lokasi Anda ${status === "approved" ? "disetujui. Silakan coba absen lagi." : "ditolak."}` + (rec.note ? " Catatan: " + rec.note : ""), read: true, createdAt: rec.decidedAt });
    }
    return { list, notifs };
  }

  function buildZones(users, now, today) {
    const list = [], notifs = [];
    const emps = users.filter((u) => u.status === "active");
    for (let i = 0; i < 34; i++) {
      const u = pick(emps);
      const off = i < 2 ? 0 : -intBetween(0, 35);
      const d = addDays(today, off);
      let since = new Date(d.getFullYear(), d.getMonth(), d.getDate(), intBetween(9, 15), intBetween(0, 59)).getTime();
      if (off === 0 && since > now - 15 * 60000) since = now - intBetween(16, 90) * 60000;
      const reached = since + 10 * 60000;
      const active = off === 0 && i === 0;
      const dist = Math.round(between(16, 140) * 10) / 10;
      const returned = active ? null : reached + intBetween(3, 40) * 60000;
      const reason = active ? null : (chance(0.85) ? pick(ZONE_REASONS) : null);
      const rec = {
        id: did("zone"), userId: u.id, status: active ? "active" : "resolved",
        outsideSince: since, reachedAt: reached, returnedAt: returned,
        lastLat: LAT + between(-0.0012, 0.0012), lastLon: LON + between(-0.0012, 0.0012), lastDistance: dist, lastAccuracy: Math.round(between(5, 25)),
        reason, reasonAt: reason ? reached + intBetween(20, 200) * 1000 : null, createdAt: reached
      };
      list.push(rec);
      notifs.push({ id: did("ntf"), audience: "admin", type: "zone", title: "⚠️ Peringatan Lokasi", message: `${u.name} berada di luar area kerja selama ${CONFIG.OUTSIDE_AREA_MINUTES} menit. Jarak terakhir: ${dist.toFixed(1)} m dari kantor.`, read: off < -1, createdAt: reached, refId: rec.id });
      if (reason) notifs.push({ id: did("ntf"), audience: "admin", type: "zone", title: "💬 Alasan Keluar Area", message: `${u.name}: "${reason}"`, read: off < -1, createdAt: rec.reasonAt, refId: rec.id });
      if (returned) notifs.push({ id: did("ntf"), audience: "admin", type: "zone", title: "Kembali ke Area Kerja", message: `${u.name} kembali ke area kerja.`, read: off < -1, createdAt: returned, refId: rec.id });
    }
    return { list, notifs };
  }

  function buildMisc(users, now, today) {
    const notifs = [];
    const emps = users.filter((u) => u.status === "active");
    // Pendaftaran menunggu
    users.filter((u) => u.status === "pending").forEach((u) => {
      notifs.push({ id: did("ntf"), audience: "admin", type: "registration", title: "Pendaftaran karyawan baru", message: `${u.name} mendaftar sebagai ${u.position}.`, read: false, createdAt: u.createdAt, refId: u.id });
    });
    // Info umum admin
    const adminInfo = [
      ["info", "Cadangan data otomatis", "Cadangan data harian berhasil dibuat.", 0.2],
      ["info", "Rekap bulan lalu siap", "Laporan absensi bulan lalu sudah bisa diunduh di menu Laporan.", 2],
      ["info", "Pembaruan sistem", "Aplikasi diperbarui ke versi terbaru (v46).", 3],
      ["info", "Radius absensi", "Pengaturan lokasi kantor diperiksa dan masih sesuai.", 6],
      ["info", "Pengingat gaji", "Rekap kehadiran bulan berjalan dipakai untuk perhitungan gaji tanggal 25.", 9]
    ];
    adminInfo.forEach((a) => notifs.push({ id: did("ntf"), audience: "admin", type: a[0], title: a[1], message: a[2], read: a[3] > 1, createdAt: now - a[3] * DAY }));
    // Notifikasi karyawan: sambutan, pengumuman, pengingat
    emps.forEach((u) => {
      notifs.push({ id: did("ntf"), audience: u.id, type: "info", title: "Selamat datang di PT. Depo PRG", message: "Akun Anda telah aktif. Selamat bekerja!", read: true, createdAt: Date.parse(u.joinDate || "2024-01-01") });
      const n = intBetween(2, 5);
      const pool = [
        ["info", "Pengumuman", "Besok ada inspeksi dinas. Mohon area kerja dirapikan."],
        ["info", "Pengingat absen", "Jangan lupa absen pulang sebelum meninggalkan area kantor."],
        ["info", "Jadwal berubah", "Jadwal shift minggu depan telah diperbarui oleh HR."],
        ["info", "Rapat evaluasi", "Rapat evaluasi mingguan hari Jumat pukul 15.00."],
        ["info", "Sisa cuti", "Cek sisa cuti tahunan Anda di menu Cuti."],
        ["info", "Slip kehadiran", "Rekap kehadiran bulan lalu sudah tersedia di Riwayat."]
      ];
      for (let i = 0; i < n; i++) { const p = pick(pool); notifs.push({ id: did("ntf"), audience: u.id, type: p[0], title: p[1], message: p[2], read: chance(0.6), createdAt: now - intBetween(1, 30) * DAY - intBetween(0, 20) * 3600000 }); }
    });
    return notifs;
  }

  function buildChat(users, now, today) {
    const msgs = [];
    const active = users.filter((u) => u.role === "admin" || u.status === "active");
    const admin = users.find((u) => u.role === "admin") || { id: "ADM001", name: "Admin Depo PRG", role: "admin" };
    const emps = active.filter((u) => u.role === "employee");
    const chatters = emps.slice(0, 20);
    const days = 9;
    let t = now - days * DAY;
    // Kumpulkan pesan skrip diulang acak ke dalam ~9 hari, jam kerja saja.
    const extras = ["Siap", "Oke", "👍", "Terima kasih", "Noted", "Baik Pak/Bu", "Sudah saya cek", "Sedang di jalan", "Mohon info lanjut", "Laporan sudah dikirim", "Izin telat 15 menit, macet", "Sudah sampai kantor", "Cuaca hujan, hati-hati", "Ada kendala di gudang, cek ya"];
    const target = 250;
    let guard = 0;
    while (msgs.length < target && guard++ < 5000) {
      const dayOffset = Math.floor((msgs.length / target) * days);
      const base = new Date(now - (days - dayOffset) * DAY);
      const ts = new Date(base.getFullYear(), base.getMonth(), base.getDate(), intBetween(7, 20), intBetween(0, 59), intBetween(0, 59)).getTime();
      if (ts > now - 30000) { t = now - msgs.length * 1000; }
      const scripted = chance(0.55);
      let text, sender;
      if (scripted) {
        const s = pick(CHAT_SCRIPT);
        text = s[0]; sender = s[1] === "admin" ? admin : chatters[s[1] % chatters.length];
      } else { text = pick(extras); sender = pick(chatters); }
      msgs.push({ id: did("msg"), senderId: sender.id, senderName: sender.name, senderRole: sender.role, text, image: null, createdAt: Math.min(ts, now - 20000), readBy: [] });
    }
    msgs.sort((a, b) => a.createdAt - b.createdAt);
    const memberIds = active.map((u) => u.id);
    msgs.forEach((m, i) => {
      const age = now - m.createdAt;
      // Pesan lama dibaca hampir semua orang; pesan terbaru dibaca sebagian.
      const readers = age > 2 * DAY ? memberIds : memberIds.filter(() => chance(Math.min(0.95, 0.35 + age / (2 * DAY))));
      m.readBy = Array.from(new Set([m.senderId].concat(readers)));
    });
    return msgs;
  }

  /* ---------- orkestrasi ---------- */
  function isEnabled() {
    try {
      if (typeof CONFIG !== "undefined" && CONFIG.DEMO_DATA === false) return false;
      if (/[?&]demo=off\b/.test(location.search)) return false;
    } catch (e) {}
    return true;
  }
  function isLoaded() { return !!read(FLAG, null); }
  function wasCleared() { try { return localStorage.getItem(FLAG + "_cleared") === "1"; } catch (e) { return false; } }

  function load(opts) {
    opts = opts || {};
    if (typeof Store === "undefined") return false;
    try { localStorage.removeItem(FLAG + "_cleared"); } catch (e) {}
    rnd = mulberry32(46046); seq = 0;
    const t0 = (typeof performance !== "undefined") ? performance.now() : 0;
    const now = Date.now();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // 1. Shift
    const shifts = Store.getShifts();
    EXTRA_SHIFTS.forEach((s) => { if (!shifts.some((x) => x.id === s.id)) shifts.push(Object.assign({}, s, { createdAt: now - 300 * DAY, _demo: true })); });
    Store.saveShifts(shifts);
    const shiftMap = {}; shifts.forEach((s) => { shiftMap[s.id] = s; });

    // 2. Pengguna
    const existingUsers = Store.getUsers();
    const demoUsers = buildUsers(existingUsers, now);
    const allUsers = existingUsers.concat(demoUsers);
    // Karyawan lama (LKN001/002) ikut diberi riwayat absensi.
    const attendanceUsers = allUsers.filter((u) => u.role === "employee");

    // 3. Cuti (dibuat dulu agar absensi menghindari hari cuti)
    const lv = buildLeave(attendanceUsers, now, today);
    const existingLeave = Store.getLeave();
    const leaveAll = existingLeave.concat(lv.leave);

    // 4. Absensi
    const existingAtt = Store.getAttendance();
    const existingKeys = new Set(existingAtt.map((a) => a.userId + "|" + a.date));
    const at = buildAttendance(attendanceUsers, leaveAll, now, today, shiftMap, existingKeys);
    const attAll = existingAtt.concat(at.att);

    // 5. Lembur, izin lokasi, zona, lain-lain
    const ot = buildOvertime(attendanceUsers, now, today);
    const out = buildOutside(attendanceUsers, now, today);
    const zn = buildZones(attendanceUsers, now, today);
    const misc = buildMisc(allUsers, now, today);
    const chat = buildChat(allUsers, now, today);

    // 6. Presence karyawan yang sedang bekerja (untuk Monitoring)
    const presence = Store.getPresenceMap();
    const todayKey = key(today);
    at.att.filter((a) => a.date === todayKey && a.checkIn && !a.checkOut).forEach((a) => {
      presence[a.userId] = { userId: a.userId, updatedAt: now - intBetween(5, 90) * 1000, lat: LAT + between(-0.00007, 0.00007), lon: LON + between(-0.00007, 0.00007), distance: Math.round(between(0.5, 9) * 10) / 10, accuracy: Math.round(between(4, 20)), inside: true, _demo: true };
    });

    // 7. Tulis semuanya
    const K = Store.KEYS;
    write(K.users, allUsers);
    write(K.attendance, attAll);
    write(K.leave, leaveAll);
    write(K.overtime, Store.getOvertime().concat(ot.list));
    write(K.outsideRequests, Store.getOutsideRequests().concat(out.list).sort((a, b) => b.createdAt - a.createdAt));
    write(K.zoneEvents, Store.getZoneEvents().concat(zn.list).sort((a, b) => b.createdAt - a.createdAt));
    const notifAll = Store.getNotifications().concat(lv.notifs, at.notifs, ot.notifs, out.notifs, zn.notifs, misc)
      .sort((a, b) => b.createdAt - a.createdAt);
    write(K.notifications, notifAll);
    write(K.chatMessages, Store.getChatMessages().concat(chat).slice(-300));
    write(K.presence, presence);
    // Pesan chat terbaru dianggap belum dibaca oleh akun demo bawaan (supaya badge tampil)
    const reads = read(K.chatReads, {});
    reads["ADM001"] = now - 5 * 3600000; reads["LKN001"] = now - 7 * 3600000;
    write(K.chatReads, reads);

    write(FLAG, { at: now, users: demoUsers.length, attendance: at.att.length, leave: lv.leave.length, overtime: ot.list.length, outside: out.list.length, zones: zn.list.length, notifications: notifAll.length, chat: chat.length });
    if (!opts.silent && window.console) console.info("[DemoData] selesai dalam " + Math.round((performance.now() - t0)) + " ms", read(FLAG, {}));
    return true;
  }

  function clear() {
    try { localStorage.setItem(FLAG + "_cleared", "1"); } catch (e) {}
    const K = Store.KEYS;
    const isDemo = (x) => x && ((typeof x.id === "string" && x.id.indexOf("demo_") === 0) || x._demo === true);
    const demoUserIds = new Set(Store.getUsers().filter((u) => u._demo).map((u) => u.id));
    const keepRec = (x) => !isDemo(x) && !demoUserIds.has(x.userId);
    write(K.users, Store.getUsers().filter((u) => !u._demo));
    write(K.shifts, Store.getShifts().filter((s) => !s._demo));
    write(K.attendance, Store.getAttendance().filter(keepRec));
    write(K.leave, Store.getLeave().filter(keepRec));
    write(K.overtime, Store.getOvertime().filter(keepRec));
    write(K.outsideRequests, Store.getOutsideRequests().filter(keepRec));
    write(K.zoneEvents, Store.getZoneEvents().filter(keepRec));
    write(K.notifications, Store.getNotifications().filter((n) => !isDemo(n) && !demoUserIds.has(n.audience)));
    write(K.chatMessages, Store.getChatMessages().filter((m) => !isDemo(m)));
    const pr = Store.getPresenceMap(); Object.keys(pr).forEach((k) => { if (demoUserIds.has(k) || (pr[k] && pr[k]._demo)) delete pr[k]; });
    write(K.presence, pr);
    // Riwayat absensi LKN001/LKN002 buatan generator ikut dibuang (id berawalan demo_ sudah tersaring).
    try { localStorage.removeItem(FLAG); } catch (e) {}
  }

  function stats() { return read(FLAG, null); }

  // Pemasangan awal: sebelum UI (auth.js/admin.js/employee.js) dimuat.
  try {
    if (isEnabled() && !isLoaded() && !wasCleared() && typeof Store !== "undefined") load({ silent: false });
  } catch (e) { console.error("DemoData gagal dijalankan:", e); }

  /* ---------- kartu di Admin > Pengaturan ---------- */
  function renderCard() {
    const box = document.getElementById("demo-data-stats");
    if (!box) return;
    const st = stats();
    const rows = st ? [
      ["Karyawan dummy", st.users], ["Absensi", st.attendance], ["Cuti", st.leave], ["Lembur", st.overtime],
      ["Izin lokasi", st.outside], ["Riwayat zona", st.zones], ["Notifikasi", st.notifications], ["Pesan chat", st.chat]
    ] : [];
    box.innerHTML = rows.length ? rows.map((r) => "<li><span>" + r[0] + "</span><b>" + r[1] + "</b></li>").join("") : "<li style='grid-column:1/-1'>Belum ada data dummy dimuat.</li>";
    const clr = document.getElementById("demo-clear-btn"); if (clr) clr.disabled = !st;
    const rel = document.getElementById("demo-reload-btn"); if (rel) rel.textContent = st ? "Muat ulang data dummy" : "Muat data dummy";
  }
  function bindCard() {
    const rel = document.getElementById("demo-reload-btn"), clr = document.getElementById("demo-clear-btn");
    if (!rel || !clr) return;
    rel.addEventListener("click", function () {
      if (!window.confirm("Data dummy lama akan dibuat ulang. Lanjutkan?")) return;
      rel.disabled = true; rel.textContent = "Memuat…";
      setTimeout(function () { try { if (isLoaded()) clear(); load(); } finally { location.reload(); } }, 30);
    });
    clr.addEventListener("click", function () {
      if (!window.confirm("Hapus semua data dummy? Akun & data asli tidak dihapus.")) return;
      clear();
      try { sessionStorage.setItem("rakabu_demo_off", "1"); } catch (e) {}
      location.reload();
    });
    renderCard();
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindCard); else bindCard();
  }

  return { load, clear, stats, isLoaded, FLAG };
})();
