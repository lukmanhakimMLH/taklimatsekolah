(function () {
  // Pengesahan sebelum hantar borang
  document.addEventListener('submit', function (e) {
    var m = e.target.getAttribute('data-confirm');
    if (m && !confirm(m)) e.preventDefault();
  });

  // Butang salin
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var el = document.getElementById(b.getAttribute('data-copy'));
    var txt = el ? (el.value || el.innerText) : b.getAttribute('data-text');
    var done = function () { var o = b.innerText; b.innerText = '✓ Disalin'; setTimeout(function () { b.innerText = o; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () { fallback(txt); done(); });
    else { fallback(txt); done(); }
  });
  function fallback(t) { var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }

  // Pad tandatangan
  var wrap = document.querySelector('.sigwrap');
  if (wrap) {
    var cv = wrap.querySelector('canvas'), out = document.getElementById('signature'), ctx = cv.getContext('2d'), drawing = false, dirty = false, last;
    function size() {
      var r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      cv.width = r.width * d; cv.height = r.height * d; ctx.scale(d, d);
      ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14306b';
    }
    size();
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener('pointerdown', function (e) { drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', function (e) {
      if (!drawing) return; var p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; dirty = true;
    });
    function end() { if (drawing && dirty) out.value = trimmed(); drawing = false; }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    document.getElementById('sig-clear').addEventListener('click', function () { ctx.clearRect(0, 0, cv.width, cv.height); out.value = ''; dirty = false; var pv = document.getElementById('sig-current'); if (pv) pv.style.display = 'none'; });
    function trimmed() {
      // potong ruang kosong supaya tandatangan kemas dalam surat
      var w = cv.width, h = cv.height, d = ctx.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < x0) return '';
      var pad = 6, c2 = document.createElement('canvas'); c2.width = x1 - x0 + pad * 2; c2.height = y1 - y0 + pad * 2;
      c2.getContext('2d').drawImage(cv, x0 - pad, y0 - pad, c2.width, c2.height, 0, 0, c2.width, c2.height);
      return c2.toDataURL('image/png');
    }
    var up = document.getElementById('sig-upload');
    if (up) up.addEventListener('change', function () {
      var f = up.files[0]; if (!f) return;
      var img = new Image(), rd = new FileReader();
      rd.onload = function () { img.src = rd.result; };
      img.onload = function () {
        // buang latar putih → telus
        var c = document.createElement('canvas'), s = Math.min(1, 600 / img.width); c.width = img.width * s; c.height = img.height * s;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
        var id = x.getImageData(0, 0, c.width, c.height), p = id.data;
        for (var i = 0; i < p.length; i += 4) { var l = (p[i] + p[i + 1] + p[i + 2]) / 3; if (l > 200) p[i + 3] = 0; else { p[i] = 20; p[i + 1] = 48; p[i + 2] = 107; } }
        x.putImageData(id, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        var r = cv.getBoundingClientRect(), sc = Math.min(r.width / c.width, (r.height - 40) / c.height);
        ctx.drawImage(c, (r.width - c.width * sc) / 2, 10, c.width * sc, c.height * sc);
        dirty = true; out.value = trimmed();
      };
      rd.readAsDataURL(f);
    });
  }

  // Semakan bertindan secara langsung
  var ag = document.getElementById('nama_agensi');
  if (ag) {
    var box = document.getElementById('semak'), btn = document.getElementById('btn-jana'), t;
    var lock = document.querySelectorAll('[data-lock]');
    function setLock(on) { lock.forEach(function (el) { el.disabled = on; }); if (btn) btn.disabled = on; }
    function check() {
      var v = ag.value.trim();
      if (v.length < 3) { box.innerHTML = ''; setLock(false); return; }
      fetch('/api/semak?nama=' + encodeURIComponent(v)).then(function (r) { return r.json(); }).then(function (j) {
        box.innerHTML = j.html; setLock(!!j.bertindan);
      });
    }
    ag.addEventListener('input', function () { clearTimeout(t); t = setTimeout(check, 600); });
    if (ag.value) check();
  }

  // Kadar closing automatik
  var hd = document.getElementById('hadir'), cl = document.getElementById('closing'), kd = document.getElementById('kadar');
  if (hd && cl && kd) {
    var f = function () { var a = +hd.value, b = +cl.value; kd.textContent = a > 0 ? (Math.round(b / a * 1000) / 10) + '%' : '–'; };
    hd.addEventListener('input', f); cl.addEventListener('input', f); f();
  }

  // Daftar service worker (boleh "Add to Home Screen")
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {});
})();
