process.env.TZ = process.env.TZ || 'Asia/Kuala_Lumpur';
try { require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split('\n').forEach(l => { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); } catch (e) { /* tiada .env */ }

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const C = require('./config');
const { one, run } = require('./db');
const { layout } = require('./lib/views');

const app = express();
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use(cookieSession({ name: 'tkl', secret: C.SESSION_SECRET, maxAge: 30 * 24 * 3600 * 1000, sameSite: 'lax', httpOnly: true }));

// Muat pengguna + bantuan render
app.use((req, res, next) => {
  req.user = req.session.uid ? one('SELECT * FROM users WHERE id=?', req.session.uid) : null;
  if (req.session.uid && !req.user) req.session = null;
  res.flash = (msg, type) => { req.session.flash = { msg, type }; };
  res.page = (opts) => {
    const flash = req.session && req.session.flash; if (flash) delete req.session.flash;
    const unread = req.user ? one('SELECT COUNT(*) n FROM notifikasi WHERE user_id=? AND dibaca=0', req.user.id).n : 0;
    res.send(layout({ ...opts, user: req.user, flash, unread }));
  };
  next();
});

app.use(require('./routes/auth'));
app.use(require('./routes/ejen'));
app.use(require('./routes/permohonan'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => { res.status(404); res.page({ title: 'Tidak dijumpai', back: '/', body: '<div class="empty">Halaman tidak dijumpai.</div>' }); });
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500); res.page({ title: 'Ralat', back: '/', body: `<div class="empty">Maaf, berlaku ralat. Sila cuba lagi.</div>` });
});

if (require.main === module) {
  app.listen(C.PORT, () => console.log(`Apps taklimat berjalan di http://localhost:${C.PORT}`));
  require('./lib/jobs').start();
}
module.exports = app;
