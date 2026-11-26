// Kerja automatik: luput 45 hari, amaran, peringatan, semak peti email
const C = require('../config');
const { all, run, now, event, notify, notifyAdmins, tx } = require('../db');
const U = require('./util');
const emailcheck = require('./emailcheck');

function harian() {
  const hasil = { dilepaskan: 0, amaran: 0, emailLewat: 0, rekod: 0, ingat: 0 };
  // 1. Luput & amaran (Surat Siap / Dah Email yang tiada tindakan)
  for (const p of all("SELECT * FROM permohonan WHERE status IN ('surat_siap','dah_email')")) {
    const lagi = U.hariLagi(p.last_activity);
    if (lagi <= 0) {
      tx(() => {
        run("UPDATE permohonan SET status='dilepaskan', closed_at=? WHERE id=?", now(), p.id);
        event(p.id, `Dilepaskan automatik – ${U.LUPUT_HARI} hari tiada tindakan`);
      });
      notify(p.user_id, `Agensi ${p.nama_agensi} telah dilepaskan (${U.LUPUT_HARI} hari tiada tindakan).`, `/p/${p.id}`);
      hasil.dilepaskan++;
    } else {
      const tahap = lagi <= 3 ? 42 : lagi <= 10 ? 35 : 0; // amaran pada hari ke-35 & ke-42
      if (tahap && p.amaran_hari < tahap) {
        run('UPDATE permohonan SET amaran_hari=? WHERE id=?', tahap, p.id);
        notify(p.user_id, `⚠ ${p.nama_agensi} akan dilepaskan dalam ${lagi} hari. Follow up untuk kekalkan.`, `/p/${p.id}?fu=1`);
        hasil.amaran++;
      }
    }
  }
  // 2. Email belum disahkan selepas 24 jam
  for (const p of all("SELECT * FROM permohonan WHERE status='dah_email' AND email_status='menunggu'")) {
    const jam = (Date.now() - U.parseDT(p.email_marked_at).getTime()) / 3600000;
    if (jam >= C.JAM_AMARAN_EMAIL) {
      run("UPDATE permohonan SET email_status='bermasalah', email_issue=? WHERE id=?", `Tiada email CC diterima dalam ${C.JAM_AMARAN_EMAIL} jam`, p.id);
      notify(p.user_id, `⚠ Email CC untuk ${p.nama_agensi} belum diterima. Pastikan anda CC ke ${C.CC_EMAIL}.`, `/p/${p.id}`);
      notifyAdmins(`Pengesahan email bermasalah: ${p.nama_agensi} (tiada CC)`, '/admin/pengesahan');
      hasil.emailLewat++;
    }
  }
  return hasil;
}

// Peringatan pagi: taklimat perlu rekod hasil & tarikh "ingatkan saya"
function pagi() {
  const hi = U.hariIni();
  for (const r of all(`SELECT p.id, p.user_id, p.nama_agensi FROM permohonan p JOIN taklimat t ON t.permohonan_id=p.id
      WHERE p.status='dapat_taklimat' AND t.tarikh < ? AND t.hasil_at IS NULL`, hi)) {
    notify(r.user_id, `📝 Sila rekod hasil taklimat di ${r.nama_agensi} (hadir & closing).`, `/p/${r.id}/hasil`);
  }
  for (const f of all(`SELECT f.user_id, p.id, p.nama_agensi FROM followup f JOIN permohonan p ON p.id=f.permohonan_id
      WHERE f.ingat=? AND p.status='dah_email'`, hi)) {
    notify(f.user_id, `⏰ Peringatan follow up: ${f.nama_agensi}`, `/p/${f.id}?fu=1`);
  }
}

function start() {
  let hariAkhir = '';
  const tick = () => {
    try { harian(); } catch (e) { console.error('[jobs]', e); }
    const hi = U.hariIni();
    if (hi !== hariAkhir && new Date().getHours() >= 8) { hariAkhir = hi; try { pagi(); } catch (e) { console.error('[jobs pagi]', e); } }
  };
  tick();
  setInterval(tick, 30 * 60 * 1000);
  if (C.IMAP_HOST) {
    emailcheck.semakPeti();
    setInterval(() => emailcheck.semakPeti(), C.IMAP_MINIT * 60 * 1000);
    console.log(`[emailcheck] Semak peti ${C.IMAP_USER} setiap ${C.IMAP_MINIT} minit`);
  } else console.log('[emailcheck] IMAP belum ditetapkan – admin perlu sahkan email secara manual.');
}

module.exports = { start, harian, pagi };
