# CHANGELOG — Final Polish v40 (dari v39 Premium HRIS)

Fokus: visual premium 2026, ringan, stabil, data tetap aman.
**Tidak ada perubahan** pada: JavaScript aplikasi (store/auth/geo/photo/chat/employee/admin/dll), ID DOM,
localStorage keys, struktur data, validasi GPS & radius, sistem foto, chat, shift, cuti, lembur, monitoring.
File yang berubah: `style.css`, `sw.js` (hanya versi cache), 4 file HTML (hanya `?v=39` → `?v=40`), logo PNG (lossless).

## 1. Perubahan visual (lapisan "FINAL POLISH v8" di akhir style.css)
- Latar bersih: glow oranye/biru lama di belakang halaman dihapus.
- Kartu KPI admin & laporan: gradasi pastel dihapus → kartu putih, ikon tile lembut per status.
- Radius konsisten (kartu 20px, kontrol 14px), bayangan lembut tunggal, tanpa efek hover-naik pada kartu.
- Tipografi: judul halaman fluid (clamp), breadcrumb, label & badge min. 12px, angka tabular.
- Tombol: primary biru dengan gradasi halus, min-height 44px; tombol Absen Masuk/Pulang min-height 92px.
- Input: tinggi 48px, font 16px (mencegah auto-zoom iOS), fokus ring biru lembut; ikon di dalam input tetap utuh.
- Tabel di HP: tidak lagi "kartu dalam kartu dalam kartu" — pembungkus tabel transparan, tiap baris jadi satu kartu.
- Empty state: tanpa kotak putus-putus; bar departemen & progress lebih tipis.
- Modal: bottom-sheet di HP (maks 92dvh, bisa di-scroll, aman safe-area).
- Bottom navigation: dibatasi lebarnya di tablet; tidak menutupi konten (diuji di semua halaman & ukuran).
- Keterbacaan: label sumbu grafik membesar di HP; teks < 11.5px dinaikkan; target sentuh min. 40px.

## 2. CSS — konsolidasi (171.389 → 146.614 byte, −14,5%; gzip 35,4 KB → 31,1 KB)
Alat konsolidasi hanya menghapus deklarasi yang **pasti kalah**: selector identik + konteks @media identik +
properti sama + tingkat !important sama, dan ada deklarasi lebih akhir. Urutan aturan yang tersisa tidak diubah.
Deklarasi dipertahankan bila pemenangnya memakai fungsi yang butuh fallback (dvh, env(), clamp(), min()/max(), -webkit-).
- 972 dari 4.547 deklarasi duplikat/ter-override dihapus (lapisan dasar, v3, v4, v5, v6, v7).
- Komentar di dalam blok aturan dibuang; komentar pemisah bagian dipertahankan.
- Verifikasi: pixel-diff 100+ screenshot sebelum/sesudah konsolidasi → identik (selisih hanya jam & animasi radar).
- Token maroon/oranye lama yang sudah tidak dipakai (tertimpa v7) ikut hilang bersama deklarasinya.

## 3. PWA & cache
- `CACHE_VERSION` depoprg-shell-v39 → **v40**; semua `?v=39` → `?v=40` (HTML + daftar app-shell sw.js).
- Logo dioptimalkan lossless (piksel identik): logo-512 85→39 KB, maskable 41→22 KB, logo-192 15→9 KB.

## 4. Hasil pengujian (Chromium headless, Playwright)
- 22/22 uji fungsional lulus: login karyawan & admin lewat UI, validasi radius (di luar 10 m ditolak),
  absen masuk + foto (kamera virtual, tersimpan di IndexedDB), absen pulang, riwayat, chat, rekap admin,
  laporan, modal 360px, service worker, cache v40 (24 file app-shell).
- Semua key localStorage tetap berawalan `rakabu_` dan tidak ada key baru.
- 0 error JavaScript, 0 file hilang (404), 0 overflow horizontal pada 360/390/430/820/1366 px di 22 halaman.
- Bottom-nav tidak menutupi konten di semua halaman pada 360/390/430/820 px.

## 5. Catatan / belum terselesaikan
- Warna bar departemen, donut, dan garis tren ditentukan inline oleh admin.js (`style="stroke:..."`).
  Saat belum ada yang hadir, bar & donut tampil merah pekat. Itu berasal dari data & JS, sengaja tidak diubah.
- Lapisan CSS lama v3–v6 masih ada (sudah tidak dominan, tapi sebagian aturannya masih menjadi dasar layout).
  Menghapus seluruh lapisan butuh uji regresi per halaman di perangkat nyata; disarankan sebagai tahap berikut.
- Pengujian memakai posisi GPS yang disuntikkan harness karena `getCurrentPosition` kehabisan waktu di Chromium headless
  (juga pada versi asli). Uji GPS nyata, kamera nyata, dan iOS Safari belum dilakukan.
- Alamat di stempel foto butuh internet (Nominatim); tanpa internet foto tetap tersimpan dengan "alamat tidak tersedia".
