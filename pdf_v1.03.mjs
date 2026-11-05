import { layoutGeometry, paginate, expandCopies, cropGeometry } from './geometry_v1.00.mjs';

// Small, dependency-free PDF writer. JPEG bytes stay binary; offsets count bytes,
// not JS characters. One reusable canvas bounds raster memory on older iPads.
export async function createPhotoPDF(photos, layout, onProgress = () => {}) {
  const g = layoutGeometry(layout.photosPerPage, layout.pageOrientation);
  const groups = paginate(expandCopies(photos), layout.photosPerPage);
  if (!groups.length) throw new Error('Choose photos first.');
  const dpi = 150;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(g.width * dpi);
  canvas.height = Math.round(g.height * dpi);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF preparation is unavailable.');
  const pages = [];
  try {
    for (const [pageIndex, group] of groups.entries()) {
      onProgress(pageIndex, groups.length);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const [slot, photo] of group.entries()) {
        const image = new Image();
        image.src = photo.src;
        await image.decode();
        const x = g.margin + (slot % g.columns) * (g.cellWidth + g.gap);
        const y = g.margin + Math.floor(slot / g.columns) * (g.cellHeight + g.gap);
        const crop = cropGeometry(photo, g.cellWidth, g.cellHeight);
        ctx.save();
        ctx.scale(dpi, dpi);
        ctx.beginPath();
        ctx.rect(x, y, g.cellWidth, g.cellHeight);
        ctx.clip();
        ctx.translate(x + g.cellWidth / 2 + crop.x, y + g.cellHeight / 2 + crop.y);
        ctx.rotate(photo.rotation * Math.PI / 180);
        ctx.drawImage(image, -crop.width / 2, -crop.height / 2, crop.width, crop.height);
        ctx.restore();
      }
      const jpeg = await new Promise((resolve, reject) => canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Could not prepare PDF page.')),
        'image/jpeg', 0.9,
      ));
      pages.push(new Uint8Array(await jpeg.arrayBuffer()));
      // Let the progress card paint between sheets.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return buildPDF(pages, canvas.width, canvas.height, g.width * 72, g.height * 72);
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export function buildPDF(jpegs, pixelWidth, pixelHeight, width = 612, height = 792) {
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [0];
  let length = 0;
  const append = value => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id, value) => {
    offsets[id] = length;
    append(`${id} 0 obj\n${value}\nendobj\n`);
  };
  append('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Count ${jpegs.length} /Kids [${jpegs.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`);
  jpegs.forEach((jpeg, i) => {
    const id = 3 + i * 3;
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Photo ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`);
    const commands = `q\n${width} 0 0 ${height} 0 0 cm\n/Photo Do\nQ\n`;
    object(id + 1, `<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}endstream`);
    offsets[id + 2] = length;
    append(`${id + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    append(jpeg);
    append('\nendstream\nendobj\n');
  });
  const xref = length;
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) append(`${String(offset).padStart(10, '0')} 00000 n \n`);
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
