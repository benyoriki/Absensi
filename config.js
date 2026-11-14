/* ==========================================================================
   DEPO PRG ATTENDANCE — KONFIGURASI GLOBAL (v9)
   ==========================================================================
   Satu-satunya tempat untuk mengubah aturan absensi. Jangan menduplikasi
   angka radius/durasi di file lain — semua file (geo.js, employee.js,
   admin.js) WAJIB membaca nilai dari CONFIG di bawah ini.

   CARA MENGUBAH KOORDINAT KANTOR:
   1. Buka lokasi kantor di Google Maps (desktop/HP).
   2. Klik-kanan (desktop) atau tekan-tahan (HP) tepat pada titik kantor,
      lalu salin koordinat yang muncul (format: -x.xxxxxx, y.yyyyyy).
   3. Ganti CONFIG.OFFICE_LOCATION.latitude / .longitude di bawah ini.
   Catatan: Google Maps short-link (maps.app.goo.gl/...) tidak bisa
   di-resolve menjadi latitude/longitude langsung dari JavaScript sisi
   browser (dibatasi cross-origin), jadi koordinat harus diisi manual.

   DUA RADIUS YANG BERBEDA (PENTING, jangan disamakan):
   1. ATTENDANCE_RADIUS — radius untuk Absen Masuk & Absen Pulang. Karyawan
      HANYA bisa menekan tombol absen jika berada dalam radius ini dari
      titik kantor.
   2. OUTSIDE_AREA_RADIUS — radius area kerja setelah absen masuk. Selama
      karyawan masih di dalam radius ini, statusnya aman/normal. Begitu
      karyawan berada DI LUAR radius ini selama OUTSIDE_AREA_MINUTES penuh
      TANPA PUTUS, sistem akan membunyikan alarm + notifikasi, lalu
      meminta karyawan mengisi alasan (dikirim ke Dashboard Admin).
   OUTSIDE_AREA_RADIUS sengaja dibuat LEBIH LONGGAR daripada
   ATTENDANCE_RADIUS, supaya karyawan tidak dianggap "keluar area" hanya
   karena berpindah dalam kompleks kantor.
   ========================================================================== */

const CONFIG = {
  // Titik absen — pin Google Maps dari pemilik (v47):
  // https://maps.app.goo.gl/pZUmxACbiEQcC6wW6  → pin koordinat langsung
  // -6.4590039, 106.7308313 (bukan listing bisnis, jadi titiknya persis di
  // tempat pin dijatuhkan). Jarak ke koordinat lama = ±254,6 m, sama persis
  // dengan angka di screenshot absen — tanda koordinat lama memang salah.
  // Bisa dikoreksi kapan saja: Admin > Pengaturan > Ubah Lokasi Kantor >
  // "Kalibrasi di Lokasi" atau tempel koordinat dari Google Maps.
  OFFICE_LOCATION: {
    latitude: -6.4590039,
    longitude: 106.7308313
  },
  OFFICE_MAPS_URL: "https://maps.app.goo.gl/pZUmxACbiEQcC6wW6?g_st=ac",

  // true = koordinat sudah diverifikasi. Jika false, dasbor admin menampilkan
  // peringatan "titik kantor belum terkalibrasi" (lihat admin.js).
  OFFICE_CALIBRATED: true,

  // Naikkan angka ini setiap kali titik/radius di atas diubah lewat file ini,
  // supaya pengaturan lama yang tersimpan di HP/browser otomatis diabaikan.
  SETTINGS_VERSION: 4,

  // ---- RADIUS & TOLERANSI JARAK (v47) -------------------------------------
  // Praktik umum geofence absensi: radius dasar 25–50 m + toleransi yang
  // mengikuti akurasi GPS perangkat. GPS HP di luar ruangan biasanya ±5–20 m,
  // di dalam bangunan ±20–50 m, sehingga radius 10 m membuat karyawan yang
  // sebenarnya sudah di kantor sering ditolak.
  //
  // Aturan keputusan (lihat evaluateLocation di geo.js):
  //   jarak <= ATTENDANCE_RADIUS                      → DI DALAM (valid)
  //   jarak - bonus <= ATTENDANCE_RADIUS              → DI DALAM (toleransi GPS)
  //   selain itu                                      → DI LUAR RADIUS
  //   bonus = min(akurasi × GPS_TOLERANCE_FACTOR, GPS_TOLERANCE_MAX)
  //   akurasi > MAX_ACCEPTABLE_ACCURACY               → DITOLAK (sinyal lemah)
  // Jadi batas terjauh yang pernah diterima = radius + GPS_TOLERANCE_MAX.

  // Radius dasar absen masuk & pulang (meter).
  ATTENDANCE_RADIUS: 30,

  // Seberapa besar akurasi GPS dikreditkan sebagai toleransi (0–1). 0.5 =
  // separuh dari angka akurasi (±20 m → bonus 10 m). Konservatif supaya
  // tidak mudah dimanfaatkan.
  GPS_TOLERANCE_FACTOR: 0.5,

  // Batas maksimum bonus toleransi (meter), berapa pun buruknya akurasi.
  GPS_TOLERANCE_MAX: 20,

  // Radius area kerja (meter) SETELAH absen masuk. Berbeda & lebih longgar
  // dari ATTENDANCE_RADIUS di atas — lihat penjelasan di header file ini.
  OUTSIDE_AREA_RADIUS: 60,

  // Akurasi GPS ≤ ini dianggap "baik" (label hijau).
  GOOD_ACCURACY: 20,

  // Akurasi GPS lebih buruk dari ini (meter) DITOLAK saat absen. Pembacaan
  // GPS dikumpulkan beberapa kali (lihat samplePosition) sehingga akurasi
  // akhir biasanya jauh lebih baik dari satu pembacaan tunggal.
  MAX_ACCEPTABLE_ACCURACY: 50,

  // ---- PENGUNCIAN GPS (multi-sampling) -----------------------------------
  // Saat absen, aplikasi mengumpulkan beberapa pembacaan GPS, membuang
  // pembacaan lompat/basi/akurasi buruk, lalu merata-ratakan dengan bobot
  // 1/akurasi². Berhenti lebih cepat jika akurasi target sudah tercapai.
  GPS_TARGET_ACCURACY: 15,   // meter — berhenti lebih awal jika tercapai
  GPS_MIN_SAMPLES: 3,        // minimal pembacaan bagus sebelum boleh berhenti
  GPS_MAX_WAIT_MS: 15000,    // batas waktu maksimum penguncian (ms)
  GPS_MAX_SAMPLE_AGE_MS: 20000, // pembacaan lebih tua dari ini dianggap basi

  // Karyawan yang berada di luar OUTSIDE_AREA_RADIUS selama menit ini
  // (setelah absen masuk, sebelum absen pulang) akan memicu alarm +
  // notifikasi + permintaan alasan yang dikirim ke admin.
  OUTSIDE_AREA_MINUTES: 10,

  // Batas jam masuk sebelum dianggap terlambat (format HH:MM, 24 jam).
  // Dipakai HANYA sebagai cadangan untuk karyawan yang belum memiliki shift
  // kerja (lihat store.js — Store.getEffectiveSchedule). Sejak sistem
  // shift ditambahkan, batas telat yang sesungguhnya dihitung dari jam
  // masuk shift masing-masing karyawan + LATE_GRACE_MINUTES di bawah.
  LATE_AFTER: "08:15",

  // Toleransi keterlambatan (menit) dihitung dari jam masuk SHIFT karyawan.
  // Contoh: shift masuk 08:00 + toleransi 15 menit → telat jika absen > 08:15.
  LATE_GRACE_MINUTES: 15,

  // Data dummy (demo-data.js) untuk uji performa & tampilan. Set false untuk
  // memakai data kosong/asli. Bisa juga dimatikan sementara dengan ?demo=off.
  DEMO_DATA: true
};

// Catatan: alias bare (OFFICE_LOCATION / OFFICE_MAPS_URL / ATTENDANCE_RADIUS)
// yang dulu ada di sini SUDAH DIHAPUS. Sejak menu "Lokasi Kantor" di admin
// bisa mengubah nilai-nilai ini saat aplikasi berjalan (lihat
// Store.saveOfficeSettings di store.js, yang MEMODIFIKASI properti di
// dalam objek CONFIG secara langsung), alias primitif seperti
// `const ATTENDANCE_RADIUS = CONFIG.ATTENDANCE_RADIUS` akan membeku ke nilai
// LAMA dan tidak pernah ikut ter-update — sumber bug yang sangat halus.
// SELALU baca lewat `CONFIG.OFFICE_LOCATION` / `CONFIG.OFFICE_MAPS_URL` /
// `CONFIG.ATTENDANCE_RADIUS` dst, jangan buat alias baru untuk nilai ini.
