# Taklimat Agensi

Apps mudah alih untuk ejen mohon taklimat ke agensi kerajaan & swasta.
**GitHub Pages + Firebase** – tiada server. Cara pasang: **[PANDUAN.md](PANDUAN.md)**.

| Bahagian | Fungsi |
|---|---|
| Daftar ejen | Nama, No. IC, telefon, email, kod ejen (unik), tandatangan jari / gambar. Jawatan tetap. |
| Kelulusan | Ejen baru menunggu kelulusan admin. Pendaftar pertama = **Admin Utama**. |
| Admin | Lulus / tolak, gantung + **pindah agensi**, aktif semula, tambah / buang admin, prestasi. |
| Permohonan | Semakan **bertindan** (“MAAF, ALI SUDAH ISI … Sila cari agensi lain”); faham singkatan (Poli, PKD, SK, SMK, MD…). Dikunci oleh peraturan Firestore. |
| PDF permohonan | Satu PDF (9 ms): surat berlogo + kertas kerja cadangan 6 ms (nama pegawai agensi & ejen diisi automatik) + surat sokongan MyAngkasa & ANGKASA. Tiada “Semakan Gaji” dalam tajuk & kertas kerja. |
| Rangka email | Kepada, **CC wajib**, subjek `[TKL-xxxx]`, isi email – salin / buka apps email / Gmail. |
| Pengesahan | Robot Google Apps Script baca Gmail pengesahan → **Disahkan** automatik; admin boleh sahkan manual. |
| Follow up | Kali ke-1, 2, 3… + nota + peringatan. |
| Keputusan | Dapat Taklimat (tarikh, masa, penceramah) → hasil (hadir & closing) / Tak Berjaya. |
| Luput 45 hari | Agensi tanpa tindakan dilepaskan; Tak Berjaya / Dilepaskan dibuka semula dengan sejarah ejen terdahulu. |

## Fail

```
index.html, style.css, js/       – apps (dihidangkan oleh GitHub Pages)
firebase-config.js               – TETAPAN: isi firebaseConfig & email CC
firestore.rules                  – peraturan keselamatan (tampal di Firebase Console)
aset/                            – logo, fon, templat kertas-kerja.pdf, lampiran.pdf
alat/kertas-kerja.html           – sumber kertas kerja; ubah lalu jalankan `node alat/bina-kertas-kerja.mjs`
apps-script/Kod.gs               – robot pengesahan email (Google Apps Script)
design/                          – rangka reka bentuk (PDF)
test/                            – ujian automatik (Firebase Emulator + Playwright)
```

## Ujian

```bash
cd test && npm install && npm test   # perlu Java (untuk Firebase Emulator)
```
16 senario: daftar & kelulusan, bertindan, PDF, email + robot CC, follow up, hasil, luput 45 hari, gantung & pindah, tambah admin, peraturan keselamatan.
