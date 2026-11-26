// Apps Taklimat Agensi – paparan & navigasi (hash router)
import * as DB from './db.js';
import * as S from './surat.js';
import * as U from './util.js';
const { esc, pill, CFG } = U;

const $app = document.getElementById('app');
let me = null;          // dokumen pengguna semasa
let flash = null;       // mesej sekali papar
const isAdmin = u => u && ['admin', 'admin_utama'].includes(u.role) && u.status === 'aktif';
const utama = u => u && u.role === 'admin_utama';
const go = h => { if (location.hash === h) route(); else location.hash = h; };
const setFlash = (msg, type = '') => { flash = { msg, type }; };

// ---------- RANGKA HALAMAN ----------
let alertCount = 0;
function paint({ title, body, back, tone }) {
  const topCls = tone === 'admin' ? 'top admin' : tone === 'red' ? 'top red' : 'top';
  const f = flash; flash = null;
  $app.innerHTML = `
<header class="${topCls}">
  ${back ? `<a class="bk" href="${esc(back)}" aria-label="Kembali">‹</a>` : ''}
  <span class="tt">${esc(title)}</span>
  ${me && me.status === 'aktif' ? `<span class="tr">
    <a href="#/dashboard" class="ic" aria-label="Amaran">🔔${alertCount ? `<i>${alertCount}</i>` : ''}</a>
    <details class="menu"><summary aria-label="Menu">☰</summary><nav>
      <a href="#/dashboard">Dashboard</a>
      <a href="#/baru">+ Permohonan baru</a>
      <a href="#/senarai/semua">Semua permohonan saya</a>
      <a href="#/profil">Profil &amp; tandatangan</a>
      ${isAdmin(me) ? `<hr><b class="mh">ADMIN</b>
      <a href="#/admin/ejen">Urus ejen</a>
      <a href="#/admin/pengesahan">Pengesahan email</a>
      <a href="#/admin/permohonan">Semua permohonan</a>
      <a href="#/admin/prestasi">Prestasi</a>
      ${utama(me) ? '<a href="#/admin/tetapan">Tetapan robot email</a>' : ''}` : ''}
      <hr><button class="linkbtn" data-act="logout">Log keluar</button>
    </nav></details></span>` : ''}
</header>
<main>
${f ? `<div class="flash ${esc(f.type)}">${esc(f.msg)}</div>` : ''}
${body}
</main>`;
  window.scrollTo(0, 0);
  pasang();
}
const render = o => o; // halaman dipulangkan, route() yang lukis
const loading = () => { $app.querySelector('main') ? ($app.querySelector('main').style.opacity = .5) : ($app.innerHTML = '<div class="empty" style="padding-top:40vh">Memuatkan…</div>'); };

// ---------- ROUTER ----------
const ROUTES = [];
const r = (pat, fn, guard = 'aktif') => ROUTES.push({ re: new RegExp('^' + pat.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn, guard });

let seq = 0;
async function route() {
  const my = ++seq;
  const h = (location.hash || '#/').slice(1) || '/';
  const [path, qs] = h.split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  if (!DB.dikonfigur) return paint({ title: 'Belum ditetapkan', body: '<div class="card">Firebase belum ditetapkan. Isi <b>firebase-config.js</b> – lihat <b>PANDUAN.md</b>.</div>' });
  for (const rt of ROUTES) {
    const m = path.match(rt.re);
    if (!m) continue;
    if (rt.guard !== 'awam') {
      if (!me) return go('#/login');
      if (rt.guard !== 'login') {
        if (me.status !== 'aktif') await muatMe(); // mungkin baru diluluskan
        if (!me) return go('#/login');
        if (me.status === 'profil') return go('#/profil');
        if (me.status !== 'aktif') return go('#/menunggu');
        if (rt.guard === 'admin' && !isAdmin(me)) return paint({ title: 'Tiada akses', back: '#/dashboard', body: '<div class="empty">Halaman ini untuk admin sahaja.</div>' });
      }
    }
    loading();
    try {
      const out = await rt.fn({ ...m.groups }, q);
      if (my === seq && out && out.body !== undefined) paint(out);
    } catch (e) {
      console.error(e);
      if (my === seq) paint({ title: 'Ralat', back: '#/dashboard', body: `<div class="alert err">${esc(DB.mesejRalat(e))}</div>` });
    }
    return;
  }
  go(me ? '#/dashboard' : '#/login');
}

// ---------- BORANG & BUTANG ----------
const FORMS = {}, ACTS = {};
function pasang() {
  $app.querySelectorAll('form[data-f]').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    if (f.dataset.confirm && !confirm(f.dataset.confirm)) return;
    const btn = f.querySelector('button[type=submit],button:not([type])');
    if (btn) { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = 'Sila tunggu…'; }
    try { await FORMS[f.dataset.f](Object.fromEntries(new FormData(f)), f); }
    catch (err) { console.error(err); setFlash(DB.mesejRalat(err), 'err'); if (btn) { btn.disabled = false; btn.textContent = btn.dataset.t; } const m = $app.querySelector('main'); if (m) { m.querySelector('.flash')?.remove(); m.insertAdjacentHTML('afterbegin', `<div class="flash err">${esc(flash.msg)}</div>`); flash = null; window.scrollTo(0, 0); } }
  }));
  initSig(); initSemak(); initKadar();
}
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]');
  if (a) {
    e.preventDefault();
    if (a.dataset.confirm && !confirm(a.dataset.confirm)) return;
    try { await ACTS[a.dataset.act](a.dataset, a); } catch (err) { console.error(err); alert(DB.mesejRalat(err)); }
    return;
  }
  const c = e.target.closest('[data-copy]');
  if (c) {
    const el = document.getElementById(c.dataset.copy);
    const txt = el ? (el.value || el.innerText) : '';
    const done = () => { const o = c.innerText; c.innerText = '✓ Disalin'; setTimeout(() => { c.innerText = o; }, 1500); };
    try { await navigator.clipboard.writeText(txt); } catch { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    done();
  }
  if (!e.target.closest('details.menu')) document.querySelectorAll('details.menu[open]').forEach(d => d.removeAttribute('open'));
});
ACTS.logout = async () => { await DB.logout(); };

// ================= AUTH =================
const authForm = mode => `
<div class="authbox">
  <img class="logo" src="icon.svg" alt="">
  <h2 class="center">${mode === 'login' ? 'Log Masuk' : 'Daftar Akaun Ejen'}</h2>
  <form data-f="${mode}" class="card">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="email">
    <label for="password">Kata laluan</label>
    <input id="password" name="password" type="password" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
    ${mode === 'daftar' ? '<label for="password2">Ulang kata laluan</label><input id="password2" name="password2" type="password" required minlength="6" autocomplete="new-password">' : ''}
    <button class="btn">${mode === 'login' ? 'LOG MASUK' : 'DAFTAR'}</button>
  </form>
  <p class="center small">${mode === 'login' ? 'Ejen baru? <a href="#/daftar">Daftar di sini</a><br><a href="#" data-act="lupa">Lupa kata laluan?</a>' : 'Sudah ada akaun? <a href="#/login">Log masuk</a>'}</p>
</div>`;
r('/login', () => me ? go('#/') : render({ title: 'Taklimat Agensi', body: authForm('login') }), 'awam');
r('/daftar', () => me ? go('#/') : render({ title: 'Taklimat Agensi', body: authForm('daftar') }), 'awam');
FORMS.login = async v => { await DB.login(v.email.trim(), v.password); };
FORMS.daftar = async v => {
  if (v.password !== v.password2) throw { mesej: 'Kata laluan tidak sama.' };
  menungguDaftar = true;
  try { await DB.daftar(v.email.trim(), v.password); } finally { menungguDaftar = false; }
  await muatMe(); go('#/profil');
};
ACTS.lupa = async () => {
  const e = prompt('Masukkan email akaun anda:'); if (!e) return;
  await DB.resetPassword(e.trim()); alert('Pautan tetapan semula kata laluan telah dihantar ke email anda.');
};

// ================= PROFIL & TANDATANGAN =================
function profilForm(u) {
  const lockKod = u.status === 'aktif' && u.kodEjen, baru = u.status !== 'aktif';
  return `
<form data-f="profil">
  ${baru ? '<p class="muted small">Lengkapkan profil &amp; tandatangan. Selepas dihantar, admin perlu luluskan sebelum anda boleh buat permohonan.</p>' : ''}
  ${u.status === 'ditolak' && u.sebab ? `<div class="alert err"><div class="h">Pendaftaran ditolak</div>${esc(u.sebab)}</div>` : ''}
  <div class="card">
    <h3 style="margin-top:0">Maklumat ejen</h3>
    <label for="nama">Nama penuh (seperti dalam surat) *</label>
    <input id="nama" name="nama" required value="${esc(u.nama)}" placeholder="cth: Mohamad Lukman Hakim bin Md Zaki">
    <label for="noIc">No. Kad Pengenalan *</label>
    <input id="noIc" name="noIc" required inputmode="numeric" pattern="[0-9]{6}-?[0-9]{2}-?[0-9]{4}" placeholder="900101-01-1234" value="${esc(u.noIc)}">
    <label>Jawatan (tetap)</label>
    <input value="🔒 ${esc(CFG.jawatanEjen)}" readonly>
    <label for="telefon">No. telefon *</label>
    <input id="telefon" name="telefon" required inputmode="tel" value="${esc(u.telefon)}" placeholder="019-7784918">
    <label for="emailp">Email *</label>
    <input id="emailp" name="email" type="email" required value="${esc(u.email)}">
    <label for="kodEjen">Kod ejen *</label>
    <input id="kodEjen" name="kodEjen" required value="${esc(u.kodEjen || '')}" ${lockKod ? 'readonly' : ''} placeholder="cth: QZ-0417" pattern="[A-Za-z0-9\\-]+" title="Huruf, nombor dan tanda '-' sahaja">
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
</form>
${baru ? '<button class="btn o" data-act="logout" style="border-color:var(--line);color:var(--mute)">Log keluar</button>' : ''}`;
}
r('/profil', () => {
  if (me.status === 'digantung') return go('#/menunggu');
  return render({ title: me.status === 'aktif' ? 'Profil Ejen' : 'Lengkapkan Profil Ejen', back: me.status === 'aktif' ? '#/dashboard' : null, body: profilForm(me) });
}, 'login');
FORMS.profil = async v => {
  const noIc = v.noIc.replace(/\D/g, '');
  const kodEjen = (me.status === 'aktif' && me.kodEjen) ? me.kodEjen : v.kodEjen.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (noIc.length !== 12) throw { mesej: 'No. IC mesti 12 digit.' };
  if (!v.signature && !me.signature) throw { mesej: 'Sila tandatangan dahulu.' };
  if (!kodEjen) throw { mesej: 'Sila isi kod ejen.' };
  const status = await DB.simpanProfil(me, {
    nama: v.nama.trim(), noIc: noIc.replace(/^(\d{6})(\d{2})(\d{4})$/, '$1-$2-$3'), telefon: v.telefon.trim(), email: v.email.trim().toLowerCase(), kodEjen,
  }, v.signature || null);
  await muatMe();
  if (status === 'aktif') { setFlash('Profil disimpan.'); go('#/dashboard'); }
  else go('#/menunggu');
};

r('/menunggu', () => {
  if (me.status === 'aktif') return go('#/dashboard');
  if (me.status === 'profil') return go('#/profil');
  const X = {
    menunggu: ['⏳', 'Menunggu Kelulusan Admin', 'Profil anda telah dihantar. Anda akan dapat akses penuh selepas admin meluluskan akaun anda.', 'warn'],
    ditolak: ['✕', 'Pendaftaran Ditolak', 'Sila betulkan profil anda dan hantar semula.', 'err'],
    digantung: ['⛔', 'Akaun Digantung', 'Akaun anda telah digantung oleh admin. Hubungi admin untuk maklumat lanjut.', 'err'],
  }[me.status];
  return render({ title: 'Status Akaun', body: `
  <div class="center" style="padding-top:20px">
    <div class="avatar" style="background:var(--amber2);border-color:var(--amber)">${X[0]}</div>
    <h2>${X[1]}</h2><p class="muted">${X[2]}</p>
  </div>
  ${me.sebab ? `<div class="alert ${X[3]}"><div class="h">Sebab</div>${esc(me.sebab)}</div>` : ''}
  <div class="card small"><b>${esc(me.nama)}</b><br>Kod Ejen: <b>${esc(me.kodEjen)}</b></div>
  ${me.status !== 'digantung' ? '<a class="btn o" href="#/profil">✎ Edit profil</a>' : ''}
  <button class="btn o" data-act="semula">↻ Semak status</button>
  <button class="btn o" data-act="logout" style="border-color:var(--line);color:var(--mute)">Log keluar</button>` });
}, 'login');
ACTS.semula = async () => { await muatMe(); route(); };

// ================= DASHBOARD & SENARAI =================
let cache = { mine: null };
async function mine() {
  let ps = await DB.senaraiSaya(me.id);
  // lepaskan yang luput (pemilik)
  for (const p of ps.filter(U.luput)) { await DB.lepasJikaLuput(p); p.status = 'dilepaskan'; p.closedAt = new Date(); }
  return ps;
}
const fuN = p => (p.fu || []).length;
const fuAkhir = p => (p.fu || []).length ? p.fu[p.fu.length - 1].at : null;
const tkTarikh = p => p.taklimat?.tarikh || '';

function item(p, opt = {}) {
  let s = '', tag = pill(p.status), cls = '';
  if (p.status === 'surat_siap') { s = `Surat dijana ${U.tarikh(p.tarikhSurat)} · belum email · ${U.hariLagi(p.lastActivity)} hari lagi`; cls = 'l-b'; }
  if (p.status === 'dah_email') {
    const n = fuN(p), lagi = U.hariLagi(p.lastActivity);
    const ev = p.emailStatus === 'disahkan' ? '✓ disahkan' : p.emailStatus === 'bermasalah' ? '⚠ bermasalah' : '⏳ menunggu pengesahan';
    s = `Email ${U.tarikh(p.emailMarkedAt)} (${ev}) · ${n ? `follow up ×${n}, terakhir ${U.tarikh(fuAkhir(p))}` : 'belum follow up'}`;
    tag = lagi <= 10 ? `<span class="pill p-r">${lagi} hari lagi</span>` : n ? `<span class="pill p-a">Follow up ×${n}</span>` : '<span class="pill p-b">Belum follow up</span>';
    cls = lagi <= 10 ? 'l-r' : 'l-a';
  }
  if (p.status === 'dapat_taklimat' || p.status === 'selesai') {
    const t = p.taklimat || {};
    if (p.status === 'selesai') { s = `📅 ${U.tarikh(t.tarikh)} · Hadir ${t.hadir} · Closing ${t.closing}${t.hadir ? ` (${Math.round(t.closing / t.hadir * 100)}%)` : ''}`; cls = 'l-g'; }
    else {
      s = `📅 ${U.tarikh(t.tarikh)} · ${U.masa12(t.masa)} · ${esc(t.penceramah)}`;
      if (t.tarikh < U.hariIni()) { tag = '<span class="pill p-a">Perlu rekod</span>'; cls = 'l-gold'; } else cls = 'l-g';
    }
  }
  if (p.status === 'tak_berjaya') { s = `${esc(p.takSebab || 'Tak berjaya')} · ${U.tarikh(p.closedAt)}`; cls = 'l-r'; }
  if (p.status === 'dilepaskan') s = `${U.LUPUT_HARI} hari tiada tindakan · ${U.tarikh(p.closedAt)}`;
  const who = opt.ejen ? `<div class="s">👤 ${esc(p.ejenNama)} (${esc(p.ejenKod)})</div>` : '';
  return `<a class="li ${cls}" href="#/p/${p.id}"><div class="row1"><b>${esc(p.namaAgensi)}</b>${tag}</div><div class="s">${s}</div>${who}</a>`;
}

r('/', () => go('#/dashboard'));
r('/dashboard', async () => {
  const ps = await mine();
  const c = k => ps.filter(p => k.includes(p.status)).length;
  const dahEmail = ps.filter(p => p.status === 'dah_email');
  const perluFU = dahEmail.filter(p => U.hariSejak(p.lastActivity) >= 3 || U.hariLagi(p.lastActivity) <= 10).length;
  const hampir = ps.filter(p => ['surat_siap', 'dah_email'].includes(p.status) && U.hariLagi(p.lastActivity) <= 10).length;
  const rekod = ps.filter(p => p.status === 'dapat_taklimat' && tkTarikh(p) < U.hariIni()).length;
  const masalah = dahEmail.filter(p => p.emailStatus === 'bermasalah').length;
  const ingat = dahEmail.filter(p => (p.fu || []).some(f => f.ingat === U.hariIni())).length;
  const closing = ps.filter(p => p.status === 'selesai').reduce((a, p) => a + (p.taklimat?.closing || 0), 0);
  let adm = '';
  if (isAdmin(me)) {
    const [us, semua] = await Promise.all([DB.senaraiEjen(), DB.senaraiSemua()]);
    const tunggu = us.filter(u => u.status === 'menunggu').length;
    const sah = semua.filter(p => p.status === 'dah_email' && (p.emailStatus === 'bermasalah' || (p.emailStatus === 'menunggu' && U.jamSejak(p.emailMarkedAt) >= CFG.jamAmaranEmail))).length;
    if (tunggu || sah) adm = `<div class="card" style="background:var(--adm2);border-color:#d9cdf1"><b style="color:var(--adm)">ADMIN</b>
      ${tunggu ? `<a class="li l-a" href="#/admin/ejen" style="margin:8px 0 0">👤 <b>${tunggu}</b> ejen menunggu kelulusan</a>` : ''}
      ${sah ? `<a class="li l-r" href="#/admin/pengesahan" style="margin:8px 0 0">✉ <b>${sah}</b> email perlu disemak</a>` : ''}</div>`;
    alertCount = tunggu + sah;
  } else alertCount = 0;
  alertCount += rekod + hampir + masalah + ingat;
  const ini = (me.nama || '?').split(/\s+/).filter(w => !/^(bin|binti|bt|b|a\/l|a\/p)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const al = (cls, href, h, s) => `<a class="alert ${cls}" style="display:block;text-decoration:none;color:var(--ink)" href="${href}"><span class="h">${h}</span><br><span class="small">${s}</span></a>`;
  return render({ title: 'Dashboard', body: `
  <div class="avatar">${esc(ini)}</div>
  <div class="card center">
    <b style="font-size:17px">${esc(me.nama)}</b>
    <div class="small muted">Kod Ejen: ${esc(me.kodEjen)} · ${esc(me.telefon)}</div>
    <div class="stats">
      <div><b>${ps.length}</b><span>Jumlah</span></div>
      <div><b style="color:var(--pri)">${c(['dapat_taklimat', 'selesai'])}</b><span>Dapat</span></div>
      <div><b style="color:var(--red)">${c(['tak_berjaya', 'dilepaskan'])}</b><span>Tak Berjaya</span></div>
      <div><b style="color:var(--gold)">${closing}</b><span>Closing</span></div>
    </div>
  </div>
  ${adm}
  ${rekod ? al('warn', '#/senarai/dapat?tab=rekod', `📝 ${rekod} taklimat perlu rekod hasil`, 'Isi bilangan hadir &amp; closing.') : ''}
  ${hampir ? al('err', '#/senarai/follow-up', `⚠ ${hampir} agensi hampir dilepaskan`, 'Ambil tindakan untuk kekalkan agensi.') : ''}
  ${masalah ? al('err', '#/senarai/dah-email', `✉ ${masalah} email bermasalah`, `Pastikan CC ke ${esc(CFG.ccEmail)} &amp; PDF dilampirkan.`) : ''}
  ${ingat ? al('warn', '#/senarai/follow-up', `⏰ ${ingat} peringatan follow up hari ini`, 'Anda minta diingatkan hari ini.') : ''}
  <div class="boxes">
    <a class="box b1" href="#/senarai/surat"><div class="i">✉</div><b>Surat</b><small>Belum email</small><div class="n">${c(['surat_siap'])}</div></a>
    <a class="box b2" href="#/senarai/dah-email"><div class="i">➤</div><b>Dah Email</b><small>Tunggu jawapan</small><div class="n">${dahEmail.length}</div></a>
    <a class="box b3" href="#/senarai/follow-up"><div class="i">↻</div><b>Follow Up</b><small>Perlu tindakan</small><div class="n">${perluFU}</div></a>
  </div>
  <div class="boxes2">
    <a class="box2 g" href="#/senarai/dapat">✓ Dapat Taklimat<small>${c(['dapat_taklimat', 'selesai'])} agensi</small></a>
    <a class="box2 r" href="#/senarai/tak-berjaya">✕ Tak Berjaya<small>${c(['tak_berjaya', 'dilepaskan'])} agensi</small></a>
  </div>
  <a class="btn" href="#/baru" style="margin-top:14px">+ PERMOHONAN BARU</a>` });
});

const SENARAI = {
  'surat': ['Surat (belum email)', p => p.status === 'surat_siap'],
  'dah-email': ['Dah Email', p => p.status === 'dah_email'],
  'follow-up': ['Follow Up', p => p.status === 'dah_email'],
  'dapat': ['Dapat Taklimat', p => ['dapat_taklimat', 'selesai'].includes(p.status)],
  'tak-berjaya': ['Tak Berjaya', p => ['tak_berjaya', 'dilepaskan'].includes(p.status)],
  'semua': ['Semua Permohonan', () => true],
};
r('/senarai/:jenis', async ({ jenis }, q) => {
  const X = SENARAI[jenis]; if (!X) return go('#/dashboard');
  const ps = await mine();
  let rows = ps.filter(X[1]).filter(p => !q.q || p.namaAgensi.toLowerCase().includes(q.q.toLowerCase()));
  const tms = t => U.toDate(t)?.getTime() || 0;
  rows.sort((a, b) => tms(b.createdAt) - tms(a.createdAt));
  let top = '';
  if (jenis === 'dapat') {
    const tab = q.tab || 'datang', hi = U.hariIni();
    const g = {
      datang: rows.filter(p => p.status === 'dapat_taklimat' && tkTarikh(p) >= hi).sort((a, b) => tkTarikh(a).localeCompare(tkTarikh(b))),
      rekod: rows.filter(p => p.status === 'dapat_taklimat' && tkTarikh(p) < hi),
      selesai: rows.filter(p => p.status === 'selesai'),
    };
    top = `<div class="tabs">${[['datang', 'Akan datang'], ['rekod', 'Perlu rekod'], ['selesai', 'Selesai']].map(([k, t]) => `<a class="${tab === k ? 'on' : ''}" href="#/senarai/dapat?tab=${k}">${t} (${g[k].length})</a>`).join('')}</div>`;
    rows = g[tab] || g.datang;
  }
  if (jenis === 'follow-up') {
    rows.sort((a, b) => tms(a.lastActivity) - tms(b.lastActivity));
    const hampir = rows.filter(p => U.hariLagi(p.lastActivity) <= 10).length;
    if (hampir) top = `<div class="alert err small">⚠ <b>${hampir} agensi</b> akan dilepaskan tidak lama lagi. Follow up untuk kekalkan.</div>`;
    const lepas = ps.filter(p => p.status === 'dilepaskan').sort((a, b) => tms(b.closedAt) - tms(a.closedAt)).slice(0, 5);
    return render({ title: X[0], back: '#/dashboard', body: top + (rows.map(p => item(p)).join('') || '<div class="empty">Tiada agensi untuk di-follow up.</div>') + (lepas.length ? `<h3>Baru dilepaskan</h3><div style="opacity:.65">${lepas.map(p => item(p)).join('')}</div>` : '') });
  }
  const search = `<form data-f="cari" data-base="#/senarai/${jenis}"><input name="q" placeholder="🔍 Cari agensi…" value="${esc(q.q)}"><input type="hidden" name="tab" value="${esc(q.tab || '')}"></form><div style="height:10px"></div>`;
  return render({ title: X[0], back: '#/dashboard', tone: jenis === 'tak-berjaya' ? 'red' : '', body: search + top + (rows.map(p => item(p)).join('') || '<div class="empty">Tiada rekod.</div>') });
});
FORMS.cari = async (v, f) => { const p = new URLSearchParams(Object.entries(v).filter(([, x]) => x)); go(`${f.dataset.base}${p.toString() ? '?' + p : ''}`); };

// ================= PERMOHONAN BARU & SEMAKAN BERTINDAN =================
async function htmlSemak(nama) {
  const { norm, ag } = await DB.getAgensi(nama);
  if (!norm) return { html: '' };
  if (DB.agensiDipegang(ag)) {
    const siapa = ag.uid === me.id ? 'ANDA' : esc(ag.ejenNama).toUpperCase();
    return { bertindan: true, html: `<div class="alert err"><div class="h">⚠ MAAF, ${siapa} SUDAH ISI</div>
      <div class="h" style="margin:2px 0">${esc(ag.nama).toUpperCase()}</div>
      <div class="small">Status: <b>BERTINDAN</b>. Diisi oleh ${esc(ag.ejenNama)} pada ${U.tarikh(ag.createdAt)}.</div>
      <div style="font-weight:700;margin-top:4px">Sila cari agensi lain.</div></div>` };
  }
  let html = '';
  const sej = [...(ag?.sejarah || [])];
  if (ag && U.luput(ag)) sej.push({ ejenNama: ag.ejenNama, ejenKod: ag.ejenKod, emailAt: ag.emailAt, fu: ag.fuCount, status: 'dilepaskan' });
  if (sej.length) html += `<div class="alert warn"><div class="h">ⓘ PERNAH DIMOHON</div><div class="small">Agensi ini <b>terbuka</b> – anda boleh mohon.</div>
    ${sej.reverse().map(s => `<div class="small" style="border-top:1px solid #f0d9a8;margin-top:6px;padding-top:6px">
      <b>${esc(s.ejenNama)}</b> (${esc(s.ejenKod)})<br>
      ${s.emailAt ? `✉ Email: ${U.tarikh(s.emailAt)}<br>` : '✉ Belum email<br>'}
      ↻ Follow up: ${s.fu || 0} kali<br>
      ${s.status === 'tak_berjaya' ? `<b style="color:var(--red)">✕ Tak Berjaya${s.sebab ? ' – ' + esc(s.sebab) : ''}</b>${s.nota ? `<br><i>“${esc(s.nota)}”</i>` : ''}` : `<b class="muted">Dilepaskan – ${U.LUPUT_HARI} hari tiada tindakan</b>`}
    </div>`).join('')}</div>`;
  const semua = await DB.semuaAgensi();
  const mirip = semua.filter(a => DB.agensiDipegang(a) && a.norm !== norm && U.similarity(a.norm, norm) >= 0.85).slice(0, 3);
  if (mirip.length) html += `<div class="alert warn small"><span class="h">Mungkin sama dengan:</span> ${mirip.map(m => `<b>${esc(m.nama)}</b>`).join(', ')}. Pastikan ia agensi berbeza sebelum teruskan.</div>`;
  return { bertindan: false, html: html || '<span class="pill p-g">✓ Agensi belum diambil</span>' };
}
r('/baru', () => render({ title: 'Permohonan Baru', back: '#/dashboard', body: `<form data-f="baru">
  <div class="card">
    <label for="namaAgensi">Nama agensi *</label>
    <input id="namaAgensi" name="namaAgensi" required autocomplete="off" placeholder="cth: Pejabat Kesihatan Daerah Mersing">
    <div id="semak" style="margin-top:6px"></div>
    <label for="namaSingkat">Nama ringkas (pilihan)</label>
    <input id="namaSingkat" name="namaSingkat" data-lock placeholder="cth: PKD Mersing">
    <div class="tiny muted">Digunakan dalam surat: “warga PKD Mersing”. Kosongkan untuk guna nama penuh.</div>
    <label for="alamat">Alamat *</label>
    <textarea id="alamat" name="alamat" required data-lock placeholder="Jalan Ismail,&#10;86800 Mersing, Johor."></textarea>
    <label for="telefon">No. telefon *</label>
    <input id="telefon" name="telefon" required inputmode="tel" data-lock>
    <label for="pic">Jawatan penerima (PIC) *</label>
    <input id="pic" name="pic" required data-lock placeholder="cth: Ketua Imigresen Mersing / Ketua Cawangan">
    <label for="picNama">Nama pegawai penerima (pilihan)</label>
    <input id="picNama" name="picNama" data-lock placeholder="cth: TPPK Mohd Azrul bin Mat Nor">
    <div class="tiny muted">Dicetak tebal di bawah jawatan dalam surat &amp; di kulit kertas kerja.</div>
    <label>Panggilan dalam surat</label>
    <div class="seg">${S.PANGGILAN.map((x, i) => `<label><input type="radio" name="panggilan" value="${x}" ${i === 2 ? 'checked' : ''} data-lock><span>${x}</span></label>`).join('')}</div>
    <label for="emailA">Email agensi *</label>
    <input id="emailA" name="email" type="email" required data-lock>
  </div>
  <button class="btn" id="btn-jana">JANA SURAT PDF</button>
</form>` }));
function initSemak() {
  const ag = document.getElementById('namaAgensi'); if (!ag) return;
  const box = document.getElementById('semak'), btn = document.getElementById('btn-jana');
  const setLock = on => { document.querySelectorAll('[data-lock]').forEach(el => { el.disabled = on; }); btn.disabled = on; };
  let t, seq = 0;
  const check = async () => {
    const v = ag.value.trim(), my = ++seq;
    if (v.length < 3) { box.innerHTML = ''; setLock(false); return; }
    const res = await htmlSemak(v);
    if (my !== seq) return;
    box.innerHTML = res.html; setLock(!!res.bertindan);
  };
  ag.addEventListener('input', () => { clearTimeout(t); t = setTimeout(check, 600); });
}
FORMS.baru = async v => {
  const val = { namaAgensi: v.namaAgensi.trim(), namaSingkat: (v.namaSingkat || '').trim(), alamat: (v.alamat || '').trim(), telefon: (v.telefon || '').trim(), pic: (v.pic || '').trim(), picNama: (v.picNama || '').trim(), panggilan: v.panggilan || 'Tuan/Puan', email: (v.email || '').trim() };
  if (!me.signature) { setFlash('Sila lengkapkan tandatangan dalam profil dahulu.', 'err'); return go('#/profil'); }
  try {
    const pid = await DB.buatPermohonan(me, val);
    setFlash('Surat berjaya dijana.'); go(`#/p/${pid}`);
  } catch (e) {
    if (e.bertindan) {
      const res = await htmlSemak(val.namaAgensi);
      document.getElementById('semak').innerHTML = res.html;
      document.querySelectorAll('[data-lock]').forEach(el => { el.disabled = true; });
      throw { mesej: 'Agensi ini sudah diambil. Sila cari agensi lain.' };
    }
    throw e;
  }
};

// ================= BUTIRAN PERMOHONAN =================
async function muatP(id) {
  const p = await DB.getPermohonan(id).catch(e => { if (e.code === 'permission-denied') return null; throw e; });
  if (!p) throw { mesej: 'Permohonan tidak dijumpai atau bukan milik anda.' };
  p.owner = p.uid === me.id;
  if (p.owner && U.luput(p)) { await DB.lepasJikaLuput(p); return muatP(id); }
  return p;
}
const milik = p => { if (!p.owner) throw { mesej: 'Hanya ejen pemilik boleh buat tindakan ini.' }; };

function semakEmailHtml(p) {
  const e = p.emailInfo;
  const ok = s => `<div>✓ ${s}</div>`, no = s => `<div class="muted">○ ${s}</div>`, bad = s => `<div style="color:var(--red)">✕ ${s}</div>`;
  let head;
  if (p.emailStatus === 'disahkan') head = `<div class="alert ok center">✅ Dah Email – Disahkan<div class="tiny" style="font-weight:500">${U.tarikhMasa(p.emailVerifiedAt)}${p.emailVerifiedBy && p.emailVerifiedBy !== 'sistem' ? ` · manual oleh ${esc(p.emailVerifiedBy)}` : ''}</div></div>`;
  else if (p.emailStatus === 'bermasalah') head = `<div class="alert err"><div class="h">⚠ Pengesahan bermasalah</div><div class="small">${esc(p.emailIssue || '')}</div></div>`;
  else if (U.jamSejak(p.emailMarkedAt) >= CFG.jamAmaranEmail) head = `<div class="alert err"><div class="h">⚠ Email CC belum diterima</div><div class="small">Sudah lebih ${CFG.jamAmaranEmail} jam. Pastikan anda CC ke <b>${esc(CFG.ccEmail)}</b>.</div></div>`;
  else head = `<div class="alert warn center"><div class="h">⏳ Menunggu pengesahan</div><div class="small">Sistem sedang semak email CC ke <b>${esc(CFG.ccEmail)}</b>.</div></div>`;
  const manual = p.emailStatus === 'disahkan' && p.emailVerifiedBy && p.emailVerifiedBy !== 'sistem';
  return `${head}<div class="small chk">
    ${ok(`Ejen tekan Dah Email · ${U.tarikhMasa(p.emailMarkedAt)}`)}
    ${manual ? ok('Disahkan manual oleh admin') : `
    ${e ? ok(`Email CC diterima · ${U.tarikhMasa(e.diterima)}`) : no('Email CC diterima')}
    ${e ? ok(`Kod ${U.kodEmail(p.id)} sepadan`) : no(`Kod ${U.kodEmail(p.id)} sepadan`)}
    ${e ? (String(e.kepada).toLowerCase().includes(p.email) ? ok(`Dihantar kepada ${esc(p.email)}`) : bad(`Tidak dihantar kepada ${esc(p.email)}`)) : no(`Dihantar kepada ${esc(p.email)}`)}
    ${e ? (e.adaPdf ? ok('Lampiran PDF ada') : bad('Tiada lampiran PDF')) : no('Lampiran PDF ada')}`}
  </div>`;
}
function sejarahHtml(p) {
  const items = [...(p.fu || []).map(f => ({ ...f, k: 'fu' })), ...(p.log || []).map(l => ({ ...l, k: 'ev' }))]
    .sort((a, b) => (U.toDate(b.at) - U.toDate(a.at)) || (a.k === 'fu' ? -1 : 1));
  if (!items.length) return '';
  return `<h3>Sejarah</h3><div class="tl">${items.map(i => i.k === 'fu'
    ? `<div class="it"><b>Follow up kali ke-${i.kali}</b> <span class="tiny muted">· ${U.tarikhMasa(i.at)} · ${esc(i.cara)}${i.olehUid !== p.uid ? ` · ${esc(i.oleh)}` : ''}</span><div class="small">${esc(i.nota)}</div>${i.ingat ? `<div class="tiny muted">⏰ Ingatkan ${U.tarikh(i.ingat)}</div>` : ''}</div>`
    : `<div class="it sys"><span class="small">${esc(i.teks)}</span> <span class="tiny muted">· ${U.tarikhMasa(i.at)}</span></div>`).join('')}</div>`;
}

r('/p/:id', async ({ id }, q) => {
  const p = await muatP(id); if (!p) return;
  const info = `<div class="card small">
    <div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:16px">${esc(p.namaAgensi)}</b>${pill(p.status)}</div>
    <div class="muted tiny">${p.id}${!p.owner ? ` · 👤 ${esc(p.ejenNama)} (${esc(p.ejenKod)})` : ''}</div>
    <div style="margin-top:6px">PIC: ${p.picNama ? `<b>${esc(p.picNama)}</b>, ` : ''}${esc(p.pic)}<br>☎ <a href="tel:${esc(p.telefon)}">${esc(p.telefon)}</a> · ✉ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a><br><span class="muted">${esc(U.alamatSebaris(p.alamat))}</span></div>
  </div>`;
  let main = '';
  const pdfBtn = `<button class="btn b" data-act="pdf" data-id="${p.id}">⬇ DOWNLOAD PDF</button>`;
  if (p.status === 'surat_siap') {
    const sig = await DB.getSig(p.id);
    main = `${S.html(p, sig)}${pdfBtn}
      ${p.owner ? `<a class="btn" href="#/p/${p.id}/email">✉ SETERUSNYA: RANGKA EMAIL</a>
      <div class="alert warn small" style="margin-top:12px">⏱ <b>${U.hariLagi(p.lastActivity)} hari lagi</b> sebelum agensi dilepaskan jika tiada tindakan.</div>
      <details style="margin-top:14px"><summary class="small muted">Tak jadi mohon?</summary>
        <a class="btn o sm" href="#/p/${p.id}/tak" style="color:var(--red);border-color:var(--red)">Batal / Tak Berjaya</a></details>` : ''}`;
  }
  if (p.status === 'dah_email') {
    const lagi = U.hariLagi(p.lastActivity);
    main = `${semakEmailHtml(p)}
      <div class="two"><a class="btn o sm" href="#/p/${p.id}/email">Lihat rangka email</a><button class="btn o sm" data-act="pdf" data-id="${p.id}">⬇ PDF</button></div>
      <div class="alert ${lagi <= 10 ? 'err' : 'warn'} small" style="margin-top:12px">⏱ <b>${lagi} hari lagi</b> sebelum agensi dilepaskan jika tiada tindakan. Setiap follow up reset kiraan ke ${U.LUPUT_HARI} hari.</div>
      ${p.owner ? `<details class="card" ${q.fu ? 'open' : ''} style="margin-top:12px"><summary style="font-weight:800;cursor:pointer">+ FOLLOW UP <span class="pill p-a">Kali ke-${fuN(p) + 1}</span></summary>
        <form data-f="followup" data-id="${p.id}">
          <label>Cara</label>
          <div class="seg">${['Telefon', 'WhatsApp', 'Email', 'Jumpa'].map((c, i) => `<label><input type="radio" name="cara" value="${c}" ${i === 0 ? 'checked' : ''}><span>${c}</span></label>`).join('')}</div>
          <label for="nota">Nota *</label><textarea id="nota" name="nota" required placeholder="cth: PA kata pegawai cuti, call balik Isnin."></textarea>
          <label for="ingat">Ingatkan saya (pilihan)</label><input id="ingat" name="ingat" type="date">
          <button class="btn">SIMPAN FOLLOW UP</button>
        </form></details>
      <p class="center tiny muted" style="margin:14px 0 0">Dah ada keputusan?</p>
      <div class="two"><a class="btn" href="#/p/${p.id}/dapat">✓ DAPAT TAKLIMAT</a><a class="btn r" href="#/p/${p.id}/tak">✕ TAK BERJAYA</a></div>` : ''}`;
  }
  if (p.status === 'dapat_taklimat' || p.status === 'selesai') {
    const t = p.taklimat || {};
    const perlu = p.status === 'dapat_taklimat' && t.tarikh <= U.hariIni();
    main = `<div class="card" style="background:var(--pri2);border-color:#bfe0d4">
      <b style="color:var(--pri)">🎉 Dapat Taklimat</b>
      <dl class="small"><dt>Tarikh</dt><dd>${U.tarikh(t.tarikh)}</dd><dt>Masa</dt><dd>${U.masa12(t.masa)}</dd><dt>Penceramah</dt><dd>${esc(t.penceramah)}</dd>
      ${t.lokasi ? `<dt>Lokasi</dt><dd>${esc(t.lokasi)}</dd>` : ''}${t.peserta ? `<dt>Anggaran peserta</dt><dd>${t.peserta} orang</dd>` : ''}</dl></div>
      ${p.status === 'selesai' ? `<div class="kpi"><div class="card"><div class="big">${t.hadir}</div><div class="tiny muted">Hadir</div></div><div class="card"><div class="big" style="color:var(--pri)">${t.closing}</div><div class="tiny muted">Closing</div></div><div class="card"><div class="big">${t.hadir ? Math.round(t.closing / t.hadir * 1000) / 10 : 0}%</div><div class="tiny muted">Kadar</div></div></div>${t.notaHasil ? `<p class="small">📝 ${esc(t.notaHasil)}</p>` : ''}` : ''}
      ${p.owner && perlu ? `<a class="btn gold" href="#/p/${p.id}/hasil">📝 REKOD HASIL TAKLIMAT</a>` : ''}
      ${p.owner && p.status === 'dapat_taklimat' ? `<a class="btn o sm" href="#/p/${p.id}/dapat">✎ Ubah tarikh / masa / penceramah</a>` : ''}
      ${p.owner && p.status === 'selesai' ? `<a class="btn o sm" href="#/p/${p.id}/hasil">✎ Ubah hasil</a>` : ''}
      ${pdfBtn}`;
  }
  if (p.status === 'tak_berjaya') main = `<div class="alert err"><div class="h">✕ Tak Berjaya</div>${p.takSebab ? `<div><b>${esc(p.takSebab)}</b></div>` : ''}${p.takNota ? `<div class="small">${esc(p.takNota)}</div>` : ''}<div class="tiny muted">${U.tarikhMasa(p.closedAt)} · Agensi kini terbuka untuk ejen lain.</div></div>`;
  if (p.status === 'dilepaskan') main = `<div class="alert warn"><div class="h">Dilepaskan</div><div class="small">${U.LUPUT_HARI} hari tiada tindakan (${U.tarikh(p.closedAt)}). Agensi kini terbuka untuk ejen lain.</div></div>`;
  const regen = p.owner && ['surat_siap', 'dah_email'].includes(p.status) && (p.snapNama !== me.nama || p.log?.some(l => l.teks.startsWith('Dipindah')))
    ? `<button class="btn o sm" data-act="janaSemula" data-id="${p.id}" data-confirm="Jana semula surat dengan nama, telefon & tandatangan anda?">↻ Jana semula surat dengan tandatangan saya</button>` : '';
  const padam = isAdmin(me) ? `<details style="margin-top:24px"><summary class="small muted">Admin: padam permohonan</summary>
    <p class="small muted">Untuk data ujian / tersilap isi. Permohonan ${p.id} akan dipadam terus dan agensi ini dibuka semula untuk semua ejen.</p>
    <button class="btn r sm" data-act="padam" data-id="${p.id}" data-confirm="PADAM terus permohonan ${esc(p.namaAgensi)} (${p.id})? Tindakan ini tidak boleh dibatalkan.">🗑 Padam permohonan</button></details>` : '';
  return render({ title: p.namaSingkat || p.namaAgensi, back: p.owner ? '#/dashboard' : '#/admin/permohonan', body: info + main + regen + sejarahHtml(p) + padam });
});

ACTS.pdf = async ({ id }) => {
  const p = await DB.getPermohonan(id), sig = await DB.getSig(id);
  const btn = document.activeElement; const asal = btn?.textContent; if (btn?.dataset.act === 'pdf') { btn.disabled = true; btn.textContent = 'Menjana PDF…'; }
  let bytes;
  try { bytes = await S.pakej(p, sig); } finally { if (btn?.dataset.act === 'pdf') { btn.disabled = false; btn.textContent = asal; } }
  const nama = S.namaFail(p);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  // Telefon: guna menu Kongsi (boleh terus ke Gmail/WhatsApp); komputer: muat turun
  const file = new File([blob], nama, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|Android|iPhone/i.test(navigator.userAgent) && !window.__NOSHARE) {
    try { await navigator.share({ files: [file], title: nama }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
};
ACTS.padam = async ({ id }) => { const p = await DB.getPermohonan(id); await DB.padamPermohonan(p); setFlash(`${p.namaAgensi} (${id}) dipadam.`); go('#/admin/permohonan'); };
ACTS.janaSemula = async ({ id }) => { const p = await DB.getPermohonan(id); await DB.janaSemula(p, me); setFlash('Surat dijana semula.'); route(); };

// ---------- RANGKA EMAIL ----------
r('/p/:id/email', async ({ id }) => {
  const p = await muatP(id); if (!p) return;
  const e = S.rangkaEmail(p);
  const mailto = `mailto:${encodeURIComponent(e.kepada)}?cc=${encodeURIComponent(e.cc)}&subject=${encodeURIComponent(e.subjek)}&body=${encodeURIComponent(e.isi)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(e.kepada)}&cc=${encodeURIComponent(e.cc)}&su=${encodeURIComponent(e.subjek)}&body=${encodeURIComponent(e.isi)}`;
  return render({ title: 'Rangka Email', back: `#/p/${p.id}`, body: `
  <label>Kepada</label><div class="copyrow"><span id="e-to">${esc(e.kepada)}</span><button class="cp" data-copy="e-to">⧉ Salin</button></div>
  <label>CC (wajib · tak boleh ubah)</label><div class="copyrow lock"><span>🔒 ${esc(e.cc)}</span><button class="cp" data-copy="e-cc">⧉ Salin</button><span id="e-cc" hidden>${esc(e.cc)}</span></div>
  <label>Subjek</label><div class="copyrow"><span id="e-sub">${esc(e.subjek)}</span><button class="cp" data-copy="e-sub">⧉ Salin</button></div>
  <label>Isi email</label><div class="copyrow"><pre id="e-body">${esc(e.isi)}</pre><button class="cp" data-copy="e-body">⧉ Salin</button></div>
  <textarea id="e-all" hidden>${esc(`Kepada: ${e.kepada}\nCC: ${e.cc}\nSubjek: ${e.subjek}\n\n${e.isi}`)}</textarea>
  <div class="alert warn small" style="margin-top:12px">📎 Jangan lupa <b>attach</b> ${esc(S.namaFail(p))}. Pastikan CC ke <b>${esc(e.cc)}</b> – tanpa CC, “Dah Email” tidak dapat disahkan.</div>
  <button class="btn b" data-act="pdf" data-id="${p.id}">⬇ DOWNLOAD PDF</button>
  <div class="two"><a class="btn o" href="${esc(mailto)}">✉ Buka apps email</a><a class="btn o" href="${esc(gmail)}" target="_blank" rel="noopener">Buka Gmail</a></div>
  <button class="btn o" data-copy="e-all">⧉ Salin semua</button>
  ${p.owner && p.status === 'surat_siap' ? `<form data-f="dahEmail" data-id="${p.id}" data-confirm="Sahkan anda SUDAH hantar email kepada ${esc(p.email)} dengan CC ke ${esc(e.cc)} dan PDF dilampirkan?">
    <button class="btn gold">✓ DAH EMAIL</button></form>` : ''}` });
});
FORMS.dahEmail = async (v, f) => {
  const p = await muatP(f.dataset.id); milik(p);
  if (p.status !== 'surat_siap') throw { mesej: 'Status sudah berubah.' };
  await DB.dahEmail(p);
  setFlash('Status: Dah Email. Sistem akan sahkan apabila email CC diterima.'); go(`#/p/${p.id}`);
};
FORMS.followup = async (v, f) => {
  const p = await muatP(f.dataset.id); milik(p);
  if (!v.nota.trim()) throw { mesej: 'Nota wajib diisi.' };
  await DB.followUp(p, me, { cara: v.cara, nota: v.nota.trim(), ingat: v.ingat || null });
  setFlash('Follow up disimpan.'); go(`#/p/${p.id}`);
};

// ---------- DAPAT TAKLIMAT ----------
r('/p/:id/dapat', async ({ id }) => {
  const p = await muatP(id); if (!p) return; milik(p);
  if (!['dah_email', 'dapat_taklimat'].includes(p.status)) return go(`#/p/${id}`);
  const t = p.taklimat || {};
  return render({ title: 'Dapat Taklimat', back: `#/p/${p.id}`, body: `
  <div class="card center" style="background:var(--pri2);border-color:#bfe0d4"><div style="font-size:26px">🎉</div><b>${esc(p.namaAgensi)}</b><div class="small muted">${fuN(p) ? `Selepas ${fuN(p)} kali follow up` : 'Tanpa follow up'}</div></div>
  <form data-f="dapat" data-id="${p.id}" class="card">
    <label for="tarikh">Tarikh *</label><input id="tarikh" name="tarikh" type="date" required value="${esc(t.tarikh)}">
    <label for="masa">Masa *</label><input id="masa" name="masa" type="time" required value="${esc(t.masa)}">
    <label for="penceramah">Nama penceramah *</label><input id="penceramah" name="penceramah" required value="${esc(t.penceramah)}" placeholder="Taip nama penceramah">
    <label for="lokasi">Lokasi (pilihan)</label><input id="lokasi" name="lokasi" value="${esc(t.lokasi)}" placeholder="cth: Dewan PKD Mersing">
    <label for="peserta">Anggaran peserta (pilihan)</label><input id="peserta" name="peserta" type="number" min="0" inputmode="numeric" value="${esc(t.peserta)}">
    <button class="btn">SIMPAN</button>
  </form>` });
});
FORMS.dapat = async (v, f) => {
  const p = await muatP(f.dataset.id); milik(p);
  if (!v.tarikh || !v.masa || !v.penceramah.trim()) throw { mesej: 'Sila isi tarikh, masa dan penceramah.' };
  await DB.dapatTaklimat(p, { tarikh: v.tarikh, masa: v.masa.slice(0, 5), penceramah: v.penceramah.trim(), lokasi: v.lokasi.trim() || null, peserta: v.peserta ? Number(v.peserta) : null });
  setFlash('Taklimat disimpan.'); go(`#/p/${p.id}`);
};

// ---------- TAK BERJAYA ----------
r('/p/:id/tak', async ({ id }) => {
  const p = await muatP(id); if (!p) return; milik(p);
  if (!['surat_siap', 'dah_email'].includes(p.status)) return go(`#/p/${id}`);
  return render({ title: 'Tak Berjaya', tone: 'red', back: `#/p/${p.id}`, body: `
  <div class="card"><b>${esc(p.namaAgensi)}</b><div class="small muted">${p.emailMarkedAt ? `Email ${U.tarikh(p.emailMarkedAt)} · ` : ''}${fuN(p)} kali follow up</div></div>
  <form data-f="tak" data-id="${p.id}" class="card" data-confirm="Sahkan Tak Berjaya? Agensi ini akan terbuka untuk ejen lain.">
    <label>Sebab (pilihan)</label>
    <div class="seg">${['Ditolak', 'Tiada jawapan', 'Jadual penuh', 'Lain-lain'].map(s => `<label><input type="radio" name="sebab" value="${s}"><span>${s}</span></label>`).join('')}</div>
    <label for="nota">Nota</label><textarea id="nota" name="nota" placeholder="cth: Program kewangan luar tidak dibenarkan tahun ini."></textarea>
    <div class="tiny muted" style="margin-top:6px">Nota ini akan dilihat oleh ejen lain yang mohon agensi ini kemudian.</div>
    <button class="btn r">SAHKAN TAK BERJAYA</button>
  </form>` });
});
FORMS.tak = async (v, f) => {
  const p = await muatP(f.dataset.id); milik(p);
  await DB.takBerjaya(p, v.sebab || null, (v.nota || '').trim() || null);
  setFlash('Direkod sebagai Tak Berjaya.'); go('#/senarai/tak-berjaya');
};

// ---------- HASIL ----------
r('/p/:id/hasil', async ({ id }) => {
  const p = await muatP(id); if (!p) return; milik(p);
  if (!['dapat_taklimat', 'selesai'].includes(p.status)) return go(`#/p/${id}`);
  const t = p.taklimat;
  return render({ title: 'Hasil Taklimat', back: `#/p/${p.id}`, body: `
  <div class="card small"><b style="font-size:16px">${esc(p.namaAgensi)}</b><br>${U.tarikh(t.tarikh)} · ${U.masa12(t.masa)}<br>Penceramah: ${esc(t.penceramah)}</div>
  <form data-f="hasil" data-id="${p.id}" class="card">
    <label for="hadir">Berapa hadir *</label><input id="hadir" name="hadir" type="number" min="0" inputmode="numeric" required value="${esc(t.hadir)}">
    <label for="closing">Berapa closing (borang dikeluarkan) *</label><input id="closing" name="closing" type="number" min="0" inputmode="numeric" required value="${esc(t.closing)}">
    <div class="card center" style="background:var(--pri2);border-color:#bfe0d4;margin-top:12px"><div class="tiny muted">Kadar closing (auto)</div><div class="big" style="color:var(--pri)" id="kadar">–</div></div>
    <label for="nota">Nota (pilihan)</label><textarea id="nota" name="nota">${esc(t.notaHasil)}</textarea>
    <button class="btn">SIMPAN HASIL</button>
  </form>` });
});
FORMS.hasil = async (v, f) => {
  const p = await muatP(f.dataset.id); milik(p);
  const hadir = parseInt(v.hadir, 10), closing = parseInt(v.closing, 10);
  if (!(hadir >= 0) || !(closing >= 0)) throw { mesej: 'Sila isi bilangan hadir dan closing.' };
  if (closing > hadir) throw { mesej: 'Closing tidak boleh melebihi bilangan hadir.' };
  await DB.rekodHasil(p, hadir, closing, (v.nota || '').trim());
  setFlash('Hasil taklimat disimpan.'); go(`#/p/${p.id}`);
};
function initKadar() {
  const hd = document.getElementById('hadir'), cl = document.getElementById('closing'), kd = document.getElementById('kadar');
  if (!hd || !cl || !kd) return;
  const f = () => { const a = +hd.value, b = +cl.value; kd.textContent = a > 0 ? (Math.round(b / a * 1000) / 10) + '%' : '–'; };
  hd.addEventListener('input', f); cl.addEventListener('input', f); f();
}

// ================= ADMIN =================
const A = (pat, fn) => r('/admin' + pat, async (prm, q) => fn(prm, q), 'admin');
const rolePill = u => u.role === 'admin_utama' ? '<span class="pill p-adm">ADMIN UTAMA</span>' : u.role === 'admin' ? '<span class="pill p-adm2">ADMIN</span>' : '';

A('/ejen', async (prm, q) => {
  const tab = ['menunggu', 'aktif', 'ditolak', 'digantung'].includes(q.tab) ? q.tab : 'menunggu';
  const [us, ps] = await Promise.all([DB.senaraiEjen(), DB.senaraiSemua()]);
  const aktifN = uid => ps.filter(p => p.uid === uid && U.BOLEH_PINDAH.includes(p.status)).length;
  const qq = (q.q || '').toLowerCase();
  const rows = us.filter(u => u.status === tab && (!qq || `${u.nama} ${u.kodEjen}`.toLowerCase().includes(qq)))
    .sort((a, b) => ({ admin_utama: 0, admin: 1 }[a.role] ?? 2) - ({ admin_utama: 0, admin: 1 }[b.role] ?? 2) || String(a.nama).localeCompare(String(b.nama)));
  return render({ tone: 'admin', title: 'Admin · Ejen', back: '#/dashboard', body: `
  ${utama(me) ? '<a class="btn adm sm" href="#/admin/tambah" style="margin:0 0 12px">+ TAMBAH ADMIN</a>' : ''}
  <div class="tabs adm">${['menunggu', 'aktif', 'ditolak', 'digantung'].map(t => `<a class="${t === tab ? 'on' : ''}" href="#/admin/ejen?tab=${t}">${t[0].toUpperCase() + t.slice(1)} (${us.filter(u => u.status === t).length})</a>`).join('')}</div>
  <form data-f="cari" data-base="#/admin/ejen"><input type="hidden" name="tab" value="${tab}"><input name="q" placeholder="🔍 Cari nama / kod ejen…" value="${esc(q.q)}"></form><div style="height:10px"></div>
  ${rows.map(u => `<a class="li ${tab === 'menunggu' ? 'l-a' : tab === 'aktif' ? '' : 'l-r'}" href="#/admin/ejen/${u.id}">
    <div class="row1"><b>${esc(u.nama || u.email)}</b>${rolePill(u) || (tab === 'menunggu' ? '<span class="pill p-a">Baru</span>' : tab === 'aktif' ? '<span class="pill p-g">Ejen</span>' : '')}</div>
    <div class="s">${esc(u.kodEjen || '-')} · ${esc(u.telefon || '')}${tab === 'aktif' ? ` · ${aktifN(u.id)} agensi aktif` : ` · ${U.tarikhMasa(u.updatedAt)}`}</div></a>`).join('') || '<div class="empty">Tiada ejen.</div>'}` });
});

A('/ejen/:uid', async ({ uid }) => {
  const [u, us, ps] = await Promise.all([DB.getUser(uid), DB.senaraiEjen(), DB.senaraiSemua()]);
  if (!u) return go('#/admin/ejen');
  const miliknya = ps.filter(p => p.uid === u.id);
  const perms = miliknya.filter(p => U.BOLEH_PINDAH.includes(p.status));
  const lain = us.filter(x => x.status === 'aktif' && x.id !== u.id).sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
  const bolehGantung = u.status === 'aktif' && u.id !== me.id && u.role !== 'admin_utama' && (u.role === 'ejen' || utama(me));
  let aksi = '';
  if (u.status === 'menunggu') aksi = `
    <button class="btn" data-act="lulus" data-uid="${u.id}">✓ LULUS</button>
    <form data-f="tolak" data-uid="${u.id}" class="card" style="margin-top:12px">
      <label for="sebab">Sebab tolak *</label><input id="sebab" name="sebab" required placeholder="cth: Kod ejen tidak wujud dalam rekod">
      <button class="btn r">✕ TOLAK</button></form>`;
  if (bolehGantung) aksi += `
    <details class="card" style="margin-top:12px"><summary style="font-weight:800;color:var(--red);cursor:pointer">Gantung ejen</summary>
    <form data-f="gantung" data-uid="${u.id}" data-confirm="Gantung ${esc(u.nama)} dan pindah ${perms.length} agensi?">
      <label for="sebab2">Sebab gantung *</label><input id="sebab2" name="sebab" required placeholder="cth: Berhenti kerja">
      ${perms.length ? `<label for="kepada">Pindah semua agensi kepada *</label>
      <select id="kepada" name="kepada" required><option value="">– Pilih ejen penerima –</option>${lain.map(l => `<option value="${l.id}">${esc(l.nama)} (${esc(l.kodEjen)})</option>`).join('')}</select>
      <h3>Agensi yang akan dipindah (${perms.length})</h3>${perms.map(p => `<div class="li" style="padding:8px 10px"><div class="row1"><b style="font-size:14px">${esc(p.namaAgensi)}</b>${pill(p.status)}</div></div>`).join('')}`
      : '<p class="small muted">Tiada agensi aktif untuk dipindah.</p>'}
      <button class="btn r">GANTUNG${perms.length ? ` &amp; PINDAH ${perms.length} AGENSI` : ''}</button>
    </form></details>`;
  if (u.status === 'digantung') aksi = `<button class="btn" data-act="aktifSemula" data-uid="${u.id}">AKTIFKAN SEMULA</button>`;
  if (utama(me) && u.status === 'aktif' && u.role === 'ejen') aksi += `<button class="btn adm" data-act="jadikanAdmin" data-uid="${u.id}" data-confirm="Jadikan ${esc(u.nama)} admin?">Jadikan Admin</button>`;
  if (utama(me) && u.role === 'admin') aksi += `<button class="btn o" style="color:var(--adm);border-color:var(--adm)" data-act="buangAdmin" data-uid="${u.id}" data-confirm="Buang ${esc(u.nama)} sebagai admin?">Buang sebagai Admin</button>`;
  return render({ tone: 'admin', title: 'Semak Ejen', back: `#/admin/ejen?tab=${u.status === 'profil' ? 'menunggu' : u.status}`, body: `
  <div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:16px">${esc(u.nama || '(profil belum lengkap)')}</b>${rolePill(u)}</div>
    <dl class="small">
      <dt>Kod ejen</dt><dd><b>${esc(u.kodEjen)}</b></dd>
      <dt>No. IC</dt><dd>${esc(u.noIc)}</dd>
      <dt>Jawatan</dt><dd>${esc(CFG.jawatanEjen)}</dd>
      <dt>Telefon / Email</dt><dd>${esc(u.telefon)} · ${esc(u.email)}</dd>
      <dt>Status</dt><dd>${esc(u.status)}${u.sebab ? ` – ${esc(u.sebab)}` : ''}</dd>
      <dt>Permohonan</dt><dd>${miliknya.length} jumlah · ${miliknya.filter(p => ['dapat_taklimat', 'selesai'].includes(p.status)).length} dapat taklimat · ${perms.length} aktif</dd>
    </dl></div>
  <label>Tandatangan</label><div class="sigimg">${u.signature ? `<img src="${u.signature}" alt="Tandatangan">` : '<span class="muted small">Tiada</span>'}</div>
  ${aksi}
  ${perms.length ? `<h3>Agensi aktif</h3>${perms.map(p => item(p)).join('')}` : ''}` });
});
const adminAct = (fn, msg) => async ({ uid }) => { const u = await DB.getUser(uid); await fn(uid, u); setFlash(msg(u)); route(); };
ACTS.lulus = adminAct(uid => DB.lulus(uid, me), u => `${u.nama} diluluskan.`);
ACTS.aktifSemula = adminAct(uid => DB.aktifSemula(uid), u => `${u.nama} diaktifkan semula.`);
ACTS.jadikanAdmin = adminAct(uid => DB.jadikanAdmin(uid), u => `${u.nama} kini admin.`);
ACTS.buangAdmin = adminAct(uid => DB.buangAdmin(uid), u => `${u.nama} bukan lagi admin.`);
FORMS.tolak = async (v, f) => { await DB.tolak(f.dataset.uid, v.sebab.trim()); setFlash('Ejen ditolak.'); route(); };
FORMS.gantung = async (v, f) => {
  const u = await DB.getUser(f.dataset.uid);
  const ke = v.kepada ? await DB.getUser(v.kepada) : null;
  const n = await DB.gantung(u, v.sebab.trim(), ke, me);
  setFlash(`${u.nama} digantung${n ? `; ${n} agensi dipindah kepada ${ke.nama}` : ''}.`); route();
};

A('/tambah', async (prm, q) => {
  if (!utama(me)) return go('#/admin/ejen');
  const qq = (q.q || '').toLowerCase();
  const rows = (await DB.senaraiEjen()).filter(u => u.status === 'aktif' && u.role === 'ejen' && (!qq || `${u.nama} ${u.kodEjen}`.toLowerCase().includes(qq)));
  return render({ tone: 'admin', title: 'Tambah Admin', back: '#/admin/ejen?tab=aktif', body: `
  <p class="small muted">Pilih ejen aktif untuk dijadikan admin. Admin boleh lulus/tolak ejen, gantung ejen biasa, pindah agensi, sahkan email &amp; nampak semua data. Admin tidak boleh buang Admin Utama.</p>
  <form data-f="cari" data-base="#/admin/tambah"><input name="q" placeholder="🔍 Cari nama / kod ejen…" value="${esc(q.q)}"></form><div style="height:10px"></div>
  ${rows.map(u => `<div class="li"><div class="row1"><div><b>${esc(u.nama)}</b><div class="s">${esc(u.kodEjen)}</div></div><button class="btn adm sm" style="width:auto;margin:0" data-act="jadikanAdmin" data-uid="${u.id}" data-confirm="Jadikan ${esc(u.nama)} admin?">Jadikan Admin</button></div></div>`).join('') || '<div class="empty">Tiada ejen.</div>'}` });
});

A('/pengesahan', async (prm, q) => {
  const tab = ['disahkan', 'masuk'].includes(q.tab) ? q.tab : 'masalah';
  const [ps, em] = await Promise.all([DB.senaraiSemua(), tab === 'masuk' ? DB.senaraiEmailMasuk() : []]);
  const de = ps.filter(p => p.status === 'dah_email');
  const tms = t => U.toDate(t)?.getTime() || 0;
  const masalah = de.filter(p => p.emailStatus !== 'disahkan').sort((a, b) => tms(a.emailMarkedAt) - tms(b.emailMarkedAt));
  const sah = de.filter(p => p.emailStatus === 'disahkan').sort((a, b) => tms(b.emailVerifiedAt) - tms(a.emailVerifiedAt));
  const robot = await DB.getRobot();
  const row = p => {
    const jam = Math.floor(U.jamSejak(p.emailMarkedAt));
    const tag = p.emailStatus === 'disahkan' ? `<span class="pill p-g">✓ ${p.emailVerifiedBy === 'sistem' ? 'Auto' : 'Manual'}</span>` : p.emailStatus === 'bermasalah' ? `<span class="pill p-r">${esc((p.emailIssue || 'Bermasalah').split(';')[0].slice(0, 28))}</span>` : `<span class="pill ${jam >= CFG.jamAmaranEmail ? 'p-r' : 'p-a'}">${jam >= CFG.jamAmaranEmail ? 'Tiada CC' : 'Menunggu'} ${jam}j</span>`;
    return `<div class="li ${p.emailStatus === 'disahkan' ? 'l-g' : p.emailStatus === 'bermasalah' || jam >= CFG.jamAmaranEmail ? 'l-r' : 'l-a'}">
      <a href="#/p/${p.id}" style="text-decoration:none;color:inherit"><div class="row1"><b>${esc(p.namaAgensi)}</b>${tag}</div>
      <div class="s">${esc(p.ejenNama)} · ${esc(p.ejenKod)} · ${p.id} · tekan Dah Email ${U.tarikhMasa(p.emailMarkedAt)}</div></a>
      ${p.emailStatus !== 'disahkan' ? `<div class="two">${p.emailInfo?.mid ? `<a class="btn o sm" href="#/admin/email/${p.emailInfo.mid}">Baca email</a>` : ''}
        <button class="btn sm" data-act="sahkan" data-id="${p.id}" data-confirm="Sahkan manual email untuk ${esc(p.namaAgensi)}?">Sahkan manual</button></div>` : ''}
    </div>`;
  };
  return render({ tone: 'admin', title: 'Pengesahan Email', back: '#/dashboard', body: `
  <div class="card small">Peti pengesahan: <b>${esc(CFG.ccEmail)}</b><br>${robot ? '✓ Robot email (Apps Script) ditetapkan – email disemak setiap 5 minit.' : `⚠ Robot email belum ditetapkan – sila sahkan secara manual${utama(me) ? ' atau <a href="#/admin/tetapan">tetapkan robot</a>' : ''}.`}</div>
  <div class="tabs adm"><a class="${tab === 'masalah' ? 'on' : ''}" href="#/admin/pengesahan">Perlu semak (${masalah.length})</a><a class="${tab === 'disahkan' ? 'on' : ''}" href="#/admin/pengesahan?tab=disahkan">Disahkan</a><a class="${tab === 'masuk' ? 'on' : ''}" href="#/admin/pengesahan?tab=masuk">Email masuk</a></div>
  ${tab === 'masalah' ? (masalah.map(row).join('') || '<div class="empty">Tiada yang perlu disemak. 👍</div>') : ''}
  ${tab === 'disahkan' ? (sah.map(row).join('') || '<div class="empty">Tiada rekod.</div>') : ''}
  ${tab === 'masuk' ? (em.map(e => `<a class="li ${e.pid ? '' : 'l-r'}" href="#/admin/email/${e.id}"><div class="row1"><b style="font-size:14px">${esc(e.subjek || '(tiada subjek)')}</b>${e.adaPdf ? '<span class="pill p-g">PDF</span>' : '<span class="pill p-r">Tiada PDF</span>'}</div><div class="s">Dari ${esc(e.dari)} · ${U.tarikhMasa(e.diterima)}${e.pid ? ` · ${e.pid}` : ' · tiada kod TKL'}</div></a>`).join('') || '<div class="empty">Tiada email.</div>') : ''}` });
});
ACTS.sahkan = async ({ id }) => { const p = await DB.getPermohonan(id); await DB.sahkanManual(p, me); setFlash('Disahkan.'); route(); };

A('/email/:id', async ({ id }) => {
  const e = await DB.getEmailMasuk(id); if (!e) return go('#/admin/pengesahan?tab=masuk');
  return render({ tone: 'admin', title: 'Email', back: '#/admin/pengesahan?tab=masuk', body: `<div class="card small"><dl>
    <dt>Subjek</dt><dd>${esc(e.subjek)}</dd><dt>Dari</dt><dd>${esc(e.dari)}</dd><dt>Kepada / CC</dt><dd>${esc(e.kepada)}</dd>
    <dt>Lampiran PDF</dt><dd>${e.adaPdf ? '✓ Ada' : '✕ Tiada'}</dd><dt>Diterima</dt><dd>${U.tarikhMasa(e.diterima)}</dd>
    ${e.pid ? `<dt>Permohonan</dt><dd><a href="#/p/${e.pid}">${e.pid}</a></dd>` : ''}</dl></div>
    <div class="card"><pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;margin:0">${esc(e.isi)}</pre></div>` });
});

A('/permohonan', async (prm, q) => {
  const [ps, us] = await Promise.all([DB.senaraiSemua(), DB.senaraiEjen()]);
  const tms = t => U.toDate(t)?.getTime() || 0;
  const rows = ps.filter(p => (!q.status || p.status === q.status) && (!q.ejen || p.uid === q.ejen) && (!q.q || p.namaAgensi.toLowerCase().includes(q.q.toLowerCase())))
    .sort((a, b) => tms(b.createdAt) - tms(a.createdAt));
  const ejen = us.filter(u => u.kodEjen).sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
  return render({ tone: 'admin', title: 'Semua Permohonan', back: '#/dashboard', body: `
  <form data-f="cari" data-base="#/admin/permohonan" class="card" style="display:grid;gap:8px">
    <input name="q" placeholder="🔍 Cari agensi…" value="${esc(q.q)}">
    <div class="two"><select name="status"><option value="">Semua status</option>${Object.entries(U.STATUS).map(([k, v]) => `<option value="${k}" ${k === q.status ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
    <select name="ejen"><option value="">Semua ejen</option>${ejen.map(e => `<option value="${e.id}" ${e.id === q.ejen ? 'selected' : ''}>${esc(e.nama)}</option>`).join('')}</select></div>
    <button class="btn adm sm">Tapis</button></form>
  <p class="tiny muted">${rows.length} rekod</p>
  ${rows.map(p => item(p, { ejen: true })).join('') || '<div class="empty">Tiada rekod.</div>'}` });
});

A('/prestasi', async (prm, q) => {
  const bulan = /^\d{4}-\d{2}$/.test(q.bulan || '') ? q.bulan : U.hariIni().slice(0, 7);
  const [ps, us] = await Promise.all([DB.senaraiSemua(), DB.senaraiEjen()]);
  const ejen = us.filter(u => u.kodEjen).map(u => {
    const mine = ps.filter(p => p.uid === u.id);
    const tk = mine.filter(p => p.taklimat?.tarikh?.slice(0, 7) === bulan);
    const sel = tk.filter(p => p.status === 'selesai');
    return {
      id: u.id, nama: u.nama, kod: u.kodEjen,
      mohon: mine.filter(p => U.isoBulan(p.createdAt) === bulan).length,
      email: mine.filter(p => U.isoBulan(p.emailMarkedAt) === bulan).length,
      takl: tk.length, hadir: sel.reduce((a, p) => a + p.taklimat.hadir, 0), closing: sel.reduce((a, p) => a + p.taklimat.closing, 0),
    };
  }).filter(r => r.mohon || r.email || r.takl).sort((a, b) => b.closing - a.closing || b.takl - a.takl);
  const T = ejen.reduce((o, r) => { for (const k of ['mohon', 'email', 'takl', 'hadir', 'closing']) o[k] += r[k]; return o; }, { mohon: 0, email: 0, takl: 0, hadir: 0, closing: 0 });
  const [y, m] = bulan.split('-').map(Number);
  const nav = dd => { const dt = new Date(y, m - 1 + dd, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; };
  return render({ tone: 'admin', title: 'Prestasi', back: '#/dashboard', body: `
  <div class="two" style="align-items:center;margin-bottom:10px"><a class="btn o sm" href="#/admin/prestasi?bulan=${nav(-1)}">‹</a><b class="center" style="flex:2">${U.BULAN[m - 1]} ${y}</b><a class="btn o sm" href="#/admin/prestasi?bulan=${nav(1)}">›</a></div>
  <div class="kpi"><div class="card"><div class="big">${T.hadir}</div><div class="tiny muted">Jumlah hadir</div></div><div class="card"><div class="big" style="color:var(--pri)">${T.closing}</div><div class="tiny muted">Closing</div></div><div class="card"><div class="big">${T.hadir ? Math.round(T.closing / T.hadir * 100) : 0}%</div><div class="tiny muted">Kadar</div></div></div>
  <div class="kpi" style="margin-top:8px"><div class="card"><div class="big">${T.mohon}</div><div class="tiny muted">Permohonan</div></div><div class="card"><div class="big">${T.email}</div><div class="tiny muted">Dah email</div></div><div class="card"><div class="big">${T.takl}</div><div class="tiny muted">Taklimat</div></div></div>
  <h3>Ikut ejen</h3>
  <div style="overflow-x:auto"><table><tr><th>Ejen</th><th>Mohon</th><th>Email</th><th>Takl.</th><th>Hadir</th><th>Closing</th></tr>
  ${ejen.map(r => `<tr><td><a href="#/admin/permohonan?ejen=${r.id}">${esc(r.nama)}</a><div class="tiny muted">${esc(r.kod)}</div></td><td>${r.mohon}</td><td>${r.email}</td><td>${r.takl}</td><td>${r.hadir}</td><td><b>${r.closing}</b></td></tr>`).join('') || '<tr><td colspan="6" class="center muted">Tiada aktiviti bulan ini.</td></tr>'}
  </table></div>` });
});

A('/tetapan', async () => {
  if (!utama(me)) return go('#/admin/ejen');
  const robot = await DB.getRobot();
  return render({ tone: 'admin', title: 'Tetapan Robot Email', back: '#/dashboard', body: `
  <div class="card small">Robot email ialah akaun Firebase khas yang digunakan oleh <b>Google Apps Script</b> dalam Gmail <b>${esc(CFG.ccEmail)}</b> untuk mengesahkan “Dah Email” secara automatik. Lihat PANDUAN.md langkah 5.</div>
  <form data-f="robot" class="card">
    <label for="ruid">UID akaun robot (dari Firebase Console → Authentication)</label>
    <input id="ruid" name="uid" required value="${esc(robot?.uid || '')}" placeholder="cth: 6xY2…">
    <button class="btn adm">SIMPAN</button>
  </form>` });
});
FORMS.robot = async v => { await DB.setRobot(v.uid.trim()); setFlash('Robot email ditetapkan.'); route(); };

// ================= PAD TANDATANGAN =================
function initSig() {
  const wrap = document.querySelector('.sigwrap'); if (!wrap) return;
  const cv = wrap.querySelector('canvas'), out = document.getElementById('signature'), ctx = cv.getContext('2d');
  let drawing = false, dirty = false, last;
  const rc = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = rc.width * dpr; cv.height = rc.height * dpr; ctx.scale(dpr, dpr);
  ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14306b';
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => { drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; dirty = true; });
  const end = () => { if (drawing && dirty) out.value = trimmed(); drawing = false; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  document.getElementById('sig-clear').addEventListener('click', () => { ctx.clearRect(0, 0, cv.width, cv.height); out.value = ''; dirty = false; const pv = document.getElementById('sig-current'); if (pv) pv.style.display = 'none'; });
  function trimmed() {
    const w = cv.width, h = cv.height, dt = ctx.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dt[(y * w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) return '';
    const pad = 6, c2 = document.createElement('canvas'); c2.width = x1 - x0 + pad * 2; c2.height = y1 - y0 + pad * 2;
    c2.getContext('2d').drawImage(cv, x0 - pad, y0 - pad, c2.width, c2.height, 0, 0, c2.width, c2.height);
    // kecilkan supaya muat dalam Firestore
    const s = Math.min(1, 500 / c2.width), c3 = document.createElement('canvas'); c3.width = c2.width * s; c3.height = c2.height * s;
    c3.getContext('2d').drawImage(c2, 0, 0, c3.width, c3.height);
    return c3.toDataURL('image/png');
  }
  document.getElementById('sig-upload').addEventListener('change', ev => {
    const f = ev.target.files[0]; if (!f) return;
    const img = new Image(), rd = new FileReader();
    rd.onload = () => { img.src = rd.result; };
    img.onload = () => {
      const c = document.createElement('canvas'), s = Math.min(1, 600 / img.width); c.width = img.width * s; c.height = img.height * s;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
      const id = x.getImageData(0, 0, c.width, c.height), p = id.data;
      for (let i = 0; i < p.length; i += 4) { const l = (p[i] + p[i + 1] + p[i + 2]) / 3; if (l > 200) p[i + 3] = 0; else { p[i] = 20; p[i + 1] = 48; p[i + 2] = 107; } }
      x.putImageData(id, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      const r = cv.getBoundingClientRect(), sc = Math.min(r.width / c.width, (r.height - 40) / c.height);
      ctx.drawImage(c, (r.width - c.width * sc) / 2, 10, c.width * sc, c.height * sc);
      dirty = true; out.value = trimmed();
    };
    rd.readAsDataURL(f);
  });
}

// ================= MULA =================
let menungguDaftar = false;
async function muatMe() { me = DB.auth.currentUser ? await DB.getUser(DB.auth.currentUser.uid) : null; }
window.addEventListener('hashchange', route);
if (DB.dikonfigur) {
  DB.onAuth(async u => {
    if (menungguDaftar) return; // daftar sedang mencipta dokumen pengguna
    await muatMe();
    if (u && !me) { await DB.logout(); return; }
    if (!u && !['#/login', '#/daftar'].includes(location.hash)) { go('#/login'); return; }
    if (u && ['#/login', '#/daftar', '', '#/'].includes(location.hash)) { go('#/'); return; }
    route();
  });
} else route();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
