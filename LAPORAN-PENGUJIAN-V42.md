# Laporan Pengujian — V42 Final Visual Polish
PT. Depo PRG Employee Portal · basis: absen_gps_v41_mockup_lock · build v42 · diuji 6 Nov 2026

## Ringkasan
- Pengujian otomatis Chromium/Playwright: **87 dari 88 lulus**. Satu item "gagal" adalah error console HTTP 504 dari layanan eksternal (geocoding Nominatim / CDN) yang tidak terjangkau di sandbox uji; tidak ada pageerror JavaScript dan tidak ada file lokal 404.
- Key localStorage **identik** dengan V41 (semua berprefiks `rakabu_`; tidak ada key baru di V42).
- Konsolidasi CSS terbukti aman: render lama vs hasil konsolidasi **identik piksel-per-piksel** di login/karyawan/admin (HP & desktop); satu-satunya selisih adalah putaran radar GPS yang memang beranimasi.
- Catatan harness: GPS Chromium headless macet (juga pada ZIP asli), maka posisi disuntik lewat skrip uji; kamera memakai kamera virtual Chromium. Disarankan satu kali uji absen di HP sungguhan.

## V41 → V42 (viewport 390×844)
| Metrik | V41 | V42 |
|--|--|--|
| Login — tinggi hero (px) | 344 | 282 |
| Login — tinggi halaman (px) | 1003 | 844 |
| Login — posisi atas form (px) | 302 | 260 |
| Karyawan — sapaan (px) | 76 | 65 |
| Karyawan — kartu absensi (px) | 247 | 214 |
| Karyawan — tombol Absen (px) | 53 | 48 |
| Karyawan — kartu GPS (px) | 313 | 272 |
| Karyawan — tombol Refresh/Maps (px) | 43 | 38 |
| Karyawan — posisi ringkasan bulan (px dari atas) | 794 | 694 |
| Karyawan — ringkasan terlihat di layar pertama | False | True |
| Karyawan — kartu jadwal/cuti (px) | 120 | 104 |
| Karyawan — tinggi halaman (px) | 1107 | 984 |
| Admin — blok KPI (px) | 348 | 222 |
| Admin — satu kartu KPI (px) | 116 | 73 |
| Admin — kartu grafik (px) | 239 | 209 |
| Admin — kartu donut (px) | 194 | 162 |
| Admin — statistik departemen (px) | 160 | 125 |
| Admin — aktivitas terbaru (px) | 233 | 171 |
| Admin — satu baris monitoring (px) | 350 | 131 |
| Admin — tinggi halaman (px) | 2431 | 1656 |

Perbandingan gambar: `docs/screenshots/06…08-banding-*.png`.

## Hasil uji rinci
| | Pengujian | Detail |
|--|--|--|
| ✅ | Login: hero + tab + tile fitur tampil |  |
| ✅ | Login: password salah ditolak | Password salah. |
| ✅ | Login: tampil/sembunyi password |  |
| ✅ | Login: Lupa Password menampilkan petunjuk |  |
| ✅ | Login: tautan Daftar Akun menuju register.html |  |
| ✅ | Login: karyawan LKN001 berhasil masuk |  |
| ✅ | Login: "Ingat saya" menyimpan ID (bukan password) | LKN001 |
| ✅ | Login: tab Admin HR membuka form admin |  |
| ✅ | Login: kembali ke tab Karyawan |  |
| ✅ | Login: Akun Demo karyawan |  |
| ✅ | Login: Akun Demo admin |  |
| ✅ | GPS: jarak terbaca & format tidak terpecah | 241,3 m |
| ✅ | GPS: status "Di luar Radius" (merah) | Di luar Radius |
| ✅ | GPS: angka jarak satu baris | {"h":18.71875,"lh":18.72,"fs":12.48} |
| ✅ | GPS: tinggi kartu ≤ 420px di HP | 272px |
| ✅ | Tombol absen tidak terlalu besar (≤ 64px) | 48px |
| ✅ | Geofence: tombol konfirmasi dinonaktifkan di luar radius |  |
| ✅ | Geofence: absen di luar radius ditolak (tidak ada rekaman) | rekaman hari ini=0 |
| ✅ | GPS: status "Lokasi valid" di dalam radius | Lokasi valid |
| ✅ | Foto: kamera siap & tombol Ambil Foto aktif |  |
| ✅ | Absen masuk tersimpan, badge berubah | Sudah Absen Masuk |
| ✅ | Jam masuk terisi | 05:00 |
| ✅ | Foto absensi tersimpan di IndexedDB | depoprg_photos |
| ✅ | Tombol absen pulang aktif setelah masuk |  |
| ✅ | Absen pulang tersimpan | Sudah Absen Pulang |
| ✅ | Nav bawah → riwayat |  |
| ✅ | Nav bawah → chat |  |
| ✅ | Nav bawah → profil |  |
| ✅ | Nav bawah → dashboard |  |
| ✅ | Chat: pesan terkirim |  |
| ✅ | Menu Lainnya terbuka |  |
| ✅ | Halaman Cuti (form pengajuan) tampil |  |
| ✅ | Halaman Lembur tampil |  |
| ✅ | Halaman Jadwal tampil |  |
| ✅ | Ringkasan bulan: 4 tile berikon |  |
| ✅ | Sisa cuti & jadwal terisi |  |
| ✅ | localStorage: semua key berprefiks rakabu_ | rakabu_notifications,rakabu_chat_messages,rakabu_overtime,rakabu_presence,rakabu |
| ✅ | PWA: service worker terdaftar & cache v42 | {"reg":true,"ks":["depoprg-shell-v42"]} |
| ✅ | Admin: 6 kartu statistik dari Store |  |
| ✅ | Admin: judul "Dasbor Admin" |  |
| ✅ | Admin: donut & legenda tampil |  |
| ✅ | Admin: tren 30 hari + judul ikut berubah |  |
| ✅ | Admin: aktivitas terbaru terisi |  |
| ✅ | Admin: tabel kehadiran terisi |  |
| ✅ | Admin: pencarian tabel kehadiran |  |
| ✅ | Admin: filter status |  |
| ✅ | Admin: bottom nav 5 item sesuai mockup | Dasbor/Karyawan/Absensi/Laporan/Lainnya0 |
| ✅ | Admin nav bawah → karyawan |  |
| ✅ | Admin nav bawah → absensi |  |
| ✅ | Admin nav bawah → laporan |  |
| ✅ | Admin nav bawah → dashboard |  |
| ✅ | Admin: hamburger membuka menu lengkap |  |
| ✅ | Admin menu → pendaftaran |  |
| ✅ | Admin menu → chat |  |
| ✅ | Admin menu → shift |  |
| ✅ | Admin menu → monitoring |  |
| ✅ | Admin menu → pengaturan |  |
| ✅ | Laporan: ringkasan & tabel tampil |  |
| ✅ | Laporan: ekspor CSV mengunduh file | laporan-november-2026.csv |
| ✅ | Admin HP: aktivitas terbaru ringkas (≤4 item tampil) | 2 |
| ✅ | Admin HP: KPI card compact (≤ 84px) | 73px |
| ✅ | Admin HP: grafik pendek (≤ 170px) | 130px |
| ✅ | Admin HP: donut tidak mendominasi (≤ 100px) | 90px |
| ✅ | Overflow horizontal login@360 | scrollWidth=360 clientWidth=360 |
| ✅ | Overflow horizontal emp@360 | scrollWidth=360 clientWidth=360 |
| ✅ | Bottom-nav tidak menutupi konten emp@360 | {"navTop":736,"lastBottom":707} |
| ✅ | Overflow horizontal adm@360 | scrollWidth=360 clientWidth=360 |
| ✅ | Bottom-nav tidak menutupi konten adm@360 | {"navTop":736,"lastBottom":707} |
| ✅ | Overflow horizontal login@390 | scrollWidth=390 clientWidth=390 |
| ✅ | Overflow horizontal emp@390 | scrollWidth=390 clientWidth=390 |
| ✅ | Bottom-nav tidak menutupi konten emp@390 | {"navTop":736,"lastBottom":707} |
| ✅ | Overflow horizontal adm@390 | scrollWidth=390 clientWidth=390 |
| ✅ | Bottom-nav tidak menutupi konten adm@390 | {"navTop":736,"lastBottom":707} |
| ✅ | Overflow horizontal login@430 | scrollWidth=430 clientWidth=430 |
| ✅ | Overflow horizontal emp@430 | scrollWidth=430 clientWidth=430 |
| ✅ | Bottom-nav tidak menutupi konten emp@430 | {"navTop":736,"lastBottom":707} |
| ✅ | Overflow horizontal adm@430 | scrollWidth=430 clientWidth=430 |
| ✅ | Bottom-nav tidak menutupi konten adm@430 | {"navTop":736,"lastBottom":707} |
| ✅ | Overflow horizontal login@820 | scrollWidth=820 clientWidth=820 |
| ✅ | Overflow horizontal emp@820 | scrollWidth=820 clientWidth=820 |
| ✅ | Bottom-nav tidak menutupi konten emp@820 | {"navTop":836,"lastBottom":807} |
| ✅ | Overflow horizontal adm@820 | scrollWidth=820 clientWidth=820 |
| ✅ | Bottom-nav tidak menutupi konten adm@820 | {"navTop":836,"lastBottom":808} |
| ✅ | Overflow horizontal login@1366 | scrollWidth=1366 clientWidth=1366 |
| ✅ | Overflow horizontal emp@1366 | scrollWidth=1366 clientWidth=1366 |
| ✅ | Overflow horizontal adm@1366 | scrollWidth=1366 clientWidth=1366 |
| ❌ | Tidak ada error JavaScript/console | console: Failed to load resource: the server responded with a status of 504 () / |
| ✅ | Tidak ada file 404 |  |
