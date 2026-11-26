// Admin: kelulusan ejen, tambah admin, gantung & pindah, pengesahan email, semua permohonan, prestasi
const router = require('express').Router();
const C = require('../config');
const { one, all, run, tx, now, event, notify } = require('../db');
const { esc, pill } = require('../lib/views');
const U = require('../lib/util');
const G = require('./guard');
const { item } = require('./ejen');
const emailcheck = require('../lib/emailcheck');

router.use(G.admin);
const page = (res, o) => res.page({ tone: 'admin', ...o });
const utama = u => u.role === 'admin_utama';
const rolePill = u => u.role === 'admin_utama' ? '<span class="pill p-adm">ADMIN UTAMA</span>' : u.role === 'admin' ? '<span class="pill p-adm2">ADMIN</span>' : '';
const AKTIF_PINDAH = "('surat_siap','dah_email','dapat_taklimat')";

// ---------- SENARAI EJEN ----------
router.get('/ejen', (req, res) => {
  const tab = ['menunggu', 'aktif', 'ditolak', 'digantung'].includes(req.query.tab) ? req.query.tab : 'menunggu';
  const q = String(req.query.q || '').trim();
  const cnt = s => one('SELECT COUNT(*) n FROM users WHERE status=?', s).n;
  const rows = all(`SELECT u.*, (SELECT COUNT(*) FROM permohonan p WHERE p.user_id=u.id AND p.status IN ${AKTIF_PINDAH}) aktif_n
    FROM users u WHERE status=? ${q ? 'AND (nama LIKE ? OR kod_ejen LIKE ?)' : ''} ORDER BY CASE role WHEN 'admin_utama' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, created_at DESC`,
    tab, ...(q ? [`%${q}%`, `%${q}%`] : []));
  page(res, { title: 'Admin · Ejen', back: '/dashboard', body: `
  ${utama(req.user) ? '<a class="btn adm sm" href="/admin/tambah-admin" style="margin:0 0 12px">+ TAMBAH ADMIN</a>' : ''}
  <div class="tabs adm">${['menunggu', 'aktif', 'ditolak', 'digantung'].map(t => `<a class="${t === tab ? 'on' : ''}" href="?tab=${t}">${t[0].toUpperCase() + t.slice(1)} (${cnt(t)})</a>`).join('')}</div>
  <form><input type="hidden" name="tab" value="${tab}"><input name="q" placeholder="🔍 Cari nama / kod ejen…" value="${esc(q)}"></form><div style="height:10px"></div>
  ${rows.length ? rows.map(u => `<a class="li ${tab === 'menunggu' ? 'l-a' : tab === 'aktif' ? '' : 'l-r'}" href="/admin/ejen/${u.id}">
    <div class="row1"><b>${esc(u.nama || u.email)}</b>${rolePill(u) || (tab === 'menunggu' ? '<span class="pill p-a">Baru</span>' : tab === 'aktif' ? '<span class="pill p-g">Ejen</span>' : '')}</div>
    <div class="s">${esc(u.kod_ejen || '-')} · ${esc(u.telefon || '')}${tab === 'aktif' ? ` · ${u.aktif_n} agensi aktif` : ` · ${U.tarikhMasa(u.created_at)}`}</div></a>`).join('') : '<div class="empty">Tiada ejen.</div>'}` });
});

router.get('/ejen/:id', (req, res) => {
  const u = one('SELECT * FROM users WHERE id=?', Number(req.params.id));
  if (!u) return res.redirect('/admin/ejen');
  const me = req.user;
  const perms = all(`SELECT * FROM permohonan WHERE user_id=? AND status IN ${AKTIF_PINDAH} ORDER BY id DESC`, u.id);
  const st = one(`SELECT COUNT(*) n, SUM(status IN ('dapat_taklimat','selesai')) dapat FROM permohonan WHERE user_id=?`, u.id);
  const lain = all("SELECT id, nama, kod_ejen FROM users WHERE status='aktif' AND id<>? ORDER BY nama", u.id);
  const bolehGantung = u.status === 'aktif' && u.id !== me.id && u.role !== 'admin_utama' && (u.role === 'ejen' || utama(me));
  let aksi = '';
  if (u.status === 'menunggu') aksi = `
    <form method="post" action="/admin/ejen/${u.id}/lulus"><button class="btn">✓ LULUS</button></form>
    <form method="post" action="/admin/ejen/${u.id}/tolak" class="card" style="margin-top:12px">
      <label for="sebab">Sebab tolak *</label><input id="sebab" name="sebab" required placeholder="cth: Kod ejen tidak wujud dalam rekod">
      <button class="btn r">✕ TOLAK</button></form>`;
  if (bolehGantung) aksi += `
    <details class="card" style="margin-top:12px"><summary style="font-weight:800;color:var(--red);cursor:pointer">Gantung ejen</summary>
    <form method="post" action="/admin/ejen/${u.id}/gantung" data-confirm="Gantung ${esc(u.nama)} dan pindah ${perms.length} agensi?">
      <label for="sebab2">Sebab gantung *</label><input id="sebab2" name="sebab" required placeholder="cth: Berhenti kerja">
      ${perms.length ? `<label for="kepada">Pindah semua agensi kepada *</label>
      <select id="kepada" name="kepada" required><option value="">– Pilih ejen penerima –</option>${lain.map(l => `<option value="${l.id}">${esc(l.nama)} (${esc(l.kod_ejen)})</option>`).join('')}</select>
      <h3>Agensi yang akan dipindah (${perms.length})</h3>${perms.map(p => `<div class="li" style="padding:8px 10px"><div class="row1"><b style="font-size:14px">${esc(p.nama_agensi)}</b>${pill(p.status)}</div></div>`).join('')}`
      : '<p class="small muted">Tiada agensi aktif untuk dipindah.</p>'}
      <button class="btn r">GANTUNG${perms.length ? ` &amp; PINDAH ${perms.length} AGENSI` : ''}</button>
    </form></details>`;
  if (u.status === 'digantung') aksi = `<form method="post" action="/admin/ejen/${u.id}/aktif"><button class="btn">AKTIFKAN SEMULA</button></form>`;
  if (utama(me) && u.status === 'aktif' && u.role === 'ejen') aksi += `<form method="post" action="/admin/ejen/${u.id}/jadikan-admin" data-confirm="Jadikan ${esc(u.nama)} admin?"><button class="btn adm">Jadikan Admin</button></form>`;
  if (utama(me) && u.role === 'admin') aksi += `<form method="post" action="/admin/ejen/${u.id}/buang-admin" data-confirm="Buang ${esc(u.nama)} sebagai admin?"><button class="btn o" style="color:var(--adm);border-color:var(--adm)">Buang sebagai Admin</button></form>`;
  page(res, { title: 'Semak Ejen', back: `/admin/ejen?tab=${u.status === 'profil' ? 'menunggu' : u.status}`, body: `
  <div class="card"><div class="row1" style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:16px">${esc(u.nama || '(profil belum lengkap)')}</b>${rolePill(u)}</div>
    <dl class="small">
      <dt>Kod ejen</dt><dd><b>${esc(u.kod_ejen)}</b></dd>
      <dt>No. IC</dt><dd>${esc(u.no_ic)}</dd>
      <dt>Jawatan</dt><dd>${esc(C.JAWATAN_EJEN)}</dd>
      <dt>Telefon / Email</dt><dd>${esc(u.telefon)} · ${esc(u.email)}</dd>
      <dt>Status</dt><dd>${esc(u.status)}${u.sebab_status ? ` – ${esc(u.sebab_status)}` : ''}</dd>
      <dt>Permohonan</dt><dd>${st.n} jumlah · ${st.dapat || 0} dapat taklimat · ${perms.length} aktif</dd>
    </dl></div>
  <label>Tandatangan</label><div class="sigimg">${u.signature ? `<img src="${u.signature}" alt="Tandatangan">` : '<span class="muted small">Tiada</span>'}</div>
  ${aksi}
  ${perms.length ? `<h3>Agensi aktif</h3>${perms.map(p => item(p)).join('')}` : ''}` });
});

function setStatus(req, res, fn) {
  const u = one('SELECT * FROM users WHERE id=?', Number(req.params.id));
  if (!u) return res.redirect('/admin/ejen');
  const msg = fn(u);
  if (msg) res.flash(msg[0], msg[1]);
  res.redirect(`/admin/ejen/${u.id}`);
}
router.post('/ejen/:id/lulus', (req, res) => setStatus(req, res, u => {
  if (u.status !== 'menunggu') return ['Ejen ini tidak menunggu kelulusan.', 'err'];
  run("UPDATE users SET status='aktif', sebab_status=NULL, approved_by=?, approved_at=? WHERE id=?", req.user.id, now(), u.id);
  notify(u.id, '✅ Akaun anda telah diluluskan. Selamat bertugas!', '/dashboard');
  return [`${u.nama} diluluskan.`];
}));
router.post('/ejen/:id/tolak', (req, res) => setStatus(req, res, u => {
  if (u.status !== 'menunggu') return ['Ejen ini tidak menunggu kelulusan.', 'err'];
  run("UPDATE users SET status='ditolak', sebab_status=? WHERE id=?", String(req.body.sebab || '').trim() || 'Tiada sebab', u.id);
  return [`${u.nama} ditolak.`];
}));
router.post('/ejen/:id/gantung', (req, res) => setStatus(req, res, u => {
  const me = req.user;
  if (u.status !== 'aktif' || u.id === me.id || u.role === 'admin_utama' || (u.role === 'admin' && !utama(me))) return ['Tidak dibenarkan.', 'err'];
  const perms = all(`SELECT * FROM permohonan WHERE user_id=? AND status IN ${AKTIF_PINDAH}`, u.id);
  const sebab = String(req.body.sebab || '').trim();
  if (!sebab) return ['Sila isi sebab.', 'err'];
  let ke = null;
  if (perms.length) {
    ke = one("SELECT * FROM users WHERE id=? AND status='aktif' AND id<>?", Number(req.body.kepada), u.id);
    if (!ke) return ['Sila pilih ejen penerima.', 'err'];
  }
  tx(() => {
    run("UPDATE users SET status='digantung', sebab_status=?, role=CASE WHEN role='admin' THEN 'ejen' ELSE role END WHERE id=?", sebab, u.id);
    const t = now();
    for (const p of perms) {
      run('UPDATE permohonan SET user_id=?, last_activity=?, amaran_hari=0 WHERE id=?', ke.id, t, p.id);
      event(p.id, `Dipindah dari ${u.nama} (${u.kod_ejen}) kepada ${ke.nama} (${ke.kod_ejen}) oleh ${me.nama}`);
    }
  });
  if (ke) notify(ke.id, `📥 ${perms.length} agensi dipindah kepada anda daripada ${u.nama}: ${perms.map(p => p.nama_agensi).join(', ')}`, '/senarai/semua');
  return [`${u.nama} digantung${ke ? `; ${perms.length} agensi dipindah kepada ${ke.nama}` : ''}.`];
}));
router.post('/ejen/:id/aktif', (req, res) => setStatus(req, res, u => {
  if (u.status !== 'digantung') return ['Ejen ini tidak digantung.', 'err'];
  run("UPDATE users SET status='aktif', sebab_status=NULL WHERE id=?", u.id);
  notify(u.id, 'Akaun anda telah diaktifkan semula.', '/dashboard');
  return [`${u.nama} diaktifkan semula.`];
}));
router.post('/ejen/:id/jadikan-admin', (req, res) => setStatus(req, res, u => {
  if (!utama(req.user) || u.status !== 'aktif' || u.role !== 'ejen') return ['Tidak dibenarkan.', 'err'];
  run("UPDATE users SET role='admin' WHERE id=?", u.id);
  notify(u.id, 'Anda telah dijadikan admin.', '/admin/ejen');
  return [`${u.nama} kini admin.`];
}));
router.post('/ejen/:id/buang-admin', (req, res) => setStatus(req, res, u => {
  if (!utama(req.user) || u.role !== 'admin') return ['Tidak dibenarkan.', 'err'];
  run("UPDATE users SET role='ejen' WHERE id=?", u.id);
  return [`${u.nama} bukan lagi admin.`];
}));

router.get('/tambah-admin', (req, res) => {
  if (!utama(req.user)) return res.redirect('/admin/ejen');
  const q = String(req.query.q || '').trim();
  const rows = all(`SELECT * FROM users WHERE status='aktif' AND role='ejen' ${q ? 'AND (nama LIKE ? OR kod_ejen LIKE ?)' : ''} ORDER BY nama`, ...(q ? [`%${q}%`, `%${q}%`] : []));
  page(res, { title: 'Tambah Admin', back: '/admin/ejen?tab=aktif', body: `
  <p class="small muted">Pilih ejen aktif untuk dijadikan admin. Admin boleh lulus/tolak ejen, gantung ejen biasa, pindah agensi, sahkan email &amp; nampak semua data. Admin tidak boleh buang Admin Utama.</p>
  <form><input name="q" placeholder="🔍 Cari nama / kod ejen…" value="${esc(q)}"></form><div style="height:10px"></div>
  ${rows.map(u => `<form method="post" action="/admin/ejen/${u.id}/jadikan-admin" class="li" data-confirm="Jadikan ${esc(u.nama)} admin?"><div class="row1"><div><b>${esc(u.nama)}</b><div class="s">${esc(u.kod_ejen)}</div></div><button class="btn adm sm" style="width:auto;margin:0">Jadikan Admin</button></div></form>`).join('') || '<div class="empty">Tiada ejen.</div>'}` });
});

// ---------- PENGESAHAN EMAIL ----------
router.get('/pengesahan', (req, res) => {
  const tab = req.query.tab === 'disahkan' ? 'disahkan' : req.query.tab === 'masuk' ? 'masuk' : 'masalah';
  const q = `SELECT p.*, u.nama ejen_nama, u.kod_ejen ejen_kod FROM permohonan p JOIN users u ON u.id=p.user_id WHERE p.status='dah_email'`;
  const masalah = all(`${q} AND p.email_status IN ('menunggu','bermasalah') ORDER BY p.email_marked_at`);
  const sah = all(`${q} AND p.email_status='disahkan' ORDER BY p.email_verified_at DESC LIMIT 100`);
  const masuk = all('SELECT * FROM email_masuk ORDER BY id DESC LIMIT 100');
  const row = p => {
    const jam = Math.floor((Date.now() - U.parseDT(p.email_marked_at).getTime()) / 3600000);
    const e = one('SELECT id FROM email_masuk WHERE permohonan_id=? ORDER BY id DESC LIMIT 1', p.id);
    const tag = p.email_status === 'disahkan' ? `<span class="pill p-g">✓ ${p.email_verified_by === 'sistem' ? 'Auto' : 'Manual'}</span>` : p.email_status === 'bermasalah' ? `<span class="pill p-r">${esc((p.email_issue || 'Bermasalah').split(';')[0].slice(0, 28))}</span>` : `<span class="pill p-a">Menunggu ${jam}j</span>`;
    return `<div class="li ${p.email_status === 'bermasalah' ? 'l-r' : p.email_status === 'menunggu' ? 'l-a' : 'l-g'}">
      <a href="/p/${p.id}" style="text-decoration:none;color:inherit"><div class="row1"><b>${esc(p.nama_agensi)}</b>${tag}</div>
      <div class="s">${esc(p.ejen_nama)} · ${esc(p.ejen_kod)} · ${U.kodTKL(p.id)} · tekan Dah Email ${U.tarikhMasa(p.email_marked_at)}</div></a>
      ${p.email_status !== 'disahkan' ? `<div class="two">${e ? `<a class="btn o sm" href="/admin/email/${e.id}">Baca email</a>` : ''}
        <form method="post" action="/admin/p/${p.id}/sahkan" data-confirm="Sahkan manual email untuk ${esc(p.nama_agensi)}?"><button class="btn sm">Sahkan manual</button></form></div>` : ''}
    </div>`;
  };
  page(res, { title: 'Pengesahan Email', back: '/dashboard', body: `
  <div class="card small">Peti pengesahan: <b>${esc(C.CC_EMAIL)}</b><br>${C.IMAP_HOST ? `✓ Sistem semak peti setiap ${C.IMAP_MINIT} minit.` : '⚠ IMAP belum ditetapkan – sila sahkan secara manual (lihat README).'}
    ${C.IMAP_HOST ? `<form method="post" action="/admin/semak-peti"><button class="btn o sm">↻ Semak peti sekarang</button></form>` : ''}</div>
  <div class="tabs adm"><a class="${tab === 'masalah' ? 'on' : ''}" href="?tab=masalah">Perlu semak (${masalah.length})</a><a class="${tab === 'disahkan' ? 'on' : ''}" href="?tab=disahkan">Disahkan</a><a class="${tab === 'masuk' ? 'on' : ''}" href="?tab=masuk">Email masuk</a></div>
  ${tab === 'masalah' ? (masalah.map(row).join('') || '<div class="empty">Tiada yang perlu disemak. 👍</div>') : ''}
  ${tab === 'disahkan' ? (sah.map(row).join('') || '<div class="empty">Tiada rekod.</div>') : ''}
  ${tab === 'masuk' ? (masuk.map(e => `<a class="li ${e.permohonan_id ? '' : 'l-r'}" href="/admin/email/${e.id}"><div class="row1"><b style="font-size:14px">${esc(e.subjek || '(tiada subjek)')}</b>${e.ada_pdf ? '<span class="pill p-g">PDF</span>' : '<span class="pill p-r">Tiada PDF</span>'}</div><div class="s">Dari ${esc(e.dari)} · ${U.tarikhMasa(e.diterima_at)}${e.permohonan_id ? ` · ${U.kodTKL(e.permohonan_id)}` : ' · tiada kod TKL'}</div></a>`).join('') || '<div class="empty">Tiada email.</div>') : ''}` });
});

router.get('/email/:id', (req, res) => {
  const e = one('SELECT * FROM email_masuk WHERE id=?', Number(req.params.id));
  if (!e) return res.redirect('/admin/pengesahan');
  page(res, { title: 'Email', back: '/admin/pengesahan?tab=masuk', body: `<div class="card small"><dl>
    <dt>Subjek</dt><dd>${esc(e.subjek)}</dd><dt>Dari</dt><dd>${esc(e.dari)}</dd><dt>Kepada / CC</dt><dd>${esc(e.kepada)}</dd>
    <dt>Lampiran PDF</dt><dd>${e.ada_pdf ? '✓ Ada' : '✕ Tiada'}</dd><dt>Diterima</dt><dd>${U.tarikhMasa(e.diterima_at)}</dd>
    ${e.permohonan_id ? `<dt>Permohonan</dt><dd><a href="/p/${e.permohonan_id}">${U.kodTKL(e.permohonan_id)}</a></dd>` : ''}</dl></div>
    <div class="card"><pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;margin:0">${esc(e.isi)}</pre></div>` });
});

router.post('/p/:id/sahkan', (req, res) => {
  const p = one("SELECT * FROM permohonan WHERE id=? AND status='dah_email'", Number(req.params.id));
  if (p && p.email_status !== 'disahkan') {
    const t = now();
    run("UPDATE permohonan SET email_status='disahkan', email_verified_at=?, email_verified_by=?, email_issue=NULL, last_activity=?, amaran_hari=0 WHERE id=?", t, req.user.nama, t, p.id);
    event(p.id, `Dah Email disahkan manual oleh ${req.user.nama}`);
    notify(p.user_id, `✅ Email ke ${p.nama_agensi} disahkan oleh admin.`, `/p/${p.id}`);
    res.flash('Disahkan.');
  }
  res.redirect('/admin/pengesahan');
});

router.post('/semak-peti', async (req, res, next) => {
  try { const r = await emailcheck.semakPeti(); res.flash(r.skipped ? 'Semakan sedang berjalan.' : `${r.diproses} email baru diproses.`); res.redirect('/admin/pengesahan'); }
  catch (e) { next(e); }
});

// ---------- SEMUA PERMOHONAN ----------
router.get('/permohonan', (req, res) => {
  const st = Object.keys(U.STATUS).includes(req.query.status) ? req.query.status : '';
  const ej = Number(req.query.ejen) || 0;
  const q = String(req.query.q || '').trim();
  const w = [], a = [];
  if (st) { w.push('p.status=?'); a.push(st); }
  if (ej) { w.push('p.user_id=?'); a.push(ej); }
  if (q) { w.push('p.nama_agensi LIKE ?'); a.push(`%${q}%`); }
  const rows = all(`SELECT p.*, u.nama ejen_nama, u.kod_ejen ejen_kod FROM permohonan p JOIN users u ON u.id=p.user_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY p.id DESC LIMIT 300`, ...a);
  const ejen = all("SELECT id, nama, kod_ejen FROM users WHERE kod_ejen IS NOT NULL ORDER BY nama");
  page(res, { title: 'Semua Permohonan', back: '/dashboard', body: `
  <form class="card" style="display:grid;gap:8px">
    <input name="q" placeholder="🔍 Cari agensi…" value="${esc(q)}">
    <div class="two"><select name="status"><option value="">Semua status</option>${Object.entries(U.STATUS).map(([k, v]) => `<option value="${k}" ${k === st ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
    <select name="ejen"><option value="">Semua ejen</option>${ejen.map(e => `<option value="${e.id}" ${e.id === ej ? 'selected' : ''}>${esc(e.nama)}</option>`).join('')}</select></div>
    <button class="btn adm sm">Tapis</button></form>
  <p class="tiny muted">${rows.length} rekod</p>
  ${rows.map(p => item(p, { ejen: true })).join('') || '<div class="empty">Tiada rekod.</div>'}` });
});

// ---------- PRESTASI ----------
router.get('/prestasi', (req, res) => {
  const bulan = /^\d{4}-\d{2}$/.test(req.query.bulan || '') ? req.query.bulan : U.hariIni().slice(0, 7);
  const ejen = all(`SELECT u.id, u.nama, u.kod_ejen,
      (SELECT COUNT(*) FROM permohonan p WHERE p.user_id=u.id AND substr(p.created_at,1,7)=?) mohon,
      (SELECT COUNT(*) FROM permohonan p WHERE p.user_id=u.id AND substr(p.email_marked_at,1,7)=?) email,
      (SELECT COUNT(*) FROM permohonan p JOIN taklimat t ON t.permohonan_id=p.id WHERE p.user_id=u.id AND substr(t.tarikh,1,7)=?) takl,
      (SELECT COALESCE(SUM(t.hadir),0) FROM permohonan p JOIN taklimat t ON t.permohonan_id=p.id WHERE p.user_id=u.id AND p.status='selesai' AND substr(t.tarikh,1,7)=?) hadir,
      (SELECT COALESCE(SUM(t.closing),0) FROM permohonan p JOIN taklimat t ON t.permohonan_id=p.id WHERE p.user_id=u.id AND p.status='selesai' AND substr(t.tarikh,1,7)=?) closing
    FROM users u WHERE u.kod_ejen IS NOT NULL AND u.status IN ('aktif','digantung')`, bulan, bulan, bulan, bulan, bulan)
    .filter(r => r.mohon || r.email || r.takl).sort((a, b) => b.closing - a.closing || b.takl - a.takl);
  const T = ejen.reduce((o, r) => { for (const k of ['mohon', 'email', 'takl', 'hadir', 'closing']) o[k] += r[k]; return o; }, { mohon: 0, email: 0, takl: 0, hadir: 0, closing: 0 });
  const [y, m] = bulan.split('-').map(Number);
  const nav = d => { const dt = new Date(y, m - 1 + d, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; };
  page(res, { title: 'Prestasi', back: '/dashboard', body: `
  <div class="two" style="align-items:center;margin-bottom:10px"><a class="btn o sm" href="?bulan=${nav(-1)}">‹</a><b class="center" style="flex:2">${U.BULAN[m - 1]} ${y}</b><a class="btn o sm" href="?bulan=${nav(1)}">›</a></div>
  <div class="kpi"><div class="card"><div class="big">${T.hadir}</div><div class="tiny muted">Jumlah hadir</div></div><div class="card"><div class="big" style="color:var(--pri)">${T.closing}</div><div class="tiny muted">Closing</div></div><div class="card"><div class="big">${T.hadir ? Math.round(T.closing / T.hadir * 100) : 0}%</div><div class="tiny muted">Kadar</div></div></div>
  <div class="kpi" style="margin-top:8px"><div class="card"><div class="big">${T.mohon}</div><div class="tiny muted">Permohonan</div></div><div class="card"><div class="big">${T.email}</div><div class="tiny muted">Dah email</div></div><div class="card"><div class="big">${T.takl}</div><div class="tiny muted">Taklimat</div></div></div>
  <h3>Ikut ejen</h3>
  <div style="overflow-x:auto"><table><tr><th>Ejen</th><th>Mohon</th><th>Email</th><th>Takl.</th><th>Hadir</th><th>Closing</th></tr>
  ${ejen.map(r => `<tr><td><a href="/admin/permohonan?ejen=${r.id}">${esc(r.nama)}</a><div class="tiny muted">${esc(r.kod_ejen)}</div></td><td>${r.mohon}</td><td>${r.email}</td><td>${r.takl}</td><td>${r.hadir}</td><td><b>${r.closing}</b></td></tr>`).join('') || '<tr><td colspan="6" class="center muted">Tiada aktiviti bulan ini.</td></tr>'}
  </table></div>` });
});

module.exports = router;
