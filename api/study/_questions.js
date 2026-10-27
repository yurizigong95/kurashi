/* 国家試験対策モードの問題セット配信（#197）
   使い方:
     GET /api/study/questions … 設定doc（部屋ID__config_v1）の examSets に入っている問題セットを返す
                                 { ok, sets:[{ id, title, items:[...] }] }
   - 問題データの用意はアプリの外（管理側）で行う想定で、この受け口は「配信」だけをする。
     examSets の形: { sets: [ { id, title, items: [もんだいメーカーの gItem と同じ形] } ] }
     または配列そのものでもよい。
   - 入っていなければ { ok:true, empty:true, sets:[] } を返す（問題があるふりはしない）。 */
'use strict';
const { sendJson, checkAppKey, fsGetDoc, CONFIG_DOC } = require('../_fb');

async function loadExamSets() {
  try {
    const doc = await fsGetDoc(CONFIG_DOC);
    if (!doc || !doc.examSets) return [];
    const v = typeof doc.examSets === 'string' ? JSON.parse(doc.examSets) : doc.examSets;
    const sets = Array.isArray(v) ? v : (v && Array.isArray(v.sets) ? v.sets : []);
    return sets.filter((s) => s && typeof s === 'object' && Array.isArray(s.items));
  } catch (e) { return []; }
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const sets = await loadExamSets();
    if (!sets.length) {
      return sendJson(res, 200, { ok: true, empty: true, sets: [], note: '問題セットはまだ入っていません（設定docの examSets に入れると配信されます）' });
    }
    return sendJson(res, 200, {
      ok: true,
      sets: sets.map((s) => ({ id: String(s.id || ''), title: String(s.title || '問題セット'), items: s.items })),
    });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.loadExamSets = loadExamSets;
