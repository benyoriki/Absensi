# Changelog v47 — Mesin Lokasi Akurat & Toleransi Jarak Profesional

## Akar masalah (screenshot "254,6 m dari kantor")
1. Koordinat kantor di `config.js` hanyalah perkiraan (bukan hasil ukur di titik absen).
2. Radius 10 m + 1 pembacaan GPS tunggal terlalu ketat: GPS HP normalnya ±5–20 m (di dalam gedung ±20–50 m).

## Baru
- **Penguncian GPS multi-sampel** (`samplePosition`): kumpulkan beberapa pembacaan, buang basi/outlier, rata-rata berbobot 1/akurasi². Selesai lebih awal bila akurasi target (15 m) tercapai; bar progres tampil saat absen.
- **Filter Kalman** untuk kartu lokasi realtime & pemantau area kerja (jarak tidak lagi "loncat-loncat").
- **Toleransi adaptif** (`evaluateLocation`): radius 30 m + bonus ½×akurasi GPS (maks. 20 m). Status: Dalam radius / Dalam toleransi / Di luar / Akurasi rendah. Akurasi > 50 m ditolak.
- **Radius area kerja** 15→60 m, dan ZoneMonitor mengabaikan pembacaan kasar → alarm "keluar area" tidak palsu.
- **Skor kepercayaan GPS** (0–100) + bendera anomali (lompatan lokasi, pembacaan beku, akurasi nol, dll.). Disimpan di data absen dan ditandai "⚠️ tinjau" di Rekap admin. Tidak memblokir sendiri (browser tidak bisa memastikan fake GPS).
- **Admin > Ubah Lokasi Kantor**: kolom *Tempel dari Google Maps* (link panjang / "lat, lon"; pin `!3d!4d` diprioritaskan), tombol **Kalibrasi di Lokasi** (±20 dtk, rata-rata berbobot), kolom toleransi maksimum, banner peringatan selama titik belum terkalibrasi.
- Link Maps baru: CV. Tirta Usaha (AQUA), Jl. Raya Parung No.22.

## Wajib setelah deploy
Koordinat bawaan BELUM terkalibrasi. Login admin → Dasbor → "Kalibrasi sekarang" (berdiri di titik absen), atau tempel koordinat dari Google Maps, lalu Simpan. (Opsional: isi `OFFICE_LOCATION` di `config.js` dan set `OFFICE_CALIBRATED: true`.)

## Teknis
- `SETTINGS_VERSION` 3: pengaturan lokasi lama di browser otomatis diabaikan.
- Cache service worker `v47`, semua `?v=47`.
- Tes: `node tests/geo.test.js .` (27 tes: toleransi, Kalman, fusi sampel, anomali, parser Maps, alur samplePosition).

## Pembaruan: titik kantor & pratinjau WhatsApp
- Titik kantor diganti ke pin Google Maps baru (`maps.app.goo.gl/pZUmxACbiEQcC6wW6`): **-6.4590039, 106.7308313**. Jarak ke koordinat lama 254,7 m = angka di screenshot error. `OFFICE_CALIBRATED: true`, `SETTINGS_VERSION: 4`.
- Gambar pratinjau link diganti `preview-v47.jpg` (1200×630, ±200 KB). Nama file baru sengaja dipakai agar cache WhatsApp tidak menampilkan gambar lama.
- Judul & deskripsi pratinjau (Open Graph) ditulis ulang di `index.html` dan `register.html`.
