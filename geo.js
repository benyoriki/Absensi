/* ==========================================================================
   DEPO PRG ATTENDANCE — LOKASI (JARAK, AKURASI GPS, MONITORING ZONA) — v8 (rilis v47)
   ==========================================================================
   Semua konfigurasi (koordinat kantor, radius, durasi peringatan) dibaca
   dari CONFIG (lihat config.js). File ini TIDAK menyimpan angka radius
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

const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

/* ==========================================================================
   v47 — MESIN LOKASI AKURAT
   1. createPositionFilter  : filter Kalman 1-D (haluskan jitter GPS realtime)
   2. samplePosition        : kunci GPS multi-sampel (dipakai saat absen)
   3. evaluateLocation      : keputusan radius + toleransi adaptif akurasi
   4. parseMapsInput        : baca koordinat dari link/teks Google Maps
   ========================================================================== */

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

/* ---------- 1. Filter Kalman -------------------------------------------- */
/**
 * Filter Kalman sederhana untuk lintang/bujur. Setiap pembacaan diberi bobot
 * berdasarkan akurasinya (varian = akurasi²): pembacaan akurat menarik
 * estimasi lebih kuat daripada pembacaan kasar. Ketidakpastian membesar
 * seiring waktu (q = meter/detik) sehingga perpindahan nyata tetap terikuti.
 * Jika datang pembacaan JAUH lebih akurat tetapi lokasinya melompat
 * (mis. GPS baru "mengunci" setelah posisi awal dari WiFi), filter
 * di-reset ke pembacaan baru itu — bukan dirata-rata dengan yang lama.
 */
function createPositionFilter(opts) {
  const q = (opts && opts.q) || 3;
  let lat = 0, lon = 0, variance = -1, ts = 0;
  return {
    update(nLat, nLon, accuracy, timestamp) {
      const acc = Math.max(1, Number(accuracy) || 1);
      const t = timestamp || Date.now();
      if (variance < 0) {
        lat = nLat; lon = nLon; variance = acc * acc; ts = t;
      } else {
        const dt = Math.max(0, t - ts);
        variance += (dt * q * q) / 1000;
        const sigma = Math.sqrt(variance);
        const jump = haversineDistance(lat, lon, nLat, nLon);
        if (acc < sigma && jump > 3 * (sigma + acc)) {
          lat = nLat; lon = nLon; variance = acc * acc;
        } else {
          const k = variance / (variance + acc * acc);
          lat += k * (nLat - lat);
          lon += k * (nLon - lon);
          variance = (1 - k) * variance;
        }
        ts = t;
      }
      return this.get();
    },
    get() { return variance < 0 ? null : { lat, lon, accuracy: Math.sqrt(variance) }; },
    reset() { variance = -1; }
  };
}

/* ---------- 2. Penguncian GPS multi-sampel ------------------------------ */
function median(arr) {
  const a = arr.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/**
 * Menggabungkan kumpulan sampel {lat,lon,acc} menjadi satu titik.
 * - Ambil sampel terbaik (akurasi <= 2× akurasi terbaik, maks MAX×2).
 * - Buang outlier: jarak ke median > max(15 m, 2×akurasinya).
 * - Rata-rata berbobot 1/akurasi².
 * - Akurasi akhir dibuat KONSERVATIF: galat GPS berurutan saling
 *   berkorelasi, jadi tidak boleh sekecil sqrt(1/Σw). Dipakai yang terbesar
 *   dari: 0.7×akurasi terbaik, sqrt(1/Σw), dan sebaran sampel (RMS).
 */
function fuseSamples(samples) {
  if (!samples.length) return null;
  const best = Math.min(...samples.map((s) => s.acc));
  const cap = Math.min(best * 2, (CONFIG.MAX_ACCEPTABLE_ACCURACY || 50) * 2);
  let pool = samples.filter((s) => s.acc <= Math.max(cap, best));
  const mLat = median(pool.map((s) => s.lat));
  const mLon = median(pool.map((s) => s.lon));
  const kept = pool.filter((s) => haversineDistance(mLat, mLon, s.lat, s.lon) <= Math.max(15, 2 * s.acc));
  if (kept.length) pool = kept;
  let sw = 0, sLat = 0, sLon = 0;
  pool.forEach((s) => { const w = 1 / (s.acc * s.acc); sw += w; sLat += w * s.lat; sLon += w * s.lon; });
  const lat = sLat / sw, lon = sLon / sw;
  let sq = 0;
  pool.forEach((s) => { const d = haversineDistance(lat, lon, s.lat, s.lon); sq += d * d; });
  const spread = Math.sqrt(sq / pool.length);
  const accuracy = Math.max(0.7 * best, Math.sqrt(1 / sw), spread);
  return { lat, lon, accuracy, used: pool.length, rejected: samples.length - pool.length, spread, best };
}

/**
 * Deteksi anomali pembacaan (indikasi lokasi palsu / sinyal tidak wajar).
 * Browser TIDAK bisa memastikan "fake GPS", jadi ini hanya skor
 * kepercayaan untuk ditinjau admin — tidak pernah memblokir sendiri.
 */
function analyzeSamples(raw, fused, extra) {
  const flags = [];
  const ex = extra || {};
  if (raw.some((s) => s.acc < 1)) flags.push("akurasi-nol");
  if (ex.stale) flags.push("data-basi");
  // Lompatan mustahil antar pembacaan (> 50 m/s ≈ 180 km/jam).
  for (let i = 1; i < raw.length; i++) {
    const dt = (raw[i].t - raw[i - 1].t) / 1000;
    if (dt > 0.2) {
      const v = haversineDistance(raw[i - 1].lat, raw[i - 1].lon, raw[i].lat, raw[i].lon) / dt;
      if (v > 50 && Math.max(raw[i].acc, raw[i - 1].acc) < 50) { flags.push("lompatan-lokasi"); break; }
    }
  }
  // Beku: banyak pembacaan identik sempurna (GPS asli selalu sedikit bergoyang;
  // namun lokasi jaringan/cache juga bisa identik, jadi bobotnya ringan).
  if (raw.length >= 4) {
    const key = (s) => s.lat.toFixed(6) + "," + s.lon.toFixed(6) + "," + s.acc;
    if (new Set(raw.map(key)).size === 1) flags.push("pembacaan-beku");
  }
  if (fused && fused.rejected > 0 && fused.rejected / raw.length >= 0.3) flags.push("banyak-outlier");
  if (fused && fused.used < 2) flags.push("sampel-sedikit");
  if (ex.clockSkew) flags.push("jam-perangkat-tidak-sinkron");

  const penalty = { "akurasi-nol": 30, "data-basi": 15, "lompatan-lokasi": 40, "pembacaan-beku": 25,
    "banyak-outlier": 10, "sampel-sedikit": 10, "jam-perangkat-tidak-sinkron": 10 };
  const trust = Math.max(0, 100 - flags.reduce((n, f) => n + (penalty[f] || 0), 0));
  const trustLevel = trust >= 80 ? "tinggi" : trust >= 50 ? "sedang" : "rendah";
  return { flags, trust, trustLevel };
}

/**
 * Mengunci lokasi dengan mengumpulkan beberapa pembacaan GPS.
 *
 * opts: { onProgress(info), maxWaitMs, targetAccuracy, minSamples }
 * resolve → {lat, lon, accuracy, used, rejected, spread, samples, durationMs,
 *            flags, trust, trustLevel, timestamp}
 * reject  → Error(pesan Indonesia). TIDAK PERNAH menganggap error = berhasil.
 * Hasilnya punya .cancel() untuk membatalkan (mis. modal ditutup).
 */
function samplePosition(opts) {
  const o = opts || {};
  const maxWait = o.maxWaitMs || CONFIG.GPS_MAX_WAIT_MS || 15000;
  const target = o.targetAccuracy || CONFIG.GPS_TARGET_ACCURACY || 15;
  const minSamples = o.minSamples || CONFIG.GPS_MIN_SAMPLES || 3;
  const maxAge = CONFIG.GPS_MAX_SAMPLE_AGE_MS || 20000;
  let cancel = () => {};
  const promise = new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Browser Anda tidak mendukung fitur lokasi. Gunakan browser modern (Chrome/Safari) terbaru."));
      return;
    }
    const startedAt = Date.now();
    const raw = [];
    let watchId = null, timer = null, graceTimer = null, lastErr = null, done = false, stale = false, clockSkew = false;

    function finish(err) {
      if (done) return; done = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer); clearTimeout(graceTimer);
      if (err) { reject(err); return; }
      const fused = fuseSamples(raw);
      if (!fused) { reject(new Error(lastErr ? geoErrorMessage(lastErr) : "Lokasi tidak dapat diperoleh. Pastikan GPS aktif dan izin lokasi diberikan.")); return; }
      const a = analyzeSamples(raw, fused, { stale, clockSkew });
      resolve({
        lat: fused.lat, lon: fused.lon, accuracy: fused.accuracy, used: fused.used,
        rejected: fused.rejected, spread: fused.spread, samples: raw.length,
        durationMs: Date.now() - startedAt, flags: a.flags, trust: a.trust, trustLevel: a.trustLevel,
        timestamp: Date.now()
      });
    }
    cancel = () => finish(new Error("Dibatalkan."));

    function onPos(pos) {
      if (done) return;
      const c = pos.coords;
      const age = Date.now() - (pos.timestamp || Date.now());
      if (age > maxAge) { stale = true; return; }
      if (age < -60000) clockSkew = true;
      if (!Number.isFinite(c.accuracy)) return;
      pushRaw(c, pos.timestamp);
      const fused = fuseSamples(raw.filter((s) => s.acc >= 1 || raw.length === 1));
      const elapsed = Date.now() - startedAt;
      if (o.onProgress) {
        try { o.onProgress({ elapsed, maxWait, samples: raw.length, current: c.accuracy, accuracy: fused ? fused.accuracy : c.accuracy, target }); } catch (e) { /* ignore */ }
      }
      if (fused && fused.used >= minSamples && fused.accuracy <= target && elapsed >= 1500) finish();
    }
    function pushRaw(c, t) {
      raw.push({ lat: c.latitude, lon: c.longitude, acc: c.accuracy, t: t || Date.now() });
    }
    // HP yang jarang mengirim update (mis. lokasi jaringan saat diam) tidak
    // perlu menunggu batas waktu penuh: setelah masa tunggu singkat, selesaikan
    // jika sudah ada hasil yang "baik"; jika belum ada pembacaan sama sekali,
    // coba satu pembacaan langsung (cache ≤ 15 dtk) sebagai cadangan.
    const grace = Math.min(6000, Math.floor(maxWait / 2));
    graceTimer = setTimeout(() => {
      if (done) return;
      const fused = raw.length ? fuseSamples(raw) : null;
      if (fused && fused.accuracy <= (CONFIG.GOOD_ACCURACY || 20)) { finish(); return; }
      if (!raw.length && typeof navigator.geolocation.getCurrentPosition === "function") {
        navigator.geolocation.getCurrentPosition(
          (pos) => { if (!done && Number.isFinite(pos.coords.accuracy)) pushRaw(pos.coords, pos.timestamp); },
          (err) => { lastErr = err; },
          { enableHighAccuracy: true, maximumAge: 15000, timeout: Math.max(2000, maxWait - grace - 500) }
        );
      }
    }, grace);
    function onErr(err) {
      lastErr = err;
      if (err && err.code === err.PERMISSION_DENIED) finish(new Error(geoErrorMessage(err)));
    }
    watchId = navigator.geolocation.watchPosition(onPos, onErr, GEO_OPTIONS);
    timer = setTimeout(() => finish(), maxWait);
  });
  promise.cancel = () => cancel();
  return promise;
}

/* ---------- 3. Keputusan radius + toleransi ----------------------------- */
/**
 * status:
 *   "inside"        jarak <= radius dasar
 *   "tolerance"     di atas radius dasar, tetapi masih dalam radius + bonus
 *                   toleransi akurasi GPS → DIIZINKAN (ditandai)
 *   "outside"       di luar radius efektif
 *   "poor-accuracy" masih dalam radius efektif tetapi akurasi > batas → DITOLAK
 */
function gpsToleranceBonus(accuracy) {
  const acc = Number.isFinite(accuracy) ? Math.max(0, accuracy) : 0;
  const f = CONFIG.GPS_TOLERANCE_FACTOR != null ? CONFIG.GPS_TOLERANCE_FACTOR : 0.5;
  const mx = CONFIG.GPS_TOLERANCE_MAX != null ? CONFIG.GPS_TOLERANCE_MAX : 20;
  return Math.min(acc * f, mx);
}

function evaluateLocation(distance, accuracy, radiusOverride) {
  const radius = radiusOverride != null ? radiusOverride : CONFIG.ATTENDANCE_RADIUS;
  const bonus = gpsToleranceBonus(accuracy);
  const effectiveRadius = radius + bonus;
  const maxAcc = CONFIG.MAX_ACCEPTABLE_ACCURACY;
  const poor = !Number.isFinite(accuracy) || accuracy > maxAcc;
  let status;
  if (distance > effectiveRadius) status = "outside";
  else if (poor) status = "poor-accuracy";
  else if (distance <= radius) status = "inside";
  else status = "tolerance";
  const quality = poor ? "poor" : accuracy <= (CONFIG.GOOD_ACCURACY || 20) ? "good" : "fair";
  return {
    status, allowed: status === "inside" || status === "tolerance",
    distance, accuracy, radius, bonus, effectiveRadius, quality,
    shortBy: Math.max(0, distance - effectiveRadius)
  };
}

/** Sama seperti evaluateLocation tetapi untuk radius area kerja (ZoneMonitor). */
function isInsideWorkArea(distance, accuracy) {
  return distance - gpsToleranceBonus(accuracy) <= CONFIG.OUTSIDE_AREA_RADIUS;
}

/* ---------- 4. Baca koordinat dari link / teks Google Maps -------------- */
/**
 * Menerima link Google Maps panjang atau teks "lat, lon" hasil salin dari
 * Maps (tekan-tahan titik → koordinat muncul di atas). Prioritas:
 *   !3d..!4d..   → pin tempat (paling presisi)
 *   @lat,lon     → pusat tampilan peta
 *   ?q= / ll=    → parameter pencarian
 *   "lat, lon"   → teks biasa
 * Link pendek (maps.app.goo.gl / goo.gl/maps) TIDAK bisa dibaca dari browser
 * (dibatasi CORS) → dikembalikan { error } dengan petunjuk.
 */
function parseMapsInput(input) {
  let t = String(input || "").trim();
  if (!t) return { error: "Kolom masih kosong." };
  try { t = decodeURIComponent(t); } catch (e) { /* biarkan apa adanya */ }
  const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const patterns = [
    [new RegExp("!3d" + num + "!4d" + num), "pin"],
    [new RegExp("@" + num + "," + num), "view"],
    [new RegExp("[?&](?:q|ll|query|center|destination)=" + num + "[,+ ]\\s*" + num), "param"],
    [new RegExp("^\\s*" + num + "\\s*[,;\\s]\\s*" + num + "\\s*$"), "text"]
  ];
  for (const [re, source] of patterns) {
    const m = t.match(re);
    if (m) {
      const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)) return { lat, lon, source };
    }
  }
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(t)) {
    return { error: "Link pendek Google Maps tidak bisa dibaca langsung. Buka link tersebut di Google Maps, tekan-tahan tepat di titik absen, lalu salin angka koordinat yang muncul (contoh: -6.456874, 106.729983) dan tempel di sini. Atau salin link panjang dari bilah alamat browser desktop." };
  }
  return { error: "Koordinat tidak ditemukan. Tempel link panjang Google Maps atau teks koordinat seperti -6.456874, 106.729983." };
}

/**
 * GeoMonitor: watchPosition() untuk menampilkan jarak & akurasi GPS
 * secara realtime di kartu lokasi. Pembacaan dihaluskan filter Kalman.
 * Ini HANYA untuk tampilan — validasi saat absen memakai samplePosition().
 *
 * callbacks:
 *  onUpdate({distance, accuracy, lat, lon, safe, eval, timestamp})
 *  onError(message)
 */
function createGeoMonitor(callbacks) {
  let watchId = null;
  const filter = createPositionFilter({ q: 3 });

  function handlePosition(pos) {
    const c = pos.coords;
    const f = filter.update(c.latitude, c.longitude, c.accuracy, pos.timestamp);
    const distance = distanceToOffice(f.lat, f.lon);
    const accuracy = Math.max(f.accuracy, 0.6 * c.accuracy);
    const ev = evaluateLocation(distance, accuracy);
    callbacks.onUpdate && callbacks.onUpdate({
      distance, accuracy, lat: f.lat, lon: f.lon, safe: ev.allowed, eval: ev,
      rawAccuracy: c.accuracy, timestamp: Date.now()
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
      filter.reset();
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
 * Mengambil lokasi terkunci (dipakai saat proses absen & kalibrasi admin).
 * Kompatibel dengan versi lama: resolve({ coords:{latitude,longitude,accuracy}, ... })
 * ditambah field `fix` berisi hasil lengkap samplePosition().
 * Menolak (reject) jika GPS error/timeout — TIDAK PERNAH menganggap error
 * sebagai absensi berhasil.
 */
function getCurrentPositionOnce(opts) {
  const p = samplePosition(opts);
  const wrapped = p.then((fix) => ({
    coords: { latitude: fix.lat, longitude: fix.lon, accuracy: fix.accuracy },
    timestamp: fix.timestamp, fix
  }));
  wrapped.cancel = p.cancel;
  return wrapped;
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function notifyBrowser(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body, icon: "logo-192.png" }); } catch (e) { /* ignore */ }
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
   absen masuk/pulang, mis. 10 meter). Keduanya sengaja berbeda, lihat
   penjelasan di config.js.

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

  const filter = createPositionFilter({ q: 3 });

  function handlePosition(pos) {
    const c = pos.coords;
    // Pembacaan sangat kasar tidak boleh memulai/menghapus hitungan
    // "keluar area" — tidak bisa dibuktikan sedang di luar atau di dalam.
    if (!(c.accuracy <= CONFIG.MAX_ACCEPTABLE_ACCURACY)) return;
    const f = filter.update(c.latitude, c.longitude, c.accuracy, pos.timestamp);
    const latitude = f.lat, longitude = f.lon, accuracy = f.accuracy;
    const distance = distanceToOffice(latitude, longitude);
    // Toleransi akurasi GPS ikut diperhitungkan agar goyangan GPS di batas
    // area tidak memicu alarm palsu.
    const inside = isInsideWorkArea(distance, accuracy);
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
      filter.reset();
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

// Untuk pengujian otomatis di Node (tidak berpengaruh di browser).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { haversineDistance, createPositionFilter, fuseSamples, analyzeSamples,
    samplePosition, evaluateLocation, gpsToleranceBonus, isInsideWorkArea, parseMapsInput };
}
