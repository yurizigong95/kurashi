/* 直近の予定・締切の軽量JSON（#80）
   使い方:
     GET /api/plan/next[?limit=10]  … 今日から60日以内の予定・試験・課題の締切・記念日を
                                      日付順に返す（ウィジェット等が叩く想定の軽い形） */
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
    const limit = Number(q.get('limit')) || 10;
    const data = await D.loadData();
    const extra = await D.loadPart('extra').catch(() => null);
    const gcal = await P.loadGcalItems();
    const items = P.nextItems(data, extra, D.ymdJst(Date.now()), limit, gcal);
    return sendJson(res, 200, { ok: true, items });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
