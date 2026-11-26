// Dashboard & senarai permohonan ejen
const router = require('express').Router();
const { one, all } = require('../db');
const { esc, pill } = require('../lib/views');
const U = require('../lib/util');
const G = require('./guard');

function bilFollow(pid) { return one('SELECT COUNT(*) n, MAX(created_at) akhir FROM followup WHERE permohonan_id=?', pid); }

// Satu baris permohonan dalam senarai
function item(p, opt = {}) {
  let s = '', tag = pill(p.status), cls = '';
  if (p.status === 'surat_siap') { s = `Surat dijana ${U.tarikh(p.tarikh_surat)} · belum email`; cls = 'l-b'; }
  if (p.status === 'dah_email') {
    const f = bilFollow(p.id), lagi = U.hariLagi(p.last_activity);
    const ev = p.email_status === 'disahkan' ? '✓ disahkan' : p.email_status === 'bermasalah' ? '⚠ bermasalah' : '⏳ menunggu pengesahan';
    s = `Email ${U.tarikh(p.email_marked_at)} (${ev}) · ${f.n ? `follow up ×${f.n}, terakhir ${U.tarikh(f.akhir)}` : 'belum follow up'}`;
    tag = lagi <= 10 ? `<span class="pill p-r">${lagi} hari lagi</span>` : f.n ? `<span class="pill p-a">Follow up ×${f.n}</span>` : `<span class="pill p-b">Belum follow up</span>`;
    cls = lagi <= 10 ? 'l-r' : 'l-a';
  }
  if (p.status === 'dapat_taklimat' || p.status === 'selesai') {
    const t = one('SELECT * FROM taklimat WHERE permohonan_id=?', p.id) || {};
    if (p.status === 'selesai') { s = `📅 ${U.tarikh(t.tarikh)} · Hadir ${t.hadir} · Closing ${t.closing}${t.hadir ? ` (${Math.round(t.closing / t.hadir * 100)}%)` : ''}`; cls = 'l-g'; }
    else {
      const perlu = t.tarikh && t.tarikh < U.hariIni();
      s = `📅 ${U.tarikh(t.tarikh)} · ${U.masa12(t.masa)} · ${esc(t.penceramah)}`;
      if (perlu) { tag = '<span class="pill p-a">Perlu rekod</span>'; cls = 'l-gold'; } else cls = 'l-g';
    }
  }
  if (p.status === 'tak_berjaya') { s = `${esc(p.tak_sebab || 'Tak berjaya')} · ${U.tarikh(p.closed_at)}`; cls = 'l-r'; }
  if (p.status === 'dilepaskan') { s = `${U.LUPUT_HARI} hari tiada tindakan · ${U.tarikh(p.closed_at)}`; }
  const who = opt.ejen ? `<div class="s">👤 ${esc(p.ejen_nama)} (${esc(p.ejen_kod)})</div>` : '';
  return `<a class="li ${cls}" href="/p/${p.id}"><div class="row1"><b>${esc(p.nama_agensi)}</b>${tag}</div><div class="s">${s}</div>${who}</a>`;
}

router.get('/dashboard', G.aktif, (req, res) => {
  const u = req.user;
  const c = one(`SELECT COUNT(*) jumlah,
      SUM(status='surat_siap') surat, SUM(status='dah_email') email,
      SUM(status IN ('dapat_taklimat','selesai')) dapat, SUM(status IN ('tak_berjaya','dilepaskan')) tak
    FROM permohonan WHERE user_id=?`, u.id);
  const dahEmail = all("SELECT * FROM permohonan WHERE user_id=? AND status='dah_email'", u.id);
  const perluFU = dahEmail.filter(p => U.hariSejak(p.last_activity) >= 3 || U.hariLagi(p.last_activity) <= 10).length;
  const hampir = dahEmail.filter(p => U.hariLagi(p.last_activity) <= 10).length;
  const rekod = one("SELECT COUNT(*) n FROM permohonan p JOIN taklimat t ON t.permohonan_id=p.id WHERE p.user_id=? AND p.status='dapat_taklimat' AND t.tarikh < ?", u.id, U.hariIni()).n;
  const hasil = one("SELECT COALESCE(SUM(t.hadir),0) hadir, COALESCE(SUM(t.closing),0) closing FROM permohonan p JOIN taklimat t ON t.permohonan_id=p.id WHERE p.user_id=? AND p.status='selesai'", u.id);
  const ini = (u.nama || '?').split(/\s+/).filter(w => !/^(bin|binti|bt|b|a\/l|a\/p)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  res.page({ title: 'Dashboard', body: `
  <div class="avatar">${esc(ini)}</div>
  <div class="card center">
    <b style="font-size:17px">${esc(u.nama)}</b>
    <div class="small muted">Kod Ejen: ${esc(u.kod_ejen)} · ${esc(u.telefon)}</div>
    <div class="stats">
      <div><b>${c.jumlah || 0}</b><span>Jumlah</span></div>
      <div><b style="color:var(--pri)">${c.dapat || 0}</b><span>Dapat</span></div>
      <div><b style="color:var(--red)">${c.tak || 0}</b><span>Tak Berjaya</span></div>
      <div><b style="color:var(--gold)">${hasil.closing}</b><span>Closing</span></div>
    </div>
  </div>
  ${rekod ? `<a class="alert warn" style="display:block;text-decoration:none;color:var(--ink)" href="/senarai/dapat?tab=rekod"><span class="h">📝 ${rekod} taklimat perlu rekod hasil</span><br><span class="small">Isi bilangan hadir &amp; closing.</span></a>` : ''}
  ${hampir ? `<a class="alert err" style="display:block;text-decoration:none;color:var(--ink)" href="/senarai/follow-up"><span class="h">⚠ ${hampir} agensi hampir dilepaskan</span><br><span class="small">Follow up untuk kekalkan agensi.</span></a>` : ''}
  <div class="boxes">
    <a class="box b1" href="/senarai/surat"><div class="i">✉</div><b>Surat</b><small>Belum email</small><div class="n">${c.surat || 0}</div></a>
    <a class="box b2" href="/senarai/dah-email"><div class="i">➤</div><b>Dah Email</b><small>Tunggu jawapan</small><div class="n">${c.email || 0}</div></a>
    <a class="box b3" href="/senarai/follow-up"><div class="i">↻</div><b>Follow Up</b><small>Perlu tindakan</small><div class="n">${perluFU}</div></a>
  </div>
  <div class="boxes2">
    <a class="box2 g" href="/senarai/dapat">✓ Dapat Taklimat<small>${c.dapat || 0} agensi</small></a>
    <a class="box2 r" href="/senarai/tak-berjaya">✕ Tak Berjaya<small>${c.tak || 0} agensi</small></a>
  </div>
  <a class="btn" href="/permohonan/baru" style="margin-top:14px">+ PERMOHONAN BARU</a>` });
});

const SENARAI = {
  'surat': ['Surat (belum email)', "status='surat_siap'", 'p.created_at DESC'],
  'dah-email': ['Dah Email', "status='dah_email'", 'p.email_marked_at DESC'],
  'follow-up': ['Follow Up', "status='dah_email'", 'p.last_activity ASC'],
  'dapat': ['Dapat Taklimat', "status IN ('dapat_taklimat','selesai')", 'p.id DESC'],
  'tak-berjaya': ['Tak Berjaya', "status IN ('tak_berjaya','dilepaskan')", 'p.closed_at DESC'],
  'semua': ['Semua Permohonan', '1=1', 'p.id DESC'],
};

router.get('/senarai/:jenis', G.aktif, (req, res) => {
  const S = SENARAI[req.params.jenis];
  if (!S) return res.redirect('/dashboard');
  const q = String(req.query.q || '').trim();
  let rows = all(`SELECT p.* FROM permohonan p WHERE user_id=? AND ${S[1]} ${q ? 'AND nama_agensi LIKE ?' : ''} ORDER BY ${S[2]}`, req.user.id, ...(q ? [`%${q}%`] : []));
  let top = '';
  if (req.params.jenis === 'dapat') {
    const tab = req.query.tab || 'datang', hi = U.hariIni();
    const tk = id => one('SELECT tarikh FROM taklimat WHERE permohonan_id=?', id)?.tarikh || '';
    const g = {
      datang: rows.filter(p => p.status === 'dapat_taklimat' && tk(p.id) >= hi),
      rekod: rows.filter(p => p.status === 'dapat_taklimat' && tk(p.id) < hi),
      selesai: rows.filter(p => p.status === 'selesai'),
    };
    top = `<div class="tabs">${[['datang', 'Akan datang'], ['rekod', 'Perlu rekod'], ['selesai', 'Selesai']].map(([k, t]) => `<a class="${tab === k ? 'on' : ''}" href="?tab=${k}">${t} (${g[k].length})</a>`).join('')}</div>`;
    rows = g[tab] || g.datang;
    if (tab === 'datang') rows.sort((a, b) => tk(a.id).localeCompare(tk(b.id)));
  }
  if (req.params.jenis === 'follow-up') {
    const hampir = rows.filter(p => U.hariLagi(p.last_activity) <= 10).length;
    if (hampir) top = `<div class="alert err small">⚠ <b>${hampir} agensi</b> akan dilepaskan tidak lama lagi. Follow up untuk kekalkan.</div>`;
    const lepas = all("SELECT * FROM permohonan WHERE user_id=? AND status='dilepaskan' ORDER BY closed_at DESC LIMIT 5", req.user.id);
    res.page({ title: S[0], back: '/dashboard', body: top + (rows.length ? rows.map(p => item(p)).join('') : '<div class="empty">Tiada agensi untuk di-follow up.</div>') + (lepas.length ? `<h3>Baru dilepaskan</h3><div style="opacity:.65">${lepas.map(p => item(p)).join('')}</div>` : '') });
    return;
  }
  const search = `<form><input name="q" placeholder="🔍 Cari agensi…" value="${esc(q)}">${req.query.tab ? `<input type="hidden" name="tab" value="${esc(req.query.tab)}">` : ''}</form><div style="height:10px"></div>`;
  res.page({ title: S[0], back: '/dashboard', tone: req.params.jenis === 'tak-berjaya' ? 'red' : '', body: search + top + (rows.length ? rows.map(p => item(p)).join('') : '<div class="empty">Tiada rekod.</div>') });
});

module.exports = router;
module.exports.item = item;
