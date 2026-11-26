/**
 * ROBOT PENGESAHAN EMAIL – Google Apps Script
 * Dipasang dalam akaun Gmail pengesahan (email yang wajib di-CC).
 *
 * Tugas:
 *  1. setiap 5 minit  → semakEmail(): baca email belum dibaca yang subjeknya ada "QAIZER GROUP-0001" (atau TKL-0001),
 *                        semak penerima & lampiran PDF, sahkan "Dah Email" dalam Firestore.
 *  2. setiap hari      → harian(): lepaskan agensi yang 45 hari tiada tindakan,
 *                        tandakan email yang belum di-CC selepas 24 jam.
 *
 * Tetapan (Project Settings → Script Properties):
 *   API_KEY      = apiKey dari firebase-config.js
 *   PROJECT_ID   = projectId dari firebase-config.js
 *   ROBOT_EMAIL  = email akaun robot (Firebase Authentication)
 *   ROBOT_PASS   = kata laluan akaun robot
 * Jalankan pasangTrigger() SEKALI untuk mula.
 */

var LUPUT_HARI = 45;
var JAM_AMARAN = 24;

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function authBase_() { return prop_('AUTH_URL') || 'https://identitytoolkit.googleapis.com'; }
function fsBase_() { return (prop_('FS_URL') || 'https://firestore.googleapis.com/v1') + '/projects/' + prop_('PROJECT_ID') + '/databases/(default)/documents'; }
function docName_(path) { return 'projects/' + prop_('PROJECT_ID') + '/databases/(default)/documents/' + path; }

var TOKEN_ = null;
function token_() {
  if (TOKEN_) return TOKEN_;
  var r = UrlFetchApp.fetch(authBase_() + '/v1/accounts:signInWithPassword?key=' + prop_('API_KEY'), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ email: prop_('ROBOT_EMAIL'), password: prop_('ROBOT_PASS'), returnSecureToken: true }),
  });
  var j = JSON.parse(r.getContentText());
  if (!j.idToken) throw new Error('Log masuk robot gagal: ' + r.getContentText());
  TOKEN_ = j.idToken;
  return TOKEN_;
}
function api_(method, url, body) {
  var opt = { method: method, contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token_() } };
  if (body) opt.payload = JSON.stringify(body);
  var r = UrlFetchApp.fetch(url, opt);
  var code = r.getResponseCode();
  if (code === 404) return null;
  if (code >= 300) throw new Error(method + ' ' + url + ' → ' + code + ' ' + r.getContentText());
  return JSON.parse(r.getContentText() || '{}');
}

// ---------- Tukar nilai Firestore REST ⇄ JS ----------
function toV_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toV_) } };
  if (typeof v === 'object') { var f = {}; for (var k in v) f[k] = toV_(v[k]); return { mapValue: { fields: f } }; }
  return { stringValue: String(v) };
}
function fromV_(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromV_);
  if ('mapValue' in v) return fromF_(v.mapValue.fields || {});
  return null;
}
function fromF_(f) { var o = {}; for (var k in f) o[k] = fromV_(f[k]); return o; }
function getDoc_(path) {
  var d = api_('get', fsBase_() + '/' + path);
  if (!d) return null;
  var o = fromF_(d.fields || {}); o._id = d.name.split('/').pop(); return o;
}
function query_(col, field, op, value) {
  var res = api_('post', fsBase_() + ':runQuery', { structuredQuery: {
    from: [{ collectionId: col }], where: { fieldFilter: { field: { fieldPath: field }, op: op, value: toV_(value) } } } });
  return (res || []).filter(function (x) { return x.document; }).map(function (x) {
    var o = fromF_(x.document.fields || {}); o._id = x.document.name.split('/').pop(); return o;
  });
}
// Kemas kini medan (+ tambah ke dalam tatasusunan, cth log)
function update_(path, fields, append) {
  var w = { update: { name: docName_(path), fields: {} }, updateMask: { fieldPaths: [] }, currentDocument: { exists: true } };
  for (var k in fields) { w.update.fields[k] = toV_(fields[k]); w.updateMask.fieldPaths.push(k); }
  if (append) w.updateTransforms = Object.keys(append).map(function (k) { return { fieldPath: k, appendMissingElements: { values: append[k].map(toV_) } }; });
  return w;
}
function commit_(writes) { if (writes.length) api_('post', fsBase_() + ':commit', { writes: writes }); }
function log_(teks) { return { teks: teks, at: new Date() }; }

// ================= 1. SEMAK EMAIL =================
function semakEmail() {
  var threads = GmailApp.search('is:unread {subject:"QAIZER GROUP" subject:TKL}', 0, 50);
  var n = 0;
  threads.forEach(function (t) {
    t.getMessages().forEach(function (m) {
      if (!m.isUnread()) return;
      try { prosesMesej_(m); n++; } catch (e) { console.error(e); return; }
      m.markRead();
    });
  });
  nilaiSemua_();
  return n;
}

function prosesMesej_(m) {
  var subjek = m.getSubject() || '';
  var mt = subjek.match(/(?:QAIZER\s*GROUP|TKL)\s*-\s*(\d{1,8})/i);
  var pid = mt ? 'TKL-' + String(Number(mt[1])).padStart(4, '0') : null;
  var kepada = [m.getTo(), m.getCc()].filter(String).join(', ');
  var adaPdf = m.getAttachments().some(function (a) { return /pdf/i.test(a.getContentType()) || /\.pdf$/i.test(a.getName()); });
  var diterima = m.getDate();
  var p = pid ? getDoc_('permohonan/' + pid) : null;
  // simpan untuk admin baca
  var mid = Utilities.getUuid();
  commit_([{ update: { name: docName_('emailMasuk/' + mid), fields: {
    pid: toV_(p ? pid : null), dari: toV_(m.getFrom()), kepada: toV_(kepada), subjek: toV_(subjek),
    adaPdf: toV_(adaPdf), isi: toV_(String(m.getPlainBody() || '').slice(0, 5000)), diterima: toV_(diterima) } } }]);
  if (p) commit_([update_('permohonan/' + pid, { emailInfo: { kepada: kepada, adaPdf: adaPdf, diterima: diterima, mid: mid } })]);
}

// Nilai semua permohonan "Dah Email" yang belum disahkan
function nilaiSemua_() {
  var ps = query_('permohonan', 'status', 'EQUAL', 'dah_email');
  var writes = [];
  ps.forEach(function (p) {
    if (p.emailStatus === 'disahkan') return;
    var pathP = 'permohonan/' + p._id;
    if (p.emailInfo) {
      var isu = [];
      if (String(p.emailInfo.kepada).toLowerCase().indexOf(String(p.email).toLowerCase()) < 0) isu.push('Email tidak dihantar kepada ' + p.email);
      if (!p.emailInfo.adaPdf) isu.push('Tiada lampiran PDF');
      if (!isu.length) {
        var now = new Date();
        writes.push(update_(pathP, { emailStatus: 'disahkan', emailVerifiedAt: now, emailVerifiedBy: 'sistem', emailIssue: null, lastActivity: now, amaran: 0 },
          { log: [log_('Dah Email disahkan automatik (email CC diterima)')] }));
        writes.push(update_('agensi/' + p.agensiId, { lastActivity: now }));
      } else if (p.emailIssue !== isu.join('; ')) {
        writes.push(update_(pathP, { emailStatus: 'bermasalah', emailIssue: isu.join('; ') }, { log: [log_('Pengesahan email bermasalah: ' + isu.join('; '))] }));
      }
    } else if (p.emailStatus === 'menunggu' && p.emailMarkedAt && (Date.now() - p.emailMarkedAt.getTime()) / 3600000 >= JAM_AMARAN) {
      writes.push(update_(pathP, { emailStatus: 'bermasalah', emailIssue: 'Tiada email CC diterima dalam ' + JAM_AMARAN + ' jam' }));
    }
  });
  commit_(writes);
}

// ================= 2. KERJA HARIAN =================
function harian() {
  var ps = query_('permohonan', 'status', 'IN', ['surat_siap', 'dah_email']);
  var n = 0;
  ps.forEach(function (p) {
    if (!p.lastActivity || Date.now() - p.lastActivity.getTime() < LUPUT_HARI * 86400000) return;
    var writes = [update_('permohonan/' + p._id, { status: 'dilepaskan', closedAt: new Date() }, { log: [log_('Dilepaskan – ' + LUPUT_HARI + ' hari tiada tindakan')] })];
    var ag = getDoc_('agensi/' + p.agensiId);
    if (ag && ag.pid === p._id) writes.push(update_('agensi/' + p.agensiId, { status: 'dilepaskan' }, { sejarah: [{
      ejenNama: ag.ejenNama, ejenKod: ag.ejenKod, emailAt: ag.emailAt || null, fu: ag.fuCount || 0, status: 'dilepaskan', sebab: null, nota: null, at: new Date() }] }));
    commit_(writes);
    n++;
  });
  nilaiSemua_();
  return n;
}

// ================= PASANG JADUAL =================
function pasangTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('semakEmail').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('harian').timeBased().everyDays(1).atHour(6).create();
  token_(); // uji log masuk robot
  Logger.log('Jadual dipasang. Robot berjaya log masuk.');
}
