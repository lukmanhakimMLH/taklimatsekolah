// Muat turun SDK Firebase & jsPDF untuk ujian luar talian
import fs from 'node:fs';
const D = new URL('./vendor/', import.meta.url);
fs.mkdirSync(D, { recursive: true });
const F = { 'firebase-app.js': 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js', 'firebase-auth.js': 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'firebase-firestore.js': 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js', 'jspdf.umd.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'pdf-lib.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', 'fontkit.umd.min.js': 'https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js' };
for (const [f, u] of Object.entries(F)) if (!fs.existsSync(new URL(f, D))) fs.writeFileSync(new URL(f, D), Buffer.from(await (await fetch(u)).arrayBuffer()));
