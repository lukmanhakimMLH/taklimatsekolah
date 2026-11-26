// Ujian hujung-ke-hujung dengan Firebase Emulator + Playwright.
// Jalankan: cd test && npm install && npm test
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..');
const PROJ = 'demo-tkl';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJ}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const SHOTS = process.env.SHOTS || '';
let n = 0;
const ok = m => console.log(`  ✓ ${++n}. ${m}`);

// ---------- pelayan fail statik (macam GitHub Pages) ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const BASE = `http://localhost:${server.address().port}`;

// ---------- REST bantuan ----------
const j = async (url, opt = {}) => { const r = await fetch(url, { ...opt, headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) } }); const t = await r.text(); return { status: r.status, body: t ? JSON.parse(t) : {} }; };
const token = async (email) => (await j(`${AUTH}/accounts:signInWithPassword?key=x`, { method: 'POST', body: JSON.stringify({ email, password: 'rahsia123', returnSecureToken: true }) })).body;
const owner = { Authorization: 'Bearer owner' }; // emulator: pintas peraturan
const getDoc = async (p) => (await j(`${FS}/${p}`, { headers: owner })).body;
const field = (d, k) => { const v = d.fields?.[k]; return v ? Object.values(v)[0] : undefined; };
async function patch(p, fields, hdr = owner) {
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  return j(`${FS}/${p}?${mask}`, { method: 'PATCH', headers: hdr, body: JSON.stringify({ fields }) });
}
const harilalu = h => ({ timestampValue: new Date(Date.now() - h * 3600000).toISOString() });

// ---------- Apps Script dalam Node (shim segerak) ----------
function appsScript(props, mel = []) {
  const UrlFetchApp = { fetch(url, o = {}) {
    const args = ['-s', '-X', (o.method || 'get').toUpperCase(), url, '-w', '\n%{http_code}'];
    for (const [k, v] of Object.entries(o.headers || {})) args.push('-H', `${k}: ${v}`);
    if (o.payload) args.push('-H', 'Content-Type: application/json', '--data-binary', o.payload);
    const out = execFileSync('curl', args, { env: { ...process.env, NO_PROXY: 'localhost', no_proxy: 'localhost' } }).toString();
    const i = out.lastIndexOf('\n');
    return { getContentText: () => out.slice(0, i), getResponseCode: () => Number(out.slice(i + 1)) };
  } };
  const msgs = mel.map(m => ({ ...m, unread: true }));
  const GmailApp = { search: () => [{ getMessages: () => msgs.map(m => ({
    isUnread: () => m.unread, markRead: () => { m.unread = false; }, getSubject: () => m.subjek, getTo: () => m.to, getCc: () => m.cc,
    getFrom: () => m.dari, getDate: () => new Date(), getPlainBody: () => 'Assalamualaikum…',
    getAttachments: () => (m.pdf ? [{ getContentType: () => 'application/pdf', getName: () => 'Surat.pdf' }] : []),
  })) }] };
  const ctx = { UrlFetchApp, GmailApp, PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] }) }, Utilities: { getUuid: () => crypto.randomUUID() }, console, Date, JSON, Number, String, Object, Math };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/Kod.gs'), 'utf8'), ctx);
  return ctx;
}

// ================= UJIAN =================
const browser = await chromium.launch();
const VENDOR = path.join(DIR, 'vendor');
async function halaman() {
  const c = await browser.newContext({ ...devices['iPhone 13'], baseURL: BASE });
  await c.route(/gstatic\.com\/firebasejs\/10\.12\.2\/(.+)$/, r => r.fulfill({ path: path.join(VENDOR, r.request().url().split('/').pop()), contentType: 'text/javascript' }));
  await c.route(/cdnjs\.cloudflare\.com\/.*jspdf/, r => r.fulfill({ path: path.join(VENDOR, 'jspdf.umd.min.js'), contentType: 'text/javascript' }));
  await c.route(/cdnjs\.cloudflare\.com\/.*pdf-lib/, r => r.fulfill({ path: path.join(VENDOR, 'pdf-lib.min.js'), contentType: 'text/javascript' }));
  await c.route(/unpkg\.com\/@pdf-lib\/fontkit/, r => r.fulfill({ path: path.join(VENDOR, 'fontkit.umd.min.js'), contentType: 'text/javascript' }));
  const p = await c.newPage();
  p.on('pageerror', e => console.log('   [pageerror]', e.message));
  await p.addInitScript(() => { window.__NOSHARE = true; });
  return p;
}
const shot = async (p, name) => { if (SHOTS) { await p.waitForTimeout(150); await p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); } };
const URL0 = `/?emu=${PROJ}`;
const flash = p => p.locator('.flash').first().textContent({ timeout: 8000 });

async function daftar(p, email, prof) {
  await p.goto(URL0 + '#/daftar');
  await p.fill('#email', email); await p.fill('#password', 'rahsia123'); await p.fill('#password2', 'rahsia123');
  await p.click('button:has-text("DAFTAR")');
  await p.waitForURL('**#/profil');
  await p.fill('#nama', prof.nama); await p.fill('#noIc', prof.ic); await p.fill('#telefon', prof.tel); await p.fill('#kodEjen', prof.kod);
  await p.locator('.sigwrap').scrollIntoViewIfNeeded();
  const b = await p.locator('.sigwrap canvas').boundingBox();
  await p.mouse.move(b.x + 30, b.y + 120); await p.mouse.down();
  for (let i = 0; i < 12; i++) await p.mouse.move(b.x + 30 + i * 22, b.y + 60 + (i % 2 ? 60 : 0), { steps: 3 });
  await p.mouse.up();
  await p.check('input[name=sahkan]');
  if (prof.shot) await shot(p, prof.shot);
  await p.click('button:has-text("HANTAR UNTUK KELULUSAN")');
}
async function mohon(p, v) {
  await p.goto(URL0 + '#/baru');
  await p.fill('#namaAgensi', v.nama); await p.waitForTimeout(1200);
  if (v.singkat) await p.fill('#namaSingkat', v.singkat);
  await p.fill('#alamat', v.alamat || 'Jalan Ismail,\n86800 Mersing, Johor.');
  await p.fill('#telefon', '07-799 1234'); await p.fill('#pic', v.pic || 'Pengarah'); if (v.picNama) await p.fill('#picNama', v.picNama); if (v.panggilan) await p.click(`.seg span:text-is("${v.panggilan}")`); await p.fill('#emailA', v.email);
  await p.click('#btn-jana');
  await p.waitForURL(/#\/p\/TKL-\d+$/);
  return p.url().match(/TKL-\d+/)[0];
}
const uidOf = async email => (await token(email)).localId;

try {
  // 1. Admin Utama
  const A = await halaman();
  await daftar(A, 'admin@qaizer.my', { nama: 'Mohamad Lukman Hakim bin Md Zaki', ic: '900101011234', tel: '019-7784918', kod: 'QZ-0417', shot: '01-profil' });
  await A.waitForURL('**#/dashboard');
  assert.equal(field(await getDoc(`users/${await uidOf('admin@qaizer.my')}`), 'role'), 'admin_utama');
  ok('Pengguna pertama jadi Admin Utama & terus aktif');

  // 2. Ejen baru menunggu
  const ali = await halaman();
  await daftar(ali, 'ali@contoh.com', { nama: 'Ali bin Ahmad', ic: '920202-02-2222', tel: '012-3456789', kod: 'QZ-0422' });
  await ali.waitForURL('**#/menunggu'); await shot(ali, '02-menunggu');
  await ali.goto(URL0 + '#/baru'); await ali.waitForURL('**#/menunggu');
  ok('Ejen baru menunggu kelulusan & tak boleh buat permohonan');
  const abu = await halaman();
  await daftar(abu, 'abu@contoh.com', { nama: 'Abu bin Bakar', ic: '930303033333', tel: '013-2223344', kod: 'QZ-0198' });
  await abu.waitForURL('**#/menunggu');
  const dup = await halaman();
  await daftar(dup, 'dup@contoh.com', { nama: 'Dup', ic: '940404044444', tel: '011', kod: 'qz-0198' });
  assert((await flash(dup)).includes('sudah didaftar'));
  ok('Kod ejen berulang ditolak');

  // 3. Admin lulus
  await A.goto(URL0 + '#/admin/ejen'); await A.waitForSelector('text=Ali bin Ahmad'); await shot(A, '03-admin-menunggu');
  for (const e of ['ali@contoh.com', 'abu@contoh.com']) {
    await A.goto(URL0 + `#/admin/ejen/${await uidOf(e)}`);
    await A.waitForSelector('button:has-text("LULUS")');
    if (e.startsWith('ali')) await shot(A, '04-admin-semak');
    await A.click('button:has-text("LULUS")'); await flash(A);
  }
  await ali.click('button:has-text("Semak status")'); await ali.waitForURL('**#/dashboard');
  ok('Admin lulus ejen → ejen dapat akses dashboard');

  // 4. Permohonan + PDF
  const p1 = await mohon(ali, { nama: 'Politeknik Mersing', singkat: 'Poli Mersing', email: 'poli@mersing.edu.my', pic: 'Pengarah Politeknik Mersing', picNama: 'Ts. Dr. Ahmad Fauzi bin Hassan', panggilan: 'Tuan' });
  assert.equal(p1, 'TKL-0001');
  await ali.waitForSelector('.surat'); await shot(ali, '05-surat');
  const [dl] = await Promise.all([ali.waitForEvent('download'), ali.click('button:has-text("DOWNLOAD PDF")')]);
  const pdfPath = await dl.path(); const buf = fs.readFileSync(pdfPath);
  assert(buf.slice(0, 4).toString() === '%PDF' && buf.length > 3000);
  assert.equal(dl.suggestedFilename(), 'Politeknik_Mersing.pdf');
  assert.equal(execFileSync('pdfinfo', [pdfPath]).toString().match(/Pages:\s+(\d+)/)[1], '9');
  { const tx = execFileSync('pdftotext', ['-l', '7', pdfPath, '-']).toString(); assert(!/semakan gaji|potongan gaji|SPGA/i.test(tx), 'masih ada semakan gaji'); }
  if (SHOTS) fs.copyFileSync(pdfPath, path.join(SHOTS, 'contoh-surat.pdf'));
  ok(`PDF penuh (surat + kertas kerja + lampiran, 9 ms) dijana dalam telefon (${Math.round(buf.length / 1024)} KB)`);

  // 5. Bertindan
  await abu.goto(URL0 + '#/dashboard'); await abu.waitForSelector('a.btn:has-text("PERMOHONAN BARU")');
  await abu.goto(URL0 + '#/baru');
  await abu.fill('#namaAgensi', 'poli  MERSING'); await abu.waitForSelector('#semak .alert.err');
  const t = await abu.locator('#semak').textContent();
  assert(t.includes('MAAF, ALI BIN AHMAD SUDAH ISI') && t.includes('BERTINDAN'), t);
  assert(await abu.locator('#btn-jana').isDisabled());
  await shot(abu, '06-bertindan');
  // pintas UI: tulis terus ke Firestore → peraturan tolak
  const tb = await token('abu@contoh.com');
  const hack = await j(`${FS}/agensi/politeknik_mersing?updateMask.fieldPaths=uid`, { method: 'PATCH', headers: { Authorization: `Bearer ${tb.idToken}` }, body: JSON.stringify({ fields: { uid: { stringValue: tb.localId } } }) });
  assert.equal(hack.status, 403);
  ok('Semakan bertindan: UI dikunci & peraturan Firestore tolak rampasan');

  // 6. Rangka email + Dah Email
  await ali.goto(URL0 + `#/p/${p1}/email`); await ali.waitForSelector('#e-sub'); await shot(ali, '07-rangka-email');
  assert((await ali.locator('#e-sub').textContent()).includes('QAIZER GROUP-0001 Permohonan') && !(await ali.locator('#e-sub').textContent()).includes('–'));
  ali.once('dialog', d => d.accept());
  await ali.click('button:has-text("DAH EMAIL")'); await ali.waitForSelector('text=Menunggu pengesahan');
  await shot(ali, '08-menunggu-pengesahan');
  // ejen cuba sahkan sendiri → ditolak
  const ta = await token('ali@contoh.com');
  const self = await patch(`permohonan/${p1}`, { emailStatus: { stringValue: 'disahkan' } }, { Authorization: `Bearer ${ta.idToken}` });
  assert.equal(self.status, 403);
  ok('Rangka email & Dah Email → menunggu; ejen tak boleh sahkan sendiri');

  // 7. Robot Apps Script
  await j(`${AUTH}/accounts:signUp?key=x`, { method: 'POST', body: JSON.stringify({ email: 'robot@sahkan.app', password: 'robot12345' }) });
  const robotUid = (await j(`${AUTH}/accounts:signInWithPassword?key=x`, { method: 'POST', body: JSON.stringify({ email: 'robot@sahkan.app', password: 'robot12345', returnSecureToken: true }) })).body.localId;
  await A.goto(URL0 + '#/admin/tetapan'); await A.fill('#ruid', robotUid); await A.click('button:has-text("SIMPAN")'); await flash(A);
  const props = { API_KEY: 'x', PROJECT_ID: PROJ, ROBOT_EMAIL: 'robot@sahkan.app', ROBOT_PASS: 'robot12345', AUTH_URL: 'http://127.0.0.1:9099/identitytoolkit.googleapis.com', FS_URL: 'http://127.0.0.1:8080/v1' };
  const gs = appsScript(props, [
    { subjek: 'QAIZER GROUP-0001 Permohonan Program Taklimat…', to: 'poli@mersing.edu.my', cc: 'sahkan@contoh.com', dari: 'Ali <ali@contoh.com>', pdf: true },
    { subjek: 'Re: hal lain', to: 'x@y.com', cc: '', dari: 'z@z.com', pdf: false },
  ]);
  assert.equal(gs.semakEmail(), 2);
  assert.equal(field(await getDoc(`permohonan/${p1}`), 'emailStatus'), 'disahkan');
  await ali.reload(); await ali.waitForSelector('text=Disahkan'); await shot(ali, '09-disahkan');
  ok('Robot Apps Script baca email CC → Dah Email disahkan automatik');

  // 8. Follow up ×2
  for (const nota of ['Dah sampai email, tunggu kelulusan.', 'PA kata pegawai cuti, call balik Isnin.']) {
    await ali.goto(URL0 + `#/p/${p1}?fu=1`); await ali.waitForSelector('#nota');
    await ali.fill('#nota', nota); await ali.click('button:has-text("SIMPAN FOLLOW UP")'); await flash(ali);
  }
  await ali.waitForSelector('text=Follow up kali ke-2'); await shot(ali, '10-followup');
  ok('Follow up kali ke-1 & ke-2 dikira automatik');

  // 9. Dapat taklimat → hasil
  await ali.goto(URL0 + `#/p/${p1}/dapat`); await ali.waitForSelector('#tarikh');
  await ali.fill('#tarikh', '2026-01-10'); await ali.fill('#masa', '09:00'); await ali.fill('#penceramah', 'Ustaz Hafiz bin Rahman');
  await ali.click('button:has-text("SIMPAN")'); await flash(ali);
  await ali.click('text=REKOD HASIL TAKLIMAT'); await ali.waitForSelector('#hadir');
  await ali.fill('#hadir', '80'); await ali.fill('#closing', '14'); await shot(ali, '11-hasil');
  await ali.click('button:has-text("SIMPAN HASIL")'); assert((await flash(ali)).includes('Hasil taklimat disimpan')); await ali.waitForSelector('.kpi >> text=17.5%');
  assert.equal(field(await getDoc(`permohonan/${p1}`), 'status'), 'selesai');
  ok('Dapat Taklimat → hadir 80 / closing 14 (17.5%) → SELESAI');

  // 10. Tak berjaya → dibuka semula
  const p2 = await mohon(ali, { nama: 'Majlis Daerah Mersing', email: 'mdm@johor.gov.my' });
  await ali.goto(URL0 + `#/p/${p2}/email`); ali.once('dialog', d => d.accept()); await ali.click('button:has-text("DAH EMAIL")'); await ali.waitForURL(`**#/p/${p2}`); await ali.waitForSelector('text=Menunggu pengesahan');
  await ali.goto(URL0 + `#/p/${p2}/tak`); await ali.waitForSelector('text=Ditolak');
  await ali.click('text=Ditolak'); await ali.fill('#nota', 'Program kewangan luar tidak dibenarkan tahun ini.');
  ali.once('dialog', d => d.accept()); await ali.click('button:has-text("SAHKAN TAK BERJAYA")'); await ali.waitForURL('**#/senarai/tak-berjaya');
  await abu.goto(URL0 + '#/baru'); await abu.fill('#namaAgensi', 'MD Mersing'); await abu.waitForSelector('#semak .alert.warn');
  const t2 = await abu.locator('#semak').textContent();
  assert(t2.includes('PERNAH DIMOHON') && t2.includes('Ali bin Ahmad') && t2.includes('Ditolak'), t2);
  await shot(abu, '12-pernah-dimohon');
  const p3 = await mohon(abu, { nama: 'MD Mersing', email: 'mdm@johor.gov.my' });
  ok('Tak Berjaya → agensi terbuka, ejen lain nampak sejarah (MD = Majlis Daerah)');

  // 11. Luput 45 hari (ambil alih oleh ejen lain + kerja harian robot)
  const p4 = await mohon(ali, { nama: 'SMK Mersing', email: 'smk@moe.edu.my' });
  const p5 = await mohon(ali, { nama: 'Hospital Mersing', email: 'hm@moh.gov.my' });
  const p6 = await mohon(ali, { nama: 'Klinik Kesihatan Endau', email: 'kke@moh.gov.my' });
  await patch(`permohonan/${p4}`, { lastActivity: harilalu(46 * 24) }); await patch(`agensi/sekolah_menengah_kebangsaan_mersing`, { lastActivity: harilalu(46 * 24) });
  await patch(`permohonan/${p6}`, { lastActivity: harilalu(46 * 24) }); await patch(`agensi/klinik_kesihatan_endau`, { lastActivity: harilalu(46 * 24) });
  await patch(`permohonan/${p5}`, { lastActivity: harilalu(37 * 24) });
  // Abu ambil alih SMK Mersing yang luput
  const p7 = await mohon(abu, { nama: 'SMK Mersing', email: 'smk@moe.edu.my' });
  assert.equal(field(await getDoc(`permohonan/${p4}`), 'status'), 'dilepaskan');
  // robot harian lepaskan KK Endau
  assert.equal(gs.harian(), 1);
  assert.equal(field(await getDoc(`permohonan/${p6}`), 'status'), 'dilepaskan');
  await ali.goto(URL0 + '#/senarai/follow-up'); await ali.waitForSelector('main h3, main .empty, main .li'); await shot(ali, '13-follow-up-luput');
  ok('45 hari tiada tindakan → ejen lain boleh ambil alih; robot harian lepaskan');

  await ali.goto(URL0 + '#/dashboard'); await ali.waitForSelector('.boxes'); await shot(ali, '14-dashboard');
  assert(await ali.locator('text=hampir dilepaskan').count());
  ok('Dashboard ejen + amaran hampir luput');

  // 12. Gantung & pindah
  const aliUid = await uidOf('ali@contoh.com'), abuUid = await uidOf('abu@contoh.com');
  await A.goto(URL0 + `#/admin/ejen/${aliUid}`); await A.waitForSelector('summary:has-text("Gantung ejen")');
  await A.click('summary:has-text("Gantung ejen")');
  await A.fill('#sebab2', 'Berhenti kerja'); await A.selectOption('#kepada', abuUid); await shot(A, '15-gantung');
  A.once('dialog', d => d.accept()); await A.click('button:has-text("GANTUNG")'); await flash(A);
  assert.equal(field(await getDoc(`permohonan/${p5}`), 'uid'), abuUid);
  assert.equal(field(await getDoc(`permohonan/${p1}`), 'uid'), aliUid);
  await ali.goto(URL0 + '#/dashboard'); await ali.reload(); await ali.waitForURL('**#/menunggu');
  ok('Gantung ejen → agensi aktif dipindah; ejen digantung tak boleh masuk');

  // 13. Tambah admin; admin biasa tak boleh ubah Admin Utama
  await A.goto(URL0 + '#/admin/tambah'); await A.waitForSelector('button:has-text("Jadikan Admin")');
  A.once('dialog', d => d.accept()); await A.click('button:has-text("Jadikan Admin")'); await flash(A);
  assert.equal(field(await getDoc(`users/${abuUid}`), 'role'), 'admin');
  const tb2 = await token('abu@contoh.com');
  const r2 = await patch(`users/${await uidOf('admin@qaizer.my')}`, { status: { stringValue: 'digantung' } }, { Authorization: `Bearer ${tb2.idToken}` });
  assert.equal(r2.status, 403);
  ok('Admin Utama tambah admin; admin biasa tak boleh gantung Admin Utama');

  // 14. Pengesahan manual & prestasi
  await patch(`permohonan/${p3}`, { status: { stringValue: 'dah_email' }, emailStatus: { stringValue: 'menunggu' }, emailMarkedAt: harilalu(25) });
  gs.harian();
  assert.equal(field(await getDoc(`permohonan/${p3}`), 'emailStatus'), 'bermasalah');
  await A.goto(URL0 + '#/admin/pengesahan'); await A.waitForSelector('button:has-text("Sahkan manual")'); await shot(A, '16-admin-pengesahan');
  A.once('dialog', d => d.accept()); await A.click('button:has-text("Sahkan manual")'); await flash(A);
  assert.equal(field(await getDoc(`permohonan/${p3}`), 'emailStatus'), 'disahkan');
  await A.goto(URL0 + '#/admin/prestasi?bulan=2026-01'); await A.waitForSelector('table'); await shot(A, '17-admin-prestasi');
  assert(await A.locator('td:has-text("14")').count());
  ok('Tiada CC 24 jam → bermasalah → admin sahkan manual; prestasi');

  // 17. Admin padam permohonan ujian → agensi bebas
  await A.goto(URL0 + `#/p/${p7}`); await A.click('summary:has-text("padam permohonan")');
  A.once('dialog', d => d.accept()); await A.click('button:has-text("Padam permohonan")'); await A.waitForURL('**#/admin/permohonan');
  assert.equal((await j(`${FS}/permohonan/${p7}`, { headers: owner })).status, 404);
  assert.equal(field(await getDoc('agensi/sekolah_menengah_kebangsaan_mersing'), 'status'), 'dipadam');
  await abu.goto(URL0 + '#/baru'); await abu.fill('#namaAgensi', 'SMK Mersing'); await abu.waitForSelector('#semak .alert.warn');
  assert(!(await abu.locator('#btn-jana').isDisabled()));
  ok('Admin padam permohonan → agensi dibuka semula');

  console.log(`\nSEMUA ${n} UJIAN LULUS`);
} catch (e) {
  console.error('\n✕ GAGAL:', e); process.exitCode = 1;
  for (const pg of browser.contexts().flatMap(c => c.pages())) console.error('  [halaman]', pg.url(), (await pg.locator('main').textContent().catch(() => '')).slice(0, 300));
} finally {
  await browser.close(); server.close();
}
