/* ==========================================================================
   RAKABU ATTENDANCE — LOKASI & GEOFENCING
   ==========================================================================
   CARA MENGGANTI KOORDINAT KANTOR:
   1. Buka link lokasi kantor di Google Maps:
      https://maps.app.goo.gl/AqmqNdaZb8x8hbrQ6?g_st=ac
   2. Di Google Maps, klik-kanan (desktop) atau tekan-tahan (HP) tepat pada
      titik kantor lalu pilih koordinat yang muncul (format: -x.xxxxxx, y.yyyyyy),
      atau lihat di address bar setelah membuka lokasi (ada pola @lat,lon,zoom).
   3. Salin nilai latitude & longitude tersebut ke OFFICE_LOCATION di bawah.

   PENTING: Google Maps short-link (maps.app.goo.gl/...) tidak dapat di-resolve
   menjadi latitude/longitude secara langsung dari JavaScript sisi frontend
   (browser akan memblokir permintaan lintas domain semacam ini / URL redirect
   tidak dapat dibaca oleh script). Karena itu koordinat harus diisi manual
   satu kali di bawah ini.
   ========================================================================== */

const OFFICE_LOCATION = {
  // TODO: Ganti dua nilai ini dengan koordinat asli kantor PT Rakabu Sapi Kita
  // yang diambil dari link Google Maps di atas. Jangan biarkan 0,0 di produksi.
  latitude: -7.0000000,
  longitude: 110.0000000,
  attendanceRadius: 3,   // meter — radius wajib untuk boleh absen masuk/pulang
  warningRadius: 5,      // meter — radius batas "aman", di luar ini mulai dihitung
  outsideDurationMs: 5 * 60 * 1000, // 5 menit — batas sebelum alarm & wajib alasan
  maxAcceptableAccuracy: 30 // meter — akurasi GPS lebih buruk dari ini akan diberi peringatan
};
const OFFICE_MAPS_URL = "https://maps.app.goo.gl/AqmqNdaZb8x8hbrQ6?g_st=ac";

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
 * GeoMonitor: mengelola watchPosition + timer 5 menit di luar area + alarm.
 * Dipakai oleh employee.js. Sengaja generic supaya mudah diuji/diganti.
 *
 * callbacks:
 *  onUpdate({distance, accuracy, lat, lon, safe})
 *  onEnterOutside()      -> saat pertama kali melewati warningRadius
 *  onReturnSafe()        -> saat kembali ke dalam warningRadius sebelum limit
 *  onOutsideLimitReached({distance, durationMs}) -> setelah 5 menit penuh di luar
 *  onError(message)
 */
function createGeoMonitor(callbacks) {
  let watchId = null;
  let outsideSince = null;
  let alarmFired = false;
  let maxDistanceWhileOutside = 0;

  function handlePosition(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    const distance = distanceToOffice(latitude, longitude);
    const safe = distance <= OFFICE_LOCATION.warningRadius;

    if (!safe) {
      maxDistanceWhileOutside = Math.max(maxDistanceWhileOutside, distance);
      if (outsideSince === null) {
        outsideSince = Date.now();
        alarmFired = false;
        callbacks.onEnterOutside && callbacks.onEnterOutside();
      } else if (!alarmFired && Date.now() - outsideSince >= OFFICE_LOCATION.outsideDurationMs) {
        alarmFired = true;
        callbacks.onOutsideLimitReached && callbacks.onOutsideLimitReached({
          distance: maxDistanceWhileOutside,
          durationMs: Date.now() - outsideSince
        });
      }
    } else {
      if (outsideSince !== null) {
        callbacks.onReturnSafe && callbacks.onReturnSafe();
      }
      outsideSince = null;
      alarmFired = false;
      maxDistanceWhileOutside = 0;
    }

    callbacks.onUpdate && callbacks.onUpdate({
      distance, accuracy, lat: latitude, lon: longitude, safe,
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
      outsideSince = null; alarmFired = false; maxDistanceWhileOutside = 0;
    },
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
