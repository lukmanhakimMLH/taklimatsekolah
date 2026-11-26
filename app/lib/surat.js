// Kandungan surat permohonan + penjana PDF & HTML
const PDFDocument = require('pdfkit');
const C = require('../config');
const { tarikh } = require('./util');

function kandungan(p) {
  const agensi = p.nama_agensi.trim();
  const singkat = (p.nama_singkat || '').trim() || agensi;
  const nama = p.snap_nama, tel = p.snap_telefon;
  const alamat = String(p.alamat).split(/\r?\n|,\s*(?=\d{5})/).map(s => s.trim().replace(/,$/, '')).filter(Boolean);
  return {
    kepala: [C.SYARIKAT, ...C.ALAMAT_SYARIKAT, '', `Telefon : ${tel}`],
    tarikh: `Tarikh : ${tarikh(p.tarikh_surat)}`,
    penerima: [`${p.pic.trim().replace(/,$/, '')},`, `${agensi},`, ...alamat.map((l, i) => i === alamat.length - 1 ? l.replace(/\.?$/, '.') : l + ',')],
    sapaan: 'Tuan dan Puan,',
    tajuk: `PERMOHONAN MENGADAKAN PROGRAM TAKLIMAT PENGURUSAN HARTA PUSAKA & HUTANG SERTA SEMAKAN GAJI KEPADA WARGA ${agensi.toUpperCase()}`,
    blok: [
      { t: 'p', text: 'Assalamualaikum w.b.t. diucapkan dan didoakan semoga tuan dilindungi rahmat Ilahi di samping tugas dan amanah.' },
      { t: 'n', n: '2.', text: `Merujuk kepada perkara di atas, pihak kami ingin memohon kebenaran untuk mengadakan Program Taklimat Pengurusan Harta Pusaka & Hutang serta Semakan Gaji kepada kakitangan ${agensi}. ${C.RAKAN_KONGSI}` },
      { t: 'p', text: 'Objektif pelaksanaan program ini adalah untuk:' },
      { t: 'b', items: [
        `Membantu warga ${singkat} memahami kepentingan pengurusan harta pusaka, wasiat dan hibah.`,
        'Memberi kesedaran tentang pengurusan hutang serta kesan hutang tertunggak kepada waris dan pembahagian harta pusaka.',
        `Membantu warga ${singkat} membuat semakan potongan gaji (SPGA) supaya setiap potongan melalui Biro Angkasa difahami dengan jelas.`,
        `Membantu warga ${singkat} menyediakan dana yang cukup sekiranya berlaku risiko kematian atau hilang upaya kekal, dengan cara yang lebih sistematik, berdisiplin dan pada kadar yang berpatutan.`,
      ] },
      { t: 'p', text: `Kejayaan program ini berupaya membantu warga ${singkat} mengurus kewangan dengan lebih teratur, merancang harta untuk waris dan bersedia sekiranya berlaku risiko kematian atau hilang upaya kekal.` },
      { t: 'n', n: '3.', text: `Pihak kami bersedia mengadakan sesi penerangan kepada warga ${singkat} di tempat yang dianggap sesuai oleh pihak tuan. Pihak tuan boleh menghubungi saya, ${nama}, di talian ${tel}. Saya berjanji akan mematuhi segala SOP yang telah ditetapkan oleh pihak kerajaan.` },
      { t: 'n', n: '4.', text: 'Segala kerjasama dan perhatian yang diberikan tuan/puan dalam perkara ini amatlah kami sanjung tinggi dan diakhiri dengan ucapan ribuan terima kasih.' },
    ],
    penutup: 'Yang Menjalankan Tugas,',
    signature: p.snap_signature,
    nama: `Nama : ${nama}`,
    jawatan: C.JAWATAN_EJEN,
  };
}

function namaFail(p) {
  const s = (p.nama_singkat || p.nama_agensi).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `Surat_Taklimat_${s}.pdf`;
}

function pdf(p, stream) {
  const k = kandungan(p);
  const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 50, left: 62, right: 62 }, info: { Title: `Surat Permohonan Taklimat – ${p.nama_agensi}` } });
  doc.pipe(stream);
  const L = 62, W = doc.page.width - 124, FS = 10.2, GAP = 7;
  doc.font('Helvetica').fontSize(FS);

  // Kepala (kanan)
  const kx = L + W * 0.6, kw = W * 0.4;
  k.kepala.forEach((l, i) => {
    doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').text(l || ' ', kx, undefined, { width: kw });
  });
  doc.moveDown(1.4);
  doc.font('Helvetica').text(k.tarikh, L, undefined, { width: W });
  doc.moveDown(0.8);
  k.penerima.forEach(l => doc.text(l, L, undefined, { width: W }));
  doc.moveDown(0.8);
  doc.text(k.sapaan, L);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').text(k.tajuk, L, undefined, { width: W, align: 'justify' });
  doc.font('Helvetica').moveDown(0.6);

  for (const b of k.blok) {
    if (b.t === 'p') doc.text(b.text, L, undefined, { width: W, align: 'justify' });
    if (b.t === 'n') {
      const y = doc.y;
      doc.text(b.n, L, y);
      doc.text(b.text, L + 28, y, { width: W - 28, align: 'justify' });
    }
    if (b.t === 'b') {
      for (const it of b.items) {
        const y = doc.y;
        doc.text('-', L + 30, y);
        doc.text(it, L + 44, y, { width: W - 44, align: 'justify' });
        doc.moveDown(0.15);
      }
    }
    doc.y += GAP;
  }
  doc.moveDown(0.4);
  doc.text(k.penutup, L);
  const sy = doc.y + 4;
  if (k.signature && k.signature.startsWith('data:image/')) {
    try {
      const buf = Buffer.from(k.signature.split(',')[1], 'base64');
      doc.image(buf, L, sy, { fit: [150, 55] });
    } catch (e) { /* abaikan tandatangan rosak */ }
  }
  doc.y = sy + 60;
  doc.text(k.nama, L);
  doc.text(k.jawatan, L);
  doc.end();
}

function html(p, esc) {
  const k = kandungan(p);
  const e = esc;
  return `<div class="surat">
  <div class="s-kepala">${k.kepala.map((l, i) => i === 0 ? `<b>${e(l)}</b>` : (l ? e(l) : '&nbsp;')).join('<br>')}</div>
  <p>${e(k.tarikh)}</p>
  <p>${k.penerima.map(e).join('<br>')}</p>
  <p>${e(k.sapaan)}</p>
  <p><b>${e(k.tajuk)}</b></p>
  ${k.blok.map(b => b.t === 'p' ? `<p>${e(b.text)}</p>` : b.t === 'n' ? `<p class="s-n"><span>${b.n}</span>${e(b.text)}</p>` : `<ul>${b.items.map(i => `<li>${e(i)}</li>`).join('')}</ul>`).join('\n')}
  <p>${e(k.penutup)}</p>
  <div class="s-sign">${k.signature ? `<img src="${k.signature}" alt="Tandatangan">` : ''}</div>
  <p>${e(k.nama)}<br>${e(k.jawatan)}</p>
</div>`;
}

function rangkaEmail(p) {
  const { kodTKL } = require('./util');
  const subjek = `[${kodTKL(p.id)}] Permohonan Program Taklimat Pengurusan Harta Pusaka & Hutang – ${p.nama_singkat || p.nama_agensi}`;
  const isi = `Assalamualaikum w.b.t. dan salam sejahtera,

Tuan/Puan,

Dengan hormatnya, dilampirkan surat permohonan untuk mengadakan Program Taklimat Pengurusan Harta Pusaka & Hutang serta Semakan Gaji kepada warga ${p.nama_agensi} untuk pertimbangan pihak tuan/puan.

Sebarang pertanyaan boleh hubungi saya di talian ${p.snap_telefon}.

Sekian, terima kasih.

${p.snap_nama}
${C.JAWATAN_EJEN}
${C.SYARIKAT}`;
  return { kepada: p.email, cc: C.CC_EMAIL, subjek, isi };
}

module.exports = { pdf, html, namaFail, rangkaEmail };
