/* ==========================================================================
   RAKABU ATTENDANCE — LOKASI & GEOFENCING
   ==========================================================================
   Koordinat kantor SUDAH diisi di bawah, diambil dari:
   https://maps.app.goo.gl/bpJtNMaJEokaB92G9?g_st=ac

   Jika suatu saat kantor pindah dan koordinat perlu diganti lagi:
   1. Buka link lokasi baru di Google Maps.
   2. Di Google Maps, klik-kanan (desktop) atau tekan-tahan (HP) tepat pada
      titik kantor lalu salin koordinat yang muncul (format: -x.xxxxxx, y.yyyyyy).
   3. Ganti dua nilai di OFFICE_LOCATION di bawah.

   PENTING: Google Maps short-link (maps.app.goo.gl/...) tidak dapat di-resolve
   menjadi latitude/longitude secara langsung dari JavaScript sisi frontend
   (browser akan memblokir permintaan lintas domain semacam ini). Karena itu
   koordinat harus diisi manual setiap kali kantor berpindah lokasi.

   ATURAN KEAMANAN (mencegah bug alarm palsu): jika OFFICE_LOCATION di bawah
   masih berupa nilai placeholder/tidak valid (0,0 atau di luar rentang bumi),
   sistem TIDAK AKAN mengizinkan monitoring zona menyala sama sekali — lihat
   isOfficeLocationConfigured() / canEnableZoneMonitoring() di bawah. Ini
   mencegah alarm "keluar area" muncul terus-menerus akibat kesalahan
   konfigurasi, bukan akibat karyawan yang benar-benar keluar area.
   ========================================================================== */

const OFFICE_LOCATION = {
  // Koordinat kantor PT Rakabu Sapi Kita — diambil dari:
  // https://maps.app.goo.gl/bpJtNMaJEokaB92G9?g_st=ac
  latitude: -6.4569083,
  longitude: 106.7299401,
  attendanceRadius: 3,   // meter — radius wajib untuk boleh absen masuk/pulang
  warningRadius: 5,      // meter — radius batas "aman", di luar ini mulai dihitung
  outsideDurationMs: 5 * 60 * 1000, // 5 menit — batas sebelum alarm & wajib alasan
  maxAcceptableAccuracy: 30 // meter — akurasi GPS lebih buruk dari ini akan diberi peringatan
};
const OFFICE_MAPS_URL = "https://maps.app.goo.gl/bpJtNMaJEokaB92G9?g_st=ac";

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
  return haversineDistance(lat, lon, OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude);
}

/**
 * Bug guard: mendeteksi apakah koordinat kantor masih nilai contoh/placeholder
 * ATAU nilai yang jelas tidak valid (0,0 / kosong / di luar rentang lat-lon).
 * Jika koordinat tidak valid, absen & monitoring akan selalu gagal/alarm
 * terus-menerus tanpa alasan yang jelas bagi pengguna — jadi sistem TIDAK
 * BOLEH menyalakan alarm zona sama sekali sampai ini benar.
 */
const KNOWN_PLACEHOLDER_COORDS = [
  { lat: -7, lon: 110 } // nilai contoh versi sebelumnya
];
function isOfficeLocationConfigured() {
  const { latitude, longitude } = OFFICE_LOCATION;
  if (typeof latitude !== "number" || typeof longitude !== "number") return false;
  if (!isFinite(latitude) || !isFinite(longitude)) return false;
  if (Math.abs(latitude) < 1e-6 && Math.abs(longitude) < 1e-6) return false; // 0,0
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false; // di luar rentang bumi
  const isKnownPlaceholder = KNOWN_PLACEHOLDER_COORDS.some(
    (p) => Math.abs(latitude - p.lat) < 1e-6 && Math.abs(longitude - p.lon) < 1e-6
  );
  return !isKnownPlaceholder;
}

/**
 * "Aturan" utama yang harus dipenuhi SEMUA sebelum sistem boleh menyalakan
 * alarm zona (bukan hanya menampilkan info jarak). Dipusatkan di satu
 * fungsi supaya konsisten dipakai di semua tempat (employee.js) dan mudah
 * diaudit jika suatu saat muncul laporan bug serupa lagi.
 */
function canEnableZoneMonitoring() {
  return isOfficeLocationConfigured();
}

/**
 * GeoMonitor: mengelola watchPosition + timer 5 menit di luar area + alarm.
 * Dipakai oleh employee.js. Sengaja generic supaya mudah diuji/diganti.
 *
 * PENTING (perbaikan bug): pemantauan lokasi (untuk kartu "Lokasi Anda") dan
 * pemantauan ZONA (yang memicu alarm 5 menit) SEKARANG DIPISAH.
 * - start()/stop()  -> mengaktifkan/menonaktifkan pembacaan GPS itu sendiri.
 * - setZoneActive(bool) -> mengaktifkan/menonaktifkan logika alarm "keluar
 *   area". Ini HARUS hanya true selama karyawan sudah absen masuk dan belum
 *   absen pulang. Sebelumnya alarm bisa menyala bahkan sebelum absen masuk
 *   atau setelah absen pulang — itu bug yang membuat notifikasi/alarm
 *   muncul padahal status masih "BELUM ABSEN".
 *
 * callbacks:
 *  onUpdate({distance, accuracy, lat, lon, safe})
 *  onEnterOutside()      -> saat pertama kali melewati warningRadius (hanya jika zone aktif)
 *  onReturnSafe()        -> saat kembali ke dalam warningRadius sebelum limit
 *  onOutsideLimitReached({distance, durationMs}) -> setelah 5 menit penuh di luar
 *  onError(message)
 */
function createGeoMonitor(callbacks) {
  let watchId = null;
  let outsideSince = null;
  let alarmFired = false;
  let maxDistanceWhileOutside = 0;
  let zoneActive = false;

  function resetZoneState(notify) {
    if (notify && outsideSince !== null) callbacks.onReturnSafe && callbacks.onReturnSafe();
    outsideSince = null;
    alarmFired = false;
    maxDistanceWhileOutside = 0;
  }

  function handlePosition(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    const distance = distanceToOffice(latitude, longitude);
    const safe = distance <= OFFICE_LOCATION.warningRadius;

    if (zoneActive) {
      if (!safe) {
        maxDistanceWhileOutside = Math.max(maxDistanceWhileOutside, distance);
        if (outsideSince === null) {
          outsideSince = Date.now();
          alarmFired = false;
          callbacks.onEnterOutside && callbacks.onEnterOutside();
        } else if (!alarmFired && Date.now() - outsideSince >= OFFICE_LOCATION.outsideDurationMs) {
          alarmFired = true;
          const finalDistance = (typeof maxDistanceWhileOutside === "number" && isFinite(maxDistanceWhileOutside))
            ? maxDistanceWhileOutside : distance;
          // ATURAN: jangan pernah memicu alarm dengan jarak yang tidak valid.
          // Jika entah bagaimana terjadi, batalkan diam-diam dan catat di console
          // alih-alih menampilkan modal dengan "Jarak maksimum: — meter".
          if (typeof finalDistance !== "number" || !isFinite(finalDistance)) {
            console.warn("[Rakabu Attendance] Alarm zona dibatalkan: jarak tidak valid.");
          } else {
            callbacks.onOutsideLimitReached && callbacks.onOutsideLimitReached({
              distance: finalDistance,
              durationMs: Date.now() - outsideSince
            });
          }
        }
      } else if (outsideSince !== null) {
        callbacks.onReturnSafe && callbacks.onReturnSafe();
        resetZoneState(false);
      }
    }

    callbacks.onUpdate && callbacks.onUpdate({
      distance, accuracy, lat: latitude, lon: longitude, safe, zoneActive,
      outsideSince, outsideDurationMs: outsideSince ? Date.now() - outsideSince : 0
    });
  }

  function handleError(err) {
    let message = "Lokasi tidak dapat diperoleh.";
    if (err.code === err.PERMISSION_DENIED) message = "Izin lokasi diperlukan untuk melakukan absensi.";
    else if (err.code === err.TIMEOUT) message = "Waktu pencarian lokasi habis. Coba lagi.";
    callbacks.onError && callbacks.onError(message);
  }

  return {
    start() {
      if (!navigator.geolocation) {
        callbacks.onError && callbacks.onError("Browser Anda tidak mendukung fitur lokasi realtime.");
        return;
      }
      if (watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(handlePosition, handleError, GEO_OPTIONS);
    },
    stop() {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      resetZoneState(false);
      zoneActive = false;
    },
    /**
     * Nyalakan/matikan logika alarm zona. Panggil dengan `true` tepat
     * setelah absen masuk berhasil, dan `false` setelah absen pulang.
     *
     * ATURAN KEAMANAN: permintaan untuk mengaktifkan (true) akan DITOLAK
     * jika koordinat kantor belum dikonfigurasi dengan benar
     * (canEnableZoneMonitoring() === false). Ini mencegah alarm palsu
     * yang membingungkan pengguna ketika admin lupa mengisi koordinat asli.
     */
    setZoneActive(value) {
      if (value && !canEnableZoneMonitoring()) {
        console.warn("[Rakabu Attendance] Monitoring zona TIDAK diaktifkan: koordinat kantor di js/geo.js belum dikonfigurasi dengan benar.");
        zoneActive = false;
        resetZoneState(true);
        callbacks.onConfigInvalid && callbacks.onConfigInvalid();
        return;
      }
      zoneActive = !!value;
      if (!zoneActive) resetZoneState(true);
    },
    isZoneActive() { return zoneActive; },
    getOutsideDurationSec() {
      return outsideSince ? (Date.now() - outsideSince) / 1000 : 0;
    },
    isRunning() { return watchId !== null; }
  };
}

function getCurrentPositionOnce() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Browser Anda tidak mendukung fitur lokasi realtime."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => {
        let message = "Lokasi tidak dapat diperoleh.";
        if (err.code === err.PERMISSION_DENIED) message = "Izin lokasi diperlukan untuk melakukan absensi.";
        else if (err.code === err.TIMEOUT) message = "Waktu pencarian lokasi habis. Coba lagi.";
        reject(new Error(message));
      },
      GEO_OPTIONS
    );
  });
}

/**
 * Memicu alarm: bunyi (WebAudio beep, tanpa file eksternal), getar, dan
 * notifikasi browser jika izin sudah diberikan. Semua bersifat best-effort
 * dan gagal secara diam-diam jika tidak didukung/browser membatasi.
 */
function triggerZoneAlarm(title, body) {
  try {
    if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
  } catch (e) {}
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playBeep = (delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.35);
    };
    playBeep(0); playBeep(0.5); playBeep(1.0);
  } catch (e) {}
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "assets/favicon.svg" });
    }
  } catch (e) {}
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}
