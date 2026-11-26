# Apps Taklimat Agensi

Web app (boleh "Add to Home Screen" di telefon) untuk ejen mohon taklimat ke agensi kerajaan & swasta.
Ikut rangka dalam `../design/Rangka_Apps_Taklimat.pdf`.

## Fungsi

| Bahagian | Apa yang ada |
|---|---|
| Daftar ejen | Nama, No. IC, telefon, email, kod ejen (unik), tandatangan (lukis jari / muat naik gambar). Jawatan tetap. |
| Kelulusan | Ejen baru **menunggu** sehingga admin lulus. Pengguna **pertama** yang daftar = **Admin Utama**. |
| Admin | Lulus / tolak, gantung ejen + **pindah agensi** ke ejen lain, aktif semula, **tambah / buang admin** (Admin Utama sahaja). |
| Permohonan | Nama agensi, alamat, telefon, PIC, email. **Semakan bertindan** (“MAAF, ALI SUDAH ISI … Sila cari agensi lain”). Singkatan difahami: Poli = Politeknik, PKD, SK, SMK, MD, dll. |
| Surat PDF | Ikut templat PKD Mersing, dengan nama, telefon & tandatangan ejen. |
| Rangka email | Kepada, **CC wajib** ke email pengesahan, subjek dengan kod `[TKL-xxxx]`, isi email. Salin / buka apps email / buka Gmail. Ejen attach PDF. |
| Pengesahan | Sistem baca peti email pengesahan (IMAP). Jika email ada kod TKL + dihantar ke agensi + ada PDF → **Disahkan** automatik. Tiada CC dalam 24 jam → bermasalah, admin boleh sahkan manual. |
| Follow up | Kali ke-1, 2, 3… automatik, cara + nota + tarikh ingatan. |
| Keputusan | Dapat Taklimat (tarikh, masa, penceramah) / Tak Berjaya (sebab, nota). |
| Hasil | Selepas tarikh taklimat: berapa hadir & berapa closing (borang dikeluarkan). |
| Luput 45 hari | Tiada tindakan 45 hari → dilepaskan. Amaran hari ke-35 & 42. Agensi Tak Berjaya / Dilepaskan terbuka semula dengan sejarah ejen terdahulu. |
| Prestasi | Admin nampak hadir, closing & kadar ikut ejen, ikut bulan. |

## Jalankan di komputer

Perlu **Node.js 22.5 atau lebih baru** (pangkalan data SQLite terbina dalam Node, tiada pemasangan lain).

```bash
cd app
npm install
cp .env.example .env      # isi tetapan
npm start                 # buka http://localhost:3000
```

Daftar akaun pertama → akaun itu jadi **Admin Utama**.

Ujian automatik (16 senario penuh): `npm test`

## Tetapan (`.env`)

| Nama | Maksud |
|---|---|
| `SESSION_SECRET` | Rentetan rawak panjang (wajib tukar). |
| `CC_EMAIL` | Email pengesahan yang wajib di-CC, cth `qaizer.sahkan@gmail.com`. |
| `IMAP_HOST`, `IMAP_USER`, `IMAP_PASS` | Akses ke peti `CC_EMAIL` supaya sistem boleh baca & sahkan. Kosongkan = admin sahkan manual. |
| `IMAP_MINIT` | Kekerapan semak peti (lalai 5 minit). |
| `LUPUT_HARI` | Lalai 45. |
| `SYARIKAT`, `ALAMAT_SYARIKAT`, `JAWATAN_EJEN` | Kepala surat. Baris alamat dipisah dengan `|`. |
| `DB_PATH` | Lokasi fail pangkalan data (lalai `app/data/taklimat.db`). |

### Sediakan Gmail khas untuk pengesahan

1. Buat akaun Gmail baru, cth `qaizer.sahkan@gmail.com`.
2. Hidupkan **2-Step Verification** pada akaun itu.
3. Pergi ke *Google Account → Security → App passwords*, cipta satu App Password.
4. Dalam `.env`:
   ```
   CC_EMAIL=qaizer.sahkan@gmail.com
   IMAP_HOST=imap.gmail.com
   IMAP_USER=qaizer.sahkan@gmail.com
   IMAP_PASS=<app password 16 aksara>
   ```
Jika ada domain sendiri (cth `sahkan@qaizer.my`), guna tetapan IMAP penyedia email domain itu.

## Letak di internet (hosting)

Apps ini satu servis Node + satu fail pangkalan data. Pilihan mudah:

- **Railway / Render / Fly.io** – sambung repo GitHub, *root directory* `app`, *start command* `npm start`.
  **Wajib** pasang *persistent volume / disk* dan set `DB_PATH` ke dalamnya (cth `/data/taklimat.db`), jika tidak data hilang bila servis dimulakan semula.
- **VPS** (DigitalOcean, dll.) – `npm install && npm start` di belakang Nginx + HTTPS, guna `pm2` supaya sentiasa hidup.

Untuk 30–60 ejen, pelan paling kecil sudah mencukupi. **Sandarkan (backup)** fail `taklimat.db` secara berkala.

## Struktur kod

```
server.js            – permulaan apps
config.js            – tetapan
db.js                – skema & pangkalan data (kunci unik bertindan)
lib/surat.js         – kandungan surat, PDF, rangka email
lib/emailcheck.js    – baca peti IMAP & sahkan Dah Email
lib/jobs.js          – luput 45 hari, amaran, peringatan
routes/auth.js       – log masuk, daftar, profil & tandatangan
routes/ejen.js       – dashboard & senarai
routes/permohonan.js – permohonan, surat, email, follow up, keputusan, hasil
routes/admin.js      – urus ejen, pengesahan, prestasi
public/              – CSS, JS (pad tandatangan, semakan langsung), ikon PWA
test/e2e.js          – ujian hujung-ke-hujung
```
