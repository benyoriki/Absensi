# CHANGELOG V42 — Final Visual Polish (basis: v41 mockup lock)

Tidak ada redesign total, perubahan arsitektur, atau fitur yang dihapus.

## Login
- Hero HP diperpendek 344 → 282 px (−18%); halaman login kini pas satu layar (1003 → 844 px).
- Ilustrasi gudang digambar ulang (SVG ringan): sudah tidak menimpa tagline; papan nama dekoratif miring diganti papan lurus "DEPO PRG" yang terbaca.
- Form lebih dekat ke branding (overlap kartu 1.35rem), input/tombol lebih rapat.
- "Daftar Akun" dan "Akun Demo" kini berdampingan; tile GPS/Foto/Laporan/PWA lebih compact; catatan prototipe lebih ringkas.
- Desktop: dua kolom + branding dipertahankan; ilustrasi proporsional.

## Dashboard Karyawan
- Sapaan compact (avatar 3.2rem, teks lebih kecil); jam absensi 2.55 → 2.15rem; tombol absen 53 → 48 px.
- Kartu GPS 313 → 272 px (radar 7.8rem); tombol Refresh/Google Maps 38 px. Semua data GPS tetap tampil; validasi radius tidak diubah.
- Ringkasan bulan kini terlihat di layar pertama (posisi 794 → 694 px), angka lebih besar/tebal.
- Jadwal & sisa cuti lebih ringkas (120 → 104 px).

## Dashboard Admin (HP)
- KPI compact: blok 348 → 222 px, kartu 116 → 73 px; ikon 2.15rem, angka menonjol, persentase inline "(87%)", label 1 baris.
- Pending Approval ringkas: hanya menampilkan komponen yang >0 ("1 daftar · 1 cuti"), atau "Tidak ada".
- Grafik tren HP memakai kanvas pendek (380×150), label sumbu terbaca; ikut menyesuaikan bila layar berubah (ui-v42.js).
- Donut 5.6rem tidak mendominasi; statistik departemen & aktivitas terbaru lebih ringkas (aktivitas maks. 4 item di HP, "Lihat Semua" tetap ada).
- Monitoring: toolbar 3 kolom; tiap karyawan 350 → 131 px (kartu 3 baris + tombol Detail).
- Tinggi halaman admin HP 2431 → 1656 px (−32%).
- Desktop: sidebar, KPI, grafik, donut, tabel, aktivitas tidak berubah.

## Visual system & performa
- Palet tetap Corporate Blue/Navy/soft white; tanpa neon; shadow ringan; radius konsisten.
- CSS dikonsolidasi: `mockup-v41.css` digabung ke `style.css` (satu request), duplikasi deklarasi dihapus secara semantik-aman, komentar dibuang (2 file 187.0 KB → 1 file 177.6 KB; ±30.9 KB setelah gzip). Selector yang dipakai JS tidak disentuh; tidak ada aturan dihapus berdasarkan perkiraan.
- `ui-v41.js` → `ui-v42.js`. Cache service worker → `depoprg-shell-v42`; semua query `?v=42`.

## File yang berubah
index.html, employee.html, admin.html, register.html (versi aset), style.css, admin.js (KPI, ukuran grafik, label), ui-v42.js, sw.js.
Tidak berubah: store.js, employee.js, auth.js, geo.js, photo.js, chat.js, report-export.js, ui-common.js, ui-enhance.js, manifest.
Teks "Semua departemen" → "Semua dept." (filter monitoring) agar muat di HP.
