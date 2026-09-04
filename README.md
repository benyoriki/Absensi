# Rakabu Attendance — PT Rakabu Sapi Kita

## 🗑️ Fitur "Peringatan Keluar Area" — SUDAH DIHAPUS TOTAL

Atas permintaan, fitur ini **dihapus dari kode**, bukan cuma dimatikan lewat
saklar. Yang dihapus:
- Modal "Peringatan Keluar Area" + form alasan (`critical-warning-modal`) di
  `employee.html`.
- Kartu "Monitoring Area Kerja" + banner "Anda berada di luar area kerja" di
  `employee.html`.
- Semua logika alarm 5-menit, timer, getar, bunyi, dan notifikasi terkait di
  `js/geo.js` dan `js/employee.js`.

Sekarang karyawan **bebas pergi sejauh apa pun** setelah absen masuk — tidak
ada notifikasi, banner, modal, getar, atau bunyi apa pun yang akan muncul.

**Yang TIDAK berubah** (tetap berjalan seperti biasa): absen masuk & absen
pulang tetap mewajibkan karyawan berada dalam radius kantor
(`attendanceRadius`, 20 meter), dan kartu "Lokasi Anda" (jarak + akurasi GPS)
di dashboard tetap tampil sebagai bagian dari proses absen.

Kalau suatu saat fitur ini ingin dibangun ulang, disarankan sebagai fitur
baru dari nol, bukan mengembalikan kode lama — sebelumnya versi ini pernah
dicoba dimatikan lewat saklar `ZONE_ALARM_ENABLED` di `js/geo.js`, tapi
opsi itu sudah tidak ada lagi di kode karena seluruh mesinnya sudah dibuang.

---

## 🔧 Perbaikan Putaran Ke-2 (setelah laporan bug dari layar HP)

Dua laporan bug baru sudah diperbaiki:

1. **"Sudah kirim alasan, notifikasi/modal tidak hilang"** — Root cause-nya
   BUKAN di logika pengiriman alasan (`onSubmitZoneReason` di `employee.js`
   sudah benar menutup modal), melainkan **modal yang saling menumpuk**:
   sebelum ini, setiap modal (`Menu Lainnya`, `Absen Masuk/Pulang`, `Sukses`,
   `Peringatan Keluar Area` di karyawan; `Menu Lainnya`, `Detail Karyawan`,
   `Tolak`, `Konfirmasi` di admin) hanya mengatur `hidden` pada dirinya
   sendiri, tanpa pernah menutup modal lain yang mungkin masih terbuka di
   belakangnya. Kalau dua modal kebetulan sama-sama tidak `hidden` (misalnya
   akibat klik ganda, event yang datang beruntun, atau kondisi race lain),
   keduanya tampil bertumpuk — persis seperti pada screenshot: overlay gelap
   berlapis, dan teks satu modal "menembus" ke modal lain. Ini yang membuat
   layar tampak macet/tidak merespons.
   **Perbaikan:** ditambahkan `showModal()` di `employee.js` dan `admin.js`
   yang **selalu menutup semua modal lain** sebelum membuka satu modal yang
   diminta. Sekarang mustahil dua modal tampil bersamaan.
2. **"Tidak bisa masuk Dashboard Admin"** — Ini paling sering terjadi karena
   dua hal, silakan cek satu per satu:
   - Akses admin **sengaja disembunyikan**: dari halaman login karyawan,
     **ketuk logo/lambang "Rakabu Attendance" di bagian atas sebanyak 5 kali
     dengan cepat** (dalam 2 detik) — bukan lewat tombol biasa. Setelah itu
     form login admin akan muncul. Login dengan `admin` / `admin123`.
   - Jika sebelumnya sempat macet karena bug modal-tumpuk di atas, maka
     setelah tumpukan modal ini diperbaiki, admin seharusnya bisa
     melanjutkan proses (approve/tolak) tanpa layar macet lagi.
   - **Kalau website yang online (`benyoriki.github.io/Absensi/`) masih
     menampilkan perilaku lama setelah Anda unggah ulang file dari paket
     ini**, kemungkinan besar itu karena **cache browser** menyimpan versi
     JS/CSS lama. Semua referensi `css/style.css` dan `js/*.js` di file HTML
     sudah ditambahkan `?v=2` di paket ini supaya browser dipaksa mengambil
     file terbaru. Setelah unggah ulang ke GitHub, lakukan **hard refresh**
     (Ctrl+Shift+R di desktop, atau buka di jendela penyamaran/incognito di
     HP) sekali saja untuk memastikan versi baru yang termuat.

---

## 🔧 Perbaikan Sebelumnya (Bug Fix + Redesign)

**Bug utama yang diperbaiki** (penyebab notifikasi "Peringatan Keluar Area"
muncul padahal status masih "BELUM ABSEN", seperti di laporan Anda):

Sebelumnya `js/geo.js` menyalakan pemantauan zona (timer 5 menit + alarm)
**sejak halaman dibuka**, bukan hanya setelah Absen Masuk. Akibatnya:
- Alarm keluar-area bisa berbunyi sebelum karyawan absen sama sekali.
- Alarm juga tetap berbunyi setelah karyawan absen pulang dan sudah legal
  meninggalkan kantor.
- Karena alarm terpicu di luar alur yang seharusnya, nilai jarak yang
  ditampilkan di modal ("Jarak maksimum: — meter") kadang tidak konsisten.

**Perbaikan:** pemantauan zona kini punya sakelar terpisah
(`monitor.setZoneActive()`) yang hanya aktif dari saat **Absen Masuk**
berhasil sampai **Absen Pulang**. Sudah diverifikasi lewat simulasi logika
(lihat catatan commit) bahwa: sebelum absen → tidak ada alarm; setelah
absen masuk & 5 menit di luar radius → alarm muncul dengan jarak terisi
benar; setelah absen pulang → alarm berhenti sepenuhnya.

Perbaikan lain:
- Data sisa cuti di dashboard sekarang selalu diambil ulang dari
  penyimpanan (sebelumnya bisa menampilkan angka lama/basi setelah admin
  memproses pengajuan cuti).
- Jarak pada notifikasi "keluar area" sekarang disimpan sebagai nilai,
  bukan dibaca ulang dari teks yang ditampilkan di layar (lebih tahan
  terhadap race condition).
- Ditambahkan peringatan otomatis jika koordinat kantor di `js/geo.js`
  masih nilai contoh (placeholder) — supaya tidak membingungkan jika lupa
  diisi.

**Redesign tampilan:**
- Semua ikon emoji (🏠📍🔔 dst., yang tampil beda-beda di tiap HP/OS)
  diganti dengan sistem ikon SVG kustom yang konsisten — kesan jauh lebih
  rapi dan "aplikasi sungguhan", bukan template.
- Kartu status kehadiran di dashboard karyawan kini memakai aksen gradasi
  sebagai satu titik fokus visual yang berani, sementara kartu lain tetap
  bersih agar tidak ramai.
- Kartu statistik admin diberi garis aksen warna + ikon vektor + efek
  hover halus untuk kesan lebih premium.
- Ikon tombol Absen Masuk/Pulang, modal sukses, dan modal peringatan
  kini vektor tajam, bukan karakter panah/emoji polos.

---


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

## 4. Koordinat Kantor & Aturan Anti-Bug

Koordinat kantor **sudah diisi** di `js/geo.js` (`OFFICE_LOCATION`), diambil
dari link Google Maps: `https://maps.app.goo.gl/bpJtNMaJEokaB92G9?g_st=ac`
→ **-6.4569083, 106.7299401**.

Jika kantor pindah lokasi dan koordinat perlu diganti lagi:

```js
const OFFICE_LOCATION = {
  latitude: -6.4569083,   // GANTI jika kantor pindah
  longitude: 106.7299401, // GANTI jika kantor pindah
  attendanceRadius: 3,
  warningRadius: 5,
  outsideDurationMs: 5 * 60 * 1000,
  maxAcceptableAccuracy: 30
};
```

**Kenapa tidak otomatis?** Short-link Google Maps (`maps.app.goo.gl/...`)
tidak bisa di-resolve menjadi latitude/longitude langsung dari JavaScript
browser (kebijakan CORS browser). Cara mengambil koordinat baru jika kantor
pindah lagi:

1. Buka link lokasi baru — akan mengarah ke titik di Google Maps.
2. Tekan-tahan (HP) atau klik-kanan (desktop) tepat di titik kantor.
3. Salin angka yang muncul (format `-6.xxxxxx, 106.xxxxxx`) ke
   `OFFICE_LOCATION` di atas.

**Aturan anti-bug (baru ditambahkan):** sistem sekarang memvalidasi sendiri
apakah `OFFICE_LOCATION` masuk akal (bukan 0,0, bukan di luar rentang bumi,
bukan nilai contoh lama). Jika tidak valid, **monitoring zona/alarm 5 menit
otomatis dinonaktifkan seluruhnya** — bukan hanya diberi peringatan — supaya
kesalahan konfigurasi tidak pernah lagi memicu notifikasi "Peringatan Keluar
Area" yang salah/membingungkan. Ini bisa dicek di konsol browser (pesan
`[Rakabu Attendance] Monitoring zona TIDAK diaktifkan...`) dan lewat badge
"KONFIGURASI LOKASI BELUM VALID" di kartu Monitoring Area Kerja karyawan.

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
