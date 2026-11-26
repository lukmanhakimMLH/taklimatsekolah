# Panduan Pasang – Apps Taklimat Agensi

Sama macam apps rekrutmen: **GitHub Pages** (percuma) + **Firebase** (percuma). Tiada server sendiri.

Masa diperlukan: ~20 minit, sekali sahaja.

---

## Langkah 1 – Cipta projek Firebase baru

> Guna projek **baru**, jangan kongsi dengan projek apps rekrutmen (`qaizer-arg313`) – peraturan keselamatan (rules) akan bertembung.

1. Buka <https://console.firebase.google.com> → **Add project** → nama cth `qaizer-taklimat` → Google Analytics boleh *off*.
2. **Build → Authentication → Get started → Email/Password → Enable → Save.**
3. **Build → Firestore Database → Create database** → lokasi `asia-southeast1 (Singapore)` → *Start in production mode*.
4. Tab **Rules** → padam semua → tampal isi fail [`firestore.rules`](firestore.rules) → **Publish**.
5. ⚙️ **Project settings → General → Your apps → ikon `</>` (Web)** → nama `taklimat` → **Register app**.
   Salin nilai `firebaseConfig` (apiKey, authDomain, projectId, …).

## Langkah 2 – Isi `firebase-config.js`

Buka fail [`firebase-config.js`](firebase-config.js) dan tampal nilai `firebaseConfig` tadi.
Tukar juga `ccEmail` kepada email pengesahan anda (Langkah 5).

> Atau hantar `firebaseConfig` kepada Claude dan minta ia isikan.

## Langkah 3 – Hidupkan GitHub Pages

1. GitHub repo **taklimatsekolah → Settings → Pages**.
2. *Source*: **Deploy from a branch** → pilih branch (cth `main`) dan folder **/ (root)** → **Save**.
3. Tunggu 1–2 minit. Apps ada di **https://lukmanhakimmlh.github.io/taklimatsekolah/**
4. Firebase Console → **Authentication → Settings → Authorized domains → Add domain** → `lukmanhakimmlh.github.io`.

## Langkah 4 – Daftar sebagai Admin Utama

Buka pautan apps → **Daftar** → lengkapkan profil & tandatangan.
**Orang pertama yang daftar = Admin Utama** (terus aktif). Jadi pastikan anda daftar **dahulu** sebelum kongsi pautan kepada ejen.

Kongsi pautan kepada ejen. Di telefon: buka pautan → **Share → Add to Home Screen** supaya jadi macam apps.

## Langkah 5 – Robot pengesahan email (CC)

Supaya “Dah Email” disahkan **automatik** bila ejen CC ke email pengesahan.
(Jika langkah ini belum dibuat, admin boleh tekan **Sahkan manual** dalam menu *Pengesahan email*.)

1. **Buat Gmail khas**, cth `qaizer.sahkan@gmail.com`. Masukkan dalam `ccEmail` di `firebase-config.js`.
2. **Akaun robot di Firebase**: Authentication → Users → **Add user** → email cth `robot@qaizer-taklimat.app`, kata laluan kuat. Salin **User UID**.
3. Dalam apps (sebagai Admin Utama): Menu ☰ → **Tetapan robot email** → tampal UID → Simpan.
4. Log masuk ke Gmail khas tadi → buka <https://script.google.com> → **New project**.
   - Padam kod asal, tampal isi [`apps-script/Kod.gs`](apps-script/Kod.gs) → 💾 Save.
   - ⚙️ **Project Settings → Script Properties → Add**:

     | Property | Value |
     |---|---|
     | `API_KEY` | apiKey dari firebase-config.js |
     | `PROJECT_ID` | projectId dari firebase-config.js |
     | `ROBOT_EMAIL` | email robot (langkah 2) |
     | `ROBOT_PASS` | kata laluan robot |

   - Kembali ke Editor → pilih fungsi **`pasangTrigger`** → **Run** → benarkan akses (Allow).
   - Siap. Robot semak email setiap 5 minit dan lepaskan agensi 45 hari setiap pagi.

---

## Kos

Pelan percuma Firebase (Spark) mencukupi untuk 30–60 ejen. Google Apps Script & GitHub Pages juga percuma.

## Kemas kini apps kemudian

Ubah fail dalam repo → GitHub Pages kemas kini sendiri dalam 1–2 minit. Ejen cuma muat semula apps.
Jika `firestore.rules` diubah, tampal semula di Firebase Console → Firestore → Rules → Publish.
