/* エラーログ集約（#20）
   使い方（アプリ側から）:
     POST /api/log  body { level, msg, ctx } … 1件追記して { ok, count } を返す
     GET  /api/log                          … 直近50件（新しい順）を返す
   Firestore の LOG_DOC に { entries: JSON文字列(配列・古い順), updatedAt } として保存します。
   上限は120件で、超えたら古い方から捨てます。 */
'use strict';
const { sendJson, readBody, fsGetDoc, fsSetDoc, checkAppKey, LOG_DOC } = require('./_fb');

const MAX_ENTRIES = 120;
const GET_LIMIT = 50;

async function loadEntries() {
  const doc = await fsGetDoc(LOG_DOC);
  if (!doc || !doc.entries) return [];
  try {
    const arr = JSON.parse(doc.entries);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

/* ctx は任意の JSON。文字列化できないもの（循環参照など）は String() で代用 */
function ctxToString(ctx) {
  if (ctx === undefined || ctx === null) return '';
  let s;
  try { s = typeof ctx === 'string' ? ctx : JSON.stringify(ctx); } catch (e) { s = String(ctx); }
  return String(s === undefined ? '' : s).slice(0, 1000);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });

  if (req.method === 'GET') {
    try {
      const entries = await loadEntries();
      return sendJson(res, 200, { ok: true, entries: entries.slice(-GET_LIMIT).reverse() });
    } catch (e) {
      return sendJson(res, 500, { error: String((e && e.message) || e) });
    }
  }

  if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });

  const body = await readBody(req);
  const entry = {
    at: new Date().toISOString(),
    level: String(body.level || 'error').slice(0, 20),
    msg: String(body.msg === undefined || body.msg === null ? '' : body.msg).slice(0, 1000),
    ctx: ctxToString(body.ctx),
  };
  try {
    const entries = await loadEntries();
    entries.push(entry);
    while (entries.length > MAX_ENTRIES) entries.shift();
    await fsSetDoc(LOG_DOC, { entries: JSON.stringify(entries), updatedAt: new Date().toISOString() });
    return sendJson(res, 200, { ok: true, count: entries.length });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
