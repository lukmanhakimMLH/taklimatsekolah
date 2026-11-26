// Fungsi bantuan: normalkan nama agensi, tarikh, kiraan luput
export const CFG = window.TKL_CONFIG;
export const LUPUT_HARI = CFG.luputHari || 45;

// Singkatan biasa → bentuk penuh (supaya "Poli Mersing" = "Politeknik Mersing")
const SINGKATAN = {
  poli: 'politeknik', pkd: 'pejabat kesihatan daerah', ppd: 'pejabat pendidikan daerah', kk: 'klinik kesihatan',
  sk: 'sekolah kebangsaan', smk: 'sekolah menengah kebangsaan', sjkc: 'sekolah jenis kebangsaan cina', sjkt: 'sekolah jenis kebangsaan tamil',
  sma: 'sekolah menengah agama', sra: 'sekolah rendah agama', ipd: 'ibu pejabat polis daerah', bomba: 'balai bomba dan penyelamat',
  jkr: 'jabatan kerja raya', jpn: 'jabatan pendaftaran negara', pdt: 'pejabat daerah dan tanah', md: 'majlis daerah', mp: 'majlis perbandaran',
  hosp: 'hospital', kv: 'kolej vokasional', kkom: 'kolej komuniti', ilp: 'institut latihan perindustrian', jkm: 'jabatan kebajikan masyarakat',
  sek: 'sekolah', keb: 'kebangsaan', men: 'menengah', kem: 'kementerian', jab: 'jabatan',
};

export function normalize(nama) {
  return String(nama || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map(w => SINGKATAN[w] || w).join(' ').trim();
}
// ID dokumen agensi (tiada '/')
export const normId = n => n.replace(/\s+/g, '_');

export function similarity(a, b) {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

export const kodTKL = n => 'TKL-' + String(n).padStart(4, '0');

// Timestamp Firestore / Date / string → Date
export function toDate(t) {
  if (!t) return null;
  if (t instanceof Date) return t;
  if (typeof t.toDate === 'function') return t.toDate();
  if (typeof t.seconds === 'number') return new Date(t.seconds * 1000);
  return new Date(t);
}
export const hariSejak = t => { const d = toDate(t); return d ? Math.floor((Date.now() - d.getTime()) / 86400000) : 0; };
export const hariLagi = t => LUPUT_HARI - hariSejak(t);
export const jamSejak = t => { const d = toDate(t); return d ? (Date.now() - d.getTime()) / 3600000 : 0; };
export const luput = p => ['surat_siap', 'dah_email'].includes(p.status) && hariLagi(p.lastActivity) <= 0;

const p2 = n => String(n).padStart(2, '0');
export function tarikh(t) {
  if (!t) return '';
  if (typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t)) { const [y, m, d] = t.split('-'); return `${d}/${m}/${y}`; }
  const d = toDate(t); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export function tarikhMasa(t) { const d = toDate(t); return d ? `${tarikh(d)}, ${p2(d.getHours())}:${p2(d.getMinutes())}` : ''; }
export function hariIni() { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
export function isoBulan(t) { const d = toDate(t); return d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}` : ''; }
export function masa12(hhmm) {
  if (!hhmm) return '';
  let [h, m] = hhmm.split(':').map(Number);
  const s = h < 12 ? 'pagi' : (h < 14 ? 'tengah hari' : (h < 19 ? 'petang' : 'malam'));
  return `${h % 12 || 12}:${p2(m)} ${s}`;
}
export const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

export const STATUS = {
  surat_siap: ['SURAT SIAP', 'p-b'], dah_email: ['DAH EMAIL', 'p-a'], dapat_taklimat: ['DAPAT TAKLIMAT', 'p-g'],
  selesai: ['SELESAI', 'p-g'], tak_berjaya: ['TAK BERJAYA', 'p-r'], dilepaskan: ['DILEPASKAN', 'p-x'],
};
export const AKTIF = ['surat_siap', 'dah_email', 'dapat_taklimat', 'selesai'];
export const BOLEH_PINDAH = ['surat_siap', 'dah_email', 'dapat_taklimat'];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function pill(status) { const [t, c] = STATUS[status] || [status, '']; return `<span class="pill ${c}">${t}</span>`; }
export const alamatSebaris = a => String(a || '').split(/\r?\n/).map(l => l.trim().replace(/,$/, '')).filter(Boolean).join(', ');
