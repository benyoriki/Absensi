/* ==========================================================================
   RAKABU ATTENDANCE — KONFIGURASI GLOBAL (v7)
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

   CARA MENGUBAH RADIUS ABSENSI:
   Ubah CONFIG.ATTENDANCE_RADIUS (satuan meter). Radius yang sama dipakai
   untuk Absen Masuk maupun Absen Pulang — jangan dibedakan.

   CARA MENGUBAH DURASI PERINGATAN KELUAR AREA:
   Ubah CONFIG.OUTSIDE_AREA_MINUTES (satuan menit).
   ========================================================================== */

const CONFIG = {
  // Koordinat kantor PT Rakabu Sapi Kita — diverifikasi dari:
  // https://maps.app.goo.gl/Vv9wHZADw7mMiQV56?g_st=ac
  // (resolusi tautan tsb menghasilkan koordinat berikut per 2026-09-05)
  OFFICE_LOCATION: {
    latitude: -6.4568847,
    longitude: 106.7299525
  },
  OFFICE_MAPS_URL: "https://maps.app.goo.gl/Vv9wHZADw7mMiQV56?g_st=ac",

  // Radius absensi (meter). Berlaku SAMA untuk absen masuk & absen pulang.
  // ATURAN PALING PENTING: jangan ubah ke 20, 30, atau angka lain.
  ATTENDANCE_RADIUS: 15,

  // Akurasi GPS lebih buruk dari ini (meter) akan diberi peringatan.
  MAX_ACCEPTABLE_ACCURACY: 30,

  // Karyawan yang berada di luar ATTENDANCE_RADIUS selama menit ini
  // (setelah absen masuk, sebelum absen pulang) akan memicu notifikasi
  // admin. Jangan ubah dari 10 menit ke 5 menit atau angka lain.
  OUTSIDE_AREA_MINUTES: 10,

  // Batas jam masuk sebelum dianggap terlambat (format HH:MM, 24 jam).
  LATE_AFTER: "08:15"
};

// Alias lama dipertahankan agar kompatibel jika ada kode lain yang masih
// memanggilnya (tidak ada di v7, tapi aman untuk jaga-jaga).
const OFFICE_LOCATION = CONFIG.OFFICE_LOCATION;
const OFFICE_MAPS_URL = CONFIG.OFFICE_MAPS_URL;
const ATTENDANCE_RADIUS = CONFIG.ATTENDANCE_RADIUS;
