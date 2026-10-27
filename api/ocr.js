/* 写真の文字起こし OCR（#146）
   使い方:
     POST /api/ocr  { imageBase64, mime } … { ok, source:'ai', model, text }
       imageBase64 は 'data:image/...;base64,...' 形式でもよい（mime は中身から読む）。
   - Gemini の視覚入力で読み取る。プロンプトは api/_prompts.js の ocr。
   - 対応形式: image/jpeg・image/png・image/webp・image/heic・image/heif・image/gif。
   - 大きさの上限: デコード後 4MB まで（Vercel の関数の本文上限 約4.5MB のため）。
   - 鍵が無い・失敗したときは { ok:false, reason } を返す。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('./_fb');
const AI = require('./_ai');
const { PROMPTS } = require('./_prompts');

const MAX_BYTES = 4 * 1024 * 1024;
const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];

function parseImage(body) {
  const b = body && typeof body === 'object' ? body : {};
  let data = typeof b.imageBase64 === 'string' ? b.imageBase64.trim()
    : (typeof b.base64 === 'string' ? b.base64.trim() : '');
  let mime = String(b.mime || '').toLowerCase();
  const m = data.match(/^data:([^;,]+)?(;[^,]*)?,/i);
  if (m) {
    if (!mime && m[1]) mime = m[1].toLowerCase();
    data = data.slice(m[0].length);
  }
  if (!data) return { error: 'imageBase64 が必要です', status: 400 };
  if (MIMES.indexOf(mime) < 0) return { error: '対応していない画像形式です（' + (mime || '不明') + '）', status: 415 };
  if (Math.floor(data.length * 3 / 4) > MAX_BYTES + 3) return { error: '画像が大きすぎます（4MBまで）', status: 413 };
  return { data, mime };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const img = parseImage(await readBody(req));
    if (img.error) return sendJson(res, img.status, { error: img.error });
    const prompt = (PROMPTS.ocr && PROMPTS.ocr.body) || 'この画像に写っている文字を正確に書き起こしてください。';
    const r = await AI.generateParts(
      [{ text: prompt }, { inlineData: { mimeType: img.mime, data: img.data } }],
      { task: 'light' }
    );
    if (!r.ok) return sendJson(res, 200, { ok: false, source: 'none', reason: r.reason || '', text: '' });
    return sendJson(res, 200, { ok: true, source: 'ai', model: r.model, text: r.text });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.parseImage = parseImage;
module.exports.MIMES = MIMES;
