// Kandungan surat permohonan, penjana PDF (jsPDF) & HTML, rangka email
import { CFG, tarikh, esc } from './util.js';

export function kandungan(p, signature) {
  const agensi = p.namaAgensi.trim();
  const singkat = (p.namaSingkat || '').trim() || agensi;
  const nama = p.snapNama, tel = p.snapTelefon;
  const alamat = String(p.alamat).split(/\r?\n/).map(s => s.trim().replace(/,$/, '')).filter(Boolean);
  return {
    kepala: [CFG.syarikat, ...CFG.alamatSyarikat, '', `Telefon : ${tel}`],
    tarikh: `Tarikh : ${tarikh(p.tarikhSurat)}`,
    penerima: [`${p.pic.trim().replace(/,$/, '')},`, `${agensi},`, ...alamat.map((l, i) => i === alamat.length - 1 ? l.replace(/\.?$/, '.') : l + ',')],
    sapaan: 'Tuan dan Puan,',
    tajuk: `PERMOHONAN MENGADAKAN PROGRAM TAKLIMAT PENGURUSAN HARTA PUSAKA & HUTANG SERTA SEMAKAN GAJI KEPADA WARGA ${agensi.toUpperCase()}`,
    blok: [
      { t: 'p', text: 'Assalamualaikum w.b.t. diucapkan dan didoakan semoga tuan dilindungi rahmat Ilahi di samping tugas dan amanah.' },
      { t: 'n', n: '2.', text: `Merujuk kepada perkara di atas, pihak kami ingin memohon kebenaran untuk mengadakan Program Taklimat Pengurusan Harta Pusaka & Hutang serta Semakan Gaji kepada kakitangan ${agensi}. ${CFG.rakanKongsi}` },
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
    signature,
    nama: `Nama : ${nama}`,
    jawatan: CFG.jawatanEjen,
  };
}

export function namaFail(p) {
  const s = (p.namaSingkat || p.namaAgensi).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `Surat_Taklimat_${s}.pdf`;
}

export function pdf(p, signature) {
  const k = kandungan(p, signature);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setProperties({ title: `Surat Permohonan Taklimat – ${p.namaAgensi}` });
  const L = 62, W = doc.internal.pageSize.getWidth() - 124, FS = 10.2, LH = FS * 1.2, GAP = 7;
  doc.setFontSize(FS); doc.setFont('helvetica', 'normal'); doc.setLineHeightFactor(1.2);
  let y = 56;
  const tulis = (text, x, w, opt = {}) => {
    const lines = doc.splitTextToSize(text, w);
    if (opt.justify && lines.length > 1) {
      lines.forEach((ln, i) => doc.text(ln, x, y + i * LH, i < lines.length - 1 ? { maxWidth: w, align: 'justify', baseline: 'top' } : { baseline: 'top' }));
    } else doc.text(lines, x, y, { baseline: 'top' });
    return lines.length * LH;
  };
  // Kepala (kanan)
  const kx = L + W * 0.6;
  k.kepala.forEach((l, i) => { doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); y += l ? tulis(l, kx, W * 0.4) : LH; });
  doc.setFont('helvetica', 'normal');
  y += LH * 1.4;
  y += tulis(k.tarikh, L, W) + LH * 0.8;
  k.penerima.forEach(l => { y += tulis(l, L, W); });
  y += LH * 0.8;
  y += tulis(k.sapaan, L, W) + LH * 0.6;
  doc.setFont('helvetica', 'bold'); y += tulis(k.tajuk, L, W, { justify: true }) + LH * 0.6; doc.setFont('helvetica', 'normal');
  for (const b of k.blok) {
    if (b.t === 'p') y += tulis(b.text, L, W, { justify: true });
    if (b.t === 'n') { doc.text(b.n, L, y, { baseline: 'top' }); y += tulis(b.text, L + 28, W - 28, { justify: true }); }
    if (b.t === 'b') for (const it of b.items) { doc.text('-', L + 30, y, { baseline: 'top' }); y += tulis(it, L + 44, W - 44, { justify: true }) + 2; }
    y += GAP;
  }
  y += LH * 0.4;
  y += tulis(k.penutup, L, W);
  if (k.signature && k.signature.startsWith('data:image/')) {
    try {
      const pr = doc.getImageProperties(k.signature);
      const sc = Math.min(150 / pr.width, 55 / pr.height);
      doc.addImage(k.signature, 'PNG', L, y + 4, pr.width * sc, pr.height * sc, undefined, 'FAST');
    } catch (e) { /* abaikan */ }
  }
  y += 64;
  y += tulis(k.nama, L, W);
  tulis(k.jawatan, L, W);
  return doc;
}

export function html(p, signature) {
  const k = kandungan(p, signature);
  return `<div class="surat">
  <div class="s-kepala">${k.kepala.map((l, i) => i === 0 ? `<b>${esc(l)}</b>` : (l ? esc(l) : '&nbsp;')).join('<br>')}</div>
  <p>${esc(k.tarikh)}</p>
  <p>${k.penerima.map(esc).join('<br>')}</p>
  <p>${esc(k.sapaan)}</p>
  <p><b>${esc(k.tajuk)}</b></p>
  ${k.blok.map(b => b.t === 'p' ? `<p>${esc(b.text)}</p>` : b.t === 'n' ? `<p class="s-n"><span>${b.n}</span>${esc(b.text)}</p>` : `<ul>${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`).join('\n')}
  <p>${esc(k.penutup)}</p>
  <div class="s-sign">${k.signature ? `<img src="${k.signature}" alt="Tandatangan">` : ''}</div>
  <p>${esc(k.nama)}<br>${esc(k.jawatan)}</p>
</div>`;
}

export function rangkaEmail(p) {
  const subjek = `[${p.id}] Permohonan Program Taklimat Pengurusan Harta Pusaka & Hutang – ${p.namaSingkat || p.namaAgensi}`;
  const isi = `Assalamualaikum w.b.t. dan salam sejahtera,

Tuan/Puan,

Dengan hormatnya, dilampirkan surat permohonan untuk mengadakan Program Taklimat Pengurusan Harta Pusaka & Hutang serta Semakan Gaji kepada warga ${p.namaAgensi} untuk pertimbangan pihak tuan/puan.

Sebarang pertanyaan boleh hubungi saya di talian ${p.snapTelefon}.

Sekian, terima kasih.

${p.snapNama}
${CFG.jawatanEjen}
${CFG.syarikat}`;
  return { kepada: p.email, cc: CFG.ccEmail, subjek, isi };
}
