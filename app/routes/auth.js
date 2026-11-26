// Log masuk, daftar, profil ejen & tandatangan, status menunggu
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const C = require('../config');
const { one, all, run, notify, notifyAdmins } = require('../db');
const { esc } = require('../lib/views');
const { tarikhMasa } = require('../lib/util');
const G = require('./guard');

router.get('/', (req, res) => {
  if (!req.user) return res.redirect('/login');
  res.redirect('/dashboard');
});

const authForm = (mode, v = {}) => `
<div class="authbox">
  <img class="logo" src="/icon.svg" alt="">
  <h2 class="center">${mode === 'login' ? 'Log Masuk' : 'Daftar Akaun Ejen'}</h2>
  <form method="post" class="card">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="email" value="${esc(v.email)}">
    <label for="password">Kata laluan</label>
    <input id="password" name="password" type="password" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
    ${mode === 'daftar' ? `<label for="password2">Ulang kata laluan</label><input id="password2" name="password2" type="password" required minlength="6" autocomplete="new-password">` : ''}
    <button class="btn">${mode === 'login' ? 'LOG MASUK' : 'DAFTAR'}</button>
  </form>
  <p class="center small">${mode === 'login' ? 'Ejen baru? <a href="/daftar">Daftar di sini</a>' : 'Sudah ada akaun? <a href="/login">Log masuk</a>'}</p>
</div>`;

router.get('/login', (req, res) => res.page({ title: C.APP_NAME, body: authForm('login') }));
router.post('/login', (req, res) => {
  const u = one('SELECT * FROM users WHERE email=?', String(req.body.email || '').trim());
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.password_hash)) {
    res.flash('Email atau kata laluan salah.', 'err');
    return res.redirect('/login');
  }
  req.session.uid = u.id;
  res.redirect('/');
});

router.get('/daftar', (req, res) => res.page({ title: C.APP_NAME, body: authForm('daftar') }));
router.post('/daftar', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const pw = String(req.body.password || '');
  if (pw.length < 6) { res.flash('Kata laluan sekurang-kurangnya 6 aksara.', 'err'); return res.redirect('/daftar'); }
  if (pw !== req.body.password2) { res.flash('Kata laluan tidak sama.', 'err'); return res.redirect('/daftar'); }
  if (one('SELECT id FROM users WHERE email=?', email)) { res.flash('Email ini sudah didaftar. Sila log masuk.', 'err'); return res.redirect('/login'); }
  // Pengguna pertama = Admin Utama
  const first = one('SELECT COUNT(*) n FROM users').n === 0;
  const r = run('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)', email, bcrypt.hashSync(pw, 10), first ? 'admin_utama' : 'ejen');
  req.session.uid = Number(r.lastInsertRowid);
  res.redirect('/profil');
});

router.post('/logout', (req, res) => { req.session = null; res.redirect('/login'); });

// ---------- PROFIL & TANDATANGAN ----------
function profilForm(u, v) {
  const lockKod = u.status === 'aktif' && u.kod_ejen;
  const baru = u.status !== 'aktif';
  return `
<form method="post" action="/profil" id="fprofil">
  ${baru ? `<p class="muted small">Lengkapkan profil &amp; tandatangan. Selepas dihantar, admin perlu luluskan sebelum anda boleh buat permohonan.</p>` : ''}
  <div class="card">
    <h3 style="margin-top:0">Maklumat ejen</h3>
    <label for="nama">Nama penuh (seperti dalam surat) *</label>
    <input id="nama" name="nama" required value="${esc(v.nama)}" placeholder="cth: Mohamad Lukman Hakim bin Md Zaki">
    <label for="no_ic">No. Kad Pengenalan *</label>
    <input id="no_ic" name="no_ic" required inputmode="numeric" pattern="[0-9]{6}-?[0-9]{2}-?[0-9]{4}" placeholder="900101-01-1234" value="${esc(v.no_ic)}">
    <label>Jawatan (tetap)</label>
    <input value="🔒 ${esc(C.JAWATAN_EJEN)}" readonly>
    <label for="telefon">No. telefon *</label>
    <input id="telefon" name="telefon" required inputmode="tel" value="${esc(v.telefon)}" placeholder="019-7784918">
    <label for="email">Email *</label>
    <input id="email" name="email" type="email" required value="${esc(v.email)}">
    <label for="kod_ejen">Kod ejen *</label>
    <input id="kod_ejen" name="kod_ejen" required value="${esc(v.kod_ejen)}" ${lockKod ? 'readonly' : ''} placeholder="cth: QZ-0417">
    ${lockKod ? '<p class="tiny muted">Kod ejen tidak boleh diubah selepas diluluskan. Hubungi admin.</p>' : ''}
  </div>
  <div class="card">
    <h3 style="margin-top:0">Tandatangan</h3>
    ${u.signature ? `<div class="sigimg" id="sig-current"><div class="tiny muted">Tandatangan semasa</div><img src="${u.signature}" alt="Tandatangan semasa"></div><p class="tiny muted">Lukis di bawah hanya jika mahu tukar.</p>` : ''}
    <div class="sigwrap"><canvas></canvas><div class="line"></div><div class="hint">✕ Tandatangan guna jari di atas garisan</div></div>
    <input type="hidden" name="signature" id="signature">
    <div class="two"><button type="button" class="btn o sm" id="sig-clear">↺ Padam</button>
      <label class="btn o sm" style="margin-top:6px;color:var(--pri)">⬆ Muat naik gambar<input type="file" accept="image/*" id="sig-upload" hidden></label></div>
    <div class="alert warn small" style="margin-top:12px">Tandatangan ini akan dicetak secara automatik dalam <b>setiap surat</b> yang anda jana.</div>
    <label style="display:flex;gap:8px;align-items:flex-start;color:var(--ink);font-weight:500"><input type="checkbox" name="sahkan" value="1" required style="width:auto;margin-top:3px"> Saya sahkan ini tandatangan saya sendiri.</label>
  </div>
  <button class="btn">${baru ? 'HANTAR UNTUK KELULUSAN' : 'SIMPAN PROFIL'}</button>
</form>`;
}

router.get('/profil', G.login, (req, res) => {
  const u = req.user;
  if (u.status === 'digantung') return res.redirect('/menunggu');
  res.page({ title: u.status === 'aktif' ? 'Profil Ejen' : 'Lengkapkan Profil Ejen', back: u.status === 'aktif' ? '/dashboard' : null, body: profilForm(u, u) });
});

router.post('/profil', G.login, (req, res) => {
  const u = req.user;
  if (u.status === 'digantung') return res.redirect('/menunggu');
  const b = req.body;
  const v = {
    nama: String(b.nama || '').trim(),
    no_ic: String(b.no_ic || '').replace(/\D/g, ''),
    telefon: String(b.telefon || '').trim(),
    email: String(b.email || '').trim().toLowerCase(),
    kod_ejen: (u.status === 'aktif' && u.kod_ejen) ? u.kod_ejen : String(b.kod_ejen || '').trim().toUpperCase(),
  };
  const sig = String(b.signature || '');
  const err = [];
  if (!v.nama || !v.telefon || !v.email || !v.kod_ejen) err.push('Sila isi semua medan wajib.');
  if (v.no_ic.length !== 12) err.push('No. IC mesti 12 digit.');
  if (!sig && !u.signature) err.push('Sila tandatangan dahulu.');
  if (sig && !/^data:image\/png;base64,/.test(sig)) err.push('Tandatangan tidak sah.');
  if (!b.sahkan) err.push('Sila tanda kotak pengesahan tandatangan.');
  if (one('SELECT id FROM users WHERE kod_ejen=? AND id<>?', v.kod_ejen, u.id)) err.push(`Kod ejen ${v.kod_ejen} sudah didaftar oleh ejen lain.`);
  if (one('SELECT id FROM users WHERE email=? AND id<>?', v.email, u.id)) err.push('Email ini sudah digunakan akaun lain.');
  v.no_ic = v.no_ic.replace(/^(\d{6})(\d{2})(\d{4})$/, '$1-$2-$3');
  if (err.length) {
    res.flash(err.join(' '), 'err');
    return res.page({ title: 'Profil Ejen', back: u.status === 'aktif' ? '/dashboard' : null, body: profilForm(u, { ...u, ...v }) });
  }
  let status = u.status;
  if (['profil', 'ditolak'].includes(u.status)) status = u.role === 'admin_utama' ? 'aktif' : 'menunggu';
  run('UPDATE users SET nama=?, no_ic=?, telefon=?, email=?, kod_ejen=?, signature=COALESCE(?, signature), status=?, sebab_status=CASE WHEN ?<>status THEN NULL ELSE sebab_status END WHERE id=?',
    v.nama, v.no_ic, v.telefon, v.email, v.kod_ejen, sig || null, status, status, u.id);
  if (status === 'menunggu' && u.status !== 'menunggu') notifyAdmins(`Ejen baru menunggu kelulusan: ${v.nama} (${v.kod_ejen})`, `/admin/ejen/${u.id}`);
  if (status === 'aktif' && u.status !== 'aktif') { res.flash('Profil disimpan. Anda Admin Utama – akaun terus aktif.'); return res.redirect('/dashboard'); }
  if (status === 'aktif') { res.flash('Profil dikemas kini.'); return res.redirect('/dashboard'); }
  res.redirect('/menunggu');
});

router.get('/menunggu', G.login, (req, res) => {
  const u = req.user;
  if (u.status === 'aktif') return res.redirect('/dashboard');
  if (u.status === 'profil') return res.redirect('/profil');
  const S = {
    menunggu: ['⏳', 'Menunggu Kelulusan Admin', 'Profil anda telah dihantar. Anda akan dapat akses penuh selepas admin meluluskan akaun anda.', 'warn'],
    ditolak: ['✕', 'Pendaftaran Ditolak', 'Sila betulkan profil anda dan hantar semula.', 'err'],
    digantung: ['⛔', 'Akaun Digantung', 'Akaun anda telah digantung oleh admin. Hubungi admin untuk maklumat lanjut.', 'err'],
  }[u.status];
  res.page({ title: 'Status Akaun', body: `
  <div class="center" style="padding-top:20px">
    <div class="avatar" style="background:var(--amber2);border-color:var(--amber)">${S[0]}</div>
    <h2>${S[1]}</h2>
    <p class="muted">${S[2]}</p>
  </div>
  ${u.sebab_status ? `<div class="alert ${S[3]}"><div class="h">Sebab</div>${esc(u.sebab_status)}</div>` : ''}
  <div class="card small"><b>${esc(u.nama)}</b><br>Kod Ejen: <b>${esc(u.kod_ejen)}</b><br>Dikemas kini: ${tarikhMasa(u.created_at)}</div>
  ${u.status !== 'digantung' ? '<a class="btn o" href="/profil">✎ Edit profil</a>' : ''}
  <form method="post" action="/logout"><button class="btn o" style="border-color:var(--line);color:var(--mute)">Log keluar</button></form>` });
});

router.get('/notifikasi', G.aktif, (req, res) => {
  const ns = all('SELECT * FROM notifikasi WHERE user_id=? ORDER BY id DESC LIMIT 100', req.user.id);
  run('UPDATE notifikasi SET dibaca=1 WHERE user_id=?', req.user.id);
  res.page({ title: 'Notifikasi', back: '/dashboard', body: ns.length ? `<div class="card" style="padding:0;overflow:hidden">${ns.map(n => `<a class="notif ${n.dibaca ? '' : 'new'}" href="${esc(n.link || '#')}">${esc(n.teks)}<div class="tiny muted">${tarikhMasa(n.created_at)}</div></a>`).join('')}</div>` : '<div class="empty">Tiada notifikasi.</div>' });
});

module.exports = router;
