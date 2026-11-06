/* ==========================================================================
   PT. DEPO PRG — ADAPT (v43)
   Memperbaiki tampilan saat HP membuka situs dalam mode "Situs desktop".
   Di mode itu browser HP memakai lebar tampilan ~980px, sehingga media query
   (min-width:900px) mengira layar PC, padahal layar fisiknya kecil. Akibatnya
   dulu tampilan setengah PC/setengah HP: kartu terpotong, pencarian menimpa
   judul, grafik meluber.
   Solusi: stylesheet dimuat ulang dengan semua ambang lebar (px) dikalikan
   rasio zoom, sehingga media query dievaluasi terhadap lebar layar fisik.
   Hanya aktif untuk HP potret + mode desktop; PC, tablet, dan HP biasa tidak
   tersentuh (nol biaya tambahan).
   ========================================================================== */
(function () {
  "use strict";
  var root = document.documentElement;
  function ratio() {
    try {
      var touch = (navigator.maxTouchPoints || 0) > 0;
      var sw = Math.min(screen.width, screen.height);
      var vw = window.innerWidth || root.clientWidth || 0;
      var land = window.matchMedia && window.matchMedia("(orientation:landscape)").matches;
      if (touch && sw <= 600 && !land && vw >= 800) return Math.max(1, Math.min(3, vw / sw));
    } catch (e) { /* abaikan */ }
    return 0;
  }
  var r = ratio();
  window.__dopRatio = r;
  if (r) {
    var links = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]')).filter(function (l) {
      return /style(-v\d+)?\.css/.test(l.getAttribute("href") || "");
    });
    var texts = [], left = links.length;
    links.forEach(function (l, i) {
      var x = new XMLHttpRequest();
      x.open("GET", l.getAttribute("href"));
      x.onload = function () { texts[i] = x.status === 200 || x.status === 0 ? x.responseText : null; done(); };
      x.onerror = function () { texts[i] = null; done(); };
      x.send();
    });
    var done = function () {
      if (--left > 0) return;
      for (var i = 0; i < texts.length; i++) if (!texts[i]) return; // gagal -> biarkan stylesheet asli
      var css = texts.join("\n").replace(/\((min|max)-width:\s*(\d+(?:\.\d+)?)px\)/g, function (m, k, n) {
        return "(" + k + "-width:" + Math.round(n * r) + "px)";
      });
      var st = document.createElement("style");
      st.id = "dop-css";
      st.appendChild(document.createTextNode(css));
      links[0].parentNode.insertBefore(st, links[0]);
      links.forEach(function (l) { l.parentNode.removeChild(l); });
      if (window.__dopFix) window.__dopFix();
    };
  }
  // Ikon SVG ber-atribut px (mis. width="18") ikut diperbesar sebesar rasio zoom,
  // tetapi SVG yang ukurannya sudah diatur CSS (rem) dibiarkan — sehingga tidak
  // ada ikon yang terskala dua kali (sebelumnya memakai zoom global).
  if (r) {
    var fixSvgs = function () {
      var list = document.querySelectorAll("svg[width]:not([data-dz])");
      for (var i = 0; i < list.length; i++) {
        var sv = list[i];
        sv.setAttribute("data-dz", "1");
        var w = parseFloat(sv.getAttribute("width")), h = parseFloat(sv.getAttribute("height") || w);
        if (!w) continue;
        if (Math.abs(parseFloat(getComputedStyle(sv).width) - w) < 0.6) {
          sv.style.width = (w * r) + "px";
          sv.style.height = (h * r) + "px";
        }
      }
    };
    window.__dopFix = fixSvgs;
    document.addEventListener("DOMContentLoaded", function () {
      fixSvgs();
      if (window.MutationObserver) {
        var t = 0;
        new MutationObserver(function () {
          if (t) return;
          t = requestAnimationFrame(function () { t = 0; fixSvgs(); });
        }).observe(document.body, { childList: true, subtree: true });
      }
    });
  }
  // Putar layar -> hitung ulang; muat ulang hanya bila status mode berubah.
  window.addEventListener("orientationchange", function () {
    setTimeout(function () { if (!!ratio() !== !!window.__dopRatio) location.reload(); }, 450);
  });
})();
