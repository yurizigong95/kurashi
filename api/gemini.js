/* Gemini API の中継（Vercel版に埋め込んだAPI）
   使い方（アプリ側から）:
     POST /api/gemini
     headers: { 'Content-Type': 'application/json', 'x-kurashi-model': 'gemini-2.5-flash' }
     body: Gemini generateContent にそのまま渡す JSON（{ contents: [...] } など）
   鍵の優先順位:
     1. Vercel の環境変数 GEMINI_API_KEY（サーバー側の鍵。ブラウザには出ません）
     2. リクエストヘッダー x-goog-api-key（端末に保存した自分の鍵を中継だけする）
   どちらも無いときは 501 { code: 'NO_KEY' } を返すので、アプリは従来の直接呼び出しに切り替えられます。
   GET /api/gemini は状態確認（{ ok, serverKey }）。 */
'use strict';
const { sendJson, readBody } = require('./_fb');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method === 'GET') {
    return sendJson(res, 200, { ok: true, serverKey: !!process.env.GEMINI_API_KEY });
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });

  const body = await readBody(req);
  const model = (body && body.model) || req.headers['x-kurashi-model'] || 'gemini-2.5-flash';
  const key = process.env.GEMINI_API_KEY || req.headers['x-goog-api-key'] || '';
  if (!key) return sendJson(res, 501, { error: 'サーバーにも端末にも Gemini の鍵がありません', code: 'NO_KEY' });

  const payload = Object.assign({}, body);
  delete payload.model;
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    res.statusCode = r.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(text);
  } catch (e) {
    sendJson(res, 502, { error: 'Gemini へ届きませんでした: ' + e.message });
  }
};
