/* ==========================================================================
   RAKABU ATTENDANCE — KONFIGURASI GLOBAL (v9)
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
  // Koordinat kantor PT Rakabu Sapi Kita — diverifikasi dari:
  // https://maps.app.goo.gl/9XcuWc9yYGqRSCoZA?g_st=ac
  // (resolusi tautan tsb menghasilkan koordinat berikut per 2026-09-06)
  OFFICE_LOCATION: {
    latitude: -6.456902,
    longitude: 106.729954
  },
  OFFICE_MAPS_URL: "https://maps.app.goo.gl/9XcuWc9yYGqRSCoZA?g_st=ac",

  // Radius absensi (meter). HANYA dipakai untuk memvalidasi tombol Absen
  // Masuk & Absen Pulang. Karyawan di luar radius ini tidak bisa absen.
  ATTENDANCE_RADIUS: 5,

  // Radius area kerja (meter) SETELAH absen masuk. Berbeda & lebih longgar
  // dari ATTENDANCE_RADIUS di atas — lihat penjelasan di header file ini.
  OUTSIDE_AREA_RADIUS: 15,

  // Akurasi GPS lebih buruk dari ini (meter) akan diberi peringatan.
  MAX_ACCEPTABLE_ACCURACY: 30,

  // Karyawan yang berada di luar OUTSIDE_AREA_RADIUS selama menit ini
  // (setelah absen masuk, sebelum absen pulang) akan memicu alarm +
  // notifikasi + permintaan alasan yang dikirim ke admin.
  OUTSIDE_AREA_MINUTES: 10,

  // Batas jam masuk sebelum dianggap terlambat (format HH:MM, 24 jam).
  // Dipakai HANYA sebagai cadangan untuk karyawan yang belum memiliki shift
  // kerja (lihat js/store.js — Store.getEffectiveSchedule). Sejak sistem
  // shift ditambahkan, batas telat yang sesungguhnya dihitung dari jam
  // masuk shift masing-masing karyawan + LATE_GRACE_MINUTES di bawah.
  LATE_AFTER: "08:15",

  // Toleransi keterlambatan (menit) dihitung dari jam masuk SHIFT karyawan.
  // Contoh: shift masuk 08:00 + toleransi 15 menit → telat jika absen > 08:15.
  LATE_GRACE_MINUTES: 15
};

// Catatan: alias bare (OFFICE_LOCATION / OFFICE_MAPS_URL / ATTENDANCE_RADIUS)
// yang dulu ada di sini SUDAH DIHAPUS. Sejak menu "Lokasi Kantor" di admin
// bisa mengubah nilai-nilai ini saat aplikasi berjalan (lihat
// Store.saveOfficeSettings di js/store.js, yang MEMODIFIKASI properti di
// dalam objek CONFIG secara langsung), alias primitif seperti
// `const ATTENDANCE_RADIUS = CONFIG.ATTENDANCE_RADIUS` akan membeku ke nilai
// LAMA dan tidak pernah ikut ter-update — sumber bug yang sangat halus.
// SELALU baca lewat `CONFIG.OFFICE_LOCATION` / `CONFIG.OFFICE_MAPS_URL` /
// `CONFIG.ATTENDANCE_RADIUS` dst, jangan buat alias baru untuk nilai ini.
