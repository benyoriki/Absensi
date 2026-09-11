/* ==========================================================================
   RAKABU ATTENDANCE — CHAT GRUP ("Grup Karyawan")
   ==========================================================================
   Modul mandiri (dipakai bersama oleh employee.html & admin.html) yang
   menjalankan seluruh UI obrolan grup bergaya WhatsApp: bubble pesan,
   pengelompokan pesan berurutan, pemisah tanggal, status centang
   terkirim/dibaca, indikator "sedang mengetik", dan lampiran foto yang
   dikompres di sisi klien sebelum disimpan.

   KETERBATASAN PENTING (DEMO): data obrolan disimpan di localStorage milik
   browser/perangkat ini saja (lihat catatan panjang di js/store.js bagian
   CHAT GRUP). Modul ini membuat sinkronisasi terasa "hidup" ANTAR TAB pada
   browser yang sama lewat event "storage" + BroadcastChannel, plus polling
   ringan sebagai jaring pengaman. Untuk obrolan sungguhan lintas
   perangkat/karyawan, sambungkan Store.sendChatMessage dkk. ke backend
   nyata (Firebase, WebSocket, dsb.) — antarmuka di file ini tidak perlu
   diubah sama sekali karena sudah dipisah dari lapisan data.
   ========================================================================== */
const ChatUI = (function () {
  "use strict";

  const TYPING_TTL_MS = 4000;

  let user = null;
  let el = {};
  let pendingImage = null;
  let channel = null;
  let typingTimeout = null;
  let lastSignature = "";

  function ids() {
    return [
      "chat-messages", "chat-form", "chat-input", "chat-send-btn",
      "chat-attach-btn", "chat-image-input", "chat-image-preview", "chat-image-preview-thumb", "chat-image-preview-cancel",
      "chat-typing-row", "chat-typing-text", "chat-member-count", "chat-info-btn",
      "chat-info-modal", "chat-info-modal-close", "chat-info-list", "chat-scroll-bottom-btn"
    ];
  }
  function toCamel(id) { return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

  function init(currentUser) {
    user = currentUser;
    ids().forEach((id) => { el[toCamel(id)] = document.getElementById(id); });
    if (!el.chatForm || !el.chatMessages) return; // halaman ini tidak memuat markup chat

    el.chatForm.addEventListener("submit", onSubmit);
    el.chatInput.addEventListener("input", onTypingInput);
    el.chatAttachBtn.addEventListener("click", () => el.chatImageInput.click());
    el.chatImageInput.addEventListener("change", onPickImage);
    el.chatImagePreviewCancel.addEventListener("click", clearPendingImage);
    if (el.chatInfoBtn) el.chatInfoBtn.addEventListener("click", openInfo);
    if (el.chatInfoModalClose) el.chatInfoModalClose.addEventListener("click", () => Modal.hide("chat-info-modal"));
    if (el.chatScrollBottomBtn) el.chatScrollBottomBtn.addEventListener("click", () => scrollToBottom(true));
    el.chatMessages.addEventListener("scroll", onScroll);

    // Live-update lintas TAB pada browser yang sama.
    window.addEventListener("storage", (e) => {
      if (e.key === Store.KEYS.chatMessages || e.key === Store.KEYS.chatTyping) render();
    });
    if ("BroadcastChannel" in window) {
      try { channel = new BroadcastChannel("rakabu-chat"); channel.onmessage = render; } catch (e) { channel = null; }
    }
    // Jaring pengaman kalau event storage tak tertembak (mis. tab yang sama).
    setInterval(render, 4000);

    render();
    updateBadges();
  }

  /** Dipanggil oleh route() saat halaman "chat" ditampilkan. */
  function onOpen() {
    if (!el.chatMessages) return;
    render(true);
    Store.markChatRead(user.id);
    scrollToBottom(false);
    updateBadges();
    notifyOtherTabs();
  }

  function notifyOtherTabs() {
    if (channel) { try { channel.postMessage("update"); } catch (e) { /* abaikan */ } }
  }

  function updateBadges() {
    if (!user) return;
    const count = Store.unreadChatCount(user.id);
    document.querySelectorAll("[data-chat-badge]").forEach((badge) => {
      badge.hidden = count <= 0;
      badge.textContent = count > 99 ? "99+" : String(count);
    });
  }

  /* ------------------------------------------------------------------ */
  /* RENDER                                                              */
  /* ------------------------------------------------------------------ */
  function render(force) {
    if (!el.chatMessages) return;
    const messages = Store.getChatMessages();
    const typingSig = JSON.stringify(Store.getChatTyping());
    const sig = messages.length + "|" + (messages.length ? messages[messages.length - 1].id : "") + "|" + typingSig;
    if (!force && sig === lastSignature) return;
    lastSignature = sig;

    const wasAtBottom = isNearBottom();
    const members = Store.chatMembers();
    if (el.chatMemberCount) el.chatMemberCount.textContent = members.length + " anggota";

    el.chatMessages.innerHTML = messages.length
      ? messages.map((m, i) => renderMessage(m, messages[i - 1])).join("")
      : emptyStateHtml();
    hydrateIcons(el.chatMessages);
    bindMessageActions();
    renderTyping();
    if (wasAtBottom) scrollToBottom(false);
    else if (el.chatScrollBottomBtn) el.chatScrollBottomBtn.hidden = false;
    updateBadges();
  }

  function emptyStateHtml() {
    return `<div class="chat-empty">
      <span class="chat-avatar chat-avatar--group chat-avatar--lg" aria-hidden="true"></span>
      <h3>Belum ada pesan</h3>
      <p>Jadilah yang pertama menyapa seluruh tim di grup ini 👋</p>
    </div>`;
  }

  function renderMessage(m, prev) {
    const sender = Store.findUserById(m.senderId);
    const isMine = m.senderId === user.id;
    const name = sender ? sender.name : (m.senderName || "Pengguna");
    const isAdmin = sender ? sender.role === "admin" : m.senderRole === "admin";
    const sameDayAsPrev = prev && Store.localDateKey(new Date(m.createdAt)) === Store.localDateKey(new Date(prev.createdAt));
    const grouped = !!(prev && prev.senderId === m.senderId && sameDayAsPrev && (m.createdAt - prev.createdAt) < 3 * 60 * 1000);
    const showDateSep = !sameDayAsPrev;
    const canDelete = isMine || user.role === "admin";

    let ticks = "";
    if (isMine) {
      const members = Store.chatMembers();
      const readBy = Array.isArray(m.readBy) ? m.readBy : [m.senderId];
      const allRead = members.length > 0 && members.every((mem) => readBy.includes(mem.id));
      const someoneElseRead = readBy.length > 1;
      const icon = someoneElseRead ? "checkDouble" : "checkSingle";
      ticks = `<span class="chat-bubble__ticks${allRead ? " is-read" : ""}">${iconSvg(icon, 14)}</span>`;
    }

    const avatarHtml = (!isMine && !grouped)
      ? `<span class="chat-avatar chat-avatar--sm">${avatarMarkup(sender || { name })}</span>`
      : (!isMine ? `<span class="chat-avatar chat-avatar--sm chat-avatar--spacer" aria-hidden="true"></span>` : "");
    const nameHtml = (!isMine && !grouped)
      ? `<span class="chat-bubble__name">${escapeHtml(name)}${isAdmin ? ' <span class="chat-admin-tag">Admin</span>' : ""}</span>`
      : "";
    const imageHtml = m.image ? `<img src="${m.image}" alt="Lampiran foto" class="chat-bubble__image" loading="lazy" decoding="async" />` : "";
    const textHtml = m.text ? `<p class="chat-bubble__text">${escapeHtml(m.text)}</p>` : "";
    const deleteBtn = canDelete ? `<button type="button" class="chat-bubble__delete" data-del="${m.id}" aria-label="Hapus pesan">${iconSvg("trash", 13)}</button>` : "";

    return (showDateSep ? `<div class="chat-date-sep" role="separator"><span>${chatDateLabel(m.createdAt)}</span></div>` : "") +
      `<div class="chat-row${isMine ? " chat-row--mine" : ""}${grouped ? " chat-row--grouped" : ""}">
        ${avatarHtml}
        <div class="chat-bubble${isMine ? " chat-bubble--mine" : " chat-bubble--theirs"}">
          ${nameHtml}
          ${imageHtml}
          ${textHtml}
          <div class="chat-bubble__meta"><span class="chat-bubble__time">${formatChatTime(m.createdAt)}</span>${ticks}</div>
          ${deleteBtn}
        </div>
      </div>`;
  }

  function bindMessageActions() {
    el.chatMessages.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!window.confirm("Hapus pesan ini untuk semua orang?")) return;
        Store.deleteChatMessage(btn.dataset.del, user.id, user.role === "admin");
        lastSignature = "";
        render(true);
        notifyOtherTabs();
      });
    });
  }

  function chatDateLabel(ts) {
    const key = Store.localDateKey(new Date(ts));
    if (key === Store.localDateKey()) return "Hari ini";
    if (key === Store.localDateKey(new Date(Date.now() - 86400000))) return "Kemarin";
    return formatDateID(key);
  }
  function formatChatTime(ts) {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  /* ------------------------------------------------------------------ */
  /* SCROLL                                                              */
  /* ------------------------------------------------------------------ */
  function isNearBottom() {
    if (!el.chatMessages) return true;
    return el.chatMessages.scrollHeight - el.chatMessages.scrollTop - el.chatMessages.clientHeight < 130;
  }
  function scrollToBottom(smooth) {
    if (!el.chatMessages) return;
    el.chatMessages.scrollTo({ top: el.chatMessages.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    if (el.chatScrollBottomBtn) el.chatScrollBottomBtn.hidden = true;
  }
  function onScroll() {
    if (el.chatScrollBottomBtn) el.chatScrollBottomBtn.hidden = isNearBottom();
  }

  /* ------------------------------------------------------------------ */
  /* KIRIM PESAN                                                         */
  /* ------------------------------------------------------------------ */
  function onSubmit(e) {
    e.preventDefault();
    const text = el.chatInput.value.trim();
    if (!text && !pendingImage) return;
    Store.sendChatMessage({
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      text,
      image: pendingImage ? pendingImage.dataUrl : null
    });
    el.chatInput.value = "";
    clearPendingImage();
    Store.clearChatTyping(user.id);
    lastSignature = "";
    render(true);
    Store.markChatRead(user.id);
    scrollToBottom(true);
    notifyOtherTabs();
  }

  function onTypingInput() {
    Store.setChatTyping(user.id, user.name);
    notifyOtherTabs();
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { Store.clearChatTyping(user.id); notifyOtherTabs(); }, TYPING_TTL_MS);
  }

  function renderTyping() {
    if (!el.chatTypingRow) return;
    const map = Store.getChatTyping();
    const now = Date.now();
    const names = Object.keys(map)
      .filter((uid) => uid !== user.id && (now - map[uid].at) < TYPING_TTL_MS)
      .map((uid) => map[uid].name);
    if (!names.length) { el.chatTypingRow.hidden = true; return; }
    el.chatTypingRow.hidden = false;
    const label = names.length === 1
      ? `${names[0]} sedang mengetik…`
      : `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2} lagi` : ""} sedang mengetik…`;
    el.chatTypingText.textContent = label;
  }

  /* ------------------------------------------------------------------ */
  /* LAMPIRAN FOTO — dikompres di sisi klien (canvas) supaya ringan       */
  /* ------------------------------------------------------------------ */
  function onPickImage() {
    const file = el.chatImageInput.files[0];
    el.chatImageInput.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("File harus berupa gambar.", "error"); return; }
    if (file.size > 8 * 1024 * 1024) { showToast("Ukuran foto asli maksimal 8MB.", "error"); return; }
    compressImageToDataUrl(file, 900, 0.62)
      .then((dataUrl) => {
        if (dataUrl.length > Store.CHAT_IMAGE_MAX_BYTES * 1.4) {
          showToast("Foto masih terlalu besar setelah dikompres, coba foto lain.", "error");
          return;
        }
        pendingImage = { dataUrl };
        el.chatImagePreviewThumb.src = dataUrl;
        el.chatImagePreview.hidden = false;
        el.chatInput.focus();
      })
      .catch(() => showToast("Gagal memproses foto.", "error"));
  }
  function clearPendingImage() {
    pendingImage = null;
    if (el.chatImagePreview) el.chatImagePreview.hidden = true;
    if (el.chatImagePreviewThumb) el.chatImagePreviewThumb.src = "";
  }
  function compressImageToDataUrl(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim; }
            else { width = Math.round(width * maxDim / height); height = maxDim; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          try { resolve(canvas.toDataURL("image/jpeg", quality)); } catch (e) { reject(e); }
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ------------------------------------------------------------------ */
  /* INFO GRUP                                                           */
  /* ------------------------------------------------------------------ */
  function openInfo() {
    if (!el.chatInfoList) return;
    const members = Store.chatMembers().sort((a, b) => (a.role === "admin" ? -1 : 1) - (b.role === "admin" ? -1 : 1));
    el.chatInfoList.innerHTML = members.map((m) => `
      <li class="chat-info-row">
        <span class="chat-avatar chat-avatar--sm">${avatarMarkup(m)}</span>
        <span class="chat-info-row__text">
          <strong>${escapeHtml(m.name)}${m.role === "admin" ? ' <span class="chat-admin-tag">Admin</span>' : ""}</strong>
          <span>${escapeHtml(m.position || (m.role === "admin" ? "Administrator" : "Karyawan"))}</span>
        </span>
      </li>`).join("");
    Modal.show("chat-info-modal");
  }

  return { init, onOpen, updateBadges };
})();
