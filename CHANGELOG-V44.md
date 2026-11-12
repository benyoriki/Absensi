# v44
1. Peringatan "Ubah sandi Anda": kolom sandi kini type="text" langsung di HTML (disamarkan CSS), id/name tidak mengandung "password"/"pin", sehingga Chrome tidak lagi memeriksa kebocoran sandi saat login. Berlaku di login karyawan, login admin, dan pendaftaran. Fallback ke type=password bila browser tidak mendukung masking CSS.
2. Desain 2026: style-v44.css (aurora, kaca/glassmorphism, tombol gradien, navigasi bawah melayang, tata letak bento di desktop, font Plus Jakarta Sans, fokus & reduced-motion).
3. Perbaikan: judul "Rekap Absensi" admin tidak lagi menyempit/menimpa tombol di HP.
4. Cache PWA: depoprg-shell-v44.
Catatan: akar masalah tetap sandi lemah (123456 / admin123). Ganti ke sandi kuat & unik untuk data produksi.
