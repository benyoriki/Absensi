/* ==========================================================================
   PT. DEPO PRG — ABSEN FOTO (kamera + stempel jam/lokasi)
   ==========================================================================
   Dipakai saat Absen Masuk & Absen Pulang. Alur:
   1. Kamera dibuka langsung (getUserMedia) — TIDAK bisa memilih foto dari
      galeri, jadi foto selalu foto langsung saat absen.
   2. Di atas foto ditempel (di-"burn" ke gambar) stempel: jam, tanggal, hari,
      alamat, koordinat GPS, arah kompas, nama karyawan, jarak ke titik absen,
      jenis absen (Masuk/Pulang) dan kode verifikasi unik.
   3. Foto disimpan di IndexedDB perangkat (bukan localStorage, karena foto
      terlalu besar untuk localStorage). Record absensi hanya menyimpan ID foto.

   Alamat diambil dari OpenStreetMap Nominatim (butuh internet). Jika gagal,
   foto tetap bisa diambil dengan alamat "tidak tersedia" — koordinat tetap ada.
   Kamera & kompas hanya jalan di HTTPS (GitHub Pages sudah HTTPS).
   ========================================================================== */

const AttendancePhoto = (function () {
  "use strict";

  const DB_NAME = "depoprg_photos";
  const STORE = "photos";
  const MAX_EDGE = 1024;          // sisi terpanjang foto (px)
  const JPEG_QUALITY = 0.8;
  const MAX_PREVIEW_AGE_MS = 2 * 60 * 1000; // foto > 2 menit harus diulang
  const FONT = "'Inter','Segoe UI',Roboto,Arial,sans-serif";
  const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  /* ---------------------------- IndexedDB ---------------------------- */
  let dbPromise = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("Penyimpanan foto tidak didukung browser ini.")); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Gagal membuka penyimpanan foto."));
    });
    return dbPromise;
  }
  function savePhoto(rec) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => resolve(rec.id);
      tx.onerror = () => reject(tx.error || new Error("Gagal menyimpan foto."));
    }));
  }
  function getPhoto(id) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }));
  }

  /* ---------------------------- Util ---------------------------- */
  function escapeHtmlLocal(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function genCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
    const arr = new Uint8Array(14);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return Array.from(arr, (b) => chars[b % chars.length]).join("");
  }
  function formatCoord(lat, lon) {
    const ns = lat < 0 ? "S" : "N";
    const ew = lon < 0 ? "W" : "E";
    return Math.abs(lat).toFixed(6) + "°" + ns + ", " + Math.abs(lon).toFixed(6) + "°" + ew;
  }
  function headingText(h) {
    if (h == null || isNaN(h)) return "—";
    const deg = Math.round(((h % 360) + 360) % 360);
    return deg + "° " + DIRS[Math.round(deg / 45) % 8];
  }

  /* ---------------------------- Alamat ---------------------------- */
  const addrCache = {};
  async function reverseGeocode(lat, lon) {
    const key = lat.toFixed(4) + "," + lon.toFixed(4);
    if (addrCache[key]) return addrCache[key];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=id&lat=" + lat + "&lon=" + lon;
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("http " + res.status);
      const json = await res.json();
      const addr = String(json.display_name || "").replace(/,\s*Indonesia$/i, "").trim();
      if (addr) addrCache[key] = addr;
      return addr;
    } catch (e) {
      return "";
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------------------------- Kompas ---------------------------- */
  let compassHeading = null;
  let compassStarted = false;
  function onOrientation(e) {
    if (typeof e.webkitCompassHeading === "number" && !isNaN(e.webkitCompassHeading)) {
      compassHeading = e.webkitCompassHeading; // iOS
    } else if (e.absolute && typeof e.alpha === "number") {
      compassHeading = (360 - e.alpha) % 360;  // Android (deviceorientationabsolute)
    }
  }
  function startCompass() {
    if (compassStarted) return;
    try {
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") {
        // iOS 13+: harus dipanggil dari tap pengguna (open() dipanggil dari tombol).
        DOE.requestPermission().then((r) => {
          if (r === "granted") { window.addEventListener("deviceorientation", onOrientation, true); compassStarted = true; }
        }).catch(() => {});
      } else {
        window.addEventListener("deviceorientationabsolute", onOrientation, true);
        window.addEventListener("deviceorientation", onOrientation, true);
        compassStarted = true;
      }
    } catch (e) { /* kompas opsional */ }
  }

  /* ---------------------------- Stempel ---------------------------- */
  let logoImg = null;
  function loadLogo() {
    if (logoImg) return;
    logoImg = new Image();
    logoImg.src = "logo-192.png";
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line); line = w;
      } else { line = test; }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      kept[maxLines - 1] = kept[maxLines - 1].replace(/[,\s]+$/, "") + "…";
      return kept;
    }
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawStamp(ctx, w, h, d) {
    const s = w / 720;
    const pad = 28 * s;
    const now = d.now;

    // Gradasi gelap atas & bawah supaya teks terbaca di foto terang.
    let g = ctx.createLinearGradient(0, 0, 0, h * 0.2);
    g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.2);
    const gh = h * 0.5;
    g = ctx.createLinearGradient(0, h - gh, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.55, "rgba(0,0,0,.6)"); g.addColorStop(1, "rgba(0,0,0,.85)");
    ctx.fillStyle = g; ctx.fillRect(0, h - gh, w, gh);

    ctx.textBaseline = "alphabetic";

    // --- Kiri atas: logo + nama perusahaan
    const logoSize = 64 * s;
    ctx.fillStyle = "#fff";
    roundRect(ctx, pad, pad, logoSize, logoSize, 14 * s); ctx.fill();
    if (logoImg && logoImg.complete && logoImg.naturalWidth) {
      ctx.save(); roundRect(ctx, pad, pad, logoSize, logoSize, 14 * s); ctx.clip();
      ctx.drawImage(logoImg, pad, pad, logoSize, logoSize); ctx.restore();
    }
    ctx.fillStyle = "#fff"; ctx.font = "800 " + (32 * s) + "px " + FONT;
    ctx.fillText("PT. Depo PRG", pad + logoSize + 16 * s, pad + 30 * s);
    ctx.font = "500 " + (22 * s) + "px " + FONT; ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillText("Absensi Digital", pad + logoSize + 16 * s, pad + 58 * s);

    // --- Kanan atas: lencana jenis absen
    const badge = d.type === "check-in" ? "ABSEN MASUK" : "ABSEN PULANG";
    ctx.font = "800 " + (24 * s) + "px " + FONT;
    const bw = ctx.measureText(badge).width + 36 * s;
    const bh = 44 * s;
    ctx.fillStyle = "#F5A623";
    roundRect(ctx, w - pad - bw, pad + 10 * s, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(badge, w - pad - bw + 18 * s, pad + 10 * s + 30 * s);

    // --- Bawah: dihitung dari bawah ke atas
    const rightReserve = 56 * s; // ruang untuk teks vertikal di tepi kanan
    const contentW = w - pad * 2 - rightReserve;

    // Kotak koordinat/kompas/karyawan
    const lineH = 38 * s;
    const boxLines = [
      "Koordinat: " + formatCoord(d.lat, d.lon),
      "Kompas: " + headingText(d.heading) + "   ·   Akurasi GPS ±" + Math.round(d.accuracy || 0) + " m",
      d.name + (d.userId ? " (" + d.userId + ")" : "") + "   ·   " + d.distance.toFixed(1) + " m dari titik absen"
    ];
    ctx.font = "500 " + (24 * s) + "px " + FONT;
    const boxH = lineH * boxLines.length + 18 * s;
    const boxY = h - pad - boxH;
    ctx.fillStyle = "rgba(255,255,255,.16)";
    roundRect(ctx, pad, boxY, contentW, boxH, 12 * s); ctx.fill();
    ctx.fillStyle = "#fff";
    boxLines.forEach((t, i) => {
      let txt = t;
      while (ctx.measureText(txt).width > contentW - 28 * s && txt.length > 8) txt = txt.slice(0, -2);
      if (txt !== t) txt = txt.replace(/\s+$/, "") + "…";
      ctx.fillText(txt, pad + 14 * s, boxY + 9 * s + lineH * (i + 0.72));
    });

    // Alamat (maks 3 baris)
    ctx.font = "500 " + (30 * s) + "px " + FONT;
    const addrText = d.address || (d.addressPending ? "Mencari alamat…" : "Alamat tidak tersedia (tanpa koneksi internet)");
    const addrLines = wrapLines(ctx, addrText, contentW, 3);
    const addrLH = 38 * s;
    const addrBottom = boxY - 14 * s;
    ctx.fillStyle = "#fff";
    addrLines.forEach((t, i) => {
      const y = addrBottom - (addrLines.length - 1 - i) * addrLH - 8 * s;
      ctx.fillText(t, pad, y);
    });
    const addrTop = addrBottom - addrLines.length * addrLH;

    // Jam besar + garis oranye + tanggal & hari
    const timeStr = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
    const timeFont = 112 * s;
    ctx.font = "800 " + timeFont + "px " + FONT;
    const tw = ctx.measureText(timeStr).width;
    const timeBase = addrTop - 22 * s;
    ctx.fillStyle = "#fff";
    ctx.fillText(timeStr, pad, timeBase);
    ctx.fillStyle = "#F5A623";
    ctx.fillRect(pad + tw + 18 * s, timeBase - timeFont * 0.82, 6 * s, timeFont * 0.82);
    ctx.fillStyle = "#fff"; ctx.font = "700 " + (36 * s) + "px " + FONT;
    const dx = pad + tw + 38 * s;
    ctx.fillText(now.getDate() + " " + MONTHS[now.getMonth()] + " " + now.getFullYear(), dx, timeBase - timeFont * 0.46);
    ctx.font = "600 " + (34 * s) + "px " + FONT; ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText(DAYS[now.getDay()], dx, timeBase - 2 * s);

    // Teks vertikal di tepi kanan: kode verifikasi
    ctx.save();
    ctx.translate(w - 22 * s, h - pad);
    ctx.rotate(-Math.PI / 2);
    ctx.font = "800 " + (22 * s) + "px " + FONT;
    ctx.fillStyle = "#fff";
    ctx.fillText(d.code, 0, 0);
    const cw = ctx.measureText(d.code + "  ").width;
    ctx.font = "500 " + (22 * s) + "px " + FONT; ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillText("PT. Depo PRG Verified", cw, 0);
    ctx.restore();
  }

  /* ---------------------------- Kamera ---------------------------- */
  function cameraErrorMessage(err) {
    const name = err && err.name;
    if (name === "NotAllowedError" || name === "SecurityError") return "Izin kamera ditolak. Aktifkan izin kamera untuk browser ini di pengaturan HP, lalu coba lagi.";
    if (name === "NotFoundError" || name === "OverconstrainedError") return "Kamera tidak ditemukan di perangkat ini.";
    if (name === "NotReadableError") return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.";
    return "Kamera tidak dapat dibuka. Pastikan halaman dibuka lewat HTTPS dan izin kamera aktif.";
  }

  /**
   * open({ container, type, user, meta, onDone, onCancel })
   *  - container: elemen tempat UI kamera dirender (badan modal absen)
   *  - meta: { lat, lon, accuracy, distance } hasil GPS sebelum foto
   *  - onDone({ id, code, address, heading, capturedAt })
   */
  function open(opts) {
    startCompass(); // harus sinkron dari tap pengguna (syarat iOS)
    loadLogo();

    const { container, type, user, meta } = opts;
    const state = {
      stream: null, raf: 0, stopped: false, facing: "user",
      address: "", addressPending: true, code: genCode(),
      ready: false, lastDraw: 0, shot: null
    };

    container.innerHTML = `
      <div class="att-cam">
        <div class="att-cam__stage">
          <canvas class="att-cam__canvas" width="720" height="960"></canvas>
          <img class="att-cam__shot" alt="Hasil foto absen" hidden />
          <div class="att-cam__msg" role="status">Menyiapkan kamera…</div>
        </div>
        <div class="att-cam__actions" data-step="live">
          <button type="button" class="btn btn--primary btn--block" data-act="shoot" disabled>📷 Ambil Foto</button>
          <button type="button" class="btn btn--ghost btn--block" data-act="flip">🔄 Ganti Kamera</button>
          <button type="button" class="btn btn--ghost btn--block" data-act="back">Kembali</button>
        </div>
        <div class="att-cam__actions" data-step="review" hidden>
          <button type="button" class="btn btn--primary btn--block" data-act="use">${type === "check-in" ? "✅ Gunakan Foto & Absen Masuk" : "✅ Gunakan Foto & Absen Pulang"}</button>
          <button type="button" class="btn btn--ghost btn--block" data-act="retake">↺ Ulangi Foto</button>
        </div>
      </div>`;

    const canvas = container.querySelector(".att-cam__canvas");
    const shotImg = container.querySelector(".att-cam__shot");
    const msg = container.querySelector(".att-cam__msg");
    const liveActions = container.querySelector('[data-step="live"]');
    const reviewActions = container.querySelector('[data-step="review"]');
    const shootBtn = container.querySelector('[data-act="shoot"]');
    const useBtn = container.querySelector('[data-act="use"]');
    const ctx = canvas.getContext("2d");
    const video = document.createElement("video");
    video.setAttribute("playsinline", ""); video.muted = true; video.autoplay = true;

    function stamp(now) {
      return {
        now, lat: meta.lat, lon: meta.lon, accuracy: meta.accuracy, distance: meta.distance,
        heading: compassHeading, address: state.address, addressPending: state.addressPending,
        type, name: (user && (user.name || user.fullName)) || "Karyawan",
        userId: user && (user.username || user.employeeId || user.id) || "", code: state.code
      };
    }

    function drawFrame() {
      if (!video.videoWidth) return false;
      const sc = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
      const cw = Math.round(video.videoWidth * sc), ch = Math.round(video.videoHeight * sc);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      ctx.drawImage(video, 0, 0, cw, ch);
      drawStamp(ctx, cw, ch, stamp(new Date()));
      return true;
    }

    function stopCamera() {
      state.stopped = true;
      if (state.raf) cancelAnimationFrame(state.raf);
      if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
      video.srcObject = null;
    }

    function loop(ts) {
      if (state.stopped) return;
      const modal = document.getElementById("attendance-modal");
      if (!canvas.isConnected || (modal && modal.hidden)) { stopCamera(); return; }
      if (ts - state.lastDraw > 66) { state.lastDraw = ts; drawFrame(); }
      state.raf = requestAnimationFrame(loop);
    }

    function refreshShootBtn() { shootBtn.disabled = !(state.ready && !state.addressPending); }

    async function startStream() {
      state.ready = false; refreshShootBtn();
      msg.hidden = false; msg.textContent = "Menyiapkan kamera…";
      if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        msg.textContent = "Browser ini tidak mendukung kamera, atau halaman tidak dibuka lewat HTTPS. Absen foto tidak dapat dilakukan.";
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: state.facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false
        });
        if (state.stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        state.stream = stream; video.srcObject = stream;
        await video.play().catch(() => {});
        state.ready = true; msg.hidden = true;
        state.stopped = false;
        if (!state.raf) state.raf = requestAnimationFrame(loop);
        refreshShootBtn();
      } catch (err) {
        msg.hidden = false; msg.textContent = cameraErrorMessage(err);
      }
    }

    // Alamat dicari paralel dengan kamera.
    reverseGeocode(meta.lat, meta.lon).then((a) => {
      state.address = a; state.addressPending = false; refreshShootBtn();
    });

    function showReview(dataUrl) {
      state.shot = { dataUrl, at: Date.now(), address: state.address, heading: compassHeading };
      shotImg.src = dataUrl; shotImg.hidden = false; canvas.hidden = true;
      liveActions.hidden = true; reviewActions.hidden = false;
    }

    function retake() {
      state.shot = null; state.code = genCode();
      shotImg.hidden = true; canvas.hidden = false;
      reviewActions.hidden = true; liveActions.hidden = false;
      state.stopped = false; state.raf = 0;
      startStream();
    }

    container.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn || btn.disabled) return;
      const act = btn.dataset.act;
      if (act === "shoot") {
        if (!drawFrame()) return;
        const url = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        stopCamera();
        showReview(url);
      } else if (act === "flip") {
        state.facing = state.facing === "user" ? "environment" : "user";
        startStream();
      } else if (act === "retake") {
        retake();
      } else if (act === "back") {
        stopCamera();
        opts.onCancel && opts.onCancel();
      } else if (act === "use") {
        if (!state.shot) return;
        if (Date.now() - state.shot.at > MAX_PREVIEW_AGE_MS) {
          if (typeof showToast === "function") showToast("Foto sudah lebih dari 2 menit. Silakan ambil ulang.", "error");
          retake(); return;
        }
        useBtn.disabled = true; useBtn.textContent = "Menyimpan…";
        try {
          const id = "ph_" + Date.now().toString(36) + "_" + state.code.slice(0, 5);
          await savePhoto({
            id, dataUrl: state.shot.dataUrl, code: state.code, type,
            userId: user && user.id, createdAt: state.shot.at, address: state.shot.address,
            lat: meta.lat, lon: meta.lon
          });
          opts.onDone && opts.onDone({
            id, code: state.code, address: state.shot.address,
            heading: state.shot.heading, capturedAt: state.shot.at
          });
        } catch (err) {
          useBtn.disabled = false;
          useBtn.textContent = type === "check-in" ? "✅ Gunakan Foto & Absen Masuk" : "✅ Gunakan Foto & Absen Pulang";
          if (typeof showToast === "function") showToast((err && err.message) || "Gagal menyimpan foto.", "error");
        }
      }
    });

    startStream();
  }

  /* ---------------------------- Penampil foto ---------------------------- */
  function ensureViewer() {
    let ov = document.getElementById("photo-viewer-modal");
    if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "photo-viewer-modal";
    ov.className = "modal-overlay";
    ov.hidden = true;
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.innerHTML = `
      <div class="modal photo-viewer">
        <div class="modal__head"><h2 id="photo-viewer-title">Foto Absen</h2><button class="icon-btn" type="button" id="photo-viewer-close" aria-label="Tutup">✕</button></div>
        <div id="photo-viewer-body" class="photo-viewer__body"></div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov) Modal.hide("photo-viewer-modal"); });
    ov.querySelector("#photo-viewer-close").addEventListener("click", () => Modal.hide("photo-viewer-modal"));
    return ov;
  }

  function view(photoId, title) {
    const ov = ensureViewer();
    ov.querySelector("#photo-viewer-title").textContent = title || "Foto Absen";
    const body = ov.querySelector("#photo-viewer-body");
    body.innerHTML = '<p class="text-muted text-sm">Memuat foto…</p>';
    Modal.show("photo-viewer-modal");
    getPhoto(photoId).then((rec) => {
      if (!rec) {
        body.innerHTML = '<p class="text-muted text-sm">Foto tidak ditemukan di perangkat ini. Foto hanya tersimpan di HP/browser yang dipakai saat absen.</p>';
        return;
      }
      body.innerHTML = `
        <img src="${rec.dataUrl}" alt="Foto absen" class="photo-viewer__img" />
        <a class="btn btn--ghost btn--block mt-1" href="${rec.dataUrl}" download="absen-${escapeHtmlLocal(rec.code)}.jpg">⬇️ Unduh Foto</a>`;
    }).catch(() => {
      body.innerHTML = '<p class="text-muted text-sm">Gagal membuka foto.</p>';
    });
  }

  /** HTML tombol "📷 Masuk / 📷 Pulang" untuk satu record absensi. */
  function buttonsHtml(record, who) {
    const out = [];
    const label = who ? " — " + escapeHtmlLocal(who) : "";
    if (record.checkInPhoto) out.push(`<button type="button" class="btn btn--ghost btn--sm" data-photo="${escapeHtmlLocal(record.checkInPhoto)}" data-photo-title="Foto Masuk${label}">📷 Masuk</button>`);
    if (record.checkOutPhoto) out.push(`<button type="button" class="btn btn--ghost btn--sm" data-photo="${escapeHtmlLocal(record.checkOutPhoto)}" data-photo-title="Foto Pulang${label}">📷 Pulang</button>`);
    return out.join(" ");
  }

  function bindViewButtons(root) {
    root.querySelectorAll("[data-photo]").forEach((btn) => {
      btn.addEventListener("click", () => view(btn.dataset.photo, btn.dataset.photoTitle));
    });
  }

  return { open, view, buttonsHtml, bindViewButtons, getPhoto };
})();
