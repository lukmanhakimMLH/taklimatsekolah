// Fungsi bantuan: normalkan nama agensi, tarikh, kiraan luput
const LUPUT_HARI = Number(process.env.LUPUT_HARI || 45);

// Singkatan biasa → bentuk penuh (supaya "Poli Mersing" = "Politeknik Mersing")
const SINGKATAN = {
  poli: 'politeknik',
  pkd: 'pejabat kesihatan daerah',
  ppd: 'pejabat pendidikan daerah',
  kk: 'klinik kesihatan',
  sk: 'sekolah kebangsaan',
  smk: 'sekolah menengah kebangsaan',
  sjkc: 'sekolah jenis kebangsaan cina',
  sjkt: 'sekolah jenis kebangsaan tamil',
  sma: 'sekolah menengah agama',
  sra: 'sekolah rendah agama',
  ipd: 'ibu pejabat polis daerah',
  balai: 'balai',
  bomba: 'balai bomba dan penyelamat',
  jkr: 'jabatan kerja raya',
  jpn: 'jabatan pendaftaran negara',
  pdt: 'pejabat daerah dan tanah',
  md: 'majlis daerah',
  mp: 'majlis perbandaran',
  hosp: 'hospital',
  kv: 'kolej vokasional',
  kkom: 'kolej komuniti',
  ilp: 'institut latihan perindustrian',
  jkm: 'jabatan kebajikan masyarakat',
  'sek': 'sekolah',
  'keb': 'kebangsaan',
  'men': 'menengah',
  'kem': 'kementerian',
  'jab': 'jabatan',
};

function normalize(nama) {
  return String(nama || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map(w => SINGKATAN[w] || w)
    .join(' ')
    .trim();
}

function similarity(a, b) {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

const kodTKL = id => 'TKL-' + String(id).padStart(4, '0');

function parseDT(s) {
  if (!s) return null;
  return new Date(s.replace(' ', 'T'));
}
function hariSejak(s) {
  const d = parseDT(s);
  if (!d) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
function hariLagi(lastActivity) {
  return LUPUT_HARI - hariSejak(lastActivity);
}

const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
function tarikh(s) { // 'YYYY-MM-DD...' → DD/MM/YYYY
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
function tarikhMasa(s) {
  if (!s) return '';
  return `${tarikh(s)}, ${s.slice(11, 16)}`;
}
function hariIni() {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function masa12(hhmm) {
  if (!hhmm) return '';
  let [h, m] = hhmm.split(':').map(Number);
  const s = h < 12 ? 'pagi' : (h < 14 ? 'tengah hari' : (h < 19 ? 'petang' : 'malam'));
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${s}`;
}

const STATUS = {
  surat_siap: ['SURAT SIAP', 'p-b'],
  dah_email: ['DAH EMAIL', 'p-a'],
  dapat_taklimat: ['DAPAT TAKLIMAT', 'p-g'],
  selesai: ['SELESAI', 'p-g'],
  tak_berjaya: ['TAK BERJAYA', 'p-r'],
  dilepaskan: ['DILEPASKAN', 'p-x'],
};
const AKTIF = ['surat_siap', 'dah_email', 'dapat_taklimat', 'selesai'];

module.exports = { normalize, similarity, kodTKL, hariSejak, hariLagi, tarikh, tarikhMasa, hariIni, masa12, BULAN, STATUS, AKTIF, LUPUT_HARI, parseDT };
