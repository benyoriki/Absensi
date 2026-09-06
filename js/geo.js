/* ==========================================================================
   RAKABU ATTENDANCE — LOKASI (JARAK, AKURASI GPS, MONITORING ZONA) — v7
   ==========================================================================
   Semua konfigurasi (koordinat kantor, radius, durasi peringatan) dibaca
   dari CONFIG (lihat js/config.js). File ini TIDAK menyimpan angka radius
   sendiri supaya tidak ada dua sumber kebenaran yang bisa berbeda.

   Berisi dua hal:
   1. GeoMonitor — watchPosition() untuk menampilkan jarak & akurasi GPS
      secara realtime di kartu lokasi karyawan (dipakai sejak dashboard
      dibuka, bukan hanya saat proses absen). "safe" di sini mengacu ke
      CONFIG.ATTENDANCE_RADIUS (radius absen), bukan radius area kerja.
   2. ZoneMonitor — pemantauan "keluar area kerja" yang HANYA aktif setelah
      karyawan absen masuk dan HARUS berhenti setelah absen pulang/logout/
      halaman ditutup/sesi berakhir. Jika karyawan berada di luar
      CONFIG.OUTSIDE_AREA_RADIUS selama CONFIG.OUTSIDE_AREA_MINUTES penuh,
      ZoneMonitor memicu satu event "keluar area". Jika karyawan kembali
      sebelum durasi tersebut tercapai, timer dibatalkan tanpa membuat
      event apa pun (tidak ada notifikasi palsu).
   ========================================================================== */

const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 12000, maximumAge: 3000 };

/**
 * Haversine formula — jarak antar dua titik koordinat dalam meter.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function distanceToOffice(lat, lon) {
  return haversineDistance(lat, lon, CONFIG.OFFICE_LOCATION.latitude, CONFIG.OFFICE_LOCATION.longitude);
}

/**
 * GeoMonitor: watchPosition() untuk menampilkan jarak & akurasi GPS
 * secara realtime di kartu lokasi. Ini HANYA untuk tampilan — validasi
 * radius saat absen dilakukan terpisah lewat getCurrentPositionOnce().
 *
 * callbacks:
 *  onUpdate({distance, accuracy, lat, lon, safe, timestamp})
 *  onError(message)
 */
function createGeoMonitor(callbacks) {
  let watchId = null;

  function handlePosition(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    const distance = distanceToOffice(latitude, longitude);
    const safe = distance <= CONFIG.ATTENDANCE_RADIUS;
    callbacks.onUpdate && callbacks.onUpdate({
      distance, accuracy, lat: latitude, lon: longitude, safe, timestamp: Date.now()
    });
  }

  function handleError(err) {
    callbacks.onError && callbacks.onError(geoErrorMessage(err));
  }

  return {
    start() {
      if (!navigator.geolocation) {
        callbacks.onError && callbacks.onError("Browser Anda tidak mendukung fitur lokasi. Gunakan browser modern (Chrome/Safari) terbaru.");
        return;
      }
      if (watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(handlePosition, handleError, GEO_OPTIONS);
    },
    stop() {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    },
    isRunning() { return watchId !== null; }
  };
}

function geoErrorMessage(err) {
  if (!err) return "Lokasi tidak dapat diperoleh. Pastikan GPS aktif dan izin lokasi diberikan.";
  if (err.code === err.PERMISSION_DENIED) return "Izin lokasi ditolak. Aktifkan izin lokasi untuk browser ini di pengaturan perangkat, lalu muat ulang halaman.";
  if (err.code === err.TIMEOUT) return "Waktu pencarian lokasi habis. Pastikan GPS aktif, lalu coba lagi.";
  if (err.code === err.POSITION_UNAVAILABLE) return "Lokasi tidak dapat diperoleh. Pastikan GPS aktif dan izin lokasi diberikan.";
  return "Lokasi tidak dapat diperoleh. Pastikan GPS aktif dan izin lokasi diberikan.";
}

/**
 * Mengambil satu titik lokasi terbaru (dipakai saat proses absen).
 * Menolak (reject) jika GPS error/timeout — TIDAK PERNAH menganggap error
 * sebagai absensi berhasil.
 */
function getCurrentPositionOnce() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Browser Anda tidak mendukung fitur lokasi. Gunakan browser modern (Chrome/Safari) terbaru."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(new Error(geoErrorMessage(err))),
      GEO_OPTIONS
    );
  });
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function notifyBrowser(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body, icon: "assets/favicon.svg" }); } catch (e) { /* ignore */ }
  }
}

/**
 * ALARM keluar area kerja — bunyi beep (Web Audio API, tidak perlu file
 * audio eksternal) + getaran perangkat (jika didukung). Dipanggil oleh
 * employee.js saat ZoneMonitor melaporkan onOutsideLimitReached, supaya
 * peringatan tidak hanya berupa teks toast/notifikasi diam-diam yang bisa
 * terlewat, tapi benar-benar terdengar oleh karyawan.
 */
function playZoneAlarm() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      // Tiga bunyi "beep" berurutan menyerupai pola alarm peringatan.
      [0, 0.35, 0.7].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 880;
        osc.connect(gain).connect(ctx.destination);
        const start = now + offset;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
        osc.start(start);
        osc.stop(start + 0.3);
      });
      // Tutup AudioContext setelah selesai supaya tidak menumpuk resource
      // kalau alarm ini terpicu berkali-kali dalam satu sesi.
      setTimeout(() => { try { ctx.close(); } catch (e) { /* ignore */ } }, 1500);
    }
  } catch (e) { /* Web Audio tidak didukung — abaikan, notifikasi teks tetap tampil */ }

  if (navigator.vibrate) {
    try { navigator.vibrate([300, 120, 300, 120, 300]); } catch (e) { /* ignore */ }
  }
}

/* ==========================================================================
   ZONE MONITOR — peringatan keluar area kerja selama CONFIG.OUTSIDE_AREA_MINUTES
   ==========================================================================
   Dipakai HANYA setelah karyawan absen masuk (lihat employee.js). Timer
   TIDAK dihitung berdasarkan setInterval yang bisa "ngaret" saat tab tidak
   aktif — sebagai gantinya, setiap update posisi memeriksa apakah cukup
   waktu SUDAH LEWAT sejak `outsideSince` (timestamp asli), sehingga tetap
   akurat walau perangkat tidur/berpindah tab sesaat.

   PENTING: zona "aman" di sini memakai CONFIG.OUTSIDE_AREA_RADIUS (radius
   area kerja, mis. 15 meter) — BUKAN CONFIG.ATTENDANCE_RADIUS (radius
   absen masuk/pulang, mis. 5 meter). Keduanya sengaja berbeda, lihat
   penjelasan di js/config.js.

   callbacks:
   - onEnterOutside({distance})         → karyawan baru saja keluar radius
   - onReturnSafe({distance})           → karyawan kembali sebelum limit
   - onOutsideLimitReached(evt)         → keluar area SELAMA PENUH durasi
   - onReturnAfterEvent(evt)            → kembali setelah event tercatat
   ========================================================================== */
function createZoneMonitor(callbacks) {
  let watchId = null;
  let outsideSince = null;      // timestamp mulai keluar radius (null = di dalam radius)
  let limitReached = false;     // sudah memicu event OUTSIDE_AREA untuk periode keluar saat ini
  let activeEventId = null;     // id event aktif di Store, jika ada

  function handlePosition(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    const distance = distanceToOffice(latitude, longitude);
    const inside = distance <= CONFIG.OUTSIDE_AREA_RADIUS;
    const now = Date.now();

    if (inside) {
      if (outsideSince !== null) {
        // Karyawan baru saja kembali ke dalam radius.
        if (limitReached && activeEventId) {
          callbacks.onReturnAfterEvent && callbacks.onReturnAfterEvent({ id: activeEventId, distance, lat: latitude, lon: longitude });
        } else {
          callbacks.onReturnSafe && callbacks.onReturnSafe({ distance });
        }
      }
      outsideSince = null;
      limitReached = false;
      activeEventId = null;
      return;
    }

    // Di luar radius.
    if (outsideSince === null) {
      outsideSince = now;
      limitReached = false;
      callbacks.onEnterOutside && callbacks.onEnterOutside({ distance });
      return;
    }

    const elapsedMs = now - outsideSince;
    const limitMs = CONFIG.OUTSIDE_AREA_MINUTES * 60 * 1000;
    if (!limitReached && elapsedMs >= limitMs) {
      limitReached = true;
      const evt = callbacks.onOutsideLimitReached && callbacks.onOutsideLimitReached({
        distance, lat: latitude, lon: longitude, accuracy,
        outsideSince, reachedAt: now
      });
      activeEventId = evt && evt.id ? evt.id : null;
    }
  }

  function handleError(err) {
    callbacks.onError && callbacks.onError(geoErrorMessage(err));
  }

  return {
    start() {
      if (!navigator.geolocation || watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(handlePosition, handleError, GEO_OPTIONS);
    },
    stop() {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      outsideSince = null;
      limitReached = false;
      activeEventId = null;
    },
    isRunning() { return watchId !== null; },
    currentState() {
      if (outsideSince === null) return "inside";
      return limitReached ? "limit-reached" : "outside";
    }
  };
}
