/* ==========================================================================
   RAKABU ATTENDANCE — REGISTRATION PAGE LOGIC
   ========================================================================== */
(function () {
  "use strict";

  let photoDataUrl = null;

  document.addEventListener("DOMContentLoaded", () => {
    const photoPickBtn = document.getElementById("photo-pick-btn");
    const photoInput = document.getElementById("photo-input");
    const photoPreview = document.getElementById("photo-preview");
    const photoPlaceholder = document.getElementById("photo-placeholder");
    const photoWrap = document.getElementById("photo-preview-wrap");

    photoPickBtn.addEventListener("click", () => photoInput.click());
    photoWrap.addEventListener("click", () => photoInput.click());
    photoInput.addEventListener("change", () => {
      const file = photoInput.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        showToast("Ukuran foto maksimal 2MB.", "error");
        photoInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        photoDataUrl = reader.result;
        photoPreview.src = photoDataUrl;
        photoPreview.style.display = "block";
        photoPlaceholder.style.display = "none";
      };
      reader.readAsDataURL(file);
    });

    const form = document.getElementById("register-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const fields = {
        name: val("reg-name"), id: val("reg-id"), phone: val("reg-phone"),
        email: val("reg-email"), position: val("reg-position"),
        department: val("reg-department"), password: val("reg-password"),
        password2: val("reg-password2")
      };
      clearErrors(["reg-name-error","reg-id-error","reg-phone-error","reg-email-error",
        "reg-position-error","reg-department-error","reg-password-error","reg-password2-error"]);

      let hasError = false;
      if (fields.name.length < 3) { setError("reg-name-error", "Nama minimal 3 karakter."); hasError = true; }
      if (!/^[A-Za-z0-9\-]{3,20}$/.test(fields.id)) { setError("reg-id-error", "ID 3-20 karakter, huruf/angka/tanda hubung."); hasError = true; }
      if (!/^0[0-9]{8,13}$/.test(fields.phone)) { setError("reg-phone-error", "Nomor HP tidak valid."); hasError = true; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) { setError("reg-email-error", "Email tidak valid."); hasError = true; }
      if (!fields.position) { setError("reg-position-error", "Jabatan wajib diisi."); hasError = true; }
      if (!fields.department) { setError("reg-department-error", "Pilih departemen."); hasError = true; }
      if (fields.password.length < 6) { setError("reg-password-error", "Kata sandi minimal 6 karakter."); hasError = true; }
      if (fields.password !== fields.password2) { setError("reg-password2-error", "Konfirmasi kata sandi tidak sama."); hasError = true; }
      if (hasError) return;

      const result = Store.registerEmployee({
        name: fields.name, username: fields.id, phone: fields.phone, email: fields.email,
        position: fields.position, department: fields.department, password: fields.password,
        photo: photoDataUrl
      });

      if (!result.ok) {
        showToast(result.error, "error");
        if (/ID Karyawan/.test(result.error)) setError("reg-id-error", result.error);
        if (/[Ee]mail/.test(result.error)) setError("reg-email-error", result.error);
        return;
      }

      document.getElementById("view-form").hidden = true;
      const pendingView = document.getElementById("view-pending");
      pendingView.hidden = false;
      document.getElementById("pending-name").textContent = fields.name;
      document.getElementById("pending-id").textContent = fields.id;
    });
  });

  function val(id) { return document.getElementById(id).value.trim(); }
  function setError(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
  function clearErrors(ids) { ids.forEach((id) => setError(id, "")); }
})();
