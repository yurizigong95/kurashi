/* Googleカレンダーの読み取り結果の受け口＋キャッシュ配信（#71）
   使い方:
     POST /api/calendar  … GAS の gcalList_ の結果 { from, to, items } を受けて保存する
     GET  /api/calendar  … 保存済みの結果をそのまま返す（updatedAt と stale つき）
   結論（根拠）: GAS のカレンダー読み取り（CalendarApp）は、利用者本人の Google
   アカウントの権限で動いている。Vercel 側にはその OAuth 資格情報が無く、サーバーが
   本人に代わってカレンダーを読むことはできない（無理に認証を実装しない）。
   代わりに、GAS（またはアプリ）が一度読んだ結果をここへ預けておき、アプリや
   サーバー内のほかの処理はこのキャッシュを読むことで、GAS を叩く回数を減らして
   高速化する。キャッシュは Firestore の「部屋ID__gcal_v1」に置く。
   予定の中身（個人情報）なので、合言葉（checkAppKey）設定時は GET・POST とも必須。 */
'use strict';
const { sendJson, readBody, checkAppKey, GCAL_DOC, fsGetDoc, fsSetDoc } = require('./_fb');

const MAX_ITEMS = 300;
function capStr(v, n) { return String(v == null ? '' : v).slice(0, n); }
function normalizeItem(g) {
  if (!g || typeof g !== 'object') return null;
  return {
    id: capStr(g.id, 120), title: capStr(g.title, 120), cal: capStr(g.cal, 60),
    allDay: g.allDay ? 1 : 0,
    start: capStr(g.start, 20), end: capStr(g.end, 20), where: capStr(g.where, 120),
  };
}
async function loadCache() {
  const doc = await fsGetDoc(GCAL_DOC);
  if (!doc) return null;
  let items = doc.items;
  if (typeof items === 'string') { try { items = JSON.parse(items); } catch (e) { items = []; } }
  return {
    items: Array.isArray(items) ? items : [],
    from: doc.from || '', to: doc.to || '', updatedAt: doc.updatedAt || '',
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    if (req.method === 'GET') {
      const cache = await loadCache();
      if (!cache) return sendJson(res, 200, { ok: true, empty: true, items: [] });
      const ageMs = cache.updatedAt ? Date.now() - Date.parse(cache.updatedAt) : Infinity;
      return sendJson(res, 200, {
        ok: true, items: cache.items, from: cache.from, to: cache.to,
        updatedAt: cache.updatedAt, stale: !(ageMs < 24 * 60 * 60 * 1000),
      });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST only' });
    const body = await readBody(req);
    if (!body || !Array.isArray(body.items)) {
      return sendJson(res, 400, { error: 'items（配列）が必要です' });
    }
    const items = body.items.slice(0, MAX_ITEMS).map(normalizeItem).filter(Boolean);
    const updatedAt = new Date().toISOString();
    await fsSetDoc(GCAL_DOC, {
      items: JSON.stringify(items),
      from: capStr(body.from, 10), to: capStr(body.to, 10), updatedAt,
    });
    return sendJson(res, 200, { ok: true, count: items.length, updatedAt });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
module.exports.loadCache = loadCache;
