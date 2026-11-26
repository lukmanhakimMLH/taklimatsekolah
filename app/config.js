// Tetapan apps. Ubah melalui pemboleh ubah persekitaran (.env) – lihat README.
module.exports = {
  PORT: Number(process.env.PORT || 3000),
  SESSION_SECRET: process.env.SESSION_SECRET || 'tukar-rahsia-ini',
  APP_NAME: process.env.APP_NAME || 'Taklimat Agensi',

  // Kepala surat
  SYARIKAT: process.env.SYARIKAT || 'QAIZER GROUP',
  ALAMAT_SYARIKAT: (process.env.ALAMAT_SYARIKAT || 'No. 8-1, Jalan KSB 16,|Taman Kota Syahbandar,|75200 Melaka.').split('|'),
  JAWATAN_EJEN: process.env.JAWATAN_EJEN || 'Pegawai Qaizer Consultancy',
  RAKAN_KONGSI: process.env.RAKAN_KONGSI || 'Untuk makluman pihak tuan, Qaizer Group telah menjalinkan usaha sama bersama MyAngkasa Amanah Berhad dalam pengurusan harta pusaka, wasiat dan hibah.',

  // Email pengesahan (CC wajib). Sistem baca peti ini melalui IMAP.
  CC_EMAIL: process.env.CC_EMAIL || 'sahkan@contoh.com',
  IMAP_HOST: process.env.IMAP_HOST || '',          // cth imap.gmail.com
  IMAP_PORT: Number(process.env.IMAP_PORT || 993),
  IMAP_USER: process.env.IMAP_USER || '',
  IMAP_PASS: process.env.IMAP_PASS || '',          // Gmail: guna "App Password"
  IMAP_MINIT: Number(process.env.IMAP_MINIT || 5), // kekerapan semak (minit)
  JAM_AMARAN_EMAIL: Number(process.env.JAM_AMARAN_EMAIL || 24),
};
