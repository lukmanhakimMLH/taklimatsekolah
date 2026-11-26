// Permohonan: borang, semakan bertindan, surat, email, follow up, keputusan, hasil
const router = require('express').Router();
const C = require('../config');
const { one, all, run, tx, now, event, notifyAdmins } = require('../db');
const { esc, pill } = require('../lib/views');
const U = require('../lib/util');
const surat = require('../lib/surat');
const G = require('./guard');

// ---------- SEMAKAN BERTINDAN ----------
function semak(nama, userId) {
  const norm = U.normalize(nama);
  if (!norm) return { norm, html: '' };
  const aktif = one(`SELECT p.*, u.nama ejen_nama, u.kod_ejen ejen_kod FROM permohonan p JOIN users u ON u.id=p.user_id
    WHERE p.norm=? AND p.status IN ('surat_siap','dah_email','dapat_taklimat','selesai')`, norm);
  if (aktif) {
    const siapa = aktif.user_id === userId ? 'ANDA' : esc(aktif.ejen_nama).toUpperCase();
    return { norm, bertindan: true, html: `<div class="alert err"><div class="h">⚠ MAAF, ${siapa} SUDAH ISI</div>
      <div class="h" style="margin:2px 0">${esc(aktif.nama_agensi).toUpperCase()}</div>
      <div class="small">Status: <b>BERTINDAN</b>. Diisi oleh ${esc(aktif.ejen_nama)} pada ${U.tarikh(aktif.created_at)}.</div>
      <div style="font-weight:700;margin-top:4px">Sila cari agensi lain.</div></div>` };
  }
  const sejarah = all(`SELECT p.*, u.nama ejen_nama, u.kod_ejen ejen_kod FROM permohonan p JOIN users u ON u.id=p.user_id
    WHERE p.norm=? AND p.status IN ('tak_berjaya','dilepaskan') ORDER BY p.id DESC`, norm);
  let html = '';
  if (sejarah.length) {
    html += `<div class="alert warn"><div class="h">ⓘ PERNAH DIMOHON</div><div class="small">Agensi ini <b>terbuka</b> – anda boleh mohon.</div>
      ${sejarah.map(p => {
        const f = one('SELECT COUNT(*) n, MAX(created_at) akhir FROM followup WHERE permohonan_id=?', p.id);
        return `<div class="small" style="border-top:1px solid #f0d9a8;margin-top:6px;padding-top:6px">
          <b>${esc(p.ejen_nama)}</b> (${esc(p.ejen_kod)})<br>
          ${p.email_marked_at ? `✉ Email: ${U.tarikh(p.email_marked_at)}<br>` : '✉ Belum email<br>'}
          ↻ Follow up: ${f.n} kali${f.n ? ` (terakhir ${U.tarikh(f.akhir)})` : ''}<br>
          ${p.status === 'tak_berjaya' ? `<b style="color:var(--red)">✕ Tak Berjaya${p.tak_sebab ? ' – ' + esc(p.tak_sebab) : ''}</b>${p.tak_nota ? `<br><i>“${esc(p.tak_nota)}”</i>` : ''}` : `<b class="muted">Dilepaskan – ${U.LUPUT_HARI} hari tiada tindakan</b>`}
        </div>`;
      }).join('')}</div>`;
  }
  // nama hampir sama (amaran sahaja)
  const mirip = all("SELECT DISTINCT norm, nama_agensi FROM permohonan WHERE status IN ('surat_siap','dah_email','dapat_taklimat','selesai')")
    .filter(r => r.norm !== norm && U.similarity(r.norm, norm) >= 0.85).slice(0, 3);
  if (mirip.length) html += `<div class="alert warn small"><span class="h">Mungkin sama dengan:</span> ${mirip.map(m => `<b>${esc(m.nama_agensi)}</b>`).join(', ')}. Pastikan ia agensi berbeza sebelum teruskan.</div>`;
  if (!html) html = '<span class="pill p-g">✓ Agensi belum diambil</span>';
  return { norm, bertindan: false, html };
}

router.get('/api/semak', G.aktif, (req, res) => {
  const r = semak(String(req.query.nama || ''), req.user.id);
  res.json({ bertindan: !!r.bertindan, html: r.html });
});

function borang(v = {}, semakHtml = '') {
  const L = v.bertindan ? 'disabled' : '';
  return `<form method="post" action="/permohonan">
  <div class="card">
    <label for="nama_agensi">Nama agensi *</label>
    <input id="nama_agensi" name="nama_agensi" required autocomplete="off" value="${esc(v.nama_agensi)}" placeholder="cth: Pejabat Kesihatan Daerah Mersing">
    <div id="semak" style="margin-top:6px">${semakHtml}</div>
    <label for="nama_singkat">Nama ringkas (pilihan)</label>
    <input id="nama_singkat" name="nama_singkat" data-lock ${L} value="${esc(v.nama_singkat)}" placeholder="cth: PKD Mersing">
    <div class="tiny muted">Digunakan dalam surat: “warga PKD Mersing”. Kosongkan untuk guna nama penuh.</div>
    <label for="alamat">Alamat *</label>
    <textarea id="alamat" name="alamat" required data-lock ${L} placeholder="Jalan Ismail,&#10;86800 Mersing, Johor.">${esc(v.alamat)}</textarea>
    <label for="telefon">No. telefon *</label>
    <input id="telefon" name="telefon" required inputmode="tel" data-lock ${L} value="${esc(v.telefon)}">
    <label for="pic">Person in charge (PIC) *</label>
    <input id="pic" name="pic" required data-lock ${L} value="${esc(v.pic)}" placeholder="cth: Pegawai Kesihatan Daerah">
    <div class="tiny muted">Nama / jawatan penerima surat.</div>
    <label for="email">Email agensi *</label>
    <input id="email" name="email" type="email" required data-lock ${L} value="${esc(v.email)}">
  </div>
  <button class="btn" id="btn-jana" ${L}>JANA SURAT PDF</button>
</form>`;
}

router.get('/permohonan/baru', G.aktif, (req, res) => {
  res.page({ title: 'Permohonan Baru', back: '/dashboard', body: borang() });
});

router.post('/permohonan', G.aktif, (req, res) => {
  const u = req.user, b = req.body;
  const v = ['nama_agensi', 'nama_singkat', 'alamat', 'telefon', 'pic', 'email'].reduce((o, k) => (o[k] = String(b[k] || '').trim(), o), {});
  const r = semak(v.nama_agensi, u.id);
  if (r.bertindan) { res.flash('Agensi ini sudah diambil. Sila cari agensi lain.', 'err'); return res.page({ title: 'Permohonan Baru', back: '/dashboard', body: borang({ ...v, bertindan: true }, r.html) }); }
  if (!v.nama_agensi || !v.alamat || !v.telefon || !v.pic || !/^\S+@\S+\.\S+$/.test(v.email)) {
    res.flash('Sila isi semua medan wajib dengan betul.', 'err');
    return res.page({ title: 'Permohonan Baru', back: '/dashboard', body: borang(v, r.html) });
  }
  if (!u.signature) { res.flash('Sila lengkapkan tandatangan dalam profil dahulu.', 'err'); return res.redirect('/profil'); }
  try {
    const id = tx(() => {
      const t = now();
      const ins = run(`INSERT INTO permohonan (user_id, nama_agensi, nama_singkat, norm, alamat, telefon, pic, email, status, tarikh_surat, snap_nama, snap_telefon, snap_signature, last_activity)
        VALUES (?,?,?,?,?,?,?,?,'surat_siap',?,?,?,?,?)`, u.id, v.nama_agensi, v.nama_singkat || null, r.norm, v.alamat, v.telefon, v.pic, v.email.toLowerCase(), t, u.nama, u.telefon, u.signature, t);
      const pid = Number(ins.lastInsertRowid);
      event(pid, `Surat dijana oleh ${u.nama}`);
      return pid;
    });
    res.flash('Surat berjaya dijana.');
    res.redirect(`/p/${id}`);
  } catch (e) {
    // Dua ejen hantar serentak → kunci unik pangkalan data menolak yang kedua
    if (String(e.message).includes('UNIQUE')) {
      const r2 = semak(v.nama_agensi, u.id);
      res.flash('Agensi ini baru sahaja diambil oleh ejen lain.', 'err');
      return res.page({ title: 'Permohonan Baru', back: '/dashboard', body: borang({ ...v, bertindan: true }, r2.html) });
    }
    throw e;
  }
});

// ---------- BUTIRAN PERMOHONAN ----------
function load(req, res) {
  const p = one('SELECT p.*, u.nama ejen_nama, u.kod_ejen ejen_kod, u.email ejen_email FROM permohonan p JOIN users u ON u.id=p.user_id WHERE p.id=?', Number(req.params.id));
  if (!p) { res.status(404); res.page({ title: 'Tidak dijumpai', back: '/dashboard', body: '<div class="empty">Permohonan tidak dijumpai.</div>' }); return null; }
  const owner = p.user_id === req.user.id;
  if (!owner && !G.isAdmin(req.user)) { res.status(403); res.page({ title: 'Tiada akses', back: '/dashboard', body: '<div class="empty">Ini bukan permohonan anda.</div>' }); return null; }
  p.owner = owner;
  return p;
}
const mine = (req, res, statuses) => {
  const p = load(req, res); if (!p) return null;
  if (!p.owner) { res.flash('Hanya ejen pemilik boleh buat tindakan ini.', 'err'); res.redirect(`/p/${p.id}`); return null; }
  if (statuses && !statuses.includes(p.status)) { res.flash('Tindakan ini tidak sesuai untuk status semasa.', 'err'); res.redirect(`/p/${p.id}`); return null; }
  return p;
};

function semakEmail(p) {
  const e = one('SELECT * FROM email_masuk WHERE permohonan_id=? ORDER BY id DESC LIMIT 1', p.id);
  const ok = s => `<div>✓ ${s}</div>`, no = s => `<div class="muted">○ ${s}</div>`, bad = s => `<div style="color:var(--red)">✕ ${s}</div>`;
  let head;
  if (p.email_status === 'disahkan') head = `<div class="alert ok center">✅ Dah Email – Disahkan<div class="tiny" style="font-weight:500">${U.tarikhMasa(p.email_verified_at)}${p.email_verified_by && p.email_verified_by !== 'sistem' ? ` · manual oleh ${esc(p.email_verified_by)}` : ''}</div></div>`;
  else if (p.email_status === 'bermasalah') head = `<div class="alert err"><div class="h">⚠ Pengesahan bermasalah</div><div class="small">${esc(p.email_issue || '')}</div></div>`;
  else head = `<div class="alert warn center"><div class="h">⏳ Menunggu pengesahan</div><div class="small">Sistem sedang semak email CC ke <b>${esc(C.CC_EMAIL)}</b>.</div></div>`;
  const kod = U.kodTKL(p.id);
  return `${head}<div class="small chk">
    ${ok(`Ejen tekan Dah Email · ${U.tarikhMasa(p.email_marked_at)}`)}
    ${e ? ok(`Email CC diterima · ${U.tarikhMasa(e.diterima_at)}`) : no('Email CC diterima')}
    ${e ? ok(`Kod [${kod}] sepadan`) : no(`Kod [${kod}] sepadan`)}
    ${e ? (e.kepada.toLowerCase().includes(p.email) ? ok(`Dihantar kepada ${esc(p.email)}`) : bad(`Tidak dihantar kepada ${esc(p.email)}`)) : no(`Dihantar kepada ${esc(p.email)}`)}
    ${e ? (e.ada_pdf ? ok('Lampiran PDF ada') : bad('Tiada lampiran PDF')) : no('Lampiran PDF ada')}
  </div>`;
}

function sejarah(p) {
  const fu = all('SELECT f.*, u.nama FROM followup f JOIN users u ON u.id=f.user_id WHERE permohonan_id=?', p.id).map(f => ({ ...f, k: 'fu' }));
  const ev = all('SELECT * FROM peristiwa WHERE permohonan_id=?', p.id).map(e => ({ ...e, k: 'ev' }));
  const items = [...fu, ...ev].sort((a, b) => b.created_at.localeCompare(a.created_at) || (b.id - a.id));
  if (!items.length) return '';
  return `<h3>Sejarah</h3><div class="tl">${items.map(i => i.k === 'fu'
    ? `<div class="it"><b>Follow up kali ke-${i.kali}</b> <span class="tiny muted">· ${U.tarikhMasa(i.created_at)} · ${esc(i.cara)}${i.user_id !== p.user_id ? ` · ${esc(i.nama)}` : ''}</span><div class="small">${esc(i.nota)}</div>${i.ingat ? `<div class="tiny muted">⏰ Ingatkan ${U.tarikh(i.ingat)}</div>` : ''}</div>`
    : `<div class="it sys"><span class="small">${esc(i.teks)}</span> <span class="tiny muted">· ${U.tarikhMasa(i.created_at)}</span></div>`).join('')}</div>`;
}

router.get('/p/:id', G.aktif, (req, res) => {
  const p = load(req, res); if (!p) return;
  const kod = U.kodTKL(p.id);
  let main = '';
  const info = `<div class="card small">
    <div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:16px">${esc(p.nama_agensi)}</b>${pill(p.status)}</div>
    <div class="muted tiny">${kod}${!p.owner ? ` · 👤 ${esc(p.ejen_nama)} (${esc(p.ejen_kod)})` : ''}</div>
    <div style="margin-top:6px">PIC: ${esc(p.pic)}<br>☎ <a href="tel:${esc(p.telefon)}">${esc(p.telefon)}</a> · ✉ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a><br><span class="muted">${esc(String(p.alamat).split(/\r?\n/).map(l => l.trim().replace(/,$/, '')).filter(Boolean).join(', '))}</span></div>
  </div>`;
  const pdfBtn = `<a class="btn b" href="/p/${p.id}/surat.pdf">⬇ DOWNLOAD PDF</a>`;

  if (p.status === 'surat_siap') {
    main = `${surat.html(p, esc)}
      ${pdfBtn}
      ${p.owner ? `<a class="btn" href="/p/${p.id}/email">✉ SETERUSNYA: RANGKA EMAIL</a>
      <details style="margin-top:14px"><summary class="small muted">Tak jadi mohon?</summary>
        <a class="btn o sm" href="/p/${p.id}/tak-berjaya" style="color:var(--red);border-color:var(--red)">Batal / Tak Berjaya</a></details>` : ''}`;
  }
  if (p.status === 'dah_email') {
    const lagi = U.hariLagi(p.last_activity);
    const fu = one('SELECT COUNT(*) n FROM followup WHERE permohonan_id=?', p.id).n;
    main = `${semakEmail(p)}
      <div class="two"><a class="btn o sm" href="/p/${p.id}/email">Lihat rangka email</a><a class="btn o sm" href="/p/${p.id}/surat.pdf">⬇ PDF</a></div>
      <div class="alert ${lagi <= 10 ? 'err' : 'warn'} small" style="margin-top:12px">⏱ <b>${lagi} hari lagi</b> sebelum agensi dilepaskan jika tiada tindakan. Setiap follow up reset kiraan ke ${U.LUPUT_HARI} hari.</div>
      ${p.owner ? `<details class="card" ${req.query.fu ? 'open' : ''} style="margin-top:12px"><summary style="font-weight:800;cursor:pointer">+ FOLLOW UP <span class="pill p-a">Kali ke-${fu + 1}</span></summary>
        <form method="post" action="/p/${p.id}/followup">
          <label>Cara</label>
          <div class="seg">${['Telefon', 'WhatsApp', 'Email', 'Jumpa'].map((c, i) => `<label><input type="radio" name="cara" value="${c}" ${i === 0 ? 'checked' : ''}><span>${c}</span></label>`).join('')}</div>
          <label for="nota">Nota *</label><textarea id="nota" name="nota" required placeholder="cth: PA kata pegawai cuti, call balik Isnin."></textarea>
          <label for="ingat">Ingatkan saya (pilihan)</label><input id="ingat" name="ingat" type="date">
          <button class="btn">SIMPAN FOLLOW UP</button>
        </form></details>
      <p class="center tiny muted" style="margin:14px 0 0">Dah ada keputusan?</p>
      <div class="two"><a class="btn" href="/p/${p.id}/dapat">✓ DAPAT TAKLIMAT</a><a class="btn r" href="/p/${p.id}/tak-berjaya">✕ TAK BERJAYA</a></div>` : ''}`;
  }
  if (p.status === 'dapat_taklimat' || p.status === 'selesai') {
    const t = one('SELECT * FROM taklimat WHERE permohonan_id=?', p.id) || {};
    const perlu = p.status === 'dapat_taklimat' && t.tarikh <= U.hariIni();
    main = `<div class="card" style="background:var(--pri2);border-color:#bfe0d4">
      <b style="color:var(--pri)">🎉 Dapat Taklimat</b>
      <dl class="small"><dt>Tarikh</dt><dd>${U.tarikh(t.tarikh)}</dd><dt>Masa</dt><dd>${U.masa12(t.masa)}</dd><dt>Penceramah</dt><dd>${esc(t.penceramah)}</dd>
      ${t.lokasi ? `<dt>Lokasi</dt><dd>${esc(t.lokasi)}</dd>` : ''}${t.peserta ? `<dt>Anggaran peserta</dt><dd>${t.peserta} orang</dd>` : ''}</dl></div>
      ${p.status === 'selesai' ? `<div class="kpi"><div class="card"><div class="big">${t.hadir}</div><div class="tiny muted">Hadir</div></div><div class="card"><div class="big" style="color:var(--pri)">${t.closing}</div><div class="tiny muted">Closing</div></div><div class="card"><div class="big">${t.hadir ? Math.round(t.closing / t.hadir * 1000) / 10 : 0}%</div><div class="tiny muted">Kadar</div></div></div>${t.nota_hasil ? `<p class="small">📝 ${esc(t.nota_hasil)}</p>` : ''}` : ''}
      ${p.owner && perlu ? `<a class="btn gold" href="/p/${p.id}/hasil">📝 REKOD HASIL TAKLIMAT</a>` : ''}
      ${p.owner && p.status === 'dapat_taklimat' ? `<a class="btn o sm" href="/p/${p.id}/dapat">✎ Ubah tarikh / masa / penceramah</a>` : ''}
      ${p.owner && p.status === 'selesai' ? `<a class="btn o sm" href="/p/${p.id}/hasil">✎ Ubah hasil</a>` : ''}`;
  }
  if (p.status === 'tak_berjaya') main = `<div class="alert err"><div class="h">✕ Tak Berjaya</div>${p.tak_sebab ? `<div><b>${esc(p.tak_sebab)}</b></div>` : ''}${p.tak_nota ? `<div class="small">${esc(p.tak_nota)}</div>` : ''}<div class="tiny muted">${U.tarikhMasa(p.closed_at)} · Agensi kini terbuka untuk ejen lain.</div></div>`;
  if (p.status === 'dilepaskan') main = `<div class="alert warn"><div class="h">Dilepaskan</div><div class="small">${U.LUPUT_HARI} hari tiada tindakan (${U.tarikh(p.closed_at)}). Agensi kini terbuka untuk ejen lain.</div></div>`;
  const regen = p.owner && ['surat_siap', 'dah_email'].includes(p.status) && p.snap_signature !== req.user.signature
    ? `<form method="post" action="/p/${p.id}/jana-semula" data-confirm="Jana semula surat dengan nama, telefon & tandatangan anda?"><button class="btn o sm">↻ Jana semula surat dengan tandatangan saya</button></form>` : '';
  res.page({ title: p.nama_singkat || p.nama_agensi, back: p.owner ? '/dashboard' : '/admin/permohonan', body: info + main + regen + sejarah(p) });
});

router.get('/p/:id/surat.pdf', G.aktif, (req, res) => {
  const p = load(req, res); if (!p) return;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.lihat ? 'inline' : 'attachment'}; filename="${surat.namaFail(p)}"`);
  surat.pdf(p, res);
});

router.post('/p/:id/jana-semula', G.aktif, (req, res) => {
  const p = mine(req, res, ['surat_siap', 'dah_email']); if (!p) return;
  const u = req.user;
  run('UPDATE permohonan SET snap_nama=?, snap_telefon=?, snap_signature=?, tarikh_surat=? WHERE id=?', u.nama, u.telefon, u.signature, now(), p.id);
  event(p.id, `Surat dijana semula oleh ${u.nama}`);
  res.flash('Surat dijana semula.');
  res.redirect(`/p/${p.id}`);
});

// ---------- RANGKA EMAIL ----------
router.get('/p/:id/email', G.aktif, (req, res) => {
  const p = load(req, res); if (!p) return;
  const e = surat.rangkaEmail(p);
  const mailto = `mailto:${encodeURIComponent(e.kepada)}?cc=${encodeURIComponent(e.cc)}&subject=${encodeURIComponent(e.subjek)}&body=${encodeURIComponent(e.isi)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(e.kepada)}&cc=${encodeURIComponent(e.cc)}&su=${encodeURIComponent(e.subjek)}&body=${encodeURIComponent(e.isi)}`;
  const semua = `Kepada: ${e.kepada}\nCC: ${e.cc}\nSubjek: ${e.subjek}\n\n${e.isi}`;
  res.page({ title: 'Rangka Email', back: `/p/${p.id}`, body: `
  <label>Kepada</label><div class="copyrow"><span id="e-to">${esc(e.kepada)}</span><button class="cp" data-copy="e-to">⧉ Salin</button></div>
  <label>CC (wajib · tak boleh ubah)</label><div class="copyrow lock"><span id="e-cc">🔒 ${esc(e.cc)}</span><button class="cp" data-copy="e-cc2">⧉ Salin</button><span id="e-cc2" hidden>${esc(e.cc)}</span></div>
  <label>Subjek</label><div class="copyrow"><span id="e-sub">${esc(e.subjek)}</span><button class="cp" data-copy="e-sub">⧉ Salin</button></div>
  <label>Isi email</label><div class="copyrow"><pre id="e-body">${esc(e.isi)}</pre><button class="cp" data-copy="e-body">⧉ Salin</button></div>
  <textarea id="e-all" hidden>${esc(semua)}</textarea>
  <div class="alert warn small" style="margin-top:12px">📎 Jangan lupa <b>attach</b> <a href="/p/${p.id}/surat.pdf">${esc(surat.namaFail(p))}</a>. Pastikan CC ke <b>${esc(e.cc)}</b> – tanpa CC, “Dah Email” tidak dapat disahkan.</div>
  <a class="btn b" href="/p/${p.id}/surat.pdf">⬇ DOWNLOAD PDF</a>
  <div class="two"><a class="btn o" href="${esc(mailto)}">✉ Buka apps email</a><a class="btn o" href="${esc(gmail)}" target="_blank" rel="noopener">Buka Gmail</a></div>
  <button class="btn o" data-copy="e-all">⧉ Salin semua</button>
  ${p.owner && p.status === 'surat_siap' ? `<form method="post" action="/p/${p.id}/dah-email" data-confirm="Sahkan anda SUDAH hantar email kepada ${esc(p.email)} dengan CC ke ${esc(e.cc)} dan PDF dilampirkan?">
    <button class="btn gold">✓ DAH EMAIL</button></form>` : ''}` });
});

router.post('/p/:id/dah-email', G.aktif, (req, res) => {
  const p = mine(req, res, ['surat_siap']); if (!p) return;
  const t = now();
  run("UPDATE permohonan SET status='dah_email', email_status='menunggu', email_marked_at=?, last_activity=?, amaran_hari=0 WHERE id=?", t, t, p.id);
  event(p.id, 'Ejen tekan Dah Email – menunggu pengesahan CC');
  // Jika email CC sudah sampai lebih awal, sahkan terus
  require('../lib/emailcheck').nilaiSemula(p.id);
  res.flash('Status: Dah Email. Sistem akan sahkan apabila email CC diterima.');
  res.redirect(`/p/${p.id}`);
});

// ---------- FOLLOW UP ----------
router.post('/p/:id/followup', G.aktif, (req, res) => {
  const p = mine(req, res, ['dah_email']); if (!p) return;
  const nota = String(req.body.nota || '').trim();
  const cara = ['Telefon', 'WhatsApp', 'Email', 'Jumpa'].includes(req.body.cara) ? req.body.cara : 'Telefon';
  if (!nota) { res.flash('Nota wajib diisi.', 'err'); return res.redirect(`/p/${p.id}?fu=1`); }
  const ingat = /^\d{4}-\d{2}-\d{2}$/.test(req.body.ingat || '') ? req.body.ingat : null;
  tx(() => {
    const kali = one('SELECT COUNT(*) n FROM followup WHERE permohonan_id=?', p.id).n + 1;
    run('INSERT INTO followup (permohonan_id, user_id, kali, cara, nota, ingat) VALUES (?,?,?,?,?,?)', p.id, req.user.id, kali, cara, nota, ingat);
    run('UPDATE permohonan SET last_activity=?, amaran_hari=0 WHERE id=?', now(), p.id);
  });
  res.flash('Follow up disimpan.');
  res.redirect(`/p/${p.id}`);
});

// ---------- DAPAT TAKLIMAT ----------
router.get('/p/:id/dapat', G.aktif, (req, res) => {
  const p = mine(req, res, ['dah_email', 'dapat_taklimat']); if (!p) return;
  const t = one('SELECT * FROM taklimat WHERE permohonan_id=?', p.id) || {};
  const fu = one('SELECT COUNT(*) n FROM followup WHERE permohonan_id=?', p.id).n;
  res.page({ title: 'Dapat Taklimat', back: `/p/${p.id}`, body: `
  <div class="card center" style="background:var(--pri2);border-color:#bfe0d4"><div style="font-size:26px">🎉</div><b>${esc(p.nama_agensi)}</b><div class="small muted">${fu ? `Selepas ${fu} kali follow up` : 'Tanpa follow up'}</div></div>
  <form method="post" class="card">
    <label for="tarikh">Tarikh *</label><input id="tarikh" name="tarikh" type="date" required value="${esc(t.tarikh)}">
    <label for="masa">Masa *</label><input id="masa" name="masa" type="time" required value="${esc(t.masa)}">
    <label for="penceramah">Nama penceramah *</label><input id="penceramah" name="penceramah" required value="${esc(t.penceramah)}" placeholder="Taip nama penceramah">
    <label for="lokasi">Lokasi (pilihan)</label><input id="lokasi" name="lokasi" value="${esc(t.lokasi)}" placeholder="cth: Dewan PKD Mersing">
    <label for="peserta">Anggaran peserta (pilihan)</label><input id="peserta" name="peserta" type="number" min="0" inputmode="numeric" value="${esc(t.peserta)}">
    <button class="btn">SIMPAN</button>
  </form>` });
});
router.post('/p/:id/dapat', G.aktif, (req, res) => {
  const p = mine(req, res, ['dah_email', 'dapat_taklimat']); if (!p) return;
  const b = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.tarikh || '') || !/^\d{2}:\d{2}/.test(b.masa || '') || !String(b.penceramah || '').trim()) {
    res.flash('Sila isi tarikh, masa dan penceramah.', 'err'); return res.redirect(`/p/${p.id}/dapat`);
  }
  tx(() => {
    run(`INSERT INTO taklimat (permohonan_id, tarikh, masa, penceramah, lokasi, peserta) VALUES (?,?,?,?,?,?)
      ON CONFLICT(permohonan_id) DO UPDATE SET tarikh=excluded.tarikh, masa=excluded.masa, penceramah=excluded.penceramah, lokasi=excluded.lokasi, peserta=excluded.peserta`,
      p.id, b.tarikh, b.masa.slice(0, 5), b.penceramah.trim(), String(b.lokasi || '').trim() || null, b.peserta ? Number(b.peserta) : null);
    if (p.status === 'dah_email') {
      run("UPDATE permohonan SET status='dapat_taklimat', last_activity=?, closed_at=? WHERE id=?", now(), now(), p.id);
      event(p.id, `Dapat taklimat – ${U.tarikh(b.tarikh)}, ${U.masa12(b.masa)}`);
    } else event(p.id, `Butiran taklimat dikemas kini – ${U.tarikh(b.tarikh)}, ${U.masa12(b.masa)}`);
  });
  if (p.status === 'dah_email') notifyAdmins(`🎉 ${req.user.nama} dapat taklimat di ${p.nama_agensi} (${U.tarikh(b.tarikh)})`, `/p/${p.id}`);
  res.flash('Taklimat disimpan.');
  res.redirect(`/p/${p.id}`);
});

// ---------- TAK BERJAYA ----------
router.get('/p/:id/tak-berjaya', G.aktif, (req, res) => {
  const p = mine(req, res, ['surat_siap', 'dah_email']); if (!p) return;
  const fu = one('SELECT COUNT(*) n FROM followup WHERE permohonan_id=?', p.id).n;
  res.page({ title: 'Tak Berjaya', tone: 'red', back: `/p/${p.id}`, body: `
  <div class="card"><b>${esc(p.nama_agensi)}</b><div class="small muted">${p.email_marked_at ? `Email ${U.tarikh(p.email_marked_at)} · ` : ''}${fu} kali follow up</div></div>
  <form method="post" class="card" data-confirm="Sahkan Tak Berjaya? Agensi ini akan terbuka untuk ejen lain.">
    <label>Sebab (pilihan)</label>
    <div class="seg">${['Ditolak', 'Tiada jawapan', 'Jadual penuh', 'Lain-lain'].map(s => `<label><input type="radio" name="sebab" value="${s}"><span>${s}</span></label>`).join('')}</div>
    <label for="nota">Nota</label><textarea id="nota" name="nota" placeholder="cth: Program kewangan luar tidak dibenarkan tahun ini."></textarea>
    <div class="tiny muted" style="margin-top:6px">Nota ini akan dilihat oleh ejen lain yang mohon agensi ini kemudian.</div>
    <button class="btn r">SAHKAN TAK BERJAYA</button>
  </form>` });
});
router.post('/p/:id/tak-berjaya', G.aktif, (req, res) => {
  const p = mine(req, res, ['surat_siap', 'dah_email']); if (!p) return;
  run("UPDATE permohonan SET status='tak_berjaya', tak_sebab=?, tak_nota=?, closed_at=? WHERE id=?", String(req.body.sebab || '').trim() || null, String(req.body.nota || '').trim() || null, now(), p.id);
  event(p.id, `Tak berjaya${req.body.sebab ? ' – ' + req.body.sebab : ''}`);
  res.flash('Direkod sebagai Tak Berjaya.');
  res.redirect('/senarai/tak-berjaya');
});

// ---------- HASIL TAKLIMAT ----------
router.get('/p/:id/hasil', G.aktif, (req, res) => {
  const p = mine(req, res, ['dapat_taklimat', 'selesai']); if (!p) return;
  const t = one('SELECT * FROM taklimat WHERE permohonan_id=?', p.id);
  res.page({ title: 'Hasil Taklimat', back: `/p/${p.id}`, body: `
  <div class="card small"><b style="font-size:16px">${esc(p.nama_agensi)}</b><br>${U.tarikh(t.tarikh)} · ${U.masa12(t.masa)}<br>Penceramah: ${esc(t.penceramah)}</div>
  <form method="post" class="card">
    <label for="hadir">Berapa hadir *</label><input id="hadir" name="hadir" type="number" min="0" inputmode="numeric" required value="${esc(t.hadir)}">
    <label for="closing">Berapa closing (borang dikeluarkan) *</label><input id="closing" name="closing" type="number" min="0" inputmode="numeric" required value="${esc(t.closing)}">
    <div class="card center" style="background:var(--pri2);border-color:#bfe0d4;margin-top:12px"><div class="tiny muted">Kadar closing (auto)</div><div class="big" style="color:var(--pri)" id="kadar">–</div></div>
    <label for="nota">Nota (pilihan)</label><textarea id="nota" name="nota">${esc(t.nota_hasil)}</textarea>
    <button class="btn">SIMPAN HASIL</button>
  </form>` });
});
router.post('/p/:id/hasil', G.aktif, (req, res) => {
  const p = mine(req, res, ['dapat_taklimat', 'selesai']); if (!p) return;
  const hadir = parseInt(req.body.hadir, 10), closing = parseInt(req.body.closing, 10);
  if (!(hadir >= 0) || !(closing >= 0)) { res.flash('Sila isi bilangan hadir dan closing.', 'err'); return res.redirect(`/p/${p.id}/hasil`); }
  if (closing > hadir) { res.flash('Closing tidak boleh melebihi bilangan hadir.', 'err'); return res.redirect(`/p/${p.id}/hasil`); }
  tx(() => {
    run('UPDATE taklimat SET hadir=?, closing=?, nota_hasil=?, hasil_at=? WHERE permohonan_id=?', hadir, closing, String(req.body.nota || '').trim() || null, now(), p.id);
    run("UPDATE permohonan SET status='selesai' WHERE id=?", p.id);
    event(p.id, `Hasil taklimat: hadir ${hadir}, closing ${closing}`);
  });
  res.flash('Hasil taklimat disimpan.');
  res.redirect(`/p/${p.id}`);
});

module.exports = router;
