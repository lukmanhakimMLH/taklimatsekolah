// Kawalan akses
const isAdmin = u => u && ['admin', 'admin_utama'].includes(u.role) && u.status === 'aktif';

function login(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}
function aktif(req, res, next) {
  if (!req.user) return res.redirect('/login');
  const s = req.user.status;
  if (s === 'profil') return res.redirect('/profil');
  if (s !== 'aktif') return res.redirect('/menunggu');
  next();
}
function admin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (!isAdmin(req.user)) { res.status(403); return res.page({ title: 'Tiada akses', back: '/dashboard', body: '<div class="empty">Halaman ini untuk admin sahaja.</div>' }); }
  next();
}
module.exports = { login, aktif, admin, isAdmin };
