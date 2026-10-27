/* 写真の重複検知（#147）
   使い方:
     POST /api/photo/hash  { hash } … 初めてなら登録して { ok, duplicate:false }、
                                      登録済みなら { ok, duplicate:true, firstAt } を返す
     GET  /api/photo/hash  … { ok, count }（登録済みの指紋の数）
   写真そのものは送らない。端末側で計算した指紋（hash 文字列）だけを台帳に残す軽量な仕組み。
   保存先は「部屋ID__photohash_v1」の items（JSON文字列の配列 [{ h, at }]、最大2000件）。 */
'use strict';
const { sendJson, readBody, checkAppKey, fsGetDoc, fsSetDoc, PHOTOHASH_DOC } = require('../_fb');

const MAX_ITEMS = 2000;
const HASH_RE = /^[A-Za-z0-9_-]{8,128}$/;

async function loadItems() {
  try {
    const doc = await fsGetDoc(PHOTOHASH_DOC);
    if (!doc || !doc.items) return [];
    const arr = JSON.parse(doc.items);
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x === 'object' && x.h) : [];
  } catch (e) { return []; }
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    if (req.method === 'GET') {
      const items = await loadItems();
      return sendJson(res, 200, { ok: true, count: items.length });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    const hash = String((body && body.hash) || '');
    if (!HASH_RE.test(hash)) return sendJson(res, 400, { error: 'hash（8〜128文字の英数字・_・-）が必要です' });
    const items = await loadItems();
    const found = items.filter((x) => x.h === hash)[0];
    if (found) return sendJson(res, 200, { ok: true, duplicate: true, firstAt: found.at || '' });
    items.push({ h: hash, at: new Date().toISOString() });
    while (items.length > MAX_ITEMS) items.shift();
    await fsSetDoc(PHOTOHASH_DOC, { items: JSON.stringify(items), updatedAt: new Date().toISOString() });
    return sendJson(res, 200, { ok: true, duplicate: false, count: items.length });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.loadItems = loadItems;
