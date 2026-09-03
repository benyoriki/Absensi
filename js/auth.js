/* ==========================================================================
   RAKABU ATTENDANCE — LOGIN PAGE LOGIC
   ========================================================================== */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    // Jika sudah login, langsung arahkan ke dashboard masing-masing.
    const existing = Store.currentUser();
    if (existing) {
      window.location.replace(existing.role === "admin" ? "admin.html" : "employee.html");
      return;
    }

    const viewLogin = document.getElementById("view-login");
    const viewAdminLogin = document.getElementById("view-admin-login");

    /* ---------------- Login karyawan ---------------- */
    const loginForm = document.getElementById("login-form");
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      clearErrors(["login-username-error", "login-password-error"]);
      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value;

      if (!username) return setError("login-username-error", "ID Karyawan wajib diisi.");
      if (!password) return setError("login-password-error", "Kata sandi wajib diisi.");

      setLoading(true);
      setTimeout(() => {
        const result = Store.login(username, password, "employee");
        setLoading(false);
        if (!result.ok) {
          setError("login-password-error", result.error);
          showToast(result.error, "error");
          return;
        }
        showToast("Berhasil masuk. Mengalihkan…", "success");
        setTimeout(() => window.location.href = "employee.html", 400);
      }, 450);
    });

    function setLoading(isLoading) {
      const btn = document.getElementById("login-submit-btn");
      const label = document.getElementById("login-submit-label");
      btn.disabled = isLoading;
      label.innerHTML = isLoading ? '<span class="spinner" style="border-top-color:#fff;border-color:rgba(255,255,255,.4)"></span> Memproses…' : "MASUK";
    }

    /* ---------------- 5x tap logo -> admin access ---------------- */
    let tapCount = 0;
    let tapTimer = null;
    const brandTarget = document.getElementById("brand-tap-target");
    brandTarget.addEventListener("click", () => {
      tapCount++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { tapCount = 0; }, 2000);
      if (tapCount >= 5) {
        tapCount = 0;
        viewLogin.hidden = true;
        viewAdminLogin.hidden = false;
        document.getElementById("admin-username").focus();
      }
    });

    document.getElementById("back-to-login-btn").addEventListener("click", () => {
      viewAdminLogin.hidden = true;
      viewLogin.hidden = false;
    });

    /* ---------------- Login admin ---------------- */
    const adminForm = document.getElementById("admin-login-form");
    adminForm.addEventListener("submit", (e) => {
      e.preventDefault();
      clearErrors(["admin-username-error", "admin-pin-error"]);
      const username = document.getElementById("admin-username").value.trim();
      const pin = document.getElementById("admin-pin").value;
      if (!username) return setError("admin-username-error", "Username admin wajib diisi.");
      if (!pin) return setError("admin-pin-error", "Password/PIN wajib diisi.");

      const result = Store.login(username, pin, "admin");
      if (!result.ok) {
        setError("admin-pin-error", result.error);
        showToast(result.error, "error");
        return;
      }
      showToast("Verifikasi admin berhasil.", "success");
      setTimeout(() => window.location.href = "admin.html", 350);
    });
  });

  function setError(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
  function clearErrors(ids) { ids.forEach((id) => setError(id, "")); }
})();
