/* PDF テキスト抽出（#13）
   使い方（アプリ側から）:
     POST /api/pdf  body { base64 }  … 'data:application/pdf;base64,...' 形式も可
   応答: { ok, pages, chars, text[, truncated] }
   - デコード後 4MB まで（超えたら 413）。text は 100000 字まで。
   - pdfjs-dist（v4 の legacy build）を動的 import して Node 上で読みます。
   - 注意: Vercel の関数はリクエスト本文が約4.5MBまでのため、base64 化で膨らむ分、
     実際に受け取れる PDF は 3MB 強までになります。 */
'use strict';
const { sendJson, readBody } = require('./_fb');

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 100000;

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
}

/* base64 の PDF からテキストを取り出す（api/health/report.js の #188 でも使う）。
   戻り値: 成功 { ok:true, pages, chars, text[, truncated] }、
           失敗 { ok:false, status, error[, detail] }（status は HTTP のつもりの数字） */
async function extractPdfText(b64raw) {
  let b64 = typeof b64raw === 'string' ? b64raw.trim() : '';
  const m = b64.match(/^data:[^,]*;base64,/i);
  if (m) b64 = b64.slice(m[0].length);
  if (!b64) return { ok: false, status: 400, error: 'base64 is required' };

  /* 先に長さから概算して、明らかに大きいものはデコードせずに断る */
  if (Math.floor(b64.length * 3 / 4) > MAX_BYTES + 3) return { ok: false, status: 413, error: 'PDFが大きすぎます（4MBまで）' };
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) return { ok: false, status: 400, error: 'base64 is empty' };
  if (buf.length > MAX_BYTES) return { ok: false, status: 413, error: 'PDFが大きすぎます（4MBまで）' };

  let pdfjs;
  try {
    pdfjs = await loadPdfjs();
  } catch (e) {
    pdfjsPromise = null;
    return { ok: false, status: 500, error: 'pdfjs-dist を読み込めませんでした', detail: String((e && e.message) || e).slice(0, 200) };
  }

  const params = { data: new Uint8Array(buf.buffer, buf.byteOffset, buf.length), useSystemFonts: false };
  try {
    const path = require('path');
    const pkgDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
    params.standardFontDataUrl = path.join(pkgDir, 'standard_fonts') + '/';
  } catch (e) { /* 解決できなければ指定なしで続ける */ }

  let doc = null;
  try {
    doc = await pdfjs.getDocument(params).promise;
    const texts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      texts.push(tc.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : '')).join(''));
      page.cleanup();
    }
    const text = texts.join('\n');
    const out = { ok: true, pages: doc.numPages, chars: text.length, text };
    if (text.length > MAX_TEXT) {
      out.text = text.slice(0, MAX_TEXT);
      out.truncated = true;
    }
    return out;
  } catch (e) {
    return { ok: false, status: 422, error: 'PDFとして読めませんでした', detail: String((e && e.message) || e).slice(0, 200) };
  } finally {
    if (doc) { try { await doc.destroy(); } catch (e) { /* 無視 */ } }
  }
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });

  const body = await readBody(req);
  const r = await extractPdfText(typeof body.base64 === 'string' ? body.base64 : '');
  if (!r.ok) {
    const out = { error: r.error };
    if (r.detail) out.detail = r.detail;
    return sendJson(res, r.status || 500, out);
  }
  const out = { ok: true, pages: r.pages, chars: r.chars, text: r.text };
  if (r.truncated) out.truncated = true;
  return sendJson(res, 200, out);
}

module.exports = handler;
module.exports.extractPdfText = extractPdfText;
