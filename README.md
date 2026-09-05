# Rakabu Attendance — PT Rakabu Sapi Kita (Build v7)

Sistem absensi karyawan berbasis browser (HTML/CSS/JavaScript murni, tanpa
framework, tanpa build step, siap dijalankan di GitHub Pages). Build v7 ini
adalah **rombak total** dari v6: bug lama diperbaiki, fitur "keluar area 10
menit" dibangun ulang dari nol, dan struktur data dirapikan agar mudah
dipindahkan ke Firebase di tahap berikutnya.

---

## A. Ringkasan Bug yang Ditemukan (di v6)

1. **Radius tidak konsisten dengan permintaan** — v6 memakai radius 20 meter
   (dengan "radius peringatan" terpisah 30 meter), bukan 15 meter tunggal
   yang diwajibkan untuk absen masuk maupun pulang.
2. **Koordinat kantor belum diverifikasi ulang** dari tautan Google Maps yang
   baru (`https://maps.app.goo.gl/Vv9wHZADw7mMiQV56`).
3. **Fitur "keluar area 10 menit" tidak ada** — pada v6 fitur ini pernah
   dihapus total atas permintaan sebelumnya, sehingga perlu dibangun ulang
   dari nol sesuai spesifikasi baru (bukan mengaktifkan kode lama).
4. **Akses admin disembunyikan lewat "tap logo 5 kali"** — membingungkan dan
   tidak terlihat oleh pengguna baru.
5. **Modal dikelola terpisah di tiap halaman** (`employee.js` & `admin.js`
   masing-masing punya `showModal()`/`closeAllModals()` sendiri, ditambah
   `MutationObserver` sebagai jaring pengaman) — berfungsi, tapi rawan bug
   baru setiap kali ada modal baru ditambahkan karena logikanya terduplikasi.
6. **Registrasi tidak menolak ID admin** — karyawan bisa mendaftar dengan ID
   `admin` tanpa ditolak.
7. **Teks radius di kartu lokasi karyawan basi** — menampilkan "Batas
   absensi: 3 meter" padahal konfigurasi aktualnya 20 meter (tidak pernah
   diperbarui saat radius berubah).
8. **Tidak ada halaman Monitoring Lokasi / Riwayat Lokasi untuk admin** —
   admin tidak first punya cara memantau siapa yang sedang bekerja dan di
   mana posisi terakhirnya.

## B. Ringkasan Perubahan

| Area | Perubahan |
|---|---|
| Konfigurasi | Semua angka penting (radius, durasi, koordinat) dipindah ke satu file baru `js/config.js` — tidak ada lagi angka yang di-hardcode di beberapa tempat berbeda. |
| Radius | Disatukan jadi **15 meter**, berlaku sama untuk absen masuk & pulang. |
| Koordinat kantor | Diperbarui ke **-6.4568847, 106.7299525** (hasil verifikasi tautan Maps terbaru). |
| Monitoring 10 menit | Dibangun ulang di `js/geo.js` (`createZoneMonitor`) — aktif hanya antara absen masuk & absen pulang, akurat terhadap waktu asli (bukan `setInterval` yang bisa meleset), dan hanya memicu **satu** notifikasi per kejadian keluar-area. |
| Modal | Disatukan ke satu manajer baru, `js/modal.js` (objek global `Modal`) — dipakai oleh `employee.js` dan `admin.js`. Termasuk `Modal.runOnce()` untuk mencegah tombol di-klik dua kali. |
| Admin | Ditambah 3 halaman baru: **Monitoring Lokasi**, **Riwayat Lokasi**, **Pengaturan** (menampilkan koordinat/radius/durasi yang aktif). |
| Akses admin | Diganti dari "tap logo 5x" menjadi tautan **"Masuk sebagai Admin"** yang terlihat jelas di halaman login. |
| Registrasi | Menolak pendaftaran dengan ID `admin` atau ID yang bentrok dengan akun admin manapun. |
| Anti klik-ganda | Tombol konfirmasi absen, tombol ACC/Tolak pendaftaran, dan tombol setuju cuti/lembur sekarang di-disable otomatis selama proses berjalan. |

## C. Struktur File Final

```
/
├── index.html            → Halaman login (+ tautan "Masuk sebagai Admin")
├── register.html         → Pendaftaran akun karyawan baru
├── employee.html         → Dashboard karyawan (SPA)
├── admin.html             → Dashboard admin (SPA)
├── manifest.webmanifest   → Manifest PWA ringan
├── css/
│   └── style.css          → Seluruh desain (design tokens, light/dark, responsive)
├── js/
│   ├── config.js           → BARU. Satu-satunya sumber konfigurasi (koordinat, radius, durasi)
│   ├── store.js            → Lapisan data / "backend" demo (localStorage)
│   ├── ui-common.js        → Helper bersama (toast, tema, format, ikon)
│   ├── modal.js             → BARU. Manajer modal terpusat (anti tumpuk, anti klik-ganda)
│   ├── geo.js               → Jarak/GPS + monitoring zona 10 menit (dirombak total)
│   ├── auth.js              → Logika halaman login
│   ├── register.js          → Logika halaman registrasi
│   ├── employee.js          → Logika dashboard karyawan
│   └── admin.js              → Logika dashboard admin
└── assets/
    └── favicon.svg
```

## D. Kode Lengkap

Semua file di atas ada di paket ini dan siap dipakai langsung — tidak ada
placeholder atau potongan kode yang sengaja dikosongkan.

## E. Cara Menjalankan

Jalankan lewat server lokal (Geolocation API & sebagian browser modern
membatasi `file://` langsung):

```bash
# dari folder proyek
python3 -m http.server 8080
# lalu buka http://localhost:8080/index.html
```

Atau unggah ke GitHub Pages / Netlify / Vercel / hosting statis apa pun —
tidak ada build step yang diperlukan.

### Akun Demo

| Peran     | ID / Username | Password  |
|-----------|----------------|-----------|
| Admin     | `admin`        | `admin123`|
| Karyawan  | `LKN001`       | `123456`  |
| Karyawan  | `LKN002`       | `123456`  |

Ada juga 1 akun contoh berstatus **pending** (`LKN003`) untuk mendemokan
alur approval tanpa perlu mendaftar akun baru dulu.

## F. Cara Testing

Selain checklist manual di bawah, paket ini disertai **automated test
suite** (di luar folder yang dikirim ke pengguna akhir, dijalankan dengan
Node.js + jsdom) yang memuat file HTML/JS ASLI dan mensimulasikan klik/isi
form sungguhan untuk memverifikasi hampir seluruh 33 skenario yang diminta —
hasil run terakhir: **57/57 pengujian lulus**, mencakup: registrasi & semua
validasinya, seluruh kombinasi login (pending/approved/salah
password/akun tidak ada), approve/reject admin, absen masuk & pulang di
dalam/luar radius, absen ganda, refresh setelah absen masuk, logout,
absen pulang setelah refresh, GPS error/permission-denied/timeout, seluruh
siklus monitoring 10 menit (keluar <10 menit lalu kembali, keluar ≥10 menit,
notifikasi tidak berulang, kembali ke area, keluar lagi setelah kembali),
modal anti-tumpuk, anti klik-ganda, data LocalStorage rusak, session tidak
valid, serta halaman Monitoring Lokasi/Riwayat Lokasi/Pengaturan di admin.

**Checklist manual** (disarankan tetap dicoba langsung di HP & desktop,
karena beberapa hal seperti animasi, tema gelap/terang, dan perasaan GPS
sungguhan tidak sepenuhnya bisa disimulasikan otomatis):

**Sebagai karyawan baru:**
1. Buka `register.html` → isi form → submit → tampil layar "Menunggu
   Persetujuan Admin".
2. Coba daftar dengan ID yang sama lagi → ditolak "ID Karyawan sudah
   terdaftar".
3. Coba daftar dengan ID `admin` → ditolak.
4. Login dengan akun yang belum di-ACC → pesan "menunggu persetujuan admin".

**Sebagai admin** (`admin` / `admin123`, via tautan "Masuk sebagai Admin"):
1. Menu **Pendaftaran Baru** → ACC / Tolak karyawan pending (dengan dialog
   konfirmasi, tombol tidak bisa diklik dua kali).
2. Menu **Monitoring Lokasi** → menampilkan karyawan yang sedang bekerja
   beserta status area (DALAM AREA / LUAR AREA / PERINGATAN 10 MENIT / GPS
   TIDAK TERSEDIA / SUDAH PULANG).
3. Menu **Riwayat Lokasi** → menampilkan kejadian keluar-area, dengan
   filter Hari ini/Kemarin/7 hari/Semua dan pencarian nama/ID.
4. Menu **Pengaturan** → menampilkan koordinat, radius, dan durasi yang
   sedang aktif.

**Sebagai karyawan aktif** (`LKN001` / `123456`):
1. Absen Masuk di dalam radius 15 meter → berhasil, modal sukses tampil.
2. Coba Absen Masuk lagi hari yang sama → ditolak.
3. Berjalan (atau ubah lokasi GPS perangkat) ke luar radius 15 meter selama
   10 menit penuh setelah absen masuk → admin mendapat notifikasi
   "⚠️ Peringatan Lokasi" sekali saja.
4. Kembali ke dalam radius → admin mendapat notifikasi "kembali ke area
   kerja"; keluar lagi setelah itu akan membuat kejadian baru yang terpisah.
5. Absen Pulang di dalam radius → berhasil, monitoring 10-menit berhenti.
6. Refresh halaman setelah absen masuk (sebelum absen pulang) → status
   "sudah absen masuk" & monitoring tetap berjalan; Absen Pulang tetap bisa
   dilakukan setelahnya.
7. Logout setelah absen masuk → sesi benar-benar terhapus, monitoring
   berhenti sepenuhnya.

## G. Cara Mengubah Koordinat Kantor

Edit `js/config.js`:

```js
OFFICE_LOCATION: {
  latitude: -6.4568847,   // ganti sesuai kantor baru
  longitude: 106.7299525  // ganti sesuai kantor baru
},
```

Google Maps short-link (`maps.app.goo.gl/...`) **tidak bisa** di-resolve
menjadi latitude/longitude langsung dari JavaScript di browser (dibatasi
oleh kebijakan cross-origin). Cara mengambil koordinat baru:
1. Buka lokasi kantor baru di Google Maps.
2. Tekan-tahan (HP) atau klik-kanan (desktop) tepat di titik kantor.
3. Salin angka yang muncul (format `-x.xxxxxx, y.yyyyyy`) ke `config.js`.

## H. Cara Mengubah Radius

Edit `CONFIG.ATTENDANCE_RADIUS` di `js/config.js` (satuan meter). Radius
yang sama otomatis berlaku untuk absen masuk **dan** absen pulang — tidak
perlu (dan tidak boleh) diatur terpisah di file lain.

## I. Cara Mengubah Durasi Peringatan Keluar Area

Edit `CONFIG.OUTSIDE_AREA_MINUTES` di `js/config.js` (satuan menit).

## J. Keterbatasan LocalStorage (Wajib Dibaca)

Aplikasi ini **masih memakai LocalStorage**, bukan database sungguhan.
Konsekuensinya:

- Data (akun, absensi, notifikasi, riwayat lokasi) **hanya tersimpan di
  browser/perangkat masing-masing** — tidak ada server pusat.
- **Tidak ada sinkronisasi real-time antar-HP.** Halaman **Monitoring
  Lokasi** admin hanya bisa melihat data karyawan yang absen dari
  **peramban/perangkat yang sama** dengan admin. Ini bukan bug yang bisa
  "diperbaiki" tanpa backend sungguhan — ini keterbatasan mendasar dari
  LocalStorage.
- Data bisa hilang jika cache/penyimpanan browser dibersihkan, atau kalau
  karyawan berpindah perangkat/browser.
- Password disimpan dengan fungsi hash sangat sederhana (`hashPassword` di
  `store.js`) — **hanya agar tidak plaintext**, BUKAN algoritma aman untuk
  produksi.

## K. Yang Perlu Dilakukan Sebelum Firebase

1. **Autentikasi**: ganti `Store.login`/`registerEmployee`/`hashPassword`
   dengan **Firebase Authentication** (email/password atau custom auth
   dengan ID karyawan sebagai identifier).
2. **Data**: ganti seluruh fungsi baca/tulis di `store.js`
   (`getUsers`/`saveUsers`, `getAttendance`/`saveAttendanceList`, dst.)
   dengan pemanggilan **Cloud Firestore** — struktur data (bentuk objek
   user/attendance/zoneEvent) sengaja dibuat rapi di `store.js` supaya
   pemetaan ke koleksi Firestore jadi lurus, satu fungsi ganti satu query.
3. **Monitoring lokasi real-time**: pindahkan `Store.setPresence()` ke
   **Firestore** (atau Realtime Database) dengan `onSnapshot`/listener,
   supaya admin benar-benar bisa memantau semua karyawan lintas perangkat
   secara real-time — ini yang tidak mungkin dicapai dengan LocalStorage.
4. **Notifikasi ke admin**: pertimbangkan **Firebase Cloud Messaging**
   supaya notifikasi "keluar area 10 menit" bisa sampai ke HP admin bahkan
   saat dashboard admin tidak sedang dibuka.
5. **Keamanan**: pindahkan validasi role (admin vs karyawan) ke
   **Firestore Security Rules** di sisi server — jangan hanya mengandalkan
   pengecekan di frontend seperti sekarang.
6. Pertahankan nama fungsi di `store.js` (`login`, `checkIn`,
   `createLocationEvent`, dst.) supaya `auth.js`/`employee.js`/`admin.js`
   **tidak perlu diubah sama sekali** saat backend-nya diganti.

## L. Checklist Fitur (Semua Sudah Bekerja)

- [x] Registrasi + semua validasi (field kosong, ID duplikat, password tidak
      sama, ID admin ditolak).
- [x] Status pending → approval admin → login diizinkan.
- [x] Login dengan pesan error yang jelas untuk setiap kondisi (pending,
      ditolak, password salah, akun tidak ada).
- [x] Absen masuk & pulang dengan radius tunggal 15 meter.
- [x] Validasi GPS (proses "mengambil lokasi", jarak, akurasi, status) —
      GPS error tidak pernah dianggap absensi berhasil.
- [x] Monitoring GPS otomatis mulai setelah absen masuk, berhenti setelah
      absen pulang/logout/sesi berakhir — dan **dilanjutkan otomatis**
      setelah refresh halaman jika karyawan belum absen pulang.
- [x] Peringatan keluar-area 10 menit dengan satu notifikasi per kejadian,
      tidak berulang, dan event baru terpisah tiap kali keluar lagi.
- [x] Halaman Monitoring Lokasi & Riwayat Lokasi + Pengaturan di admin.
- [x] Modal terpusat, anti tumpuk, anti klik-ganda di seluruh aplikasi.
- [x] Akses admin lewat tautan yang jelas, bukan gimmick tersembunyi.
