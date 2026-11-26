// Pangkalan data SQLite (terbina dalam Node 22+, tiada pakej tambahan)
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'taklimat.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  nama TEXT,
  no_ic TEXT,
  telefon TEXT,
  kod_ejen TEXT UNIQUE COLLATE NOCASE,
  signature TEXT,                       -- PNG data URL
  role TEXT NOT NULL DEFAULT 'ejen',    -- ejen | admin | admin_utama
  status TEXT NOT NULL DEFAULT 'profil',-- profil | menunggu | aktif | ditolak | digantung
  sebab_status TEXT,
  approved_by INTEGER,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS permohonan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  nama_agensi TEXT NOT NULL,
  nama_singkat TEXT,
  norm TEXT NOT NULL,
  alamat TEXT NOT NULL,
  telefon TEXT NOT NULL,
  pic TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'surat_siap', -- surat_siap | dah_email | dapat_taklimat | selesai | tak_berjaya | dilepaskan
  tarikh_surat TEXT NOT NULL,
  -- salinan maklumat ejen semasa surat dijana (surat lama kekal walaupun profil berubah)
  snap_nama TEXT, snap_telefon TEXT, snap_signature TEXT,
  email_status TEXT,          -- null | menunggu | disahkan | bermasalah
  email_marked_at TEXT,
  email_verified_at TEXT,
  email_issue TEXT,
  email_verified_by TEXT,     -- 'sistem' atau nama admin
  tak_sebab TEXT, tak_nota TEXT,
  closed_at TEXT,
  last_activity TEXT NOT NULL,
  amaran_hari INTEGER DEFAULT 0, -- amaran terakhir dihantar (35/42)
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
-- KUNCI BERTINDAN: hanya satu permohonan aktif bagi setiap nama agensi
CREATE UNIQUE INDEX IF NOT EXISTS uniq_agensi_aktif ON permohonan(norm)
  WHERE status IN ('surat_siap','dah_email','dapat_taklimat','selesai');
CREATE INDEX IF NOT EXISTS idx_perm_user ON permohonan(user_id);
CREATE INDEX IF NOT EXISTS idx_perm_norm ON permohonan(norm);

CREATE TABLE IF NOT EXISTS followup (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permohonan_id INTEGER NOT NULL REFERENCES permohonan(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  kali INTEGER NOT NULL,
  cara TEXT NOT NULL,
  nota TEXT NOT NULL,
  ingat TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS taklimat (
  permohonan_id INTEGER PRIMARY KEY REFERENCES permohonan(id),
  tarikh TEXT NOT NULL,
  masa TEXT NOT NULL,
  penceramah TEXT NOT NULL,
  lokasi TEXT,
  peserta INTEGER,
  hadir INTEGER,
  closing INTEGER,
  nota_hasil TEXT,
  hasil_at TEXT
);

-- Catatan sistem (dipindah, disahkan, dilepaskan, dll.)
CREATE TABLE IF NOT EXISTS peristiwa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permohonan_id INTEGER NOT NULL REFERENCES permohonan(id),
  teks TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS notifikasi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  teks TEXT NOT NULL,
  link TEXT,
  dibaca INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Email masuk ke peti pengesahan (untuk admin baca)
CREATE TABLE IF NOT EXISTS email_masuk (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permohonan_id INTEGER,
  dari TEXT, kepada TEXT, subjek TEXT, ada_pdf INTEGER, isi TEXT,
  diterima_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`);

const one = (sql, ...p) => db.prepare(sql).get(...p);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);

function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

function now() {
  // waktu tempatan, format 'YYYY-MM-DD HH:MM:SS'
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function notify(userId, teks, link) {
  run('INSERT INTO notifikasi (user_id, teks, link) VALUES (?,?,?)', userId, teks, link || null);
}
function notifyAdmins(teks, link) {
  for (const a of all("SELECT id FROM users WHERE role IN ('admin','admin_utama') AND status='aktif'")) notify(a.id, teks, link);
}
function event(pid, teks) {
  run('INSERT INTO peristiwa (permohonan_id, teks) VALUES (?,?)', pid, teks);
}

module.exports = { db, one, all, run, tx, now, notify, notifyAdmins, event };
