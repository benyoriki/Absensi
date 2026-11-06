/* ==========================================================================
   PT. DEPO PRG — UI v42 (Final Visual Polish)
   Perilaku kecil yang aditif untuk desain mockup. TIDAK menyentuh Store,
   GPS, foto, chat, shift, cuti, lembur, laporan, atau PWA.
   - Login: "Ingat saya" (hanya menyimpan ID karyawan, BUKAN kata sandi),
            "Lupa Password?" (menampilkan petunjuk hubungi Admin HR).
   - Admin (HP): tombol hamburger membuka menu lengkap (sheet "Lainnya").
   ========================================================================== */
(function () {
  "use strict";
  var REMEMBER_KEY = "rakabu_remember_user";

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }

  document.addEventListener("DOMContentLoaded", function () {
    /* ---- Login: ingat saya ---- */
    var remember = document.getElementById("login-remember");
    var user = document.getElementById("login-username");
    var form = document.getElementById("login-form");
    if (remember && user && form) {
      var saved = safeGet(REMEMBER_KEY);
      if (saved) { user.value = saved; remember.checked = true; }
      form.addEventListener("submit", function () {
        if (remember.checked && user.value.trim()) safeSet(REMEMBER_KEY, user.value.trim());
        else safeDel(REMEMBER_KEY);
      });
    }

    /* ---- Login: lupa password ---- */
    var forgot = document.getElementById("forgot-password-btn");
    var note = document.getElementById("forgot-password-note");
    if (forgot && note) forgot.addEventListener("click", function () { note.hidden = !note.hidden; });

    /* ---- Admin: hamburger -> menu lengkap ---- */
    var burger = document.getElementById("menu-toggle");
    var more = document.getElementById("more-btn");
    if (burger && more) burger.addEventListener("click", function () { more.click(); });

    /* ---- Admin: grafik tren menyesuaikan HP/desktop saat lebar layar melewati 600px ---- */
    if (document.getElementById("trend-title")) {
      var narrow = window.innerWidth < 600, t = null;
      window.addEventListener("resize", function () {
        clearTimeout(t);
        t = setTimeout(function () {
          var n = window.innerWidth < 600;
          if (n === narrow) return;
          narrow = n;
          var chip = document.querySelector("[data-trend].is-active");
          if (chip) chip.click();
        }, 200);
      });
    }
  });
})();
