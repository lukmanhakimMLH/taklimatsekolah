// Pengesahan "Dah Email" melalui email CC ke peti pengesahan (IMAP)
const C = require('../config');
const { one, run, now, event, notify } = require('../db');
const U = require('./util');

// Simpan satu email masuk & cuba sahkan permohonan berkaitan
function prosesMesej({ dari, kepada, subjek, adaPdf, isi }) {
  const m = String(subjek || '').match(/TKL-(\d{1,8})/i);
  const pid = m ? Number(m[1]) : null;
  const p = pid ? one('SELECT id FROM permohonan WHERE id=?', pid) : null;
  run('INSERT INTO email_masuk (permohonan_id, dari, kepada, subjek, ada_pdf, isi) VALUES (?,?,?,?,?,?)',
    p ? p.id : null, dari || '', kepada || '', subjek || '', adaPdf ? 1 : 0, String(isi || '').slice(0, 5000));
  if (p) nilaiSemula(p.id);
  return p ? p.id : null;
}

// Nilai semula status pengesahan berdasarkan email terkini yang diterima
function nilaiSemula(pid) {
  const p = one('SELECT * FROM permohonan WHERE id=?', pid);
  if (!p || p.status !== 'dah_email' || p.email_status === 'disahkan') return;
  const e = one('SELECT * FROM email_masuk WHERE permohonan_id=? ORDER BY id DESC LIMIT 1', pid);
  if (!e) return;
  const isu = [];
  if (!String(e.kepada).toLowerCase().includes(String(p.email).toLowerCase())) isu.push(`Email tidak dihantar kepada ${p.email}`);
  if (!e.ada_pdf) isu.push('Tiada lampiran PDF');
  if (!isu.length) {
    const t = now();
    run("UPDATE permohonan SET email_status='disahkan', email_verified_at=?, email_verified_by='sistem', email_issue=NULL, last_activity=?, amaran_hari=0 WHERE id=?", t, t, pid);
    event(pid, 'Dah Email disahkan automatik (email CC diterima)');
    notify(p.user_id, `✅ Email ke ${p.nama_agensi} telah disahkan.`, `/p/${pid}`);
  } else {
    run("UPDATE permohonan SET email_status='bermasalah', email_issue=? WHERE id=?", isu.join('; '), pid);
    event(pid, `Pengesahan email bermasalah: ${isu.join('; ')}`);
    notify(p.user_id, `⚠ Email ke ${p.nama_agensi} bermasalah: ${isu.join('; ')}. Sila hantar semula dengan betul.`, `/p/${pid}`);
  }
}

let berjalan = false;
async function semakPeti() {
  if (!C.IMAP_HOST || !C.IMAP_USER || berjalan) return { skipped: true };
  berjalan = true;
  const { ImapFlow } = require('imapflow');
  const { simpleParser } = require('mailparser');
  const client = new ImapFlow({ host: C.IMAP_HOST, port: C.IMAP_PORT, secure: true, auth: { user: C.IMAP_USER, pass: C.IMAP_PASS }, logger: false });
  let n = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      for (const uid of uids || []) {
        const msg = await client.fetchOne(uid, { source: true }, { uid: true });
        const mail = await simpleParser(msg.source);
        const addr = a => (a && a.value ? a.value.map(x => x.address).join(', ') : '');
        prosesMesej({
          dari: addr(mail.from),
          kepada: [addr(mail.to), addr(mail.cc)].filter(Boolean).join(', '),
          subjek: mail.subject,
          adaPdf: (mail.attachments || []).some(a => /pdf/i.test(a.contentType) || /\.pdf$/i.test(a.filename || '')),
          isi: mail.text,
        });
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        n++;
      }
    } finally { lock.release(); }
    await client.logout();
  } catch (e) {
    console.error('[emailcheck] Gagal semak peti:', e.message);
  } finally { berjalan = false; }
  return { diproses: n };
}

module.exports = { prosesMesej, nilaiSemula, semakPeti };
