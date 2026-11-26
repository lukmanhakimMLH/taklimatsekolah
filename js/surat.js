// Pakej permohonan: surat (jsPDF) + kertas kerja (templat PDF diisi dengan pdf-lib) + lampiran sokongan
import { CFG, tarikh, toDate, esc, alamatSebaris } from './util.js';

const BULAN_PENUH = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const tarikhPanjang = t => { const d = toDate(t) || new Date(); return `${d.getDate()} ${BULAN_PENUH[d.getMonth()]} ${d.getFullYear()}`; };
export const PANGGILAN = ['Tuan', 'Puan', 'Tuan/Puan'];

export function kandungan(p, signature) {
  const agensi = p.namaAgensi.trim();
  const singkat = (p.namaSingkat || '').trim() || agensi;
  const nama = p.snapNama, tel = p.snapTelefon;
  const pg = PANGGILAN.includes(p.panggilan) ? p.panggilan : 'Tuan/Puan';
  const t = pg.toLowerCase();
  const alamat = String(p.alamat).split(/\r?\n/).map(s => s.trim().replace(/,$/, '')).filter(Boolean);
  return {
    kepala: [CFG.syarikat, ...CFG.alamatSyarikat],
    telefon: `Telefon : ${tel}`,
    tarikh: `Tarikh : ${tarikh(p.tarikhSurat)}`,
    penerima: [
      { t: `${p.pic.trim().replace(/,$/, '')},` },
      ...(p.picNama ? [{ t: p.picNama.trim(), b: true }] : []),
      { t: `${agensi},` },
      ...alamat.map((l, i) => ({ t: i === alamat.length - 1 ? l.replace(/\.?$/, '.') : l + ',' })),
    ],
    sapaan: `${pg},`,
    tajuk: `PERMOHONAN MENGADAKAN PROGRAM TAKLIMAT PENGURUSAN HARTA PUSAKA & HUTANG KEPADA WARGA ${agensi.toUpperCase()}`,
    blok: [
      { t: 'p', text: `Assalamualaikum w.b.t. diucapkan dan didoakan semoga ${t} dilindungi rahmat Ilahi di samping tugas dan amanah.` },
      { t: 'n', n: '2.', text: `Merujuk kepada perkara di atas, pihak kami ingin memohon kebenaran untuk mengadakan Program Taklimat Pengurusan Harta Pusaka & Hutang kepada warga kerja ${agensi}. ${CFG.rakanKongsi}` },
      { t: 'p', text: 'Objektif pelaksanaan program ini adalah untuk:' },
      { t: 'b', items: [
        `Membantu warga ${singkat} memahami kepentingan pengurusan harta pusaka, wasiat dan hibah.`,
        'Memberi kesedaran tentang pengurusan hutang serta kesan hutang tertunggak kepada waris dan pembahagian harta pusaka.',
        `Membantu warga ${singkat} membuat semakan potongan gaji (SPGA) supaya setiap potongan melalui Biro Angkasa difahami dengan jelas.`,
        `Membantu warga ${singkat} menyediakan dana yang cukup sekiranya berlaku risiko kematian atau hilang upaya kekal, dengan cara yang lebih sistematik, berdisiplin dan pada kadar yang berpatutan.`,
      ] },
      { t: 'p', text: `Kejayaan program ini berupaya membantu warga ${singkat} mengurus kewangan dengan lebih teratur, merancang harta untuk waris dan bersedia sekiranya berlaku risiko kematian atau hilang upaya kekal.` },
      { t: 'n', n: '3.', text: `Pihak kami bersedia mengadakan sesi penerangan kepada warga ${singkat} di tempat yang dianggap sesuai oleh pihak ${t}. Pihak ${t} boleh menghubungi saya, ${nama}, di talian ${tel}. Saya berjanji akan mematuhi segala SOP yang telah ditetapkan oleh pihak kerajaan.` },
      { t: 'n', n: '4.', text: `Segala kerjasama dan perhatian yang diberikan ${t} dalam perkara ini amatlah kami sanjung tinggi dan diakhiri dengan ucapan ribuan terima kasih.` },
    ],
    penutup: 'Yang Menjalankan Tugas,',
    signature,
    nama: `Nama : ${nama}`,
    jawatan: CFG.jawatanEjen,
  };
}

export function namaFail(p) {
  const s = p.namaAgensi.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${s}.pdf`;
}

// ---------- aset (logo, fon, templat) ----------
const cache = {};
const BASE = new URL('../aset/', import.meta.url);
async function aset(nama) {
  if (!cache[nama]) cache[nama] = fetch(new URL(nama, BASE)).then(r => { if (!r.ok) throw new Error('Gagal muat ' + nama); return r.arrayBuffer(); });
  return cache[nama];
}
async function dataUrl(nama) {
  const k = nama + 'url';
  if (!cache[k]) cache[k] = aset(nama).then(b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(new Blob([b], { type: nama.endsWith('.png') ? 'image/png' : 'image/jpeg' })); }));
  return cache[k];
}

// ---------- 1. SURAT (jsPDF) ----------
async function suratPdf(p, signature) {
  const k = kandungan(p, signature);
  const [logo, wm, rnk] = await Promise.all([dataUrl('qaizer-kotak.jpg'), dataUrl('myangkasa-wm.png'), dataUrl('myangkasa-rnk.png')]);
  const lukis = FS => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const L = 54, W = 595.28 - 108, LH = FS * 1.42, GAP = FS * 0.75;
    doc.setLineHeightFactor(1.42);
    // tera air
    doc.setGState(new doc.GState({ opacity: 0.35 }));
    doc.addImage(wm, 'PNG', 130, 390, 335, 335 * 447 / 1208, 'wm', 'FAST');
    doc.setGState(new doc.GState({ opacity: 1 }));
    // kepala
    doc.addImage(logo, 'JPEG', L, 30, 68, 68, 'logo', 'FAST');
    let y = 30;
    const kx = 436;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text(k.kepala[0], kx, y, { baseline: 'top' }); y += 12.5;
    doc.setFont('helvetica', 'normal'); k.kepala.slice(1).forEach(l => { doc.text(l, kx, y, { baseline: 'top' }); y += 12.5; });
    y += 6; doc.setFont('times', 'normal'); doc.setFontSize(10); doc.text(k.telefon, kx, y, { baseline: 'top' });
    doc.setDrawColor(200, 16, 46); doc.setLineWidth(0.8); doc.line(L, 112, L + W, 112);
    // badan
    doc.setTextColor(20, 20, 20); doc.setFontSize(FS); doc.setFont('helvetica', 'normal');
    y = 128;
    // rata kiri-kanan (justify) secara manual
    const baris = (ln, x, yy, w, justify) => {
      const words = ln.split(' ').filter(Boolean);
      if (!justify || words.length < 2) { doc.text(ln, x, yy, { baseline: 'top' }); return doc.getTextWidth(ln); }
      const tot = words.reduce((a, wd) => a + doc.getTextWidth(wd), 0), gap = (w - tot) / (words.length - 1);
      let cx = x; words.forEach(wd => { doc.text(wd, cx, yy, { baseline: 'top' }); cx += doc.getTextWidth(wd) + gap; });
      return w;
    };
    const tulis = (text, x, w, opt = {}) => {
      const lines = doc.splitTextToSize(text, w);
      lines.forEach((ln, i) => {
        const lw = baris(ln, x, y + i * LH, w, opt.justify && i < lines.length - 1);
        if (opt.underline) { doc.setLineWidth(0.6); doc.setDrawColor(20, 20, 20); doc.line(x, y + i * LH + FS + 0.6, x + lw, y + i * LH + FS + 0.6); }
      });
      return lines.length * LH;
    };
    y += tulis(k.tarikh, L, W) + GAP * 1.4;
    k.penerima.forEach(r => { doc.setFont('helvetica', r.b ? 'bold' : 'normal'); y += tulis(r.t, L, W); });
    doc.setFont('helvetica', 'bold'); y += GAP * 1.4; y += tulis(k.sapaan, L, W) + GAP * 1.4;
    y += tulis(k.tajuk, L, W, { justify: true, underline: true }) + GAP * 1.4;
    doc.setFont('helvetica', 'normal');
    for (const b of k.blok) {
      if (b.t === 'p') y += tulis(b.text, L, W, { justify: true });
      if (b.t === 'n') { doc.text(b.n, L, y, { baseline: 'top' }); y += tulis(b.text, L + 31, W - 31, { justify: true }); }
      if (b.t === 'b') b.items.forEach((it, i) => { doc.text('-', L + 33, y, { baseline: 'top' }); y += tulis(it, L + 51, W - 51, { justify: true }) + (i < b.items.length - 1 ? 3 : 0); });
      y += GAP * 1.4;
    }
    y += GAP * 0.6;
    y += tulis(k.penutup, L, W);
    const sy = y + 2;
    if (k.signature && k.signature.startsWith('data:image/')) {
      try { const pr = doc.getImageProperties(k.signature); const sc = Math.min(165 / pr.width, 48 / pr.height); doc.addImage(k.signature, 'PNG', L, sy, pr.width * sc, pr.height * sc, 'sig', 'FAST'); } catch (e) { /* abaikan */ }
    }
    y = sy + 50;
    doc.setLineDashPattern([2, 1.5], 0); doc.setLineWidth(0.6); doc.setDrawColor(60, 60, 60); doc.line(L, y, L + 165, y); doc.setLineDashPattern([], 0);
    y += 6; y += tulis(k.nama, L, W); tulis(k.jawatan, L, W);
    doc.addImage(rnk, 'PNG', 376, sy + 8, 165, 165 * 157 / 421, 'rnk', 'FAST');
    return { doc, akhir: y + LH };
  };
  let r = lukis(9.8);
  for (const fs of [9.4, 9, 8.6]) { if (r.akhir <= 812) break; r = lukis(fs); }
  return r.doc;
}

// ---------- 2. KERTAS KERJA (isi templat) & 3. LAMPIRAN ----------
function balut(teks, font, size, w) {
  const out = [];
  for (const para of String(teks).split('\n')) {
    let cur = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = cur ? cur + ' ' + word : word;
      if (font.widthOfTextAtSize(t, size) <= w || !cur) cur = t; else { out.push(cur); cur = word; }
    }
    out.push(cur);
  }
  return out;
}

export async function pakej(p, signature) {
  const { PDFDocument, rgb } = window.PDFLib;
  const { StandardFonts } = window.PDFLib;
  const [surat, tplBuf, posBuf, lampBuf, fLora] = await Promise.all([
    suratPdf(p, signature), aset('kertas-kerja.pdf'), aset('kertas-kerja.json'), aset('lampiran.pdf'), aset('fon/Lora-Regular.ttf'),
  ]);
  const pos = JSON.parse(new TextDecoder().decode(posBuf));
  const kk = await PDFDocument.load(tplBuf);
  kk.registerFontkit(window.fontkit);
  const lora = await kk.embedFont(fLora, { subset: true });
  const [inter, interB] = await Promise.all([kk.embedFont(StandardFonts.Helvetica), kk.embedFont(StandardFonts.HelveticaBold)]);
  const interSB = interB;
  const pages = kk.getPages();
  const MAROON = rgb(0.478, 0.039, 0.118), RED = rgb(0.784, 0.063, 0.18), GREY = rgb(0.373, 0.38, 0.408), INK = rgb(0.114, 0.114, 0.122);
  const tulis = (key, lines, opt) => {
    const b = pos[key], pg = pages[b.page], H = pg.getHeight();
    let top = b.top + (opt.dy || 0);
    for (const ln of lines) {
      const w = opt.font.widthOfTextAtSize(ln, opt.size);
      const x = opt.right ? b.x + b.w - w : b.x;
      pg.drawText(ln, { x, y: H - top - opt.size * 0.82, size: opt.size, font: opt.font, color: opt.color });
      top += opt.lh;
    }
    return top - b.top;
  };
  // kulit: dicadangkan kepada
  const bk = pos.kepada;
  let dy = 0;
  const besar = [p.picNama, p.pic].filter(Boolean).map(s => s.trim().replace(/,$/, ''));
  for (const s of besar) dy = tulis('kepada', balut(s, lora, 11.5, bk.w), { font: lora, size: 11.5, lh: 15.5, color: MAROON, dy });
  dy += 2;
  tulis('kepada', balut(`${p.namaAgensi}, ${alamatSebaris(p.alamat)}`, inter, 7.4, bk.w).slice(0, 3), { font: inter, size: 7.4, lh: 10.5, color: GREY, dy });
  // kulit: disediakan oleh
  tulis('sediaNama', balut(p.snapNama, interB, 7.4, pos.sediaNama.w), { font: interB, size: 7.4, lh: 10.5, color: MAROON, right: true });
  // halaman akhir: tandatangan, nama, tarikh
  if (signature && signature.startsWith('data:image/png')) {
    const img = await kk.embedPng(signature), b = pos.tandatangan, pg = pages[b.page];
    const sc = Math.min(b.w / img.width, (b.h - 2) / img.height);
    pg.drawImage(img, { x: b.x, y: pg.getHeight() - b.top - b.h + 2, width: img.width * sc, height: img.height * sc });
  }
  tulis('sediaNama2', balut(p.snapNama, interSB, 8.1, pos.sediaNama2.w), { font: interSB, size: 8.1, lh: 11.5, color: INK });
  tulis('tarikh', [tarikhPanjang(p.tarikhSurat)], { font: interSB, size: 8.1, lh: 11.5, color: INK });

  // gabung
  const out = await PDFDocument.create();
  out.setTitle(`Permohonan Taklimat – ${p.namaAgensi}`);
  out.setAuthor(p.snapNama);
  const sur = await PDFDocument.load(surat.output('arraybuffer'));
  const lamp = await PDFDocument.load(lampBuf);
  for (const src of [sur, kk, lamp]) (await out.copyPages(src, src.getPageIndices())).forEach(pg => out.addPage(pg));
  return out.save();
}

// ---------- pratonton HTML surat ----------
export function html(p, signature) {
  const k = kandungan(p, signature);
  return `<div class="surat">
  <div class="s-top"><img src="aset/qaizer-kotak.jpg" alt="" class="s-logo"><div class="s-kepala">${k.kepala.map((l, i) => i === 0 ? `<b>${esc(l)}</b>` : esc(l)).join('<br>')}<br><span class="s-tel">${esc(k.telefon)}</span></div></div>
  <p>${esc(k.tarikh)}</p>
  <p>${k.penerima.map(r => r.b ? `<b>${esc(r.t)}</b>` : esc(r.t)).join('<br>')}</p>
  <p><b>${esc(k.sapaan)}</b></p>
  <p><b><u>${esc(k.tajuk)}</u></b></p>
  ${k.blok.map(b => b.t === 'p' ? `<p>${esc(b.text)}</p>` : b.t === 'n' ? `<p class="s-n"><span>${b.n}</span>${esc(b.text)}</p>` : `<ul>${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`).join('\n')}
  <p>${esc(k.penutup)}</p>
  <div class="s-bawah"><div><div class="s-sign">${k.signature ? `<img src="${k.signature}" alt="Tandatangan">` : ''}</div>
  <p>${esc(k.nama)}<br>${esc(k.jawatan)}</p></div><img src="aset/myangkasa-rnk.png" alt="" class="s-rnk"></div>
</div>
<div class="alert warn small" style="margin-top:10px">📎 PDF yang dimuat turun mengandungi: <b>surat ini</b> + <b>kertas kerja cadangan (6 muka surat)</b> + <b>surat sokongan MyAngkasa &amp; ANGKASA</b>.</div>`;
}

export function rangkaEmail(p) {
  const subjek = `[${p.id}] Permohonan Program Taklimat Pengurusan Harta Pusaka & Hutang – ${p.namaSingkat || p.namaAgensi}`;
  const pg = (PANGGILAN.includes(p.panggilan) ? p.panggilan : 'Tuan/Puan');
  const isi = `Assalamualaikum w.b.t. dan salam sejahtera,

${pg},

Dengan hormatnya, dilampirkan surat permohonan beserta kertas kerja cadangan untuk mengadakan Program Taklimat Pengurusan Harta Pusaka & Hutang kepada warga kerja ${p.namaAgensi} untuk pertimbangan pihak ${pg.toLowerCase()}.

Sebarang pertanyaan boleh hubungi saya di talian ${p.snapTelefon}.

Sekian, terima kasih.

${p.snapNama}
${CFG.jawatanEjen}
${CFG.syarikat}`;
  return { kepada: p.email, cc: CFG.ccEmail, subjek, isi };
}
