/* ==========================================================================
   RAKABU ATTENDANCE — LOKASI (JARAK & AKURASI GPS)
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

   FITUR "PERINGATAN KELUAR AREA" SUDAH DIHAPUS (atas permintaan): tidak ada
   lagi alarm 5-menit, banner, modal wajib isi alasan, getar, atau bunyi
   apa pun setelah karyawan absen masuk — karyawan boleh pergi sejauh apa
   pun tanpa notifikasi. File ini sekarang HANYA menghitung jarak & akurasi
   GPS untuk ditampilkan di kartu lokasi, dan untuk memvalidasi radius saat
   absen masuk/pulang (attendanceRadius) — dua hal itu TETAP berjalan
   seperti biasa dan tidak berubah.
   ========================================================================== */

const OFFICE_LOCATION = {
  // Koordinat kantor PT Rakabu Sapi Kita — diambil dari:
  // https://maps.app.goo.gl/bpJtNMaJEokaB92G9?g_st=ac
  latitude: -6.4569083,
  longitude: 106.7299401,
  attendanceRadius: 20,  // meter — radius wajib untuk boleh absen masuk/pulang
  warningRadius: 30,     // meter — dipakai untuk skala tampilan radar & progress bar saja
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
 * GeoMonitor: mengelola watchPosition untuk menampilkan jarak & akurasi GPS
 * secara realtime di kartu lokasi karyawan. Tidak ada lagi logika alarm/zona
 * di sini — hanya pelaporan posisi.
 *
 * callbacks:
 *  onUpdate({distance, accuracy, lat, lon, safe})
 *  onError(message)
 */
function createGeoMonitor(callbacks) {
  let watchId = null;

  function handlePosition(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    const distance = distanceToOffice(latitude, longitude);
    const safe = distance <= OFFICE_LOCATION.warningRadius;
    callbacks.onUpdate && callbacks.onUpdate({ distance, accuracy, lat: latitude, lon: longitude, safe });
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

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}
