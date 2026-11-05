# Catatan Migrasi Firebase (masa depan) — PT. Depo PRG Employee Portal

> **Status sekarang: TETAP localStorage.** Tidak ada kode Firebase di paket ini.
> localStorage hanya penyimpanan lokal di satu browser — data **tidak** sinkron
> antar perangkat/karyawan dan **bukan** database server. Sistem ini prototipe/demo;
> login-nya bukan autentikasi produksi (hash sandi di `store.js` hanya penyamar).

## Aturan arsitektur
UI (`auth.js`, `employee.js`, `admin.js`, `chat.js`, `register.js`) **hanya** boleh
memanggil `Store.*`. Satu-satunya akses langsung ke localStorage di luar `store.js`
adalah skrip kecil di `<head>` yang *membaca* `rakabu_theme` agar tidak berkedip
saat memuat (read-only, tanpa data perusahaan). Foto absensi ada di IndexedDB (`photo.js`).

```
UI Employee / Admin
        ↓  (hanya lewat Store.*)
   Store (kontrak API)
        ↓
 LocalStorage Adapter (sekarang)   →   Firebase Adapter (nanti)
```

## Langkah penggantian
1. **Pisahkan adapter.** Di `store.js`, `read(key,fallback)` / `write(key,value)` adalah satu-satunya
   titik sentuh localStorage. Buat adapter dengan kontrak yang sama dan pilih lewat `Store.ADAPTER_NAME`.
2. **Autentikasi → Firebase Authentication.** Ganti `login`, `logout`, `currentUser`, `getSession`,
   `registerEmployee`. Pakai email/password (ID karyawan dipetakan ke email, mis. `lkn001@depoprg.local`)
   atau custom claims. Simpan `role` (`admin`/`employee`) sebagai custom claim; jangan hash sandi sendiri.
3. **Data → Cloud Firestore.** Pemetaan key → koleksi:

| Key localStorage | Koleksi Firestore |
|---|---|
| `rakabu_users` | `users/{uid}` |
| `rakabu_attendance` | `attendance/{id}` (index: `userId`, `date`) |
| `rakabu_leave` | `leave/{id}` |
| `rakabu_overtime` | `overtime/{id}` |
| `rakabu_notifications` | `notifications/{id}` (field `audience`) |
| `rakabu_shifts` | `shifts/{id}` |
| `rakabu_office_settings` | `settings/office` |
| `rakabu_zone_events` | `zoneEvents/{id}` |
| `rakabu_presence` | `presence/{userId}` (pakai `onSnapshot`) |
| `rakabu_outside_requests` | `outsideRequests/{id}` |
| `rakabu_chat_messages` / `_reads` / `_typing` | `chat/{id}` / `chatReads/{uid}` / `chatTyping/{uid}` |

4. **Sinkron → asinkron.** Store sekarang sinkron; Firebase asinkron. Ubah fungsi Store menjadi
   `async`, lalu tambahkan `await` di pemanggil (`employee.js`, `admin.js`). Helper analitik v39
   (`getDailyStats`, `getAttendanceTrend`, `getUserMonthSummary`, `getDepartmentStats`,
   `getPendingApprovalCount`) hanya membaca lewat getter Store, jadi ikut berfungsi setelah getter dipindah.
5. **Realtime lintas perangkat.** `setPresence/getPresenceMap` + chat → `onSnapshot`. Notifikasi ke HP admin → FCM.
6. **Keamanan sisi server.** Pindahkan validasi peran & radius absensi ke Firestore Security Rules / Cloud Functions;
   jangan percaya pengecekan frontend saja. Foto → Firebase Storage (bukan IndexedDB).
7. **Migrasi data lama.** Gunakan `Store.exportBackup()` (menu Admin › Pengaturan › Unduh Cadangan) sebagai sumber
   impor. Berkasnya memuat `schemaVersion` (sekarang **1**). Naikkan versi hanya bila bentuk data berubah dan
   tulis migrasinya dulu — jangan menimpa data asli.

## Yang sengaja tidak dilakukan
Tidak ada implementasi/konfigurasi Firebase palsu, tidak ada perubahan nama key, tidak ada perubahan schema.
