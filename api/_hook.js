/* Webhook 受け口（#19）
   使い方:
     POST /api/hook?src=<name>  … 外部サービスからの通知を受信箱に1件追記して { ok } を返す
     GET  /api/hook[?src=<name>] … 直近分（新しい順・最大50件）を返す。src で絞り込み可
   Firestore の INBOX_DOC に { entries: JSON文字列(配列・古い順), updatedAt } として保存します。
   上限は50件で、超えたら古い方から捨てます。
   POST には checkAppKey（合言葉）を適用しません。外部サービスの Webhook は任意のヘッダー
   x-app-key を付けて送れないことが多く、合言葉を必須にすると受け取れなくなるためです。
   その代わり、1件の大きさを制限し、件数上限で古いものから押し出します。
   GET（受信箱の中身の読み出し）はアプリから呼ぶものなので、合言葉を確認します。 */
'use strict';
const { sendJson, readBody, fsGetDoc, fsSetDoc, checkAppKey, INBOX_DOC } = require('./_fb');

const MAX_ENTRIES = 50;
const MAX_BODY_CHARS = 8000; // 1件あたり。文書全体が Firestore の上限（1MB）を超えないように

async function loadEntries() {
  const doc = await fsGetDoc(INBOX_DOC);
  if (!doc || !doc.entries) return [];
  try {
    const arr = JSON.parse(doc.entries);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function normalizeSrc(s) {
  s = String(s || '');
  return /^[A-Za-z0-9_-]{1,40}$/.test(s) ? s : 'unknown';
}

/* 本文の取得。Vercel が JSON 以外を文字列や Buffer で渡してきた場合は { raw } として扱い、
   それ以外（ストリームからの読み取りと JSON 解釈）は readBody に任せる */
async function readHookBody(req) {
  if (typeof req.body === 'string') return req.body ? { raw: req.body } : {};
  if (Buffer.isBuffer(req.body)) return req.body.length ? { raw: req.body.toString('utf8') } : {};
  return readBody(req);
}

function limitBody(body) {
  let s;
  try { s = JSON.stringify(body); } catch (e) { return { raw: String(body).slice(0, MAX_BODY_CHARS), truncated: true }; }
  if (s === undefined) return {};
  if (s.length <= MAX_BODY_CHARS) return body;
  return { raw: s.slice(0, MAX_BODY_CHARS), truncated: true };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  const q = new URL(req.url || '/', 'http://localhost').searchParams;

  if (req.method === 'GET') {
    if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
    try {
      let entries = await loadEntries();
      if (q.get('src')) {
        const src = normalizeSrc(q.get('src'));
        entries = entries.filter((e) => e && e.src === src);
      }
      return sendJson(res, 200, { ok: true, entries: entries.slice(-MAX_ENTRIES).reverse() });
    } catch (e) {
      return sendJson(res, 500, { error: String((e && e.message) || e) });
    }
  }

  if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });

  const body = await readHookBody(req);
  const entry = { at: new Date().toISOString(), src: normalizeSrc(q.get('src')), body: limitBody(body) };
  try {
    const entries = await loadEntries();
    entries.push(entry);
    while (entries.length > MAX_ENTRIES) entries.shift();
    await fsSetDoc(INBOX_DOC, { entries: JSON.stringify(entries), updatedAt: new Date().toISOString() });
    return sendJson(res, 200, { ok: true });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
