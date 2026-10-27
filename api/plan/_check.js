/* 予定の重なり・移動時間の警告候補（#72 / #78）
   使い方:
     GET /api/plan/check[?from=YYYY-MM-DD&to=YYYY-MM-DD]  … 既定は今日から14日間
   同期データの予定（＋Googleカレンダーのキャッシュ）を日ごとに並べ、時間の重なりと、
   通学の所要時間（同期の commute 設定、読めなければ約100分）より短い間隔を
   「警告候補」として返す。断定はしない。共有予定（Googleカレンダー由来）は
   shared:true とカレンダー名で区別する（#78）。 */
'use strict';
const { sendJson, checkAppKey } = require('../_fb');
const D = require('../_digest');
const P = require('../_plan');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const q = new URL(req.url || '/', 'http://localhost').searchParams;
    const today = D.ymdJst(Date.now());
    const from = D.isYmd(q.get('from')) ? q.get('from') : today;
    let to = D.isYmd(q.get('to')) ? q.get('to') : D.addDaysYmd(from, 14);
    if (to < from) to = from;
    if (D.diffDays(from, to) > 62) to = D.addDaysYmd(from, 62);
    const data = await D.loadData();
    const extra = await D.loadPart('extra').catch(() => null);
    const gcal = await P.loadGcalItems();
    const occs = P.occurrencesInRange(data, extra, from, to, gcal);
    const commuteMin = P.commuteMinutesOf(data);
    const warnings = P.conflictsForRange(occs, commuteMin);
    return sendJson(res, 200, {
      ok: true, from, to, commuteMin, warnings,
      note: '警告候補です（終わり時刻が無い予定は60分として計算しています）',
    });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
