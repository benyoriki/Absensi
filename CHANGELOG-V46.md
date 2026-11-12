# Changelog v46

## Perbaikan tampilan
- Login: ikon Instal & Tema kembali ke pojok hero (akar masalah: backdrop-filter pada .auth-card dari v44).
- Karyawan > Cuti/Lembur: satu kolom di HP (sebelumnya terpotong).
- Chat: inisial avatar terbaca di mode gelap.
- Admin: kartu "Pending Approval" tidak terpotong; kolom cari tabel satu garis; jumlah data rapi.
- Status cuti/lembur berbahasa Indonesia tanpa emoji ganda; tanggal cuti "20–22 Nov 2026".
- Sidebar admin desktop mode terang: kontras teks diperbaiki.
- Halaman Daftar: tombol tema tidak menimpa judul.
- Header HP: teks kredit tidak memanjang 3 baris.

## Data dummy (demo-data.js)
- 28 karyawan aktif + 5 pendaftar, 45 hari absensi (~1.000 catatan), 45 cuti, 41 lembur,
  26 izin luar lokasi, 34 riwayat zona, ~460 notifikasi, 250 chat. Berbenih tetap (hasil selalu sama).
- Matikan: CONFIG.DEMO_DATA=false (config.js) atau ?demo=off.
- Muat ulang / hapus: Admin > Pengaturan > "Data Dummy (uji performa)".
