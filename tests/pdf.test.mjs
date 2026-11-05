import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhotoPDF, buildPDF } from '../pdf_v1.03.mjs';

test('PDF xref and stream lengths count binary bytes exactly', async () => {
  const jpeg = new Uint8Array([255, 216, 0, 128, 255, 217]);
  const bytes = new Uint8Array(await buildPDF([jpeg, jpeg], 1275, 1650).arrayBuffer());
  const text = new TextDecoder('latin1').decode(bytes);
  const xref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xref, xref + 4), 'xref');
  const entries = text.slice(xref).split('\n').slice(3, 11);
  entries.forEach((entry, i) => {
    const offset = Number(entry.slice(0, 10));
    assert.ok(text.slice(offset).startsWith(`${i + 1} 0 obj`));
  });
  assert.match(text, /\/Count 2/);
  assert.match(text, /\/MediaBox \[0 0 612 792\]/);
  assert.match(text, /\/DCTDecode \/Length 6/);
});

test('export paginates copies and renders crops with one released canvas', async () => {
  const calls = [];
  const ctx = Object.fromEntries(['fillRect', 'save', 'scale', 'beginPath', 'rect', 'clip', 'translate', 'rotate', 'drawImage', 'restore'].map(name => [name, (...args) => calls.push([name, ...args])]));
  const canvas = {getContext: () => ctx, toBlob: cb => cb(new Blob([new Uint8Array([255, 216, 255, 217])]))};
  globalThis.document = {createElement: () => canvas};
  globalThis.Image = class { async decode() {} };
  const progress = [];
  const blob = await createPhotoPDF([{src: 'blob:local', naturalWidth: 1200, naturalHeight: 800, rotation: 90, scale: 2, offsetX: .5, offsetY: -.5, copies: 3}], {photosPerPage: 2, pageOrientation: 'portrait'}, (...args) => progress.push(args));
  assert.equal(blob.type, 'application/pdf');
  assert.deepEqual(progress, [[0, 2], [1, 2]]);
  assert.equal(calls.filter(call => call[0] === 'drawImage').length, 3);
  assert.equal(calls.find(call => call[0] === 'rotate')[1], Math.PI / 2);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
  assert.match(await blob.text(), /\/Count 2/);
});
