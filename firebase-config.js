// ============================================================
//  TETAPAN APPS – isi bahagian ini sahaja (lihat PANDUAN.md)
// ============================================================
window.TKL_CONFIG = {
  // 1. Tampal firebaseConfig dari Firebase Console → Project settings → Your apps → Web app
  firebase: {
    apiKey: "AIzaSyArJhw6vkx_k3xU_dUbEHnWmdDlBvUmS9c",
    authDomain: "qaizer-taklimat.firebaseapp.com",
    projectId: "qaizer-taklimat",
    storageBucket: "qaizer-taklimat.firebasestorage.app",
    messagingSenderId: "433861844239",
    appId: "1:433861844239:web:a856b3f6a51632bb9ff27a",
  },

  // 2. Email pengesahan yang WAJIB di-CC (Gmail khas yang menjalankan Apps Script)
  ccEmail: "hakimmdzaki@gmail.com",

  // 3. Kepala surat
  syarikat: "QAIZER GROUP",
  alamatSyarikat: ["No. 8-1, Jalan KSB 16,", "Taman Kota Syahbandar,", "75200 Melaka."],
  jawatanEjen: "Pegawai Qaizer Consultancy",
  rakanKongsi: "Untuk makluman pihak tuan, Qaizer Group telah menjalinkan usaha sama bersama MyAngkasa Amanah Berhad dalam pengurusan harta pusaka, wasiat dan hibah.",

  // 4. Peraturan (jangan ubah kecuali perlu; firestore.rules juga guna 45 hari)
  luputHari: 45,
  jamAmaranEmail: 24,
};
