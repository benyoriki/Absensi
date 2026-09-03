# Rakabu Attendance — PT Rakabu Sapi Kita

Sistem absensi & manajemen HR berbasis browser (HTML/CSS/JS murni, tanpa
framework, tanpa build step). Versi ini merombak total prototipe
"Lokon Attendance" (single-user, localStorage) menjadi sistem multi-peran
(admin & karyawan) dengan alur registrasi → persetujuan admin → login →
absensi berbasis geofencing 3–5 meter dengan pemantauan keluar-area.

## 1. Struktur File

```
/
├── index.html          → Halaman login (+ akses admin tersembunyi via 5x tap logo)
├── register.html       → Pendaftaran akun karyawan baru
├── employee.html       → Dashboard karyawan (SPA)
├── admin.html          → Dashboard admin (SPA)
├── manifest.webmanifest → Manifest PWA ringan
├── css/
│   └── style.css       → Seluruh desain (design tokens, light/dark, responsive)
├── js/
│   ├── store.js         → Lapisan data / "backend" demo (localStorage)
│   ├── geo.js            → Konfigurasi lokasi kantor + geofencing + alarm
│   ├── ui-common.js       → Helper bersama (toast, tema, format)
│   ├── auth.js            → Logika halaman login
│   ├── register.js        → Logika halaman registrasi
│   ├── employee.js        → Logika dashboard karyawan
│   └── admin.js            → Logika dashboard admin
└── assets/
    └── favicon.svg
```

## 2. Cara Menjalankan

Karena menggunakan `fetch`/module path relatif, jalankan lewat server lokal,
jangan buka file `index.html` langsung dengan `file://` (Geolocation API dan
sebagian browser modern membatasi ini).

```bash
# dari folder proyek
python3 -m http.server 8080
# lalu buka http://localhost:8080/index.html
```

Atau gunakan ekstensi "Live Server" di VS Code, atau unggah ke hosting statis
apa pun (Netlify, Vercel, GitHub Pages, dsb).

## 3. Akun Demo

| Peran     | ID / Username | Password  |
|-----------|----------------|-----------|
| Admin     | `admin`        | `admin123`|
| Karyawan  | `LKN001`       | `123456`  |
| Karyawan  | `LKN002`       | `123456`  |

Ada juga 1 akun contoh berstatus **pending** (`LKN003` — Budi Santoso) yang
sudah muncul di menu **Pendaftaran Baru** admin, untuk mendemokan alur
approval tanpa perlu mendaftar akun baru dulu.

Akun-akun ini murni untuk demo lokal (`// DEMO ONLY` di `store.js`). Ganti
seluruhnya saat masuk ke produksi (lihat bagian Backend di bawah).

## 4. Mengganti Koordinat Kantor

Buka `js/geo.js`, cari blok `OFFICE_LOCATION` di bagian paling atas:

```js
const OFFICE_LOCATION = {
  latitude: -7.0000000,   // GANTI
  longitude: 110.0000000, // GANTI
  attendanceRadius: 3,
  warningRadius: 5,
  outsideDurationMs: 5 * 60 * 1000,
  maxAcceptableAccuracy: 30
};
```

Link Google Maps kantor yang diberikan:
`https://maps.app.goo.gl/AqmqNdaZb8x8hbrQ6?g_st=ac`

**Kenapa tidak otomatis?** Short-link Google Maps (`maps.app.goo.gl/...`)
tidak bisa di-resolve menjadi latitude/longitude langsung dari JavaScript
browser (redirect lintas-domain semacam ini diblokir oleh kebijakan CORS
browser). Cara mengambil koordinatnya:

1. Buka link tersebut di HP/PC — akan mengarah ke lokasi di Google Maps.
2. Di aplikasi/situs Google Maps, tekan-tahan (HP) atau klik-kanan (desktop)
   tepat di titik kantor.
3. Angka yang muncul (format `-7.xxxxxx, 110.xxxxxx`) adalah latitude,
   longitude — salin ke `OFFICE_LOCATION` di atas.
4. Jangan biarkan nilai contoh (0,0 atau nilai dummy) di produksi — sistem
   tidak akan pernah mengizinkan absen jika koordinat salah/kosong.

## 5. Cara Kerja Radius & Monitoring

- **Absen masuk/pulang**: hanya diizinkan jika jarak ≤ `attendanceRadius` (3 m)
  **dan** akurasi GPS ≤ `maxAcceptableAccuracy` (30 m). Jarak dihitung dengan
  rumus Haversine (`haversineDistance` di `geo.js`).
- **Monitoring area kerja**: setelah absen masuk, `watchPosition()` terus
  memantau lokasi. Jika jarak > `warningRadius` (5 m), sistem mulai menghitung
  waktu. Jika karyawan tetap di luar selama `outsideDurationMs` (5 menit),
  sistem memicu alarm (bunyi WebAudio, getar via Vibration API, notifikasi
  browser jika izin diberikan) dan mewajibkan karyawan memberi alasan —
  yang otomatis terkirim ke Dashboard Admin (menu Notifikasi &
  data mentah tersimpan di `rakabu_zone_events`).
- **Keterbatasan jujur**: pemantauan ini bergantung pada browser tetap
  berjalan (tab terbuka), izin GPS, dan kebijakan hemat-baterai OS. Browser
  yang benar-benar ditutup, atau sistem operasi yang membekukan tab di
  latar belakang, dapat menghentikan pemantauan. Ini bukan solusi tracking
  latar-belakang sejati — untuk itu diperlukan aplikasi native.

## 6. Backend / Data (Demo → Produksi)

Seluruh data (`users`, `attendance`, `leave`, `overtime`, `salary`,
`notifications`, `zoneEvents`) disimpan di **localStorage** lewat modul
`js/store.js`, yang sengaja dipisah dari UI. Untuk produksi:

1. Ganti isi tiap fungsi di `store.js` (`login`, `registerEmployee`,
   `checkIn`, `submitLeave`, dst.) dengan pemanggilan API/SDK sungguhan,
   misalnya **Firebase Authentication + Firestore/Realtime Database**:
   ```js
   // Placeholder — isi dengan konfigurasi proyek Firebase Anda sendiri.
   // JANGAN commit API key asli ke repo publik.
   const firebaseConfig = {
     apiKey: "GANTI_DENGAN_API_KEY_ANDA",
     authDomain: "GANTI.firebaseapp.com",
     projectId: "GANTI",
     // ...
   };
   ```
2. Pertahankan nama fungsi & bentuk data yang sama agar `auth.js`,
   `employee.js`, `admin.js` **tidak perlu diubah sama sekali**.
3. Ganti `hashPassword()` (saat ini hanya obfuscation sederhana, BUKAN
   hashing aman) dengan autentikasi resmi (Firebase Auth / bcrypt di server).
4. Pindahkan validasi role (admin vs karyawan) ke server/security rules —
   jangan hanya mengandalkan pengecekan di frontend.

## 7. Checklist Pengujian

**Sebagai Karyawan baru:**
1. Buka `register.html` → isi form → submit → tampil layar "Menunggu
   Persetujuan Admin".
2. Login dengan akun tersebut sebelum di-ACC → ditolak dengan pesan yang
   jelas.

**Sebagai Admin** (`admin` / `admin123`, akses via 5x tap logo di halaman
login):
1. Dashboard menampilkan kartu statistik & grafik.
2. Menu **Pendaftaran Baru** → ACC / Tolak karyawan pending.
3. Menu **Data Karyawan** → cari, buka detail, aktifkan/nonaktifkan, reset
   password, ubah jabatan/departemen.
4. Menu **Rekap Absensi** → filter hari ini/minggu/bulan/semua, export CSV.
5. Menu **Pengajuan Cuti** & **Pengajuan Lembur** → setujui/tolak.
6. Menu **Gaji Karyawan** → lihat rekap dummy, export CSV.
7. Menu **Laporan** → ringkasan per karyawan.
8. Menu **Notifikasi** → badge jumlah, tandai semua dibaca.

**Sebagai Karyawan aktif** (`LKN001` / `123456`):
1. Login → Dashboard menampilkan status "BELUM ABSEN".
2. Tekan **Absen Masuk** → izinkan lokasi GPS browser → jika di luar radius 3
   meter dari `OFFICE_LOCATION`, tombol konfirmasi nonaktif dengan pesan
   jarak yang jelas (perlu koordinat asli diisi dulu agar bisa lolos).
3. Setelah absen masuk, tombol **Absen Pulang** aktif.
4. Menu **Cuti** → ajukan cuti → cek muncul di admin sebagai pending.
5. Menu **Lembur** → ajukan lembur → cek muncul di admin.
6. Menu **Profil** → ubah HP/email → simpan.
7. Menu **Notifikasi** → cek notifikasi masuk (mis. hasil approval cuti).
8. Ganti tema terang/gelap dari ikon di header — konsisten di semua halaman.
9. Uji di lebar layar HP (< 430px) dan desktop (> 1400px) — tidak ada
   horizontal scroll, bottom nav muncul di HP, sidebar muncul di desktop.

## 8. Catatan Keamanan (Demo)

- Password di-"hash" dengan fungsi sangat sederhana di `store.js`
  (`hashPassword`) — **hanya agar tidak plaintext di localStorage demo**,
  BUKAN algoritma aman untuk produksi.
- Akses admin tetap memerlukan login (username + password), 5x tap hanya
  membuka form login admin, bukan bypass.
- Sebelum produksi: tambahkan validasi sisi server, HTTPS, rate limiting
  login, dan audit trail untuk semua aksi admin (approve/reject/reset
  password).
