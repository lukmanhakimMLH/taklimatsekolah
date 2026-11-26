// Ujian hujung-ke-hujung: jalankan `npm test`
// Menggunakan pangkalan data sementara & Playwright (Chromium).
const os = require('os'), fs = require('fs'), path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tkl-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.TZ = 'Asia/Kuala_Lumpur';
const SHOTS = process.env.SHOTS || '';
const assert = require('assert');
const { chromium, devices } = require('playwright');
const app = require('../server');
const { run, one } = require('../db');
const jobs = require('../lib/jobs');
const emailcheck = require('../lib/emailcheck');

let n = 0;
const ok = m => console.log(`  ✓ ${++n}. ${m}`);

(async () => {
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  const ctx = () => browser.newContext({ ...devices['iPhone 13'], baseURL: base });
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); };

  async function daftar(page, email, prof) {
    await page.goto('/daftar');
    await page.fill('#email', email); await page.fill('#password', 'rahsia123'); await page.fill('#password2', 'rahsia123');
    await page.click('button.btn');
    await page.waitForURL('**/profil');
    await page.fill('#nama', prof.nama); await page.fill('#no_ic', prof.ic); await page.fill('#telefon', prof.tel); await page.fill('#kod_ejen', prof.kod);
    await page.locator('.sigwrap').scrollIntoViewIfNeeded();
    const box = await page.locator('.sigwrap canvas').boundingBox();
    await page.mouse.move(box.x + 30, box.y + 120); await page.mouse.down();
    for (let i = 0; i < 12; i++) await page.mouse.move(box.x + 30 + i * 22, box.y + 60 + (i % 2 ? 60 : 0), { steps: 3 });
    await page.mouse.up();
    await page.check('input[name=sahkan]');
    if (prof.shot) await shot(page, prof.shot);
    await page.click('button:has-text("HANTAR UNTUK KELULUSAN")');
  }
  async function mohon(page, v) {
    await page.goto('/permohonan/baru');
    await page.fill('#nama_agensi', v.nama); await page.waitForTimeout(900);
    if (v.singkat) await page.fill('#nama_singkat', v.singkat);
    await page.fill('#alamat', v.alamat || 'Jalan Ismail,\n86800 Mersing, Johor.');
    await page.fill('#telefon', '07-799 1234'); await page.fill('#pic', v.pic || 'Pengarah'); await page.fill('#email', v.email);
    await page.click('#btn-jana');
    await page.waitForURL(/\/p\/\d+$/);
    return Number(page.url().match(/\/p\/(\d+)/)[1]);
  }

  try {
    // 1. Admin utama
    const A = await (await ctx()).newPage();
    await daftar(A, 'admin@qaizer.my', { nama: 'Mohamad Lukman Hakim bin Md Zaki', ic: '900101011234', tel: '019-7784918', kod: 'QZ-0417', shot: '01-profil' });
    await A.waitForURL('**/dashboard', { timeout: 5000 }).catch(async e => { console.log(A.url(), await A.locator('.flash').textContent().catch(()=>'')); throw e; });
    assert.equal(one("SELECT role FROM users WHERE email='admin@qaizer.my'").role, 'admin_utama');
    ok('Pengguna pertama jadi Admin Utama & terus aktif');

    // 2. Ejen Ali & Abu daftar → menunggu
    const ali = await (await ctx()).newPage();
    await daftar(ali, 'ali@contoh.com', { nama: 'Ali bin Ahmad', ic: '920202-02-2222', tel: '012-3456789', kod: 'QZ-0422' });
    await ali.waitForURL('**/menunggu'); await shot(ali, '02-menunggu');
    await ali.goto('/permohonan/baru'); assert(ali.url().endsWith('/menunggu'));
    ok('Ejen baru menunggu kelulusan & tak boleh buat permohonan');
    const abu = await (await ctx()).newPage();
    await daftar(abu, 'abu@contoh.com', { nama: 'Abu bin Bakar', ic: '930303033333', tel: '013-2223344', kod: 'QZ-0198' });
    // kod ejen sama ditolak
    const dup = await (await ctx()).newPage();
    await daftar(dup, 'dup@contoh.com', { nama: 'Dup', ic: '940404044444', tel: '011', kod: 'qz-0198' });
    assert(await dup.locator('.flash.err').textContent().then(t => t.includes('sudah didaftar')));
    ok('Kod ejen berulang ditolak');

    // 3. Admin lulus
    await A.goto('/admin/ejen'); await shot(A, '03-admin-menunggu');
    for (const kod of ['QZ-0422', 'QZ-0198']) {
      await A.goto('/admin/ejen/' + one('SELECT id FROM users WHERE kod_ejen=?', kod).id);
      if (kod === 'QZ-0422') await shot(A, '04-admin-semak');
      await A.click('button:has-text("LULUS")');
    }
    await ali.goto('/dashboard'); assert(ali.url().endsWith('/dashboard'));
    ok('Admin lulus ejen → ejen dapat akses dashboard');

    // 4. Ali mohon Politeknik Mersing
    const p1 = await mohon(ali, { nama: 'Politeknik Mersing', singkat: 'Poli Mersing', email: 'poli@mersing.edu.my' });
    await shot(ali, '05-surat');
    const pdf = await ali.request.get(`/p/${p1}/surat.pdf`);
    assert.equal(pdf.headers()['content-type'], 'application/pdf');
    const buf = await pdf.body(); assert(buf.length > 3000 && buf.slice(0, 4).toString() === '%PDF');
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'contoh-surat.pdf'), buf);
    ok(`Surat PDF dijana (${Math.round(buf.length / 1024)} KB)`);

    // 5. Abu cuba agensi sama → BERTINDAN
    await abu.goto('/permohonan/baru');
    await abu.fill('#nama_agensi', 'poli  MERSING'); await abu.waitForTimeout(1000);
    const t = await abu.locator('#semak').textContent();
    assert(t.includes('MAAF, ALI BIN AHMAD SUDAH ISI') && t.includes('BERTINDAN'), t);
    assert(await abu.locator('#btn-jana').isDisabled());
    await shot(abu, '06-bertindan');
    // hantar terus ke server (pintas UI) → tetap ditolak
    const r = await abu.request.post('/permohonan', { form: { nama_agensi: 'Politeknik, Mersing', alamat: 'x', telefon: '1', pic: 'x', email: 'a@b.co' } });
    assert((await r.text()).includes('BERTINDAN'));
    assert.equal(one("SELECT COUNT(*) n FROM permohonan WHERE norm='politeknik mersing'").n, 1);
    ok('Semakan bertindan: UI dikunci & server tolak (Poli = Politeknik)');

    // 6. Rangka email + Dah Email
    await ali.goto(`/p/${p1}/email`); await shot(ali, '07-rangka-email');
    assert((await ali.locator('#e-sub').textContent()).includes(`[TKL-${String(p1).padStart(4, '0')}]`));
    ali.once('dialog', d => d.accept());
    await ali.click('button:has-text("DAH EMAIL")');
    await ali.waitForURL(`**/p/${p1}`);
    assert.equal(one('SELECT email_status s FROM permohonan WHERE id=?', p1).s, 'menunggu');
    await shot(ali, '08-menunggu-pengesahan');
    ok('Rangka email (CC wajib + kod TKL) & Dah Email → menunggu pengesahan');

    // 7. Email CC sampai → disahkan automatik
    emailcheck.prosesMesej({ dari: 'ali@contoh.com', kepada: `poli@mersing.edu.my, sahkan@contoh.com`, subjek: `[TKL-${String(p1).padStart(4, '0')}] Permohonan…`, adaPdf: true, isi: 'Assalamualaikum…' });
    assert.equal(one('SELECT email_status s FROM permohonan WHERE id=?', p1).s, 'disahkan');
    await ali.reload(); await shot(ali, '09-disahkan');
    ok('Email CC diterima → Dah Email disahkan automatik');

    // 8. Follow up ×2
    for (const nota of ['Dah sampai email, tunggu kelulusan.', 'PA kata pegawai cuti, call balik Isnin.']) {
      await ali.goto(`/p/${p1}?fu=1`);
      await ali.fill('#nota', nota); await ali.click('button:has-text("SIMPAN FOLLOW UP")');
    }
    assert(await ali.locator('text=Follow up kali ke-2').count());
    await shot(ali, '10-followup');
    ok('Follow up kali ke-1 & ke-2 dikira automatik');

    // 9. Dapat taklimat (tarikh lepas) → rekod hasil
    await ali.goto(`/p/${p1}/dapat`);
    await ali.fill('#tarikh', '2026-01-10'); await ali.fill('#masa', '09:00'); await ali.fill('#penceramah', 'Ustaz Hafiz bin Rahman');
    await ali.click('button:has-text("SIMPAN")');
    await ali.click('text=REKOD HASIL TAKLIMAT');
    await ali.fill('#hadir', '80'); await ali.fill('#closing', '14');
    await shot(ali, '11-hasil');
    await ali.click('button:has-text("SIMPAN HASIL")');
    assert.equal(one('SELECT status FROM permohonan WHERE id=?', p1).status, 'selesai');
    assert(await ali.locator('text=17.5%').count());
    ok('Dapat Taklimat → rekod hadir 80 / closing 14 (17.5%) → SELESAI');

    // 10. Tak berjaya → dibuka semula dengan sejarah
    const p2 = await mohon(ali, { nama: 'Majlis Daerah Mersing', email: 'mdm@johor.gov.my' });
    run("UPDATE permohonan SET status='dah_email', email_marked_at=datetime('now','localtime'), email_status='disahkan' WHERE id=?", p2);
    await ali.goto(`/p/${p2}/tak-berjaya`);
    await ali.click('text=Ditolak'); await ali.fill('#nota', 'Program kewangan luar tidak dibenarkan tahun ini.');
    ali.once('dialog', d => d.accept());
    await ali.click('button:has-text("SAHKAN TAK BERJAYA")');
    await abu.goto('/permohonan/baru'); await abu.fill('#nama_agensi', 'MD Mersing'); await abu.waitForTimeout(1000);
    const t2 = await abu.locator('#semak').textContent();
    assert(t2.includes('PERNAH DIMOHON') && t2.includes('Ali bin Ahmad') && t2.includes('Ditolak'), t2);
    await shot(abu, '12-pernah-dimohon');
    const p3 = await mohon(abu, { nama: 'MD Mersing', email: 'mdm@johor.gov.my' });
    ok('Tak Berjaya → agensi terbuka, ejen lain nampak sejarah (MD = Majlis Daerah)');

    // 11. Luput 45 hari
    const p4 = await mohon(ali, { nama: 'SMK Mersing', email: 'smk@moe.edu.my' });
    const p5 = await mohon(ali, { nama: 'Hospital Mersing', email: 'hm@moh.gov.my' });
    run("UPDATE permohonan SET last_activity=datetime('now','localtime','-46 days') WHERE id=?", p4);
    run("UPDATE permohonan SET status='dah_email', email_status='disahkan', email_marked_at=datetime('now','localtime','-36 days'), last_activity=datetime('now','localtime','-36 days') WHERE id=?", p5);
    const h = jobs.harian();
    assert.equal(one('SELECT status FROM permohonan WHERE id=?', p4).status, 'dilepaskan');
    assert.equal(h.amaran, 1);
    await ali.goto('/senarai/follow-up'); await shot(ali, '13-follow-up-luput');
    ok('45 hari tiada tindakan → DILEPASKAN; amaran hari ke-35 dihantar');

    // 12. Dashboard
    await ali.goto('/dashboard'); await shot(ali, '14-dashboard');
    ok('Dashboard ejen');

    // 13. Admin gantung Ali → pindah ke Abu
    const aliId = one("SELECT id FROM users WHERE kod_ejen='QZ-0422'").id, abuId = one("SELECT id FROM users WHERE kod_ejen='QZ-0198'").id;
    await A.goto(`/admin/ejen/${aliId}`);
    await A.click('summary:has-text("Gantung ejen")');
    await A.fill('#sebab2', 'Berhenti kerja'); await A.selectOption('#kepada', String(abuId));
    await shot(A, '15-gantung');
    A.once('dialog', d => d.accept());
    await A.click('button:has-text("GANTUNG")');
    assert.equal(one('SELECT user_id FROM permohonan WHERE id=?', p5).user_id, abuId);
    assert.equal(one('SELECT user_id FROM permohonan WHERE id=?', p1).user_id, aliId, 'selesai kekal pada ejen asal');
    await ali.goto('/dashboard'); assert(ali.url().endsWith('/menunggu'));
    ok('Gantung ejen → agensi aktif dipindah, ejen tak boleh masuk');

    // 14. Tambah admin
    await A.goto('/admin/tambah-admin');
    A.once('dialog', d => d.accept());
    await A.click('button:has-text("Jadikan Admin")');
    assert.equal(one('SELECT role FROM users WHERE id=?', abuId).role, 'admin');
    await abu.goto('/admin/ejen'); assert(abu.url().includes('/admin/ejen'));
    ok('Admin Utama tambah admin baru');

    // 15. Pengesahan manual & prestasi
    run("UPDATE permohonan SET status='dah_email', email_status='menunggu', email_marked_at=datetime('now','localtime','-25 hours') WHERE id=?", p3);
    jobs.harian();
    assert.equal(one('SELECT email_status s FROM permohonan WHERE id=?', p3).s, 'bermasalah');
    await A.goto('/admin/pengesahan'); await shot(A, '16-admin-pengesahan');
    A.once('dialog', d => d.accept());
    await A.click('button:has-text("Sahkan manual")');
    assert.equal(one('SELECT email_status s FROM permohonan WHERE id=?', p3).s, 'disahkan');
    await A.goto('/admin/prestasi?bulan=2026-01'); await shot(A, '17-admin-prestasi');
    assert(await A.locator('td:has-text("14")').count());
    ok('Tiada CC 24 jam → bermasalah → admin sahkan manual; prestasi');

    console.log(`\nSEMUA ${n} UJIAN LULUS`);
  } catch (e) {
    console.error('\n✕ GAGAL:', e); process.exitCode = 1;
  } finally {
    await browser.close(); server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})();
