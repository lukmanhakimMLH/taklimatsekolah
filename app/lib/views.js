// Templat HTML ringkas (tiada enjin templat luaran)
const C = require('../config');
const { STATUS } = require('./util');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pill(status) {
  const [t, c] = STATUS[status] || [status, ''];
  return `<span class="pill ${c}">${t}</span>`;
}

function layout({ title, body, user, back, tone, flash, unread }) {
  const isAdmin = user && ['admin', 'admin_utama'].includes(user.role) && user.status === 'aktif';
  const topCls = tone === 'admin' ? 'top admin' : tone === 'red' ? 'top red' : 'top';
  return `<!doctype html><html lang="ms"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f5c4a">
<link rel="manifest" href="/manifest.json"><link rel="icon" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon-192.png">
<title>${esc(title)} · ${esc(C.APP_NAME)}</title>
<link rel="stylesheet" href="/style.css">
</head><body>
<header class="${topCls}">
  ${back ? `<a class="bk" href="${esc(back)}" aria-label="Kembali">‹</a>` : ''}
  <span class="tt">${esc(title)}</span>
  ${user && user.status === 'aktif' ? `<span class="tr">
    <a href="/notifikasi" class="ic" aria-label="Notifikasi">🔔${unread ? `<i>${unread}</i>` : ''}</a>
    <details class="menu"><summary aria-label="Menu">☰</summary><nav>
      <a href="/dashboard">Dashboard</a>
      <a href="/permohonan/baru">+ Permohonan baru</a>
      <a href="/senarai/semua">Semua permohonan saya</a>
      <a href="/profil">Profil &amp; tandatangan</a>
      ${isAdmin ? `<hr><b class="mh">ADMIN</b>
      <a href="/admin/ejen">Urus ejen</a>
      <a href="/admin/pengesahan">Pengesahan email</a>
      <a href="/admin/permohonan">Semua permohonan</a>
      <a href="/admin/prestasi">Prestasi</a>` : ''}
      <hr><form method="post" action="/logout"><button class="linkbtn">Log keluar</button></form>
    </nav></details></span>` : ''}
</header>
<main>
${flash ? `<div class="flash ${esc(flash.type || '')}">${esc(flash.msg)}</div>` : ''}
${body}
</main>
<script src="/app.js"></script>
</body></html>`;
}

module.exports = { esc, pill, layout };
