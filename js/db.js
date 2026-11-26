// Lapisan data Firebase (Auth + Firestore)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where,
  writeBatch, runTransaction, serverTimestamp, Timestamp, arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { CFG, normalize, normId, kodTKL, luput, BOLEH_PINDAH, AKTIF } from './util.js';

const EMU = new URLSearchParams(location.search).has('emu');
const app = initializeApp(EMU ? { apiKey: 'demo', projectId: new URLSearchParams(location.search).get('emu') || 'demo-tkl', authDomain: 'localhost' } : CFG.firebase);
export const auth = getAuth(app);
export const fs = getFirestore(app);
if (EMU) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(fs, 'localhost', 8080);
}
export const dikonfigur = EMU || !!CFG.firebase.apiKey;

const d = (...p) => doc(fs, ...p);
const data = s => s.exists() ? { id: s.id, ...s.data() } : null;
const ts = serverTimestamp;
const kini = () => Timestamp.now();
export const log = teks => ({ teks, at: kini() });

// ---------- Ralat dalam Bahasa Melayu ----------
export function mesejRalat(e) {
  if (e && e.mesej) return e.mesej;
  return ({
    'auth/invalid-credential': 'Email atau kata laluan salah.', 'auth/wrong-password': 'Email atau kata laluan salah.',
    'auth/user-not-found': 'Akaun tidak dijumpai.', 'auth/email-already-in-use': 'Email ini sudah didaftar – sila log masuk.',
    'auth/weak-password': 'Kata laluan sekurang-kurangnya 6 aksara.', 'auth/invalid-email': 'Format email tidak sah.',
    'auth/too-many-requests': 'Terlalu banyak cubaan. Cuba lagi sebentar.', 'auth/network-request-failed': 'Tiada sambungan internet.',
    'permission-denied': 'Tiada kebenaran untuk tindakan ini (mungkin data telah berubah). Sila muat semula.',
    'unavailable': 'Tiada sambungan internet. Cuba lagi.',
  })[e?.code] || ('Ralat: ' + (e?.message || e));
}
const ralat = mesej => Object.assign(new Error(mesej), { mesej });

// ---------- AUTH ----------
export const onAuth = cb => onAuthStateChanged(auth, cb);
export const login = (e, p) => signInWithEmailAndPassword(auth, e, p);
export const logout = () => signOut(auth);
export const resetPassword = e => sendPasswordResetEmail(auth, e);

export async function daftar(email, pw) {
  const { user } = await createUserWithEmailAndPassword(auth, email, pw);
  const asas = { email: email.toLowerCase(), nama: '', noIc: '', telefon: '', kodEjen: null, status: 'profil', sebab: null, createdAt: ts(), updatedAt: ts() };
  // Pengguna pertama menuntut Admin Utama (meta/admin hanya boleh dicipta sekali)
  const meta = await getDoc(d('meta', 'admin'));
  if (!meta.exists()) {
    try {
      const b = writeBatch(fs);
      b.set(d('meta', 'admin'), { uid: user.uid, at: ts() });
      b.set(d('users', user.uid), { ...asas, role: 'admin_utama' });
      await b.commit();
      return;
    } catch (e) { /* orang lain sempat dahulu */ }
  }
  await setDoc(d('users', user.uid), { ...asas, role: 'ejen' });
}

export const getUser = async uid => data(await getDoc(d('users', uid)));

export async function simpanProfil(me, v, signature) {
  const kod = v.kodEjen;
  if (kod !== me.kodEjen) {
    const k = await getDoc(d('kodEjen', kod));
    if (k.exists() && k.data().uid !== me.id) throw ralat(`Kod ejen ${kod} sudah didaftar oleh ejen lain.`);
  }
  let status = me.status;
  if (['profil', 'ditolak'].includes(me.status)) status = me.role === 'admin_utama' ? 'aktif' : 'menunggu';
  const b = writeBatch(fs);
  if (kod !== me.kodEjen) {
    b.set(d('kodEjen', kod), { uid: me.id });
    if (me.kodEjen) b.delete(d('kodEjen', me.kodEjen));
  }
  const upd = { nama: v.nama, noIc: v.noIc, telefon: v.telefon, email: v.email, kodEjen: kod, status, updatedAt: ts() };
  if (signature) upd.signature = signature;
  if (status !== me.status) upd.sebab = null;
  b.update(d('users', me.id), upd);
  try { await b.commit(); } catch (e) { if (e.code === 'permission-denied' && kod !== me.kodEjen) throw ralat(`Kod ejen ${kod} sudah didaftar oleh ejen lain.`); throw e; }
  return status;
}

// ---------- AGENSI & SEMAKAN BERTINDAN ----------
export async function getAgensi(nama) {
  const norm = normalize(nama), id = normId(norm);
  if (!norm) return { norm, id, ag: null };
  return { norm, id, ag: data(await getDoc(d('agensi', id))) };
}
let cacheAg = null, cacheAt = 0;
export async function semuaAgensi() {
  if (cacheAg && Date.now() - cacheAt < 60000) return cacheAg;
  cacheAg = (await getDocs(collection(fs, 'agensi'))).docs.map(s => s.data()); cacheAt = Date.now();
  return cacheAg;
}
export const agensiDipegang = ag => ag && AKTIF.includes(ag.status) && !luput(ag);
const entriSejarah = (ag, status, sebab, nota) => ({
  ejenNama: ag.ejenNama, ejenKod: ag.ejenKod, emailAt: ag.emailAt || null, fu: ag.fuCount || 0, status, sebab: sebab || null, nota: nota || null, at: kini(),
});

// ---------- PERMOHONAN ----------
export async function buatPermohonan(me, v) {
  const norm = normalize(v.namaAgensi), aid = normId(norm);
  const agRef = d('agensi', aid), cRef = d('meta', 'counter');
  const pid = await runTransaction(fs, async tx => {
    const agS = await tx.get(agRef), cS = await tx.get(cRef);
    const ag = data(agS);
    if (agensiDipegang(ag)) throw Object.assign(ralat('BERTINDAN'), { bertindan: ag });
    const n = (cS.exists() ? cS.data().n : 0) + 1, pid = kodTKL(n);
    tx.set(cRef, { n });
    let sejarah = ag?.sejarah || [];
    if (ag && luput(ag)) { // pemegang lama luput → lepaskan
      tx.update(d('permohonan', ag.pid), { status: 'dilepaskan', closedAt: ts(), log: arrayUnion(log(`Dilepaskan – ${CFG.luputHari} hari tiada tindakan`)) });
      sejarah = [...sejarah, entriSejarah(ag, 'dilepaskan')];
    }
    const pRef = d('permohonan', pid);
    tx.set(pRef, {
      uid: me.id, ejenNama: me.nama, ejenKod: me.kodEjen, ejenEmail: me.email,
      namaAgensi: v.namaAgensi, namaSingkat: v.namaSingkat || null, norm, agensiId: aid,
      alamat: v.alamat, telefon: v.telefon, pic: v.pic, email: v.email.toLowerCase(),
      status: 'surat_siap', tarikhSurat: ts(), snapNama: me.nama, snapTelefon: me.telefon,
      emailStatus: null, emailMarkedAt: null, emailVerifiedAt: null, emailVerifiedBy: null, emailIssue: null, emailInfo: null,
      takSebab: null, takNota: null, closedAt: null, taklimat: null, amaran: 0,
      lastActivity: ts(), createdAt: ts(), fu: [], log: [log(`Surat dijana oleh ${me.nama}`)],
    });
    tx.set(d('permohonan', pid, 'rahsia', 'sig'), { signature: me.signature });
    tx.set(agRef, {
      id: aid, norm, nama: v.namaAgensi, pid, uid: me.id, ejenNama: me.nama, ejenKod: me.kodEjen,
      status: 'surat_siap', lastActivity: ts(), emailAt: null, fuCount: 0, createdAt: ts(), sejarah,
    });
    return pid;
  });
  cacheAg = null;
  return pid;
}

export const getPermohonan = async pid => data(await getDoc(d('permohonan', pid)));
export const getSig = async pid => (await getDoc(d('permohonan', pid, 'rahsia', 'sig'))).data()?.signature || null;
export const senaraiSaya = async uid => (await getDocs(query(collection(fs, 'permohonan'), where('uid', '==', uid)))).docs.map(data);
export const senaraiSemua = async () => (await getDocs(collection(fs, 'permohonan'))).docs.map(data);

// Kemas kini permohonan + cermin di dokumen agensi
async function kemas(p, upd, agUpd) {
  const b = writeBatch(fs);
  b.update(d('permohonan', p.id), upd);
  if (agUpd) {
    const ag = await getDoc(d('agensi', p.agensiId));
    if (ag.exists() && ag.data().pid === p.id) b.update(d('agensi', p.agensiId), agUpd);
  }
  await b.commit();
  cacheAg = null;
}

export const dahEmail = p => kemas(p,
  { status: 'dah_email', emailStatus: 'menunggu', emailMarkedAt: ts(), lastActivity: ts(), amaran: 0, log: arrayUnion(log('Ejen tekan Dah Email – menunggu pengesahan CC')) },
  { status: 'dah_email', emailAt: ts(), lastActivity: ts() });

export const followUp = (p, me, v) => kemas(p,
  { fu: arrayUnion({ kali: (p.fu || []).length + 1, cara: v.cara, nota: v.nota, ingat: v.ingat || null, at: kini(), oleh: me.nama, olehUid: me.id }), lastActivity: ts(), amaran: 0 },
  { lastActivity: ts(), fuCount: (p.fu || []).length + 1 });

export function dapatTaklimat(p, t) {
  const baru = p.status === 'dah_email';
  return kemas(p, {
    taklimat: { ...(p.taklimat || {}), ...t },
    ...(baru ? { status: 'dapat_taklimat', closedAt: ts(), lastActivity: ts() } : {}),
    log: arrayUnion(log(`${baru ? 'Dapat taklimat' : 'Butiran taklimat dikemas kini'} – ${t.tarikh.split('-').reverse().join('/')}, ${t.masa}`)),
  }, baru ? { status: 'dapat_taklimat', lastActivity: ts() } : null);
}

export async function takBerjaya(p, sebab, nota) {
  const ag = data(await getDoc(d('agensi', p.agensiId)));
  return kemas(p,
    { status: 'tak_berjaya', takSebab: sebab || null, takNota: nota || null, closedAt: ts(), log: arrayUnion(log(`Tak berjaya${sebab ? ' – ' + sebab : ''}`)) },
    ag ? { status: 'tak_berjaya', sejarah: arrayUnion(entriSejarah(ag, 'tak_berjaya', sebab, nota)) } : null);
}

export const rekodHasil = (p, hadir, closing, nota) => kemas(p,
  { taklimat: { ...p.taklimat, hadir, closing, notaHasil: nota || null, hasilAt: kini() }, status: 'selesai', log: arrayUnion(log(`Hasil taklimat: hadir ${hadir}, closing ${closing}`)) },
  { status: 'selesai' });

export async function janaSemula(p, me) {
  const b = writeBatch(fs);
  b.update(d('permohonan', p.id), { snapNama: me.nama, snapTelefon: me.telefon, tarikhSurat: ts(), log: arrayUnion(log(`Surat dijana semula oleh ${me.nama}`)) });
  b.set(d('permohonan', p.id, 'rahsia', 'sig'), { signature: me.signature });
  await b.commit();
}

// Pemilik buka permohonan yang sudah luput → tandakan dilepaskan
export async function lepasJikaLuput(p) {
  if (!luput(p)) return false;
  const ag = data(await getDoc(d('agensi', p.agensiId)));
  await kemas(p, { status: 'dilepaskan', closedAt: ts(), log: arrayUnion(log(`Dilepaskan – ${CFG.luputHari} hari tiada tindakan`)) },
    ag ? { status: 'dilepaskan', sejarah: arrayUnion(entriSejarah(ag, 'dilepaskan')) } : null);
  return true;
}

// ---------- ADMIN ----------
export const senaraiEjen = async () => (await getDocs(collection(fs, 'users'))).docs.map(data);
const ubahUser = (uid, upd) => updateDoc(d('users', uid), { ...upd, updatedAt: ts() });
export const lulus = (uid, me) => ubahUser(uid, { status: 'aktif', sebab: null, approvedBy: me.nama, approvedAt: ts() });
export const tolak = (uid, sebab) => ubahUser(uid, { status: 'ditolak', sebab });
export const aktifSemula = uid => ubahUser(uid, { status: 'aktif', sebab: null });
export const jadikanAdmin = uid => ubahUser(uid, { role: 'admin' });
export const buangAdmin = uid => ubahUser(uid, { role: 'ejen' });

export async function gantung(u, sebab, ke, me) {
  const perms = (await senaraiSaya(u.id)).filter(p => BOLEH_PINDAH.includes(p.status));
  if (perms.length && !ke) throw ralat('Sila pilih ejen penerima.');
  const b = writeBatch(fs);
  b.update(d('users', u.id), { status: 'digantung', sebab, role: u.role === 'admin' ? 'ejen' : u.role, updatedAt: ts() });
  for (const p of perms) {
    b.update(d('permohonan', p.id), {
      uid: ke.id, ejenNama: ke.nama, ejenKod: ke.kodEjen, ejenEmail: ke.email, lastActivity: ts(), amaran: 0,
      log: arrayUnion(log(`Dipindah dari ${u.nama} (${u.kodEjen}) kepada ${ke.nama} (${ke.kodEjen}) oleh ${me.nama}`)),
    });
    const ag = await getDoc(d('agensi', p.agensiId));
    if (ag.exists() && ag.data().pid === p.id) b.update(d('agensi', p.agensiId), { uid: ke.id, ejenNama: ke.nama, ejenKod: ke.kodEjen, lastActivity: ts() });
  }
  await b.commit();
  cacheAg = null;
  return perms.length;
}

export async function sahkanManual(p, me) {
  await kemas(p, { emailStatus: 'disahkan', emailVerifiedAt: ts(), emailVerifiedBy: me.nama, emailIssue: null, lastActivity: ts(), amaran: 0, log: arrayUnion(log(`Dah Email disahkan manual oleh ${me.nama}`)) },
    { lastActivity: ts() });
}
export const senaraiEmailMasuk = async () => (await getDocs(collection(fs, 'emailMasuk'))).docs.map(data).sort((a, b) => (b.diterima?.seconds || 0) - (a.diterima?.seconds || 0));
export const getEmailMasuk = async id => data(await getDoc(d('emailMasuk', id)));
export const getRobot = async () => data(await getDoc(d('meta', 'robot')));
export const setRobot = uid => setDoc(d('meta', 'robot'), { uid, at: ts() });
